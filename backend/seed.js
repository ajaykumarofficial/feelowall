const mongoose = require('mongoose');
const config = require('./config');
const { hashPassword } = require('./helper/bcrypt');
const { User, Wallpaper, clearDb, closeDb } = require('./databaseModels');

const wallpapersData = [
  {
    title: 'Majestic Mountain Sunset',
    category: 'Nature',
    imageUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
    filename: 'seed-nature-1.jpg',
    colors: [
      { hex: '#ff6b6b', r: 255, g: 107, b: 107 },
      { hex: '#fbc531', r: 251, g: 197, b: 49 },
      { hex: '#482ff7', r: 72, g: 47, b: 247 },
      { hex: '#192a56', r: 25, g: 42, b: 86 }
    ]
  },
  {
    title: 'Sunbeams in Enchanted Forest',
    category: 'Nature',
    imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80',
    filename: 'seed-nature-2.jpg',
    colors: [
      { hex: '#2ed573', r: 46, g: 213, b: 115 },
      { hex: '#ffeaa7', r: 255, g: 234, b: 167 },
      { hex: '#26de81', r: 38, g: 222, b: 129 },
      { hex: '#4b6584', r: 75, g: 101, b: 132 }
    ]
  },
  {
    title: 'Serene Minimalist Coastline',
    category: 'Minimalist',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    filename: 'seed-minimal-1.jpg',
    colors: [
      { hex: '#70a1ff', r: 112, g: 161, b: 255 },
      { hex: '#dfe4ea', r: 223, g: 228, b: 234 },
      { hex: '#f1f2f6', r: 241, g: 242, b: 246 },
      { hex: '#ffa502', r: 255, g: 165, b: 2 }
    ]
  },
  {
    title: 'Nordic Warm Interior Light',
    category: 'Minimalist',
    imageUrl: 'https://images.unsplash.com/photo-1494438639946-1ebd1d2038b5?auto=format&fit=crop&w=1200&q=80',
    filename: 'seed-minimal-2.jpg',
    colors: [
      { hex: '#ffeaa7', r: 255, g: 234, b: 167 },
      { hex: '#ffb8b8', r: 255, g: 184, b: 184 },
      { hex: '#747d8c', r: 116, g: 125, b: 140 },
      { hex: '#2f3542', r: 47, g: 53, b: 66 }
    ]
  },
  {
    title: 'Deep Space Cosmic Network',
    category: 'Space',
    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    filename: 'seed-space-1.jpg',
    colors: [
      { hex: '#0a3d62', r: 10, g: 61, b: 98 },
      { hex: '#82589f', r: 130, g: 88, b: 159 },
      { hex: '#3c6382', r: 60, g: 99, b: 130 },
      { hex: '#079992', r: 7, g: 153, b: 146 }
    ]
  },
  {
    title: 'Starry Sky Galactic Core',
    category: 'Space',
    imageUrl: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&w=1200&q=80',
    filename: 'seed-space-2.jpg',
    colors: [
      { hex: '#0f0c1b', r: 15, g: 12, b: 27 },
      { hex: '#2c3e50', r: 44, g: 62, b: 80 },
      { hex: '#ecf0f1', r: 236, g: 240, b: 241 },
      { hex: '#95a5a6', r: 149, g: 165, b: 166 }
    ]
  },
  {
    title: 'Neon Cyberpunk Alleyways',
    category: 'Anime',
    imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1200&q=80',
    filename: 'seed-anime-1.jpg',
    colors: [
      { hex: '#fd79a8', r: 253, g: 121, b: 168 },
      { hex: '#81ecec', r: 129, g: 236, b: 236 },
      { hex: '#6c5ce7', r: 108, g: 92, b: 231 },
      { hex: '#2d3436', r: 45, g: 52, b: 54 }
    ]
  },
  {
    title: 'Retro Futuristic Cyber-girl',
    category: 'Anime',
    imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=80',
    filename: 'seed-anime-2.jpg',
    colors: [
      { hex: '#e84393', r: 232, g: 67, b: 147 },
      { hex: '#00cec9', r: 0, g: 206, b: 201 },
      { hex: '#6c5ce7', r: 108, g: 92, b: 231 },
      { hex: '#ffeaa7', r: 255, g: 234, b: 167 }
    ]
  },
  {
    title: 'Glass Facade Skyscrapers',
    category: 'Architecture',
    imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    filename: 'seed-arch-1.jpg',
    colors: [
      { hex: '#74b9ff', r: 116, g: 185, b: 255 },
      { hex: '#dfe6e9', r: 223, g: 230, b: 233 },
      { hex: '#b2bec3', r: 178, g: 190, b: 195 },
      { hex: '#2d3436', r: 45, g: 52, b: 54 }
    ]
  },
  {
    title: 'Spiral Geometric Concrete Staircase',
    category: 'Architecture',
    imageUrl: 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1200&q=80',
    filename: 'seed-arch-2.jpg',
    colors: [
      { hex: '#dfe6e9', r: 223, g: 230, b: 233 },
      { hex: '#b2bec3', r: 178, g: 190, b: 195 },
      { hex: '#636e72', r: 99, g: 110, b: 114 },
      { hex: '#2d3436', r: 45, g: 52, b: 54 }
    ]
  }
];

async function seed() {
  try {
    console.log('Connecting to database to seed data...');
    // databaseModels/index.js auto-connects when imported, but we make sure readyState is connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.MONGODB_URI);
    }
    console.log('Connected to MongoDB.');

    // Clear existing data
    await clearDb();
    console.log('Database cleared.');

    // Create demo user
    const passwordHash = await hashPassword('password123');
    const demoUser = new User({
      username: 'demo_user',
      passwordHash
    });
    await demoUser.save();
    console.log(`Demo user created: ${demoUser.username}`);

    // Create wallpapers and seed analytics
    const { DailyAnalytics } = require('./databaseModels');
    
    // We'll generate data for the past 30 days
    const daysToSeed = 30;
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    for (const item of wallpapersData) {
      const wp = new Wallpaper({
        ...item,
        uploadedBy: demoUser.username,
        uploadedById: demoUser._id
      });
      await wp.save();

      let totalViews = 0;
      let totalDownloads = 0;
      let totalLikes = 0;

      // Seed analytics for this wallpaper
      for (let i = 0; i < daysToSeed; i++) {
        const date = new Date(now);
        date.setUTCDate(date.getUTCDate() - i);
        
        // Generate random activity with a realistic weekly pattern (more traffic on weekends)
        const dayOfWeek = date.getUTCDay();
        const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.5 : 1.0;
        
        const baseViews = Math.floor(Math.random() * 20) + 10;
        const views = Math.floor(baseViews * weekendMultiplier);
        // Downloads are typically 20% to 50% of views
        const downloads = Math.floor(views * (0.2 + Math.random() * 0.3));
        // Likes are typically 10% to 40% of downloads
        const likes = Math.floor(downloads * (0.1 + Math.random() * 0.4));

        totalViews += views;
        totalDownloads += downloads;
        totalLikes += likes;

        const dailyRecord = new DailyAnalytics({
          wallpaperId: wp._id,
          creatorId: demoUser._id,
          date,
          views,
          downloads,
          likes
        });
        await dailyRecord.save();
      }

      // Update total counts on the wallpaper to match seeded analytics
      wp.viewsCount = totalViews;
      wp.downloadsCount = totalDownloads;
      wp.likesCount = totalLikes;
      await wp.save();
    }
    console.log(`Successfully seeded ${wallpapersData.length} wallpapers and their 30-day analytics data.`);
    
    // Close connection
    await closeDb();
    console.log('Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
