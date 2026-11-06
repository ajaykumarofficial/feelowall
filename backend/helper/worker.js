const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const cloudinary = require('./cloudinary');
const { Wallpaper } = require('../databaseModels');
const { localQueue, getUseRedis, redisConnection } = require('./queue');
const { Worker } = require('bullmq');

// Helper to convert RGB to HEX
const rgbToHex = (r, g, b) => {
  const toHex = (c) => {
    const hex = c.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return '#' + toHex(r) + toHex(g) + toHex(b);
};

// Helper to calculate color distance
const colorDistance = (c1, c2) => {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
};

// Dominant color extraction using Sharp resizing
const extractDominantColors = async (imageBufferOrPath) => {
  try {
    const { data, info } = await sharp(imageBufferOrPath)
      .resize(8, 8, { fit: 'cover' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = [];
    const channels = info.channels;

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      pixels.push({ r, g, b, hex: rgbToHex(r, g, b) });
    }

    const distinctColors = [];
    const minDistance = 50;

    for (const pixel of pixels) {
      let isDistinct = true;
      for (const existing of distinctColors) {
        if (colorDistance(pixel, existing) < minDistance) {
          isDistinct = false;
          break;
        }
      }
      if (isDistinct) {
        distinctColors.push(pixel);
      }
      if (distinctColors.length >= 5) {
        break;
      }
    }

    while (distinctColors.length < 5 && distinctColors.length < pixels.length) {
      const nextPixel = pixels.find(p => !distinctColors.some(d => d.hex === p.hex));
      if (!nextPixel) break;
      distinctColors.push(nextPixel);
    }

    return distinctColors;
  } catch (error) {
    console.error('Error extracting colors on server-side:', error);
    return [];
  }
};

// Helper to download an image locally using https/http standard modules
const downloadImage = (url, destPath) => {
  const https = require('https');
  const http = require('http');
  const fs = require('fs');
  const client = url.startsWith('https') ? https : http;

  return new Promise((resolve, reject) => {
    client.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download image: ${response.statusCode}`));
        return;
      }
      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
};

// Main processing worker function
const processImageJob = async (jobData) => {
  const { wpId, filePath, isCloudinary, originalFilename, imageUrl } = jobData;
  console.log(`[Worker] Started processing wallpaper ID: ${wpId}`);

  let activePath = filePath;
  let tempDownloadPath = '';

  try {
    if (isCloudinary) {
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      tempDownloadPath = path.join(uploadsDir, `temp-${Date.now()}-${originalFilename}`);
      console.log(`[Worker] Downloading original from url: ${imageUrl}`);
      await downloadImage(imageUrl, tempDownloadPath);
      activePath = tempDownloadPath;
    }

    if (!fs.existsSync(activePath)) {
      console.error(`[Worker] File not found at path: ${activePath}`);
      return;
    }

    // 1. Convert & Optimize Image to WebP
    const webpBuffer = await sharp(activePath)
      .webp({ quality: 80 })
      .toBuffer();

    // 2. Extract Dominant Colors
    const extractedColors = await extractDominantColors(webpBuffer);
    console.log(`[Worker] Extracted dominant colors:`, extractedColors.map(c => c.hex));

    let finalImageUrl = '';
    let finalFilename = '';

    // 3. Save/Upload WebP file
    if (isCloudinary) {
      const tempWebpPath = activePath + '.webp';
      fs.writeFileSync(tempWebpPath, webpBuffer);

      if (cloudinary.isConfigured()) {
        const uploadResult = await cloudinary.uploadToCloudinary(tempWebpPath);
        finalImageUrl = uploadResult.secure_url;
        finalFilename = uploadResult.public_id;
        
        // Clean up files
        if (fs.existsSync(activePath)) fs.unlinkSync(activePath);
        if (fs.existsSync(tempWebpPath)) fs.unlinkSync(tempWebpPath);
        
        // Delete original upload from Cloudinary
        if (originalFilename) {
          try {
            await cloudinary.deleteFromCloudinary(originalFilename);
          } catch (delErr) {
            console.warn(`[Worker] Failed to delete original file ${originalFilename}:`, delErr.message);
          }
        }
      }
    } else {
      const dir = path.dirname(activePath);
      const ext = path.extname(activePath);
      const baseName = path.basename(activePath, ext);
      const webpFileName = `${baseName}.webp`;
      const webpPath = path.join(dir, webpFileName);

      fs.writeFileSync(webpPath, webpBuffer);
      finalImageUrl = `/uploads/${webpFileName}`;
      finalFilename = webpFileName;

      // Clean up original raw file
      if (fs.existsSync(activePath)) {
        fs.unlinkSync(activePath);
      }
    }

    // 4. Update database
    await Wallpaper.updateOne(
      { _id: wpId },
      {
        $set: {
          imageUrl: finalImageUrl,
          filename: finalFilename,
          colors: extractedColors
        }
      }
    );

    console.log(`[Worker] Successfully processed and optimized wallpaper ${wpId}!`);
  } catch (err) {
    console.error(`[Worker] Failed processing wallpaper ${wpId}:`, err);
    // Cleanup on failure
    if (tempDownloadPath && fs.existsSync(tempDownloadPath)) {
      try { fs.unlinkSync(tempDownloadPath); } catch (_) {}
    }
    throw err;
  }
};

// Register in-memory fallback processor
localQueue.setProcessor(async (job) => {
  console.log(`[Local Worker] Processing job ${job.id}...`);
  await processImageJob(job.data);
});

// Register Redis Worker if active
if (getUseRedis() && redisConnection) {
  const worker = new Worker('image-processing', async (job) => {
    console.log(`[BullMQ Worker] Processing job ${job.id}...`);
    await processImageJob(job.data);
  }, { connection: redisConnection });

  worker.on('completed', (job) => {
    console.log(`[BullMQ Worker] Job ${job.id} has completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ Worker] Job ${job.id} failed with error:`, err);
  });
}

module.exports = {
  processImageJob
};
