const { Queue } = require('bullmq');
const Redis = require('ioredis');
const EventEmitter = require('events');

// Pluggable configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
let useRedis = false;
let redisConnection = null;
let imageQueue = null;

// Simple in-memory fallback queue class
class LocalInMemoryQueue extends EventEmitter {
  constructor() {
    super();
    this.jobs = [];
    this.processing = false;
  }

  async add(name, data) {
    const job = { id: Date.now().toString() + Math.random().toString().substring(2, 5), name, data };
    this.jobs.push(job);
    this.emit('added', job);
    this.processQueue();
    return job;
  }

  async processQueue() {
    if (this.processing || this.jobs.length === 0) return;
    this.processing = true;
    const job = this.jobs.shift();
    try {
      if (this.processor) {
        await this.processor(job);
      }
    } catch (err) {
      console.error('In-memory job processing failed:', err);
    }
    this.processing = false;
    // Process next item
    setTimeout(() => this.processQueue(), 100);
  }

  setProcessor(fn) {
    this.processor = fn;
  }
}

const localQueue = new LocalInMemoryQueue();

// Check Redis availability
try {
  const hasRedisConfig = process.env.USE_REDIS === 'true' && process.env.NODE_ENV !== 'test';
  if (hasRedisConfig) {
    redisConnection = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      connectTimeout: 3000,
    });
    
    redisConnection.on('error', (err) => {
      console.warn('Redis connection failed. Falling back to in-memory worker queue.');
      useRedis = false;
    });

    redisConnection.on('connect', () => {
      console.log('Successfully connected to Redis. Initializing BullMQ image queue.');
      useRedis = true;
    });

    imageQueue = new Queue('image-processing', { connection: redisConnection });
  } else {
    console.log('No REDIS_URL variable detected. Using in-memory fallback queue.');
  }
} catch (e) {
  console.warn('Could not initialize Redis client. Using in-memory fallback queue.');
}

const enqueueImageProcess = async (data) => {
  if (useRedis && imageQueue) {
    try {
      const job = await imageQueue.add('optimize-image', data, {
        attempts: 3,
        backoff: 5000,
      });
      console.log(`Enqueued job ${job.id} to BullMQ for wallpaper processing.`);
      return job;
    } catch (err) {
      console.warn('Failed to enqueue to BullMQ. Falling back to in-memory queue:', err.message);
      return await localQueue.add('optimize-image', data);
    }
  } else {
    console.log('Enqueued wallpaper process job to local in-memory worker.');
    return await localQueue.add('optimize-image', data);
  }
};

module.exports = {
  enqueueImageProcess,
  localQueue,
  redisConnection,
  getUseRedis: () => useRedis
};
