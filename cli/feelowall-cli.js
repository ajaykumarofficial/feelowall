#!/usr/bin/env node

/**
 * FeeloWall Desktop Sync Client (CLI)
 * 
 * Usage:
 *   node feelowall-cli.js login <api_url> <username> <password>
 *   node feelowall-cli.js sync
 *   node feelowall-cli.js rotate <interval_minutes>
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const https = require('https');
const http = require('http');

const CONFIG_FILE = path.join(os.homedir(), '.feelowall-config.json');

const loadConfig = () => {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error('Error: Client not configured. Run "login" first:');
    console.error('  node feelowall-cli.js login <api_url> <username> <password>');
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (err) {
    console.error('Error reading configuration file:', err.message);
    process.exit(1);
  }
};

const saveConfig = (config) => {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving configuration file:', err.message);
  }
};

const makeRequest = (url, method, headers = {}, body = null) => {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          if (!data) {
            resolve({});
            return;
          }
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(parsed.message || `Request failed with status ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          if (res.statusCode >= 400) {
            reject(new Error(`Request failed (status ${res.statusCode}): ${data}`));
          } else {
            resolve(data);
          }
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const downloadImage = (url, destPath) => {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https');
    const client = isHttps ? https : http;
    
    const req = client.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download image: status code ${res.statusCode}`));
        return;
      }
      
      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(destPath);
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
  });
};

const setDesktopWallpaper = (imagePath) => {
  const absolutePath = path.resolve(imagePath);
  const platform = os.platform();

  return new Promise((resolve, reject) => {
    if (platform === 'win32') {
      const psCommand = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Wallpaper { [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni); }'; [Wallpaper]::SystemParametersInfo(20, 0, '${absolutePath}', 3)`;
      const fullCommand = `powershell -NoProfile -Command "${psCommand.replace(/"/g, '\\"')}"`;
      
      exec(fullCommand, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`Windows PowerShell failed: ${stderr || err.message}`));
        } else {
          resolve();
        }
      });
    } else if (platform === 'darwin') {
      const script = `tell application "Finder" to set desktop picture to POSIX file "${absolutePath}"`;
      exec(`osascript -e '${script}'`, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`macOS osascript failed: ${stderr || err.message}`));
        } else {
          resolve();
        }
      });
    } else if (platform === 'linux') {
      // GNOME background setter (works on Ubuntu, Fedora, etc.)
      const command = `gsettings set org.gnome.desktop.background picture-uri "file://${absolutePath}" && gsettings set org.gnome.desktop.background picture-uri-dark "file://${absolutePath}"`;
      exec(command, (err, stdout, stderr) => {
        if (err) {
          // Fallback to feh for window managers
          exec(`feh --bg-scale "${absolutePath}"`, (fehErr) => {
            if (fehErr) {
              reject(new Error(`Linux wallpaper setter failed. Tried gsettings and feh.`));
            } else {
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    } else {
      reject(new Error(`Unsupported platform: ${platform}`));
    }
  });
};

const handleLogin = async (apiUrl, username, password) => {
  console.log(`Authenticating with FeeloWall server at ${apiUrl}...`);
  try {
    const cleanUrl = apiUrl.replace(/\/$/, '');
    const data = await makeRequest(`${cleanUrl}/api/auth/login`, 'POST', {}, { username, password });
    
    saveConfig({
      apiUrl: cleanUrl,
      token: data.token,
      username: data.user.username,
      userId: data.user.id
    });
    
    console.log(`\n===========================================`);
    console.log(`🚀 Authentication successful!`);
    console.log(`Logged in as: ${data.user.username}`);
    console.log(`Configuration saved to: ${CONFIG_FILE}`);
    console.log(`===========================================`);
  } catch (err) {
    console.error(`Login failed:`, err.message);
    process.exit(1);
  }
};

const handleSync = async () => {
  let config;
  try {
    config = loadConfig();
  } catch (e) {
    return;
  }
  console.log(`Syncing favorites for ${config.username}...`);
  
  try {
    // 1. Fetch all wallpapers
    const exploreData = await makeRequest(
      `${config.apiUrl}/api/wallpapers`, 
      'GET', 
      { 'Authorization': `Bearer ${config.token}` }
    );
    
    // Filter by liked by user
    const likedWallpapers = exploreData.wallpapers.filter(
      wp => wp.likes && wp.likes.includes(config.userId)
    );
    
    if (likedWallpapers.length === 0) {
      console.log('You do not have any liked wallpapers yet. Go like some wallpapers on FeeloWall!');
      return;
    }
    
    // Choose a random favorite wallpaper
    const randomWp = likedWallpapers[Math.floor(Math.random() * likedWallpapers.length)];
    console.log(`\nSelected Wallpaper: "${randomWp.title}" by ${randomWp.uploadedBy}`);
    
    // Build download URL
    const fullImgUrl = randomWp.imageUrl.startsWith('/uploads')
      ? `${config.apiUrl}${randomWp.imageUrl}`
      : randomWp.imageUrl;
      
    // Local path to save wallpaper
    const tmpDir = path.join(os.tmpdir(), 'feelowall');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    const ext = path.extname(randomWp.filename) || '.jpg';
    const localPath = path.join(tmpDir, `current_wallpaper${ext}`);
    
    console.log(`Downloading wallpaper to local storage...`);
    await downloadImage(fullImgUrl, localPath);
    
    console.log(`Setting system wallpaper...`);
    await setDesktopWallpaper(localPath);
    
    console.log(`🎉 Desktop wallpaper updated successfully!`);
    
    // Send a view analytics event
    try {
      await makeRequest(`${config.apiUrl}/api/wallpapers/${randomWp._id || randomWp.id}/view`, 'POST');
    } catch (_) {}
    
  } catch (err) {
    console.error(`Sync failed:`, err.message);
  }
};

const handleRotate = (intervalMinutes) => {
  const mins = parseInt(intervalMinutes) || 60;
  console.log(`Starting FeeloWall rotation daemon. Wallpaper will rotate every ${mins} minutes.`);
  console.log(`Press Ctrl+C to terminate the daemon.`);
  
  // Do initial sync
  handleSync();
  
  // Schedule rotation
  setInterval(handleSync, mins * 60 * 1000);
};

// Main entrypoint CLI router
const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.log(`
FeeloWall Desktop Background Sync Client
=======================================
Usage:
  node feelowall-cli.js login <api_url> <username> <password>
  node feelowall-cli.js sync
  node feelowall-cli.js rotate <interval_minutes>

Examples:
  node feelowall-cli.js login http://localhost:5000 johndoe secret123
  node feelowall-cli.js sync
  node feelowall-cli.js rotate 30
`);
  process.exit(0);
}

if (command === 'login') {
  const [apiUrl, username, password] = args.slice(1);
  if (!apiUrl || !username || !password) {
    console.error('Error: Missing arguments for login. Usage:');
    console.error('  node feelowall-cli.js login <api_url> <username> <password>');
    process.exit(1);
  }
  handleLogin(apiUrl, username, password);
} else if (command === 'sync') {
  handleSync();
} else if (command === 'rotate') {
  const interval = args[1] || '60';
  handleRotate(interval);
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
