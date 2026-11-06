/**
 * extractColors.js
 * Extracts the dominant colors from an image element using HTML5 Canvas API.
 * Uses a pixel-sampling + bucket-grouping approach (no external library).
 */

/**
 * Convert RGB to HEX string
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Get color bucket key by rounding to nearest 32 to cluster similar colors
 */
function getBucketKey(r, g, b, precision = 32) {
  const rB = Math.round(r / precision) * precision;
  const gB = Math.round(g / precision) * precision;
  const bB = Math.round(b / precision) * precision;
  return `${rB},${gB},${bB}`;
}

/**
 * Extract top N dominant colors from an img element
 * @param {HTMLImageElement} imgEl - The image element
 * @param {number} topN - How many colors to return (default 5)
 * @param {number} sampleStep - Every Nth pixel to sample (higher = faster, default 10)
 * @returns {string[]} Array of hex color strings, sorted by dominance
 */
export function extractColors(imgEl, topN = 5, sampleStep = 10) {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Draw at reduced size for performance
    const size = 100;
    canvas.width = size;
    canvas.height = size;

    ctx.drawImage(imgEl, 0, 0, size, size);

    const { data } = ctx.getImageData(0, 0, size, size);
    const colorMap = {};

    for (let i = 0; i < data.length; i += 4 * sampleStep) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Skip transparent or near-white and near-black pixels
      if (a < 128) continue;
      const brightness = (r + g + b) / 3;
      if (brightness > 240 || brightness < 15) continue;

      const key = getBucketKey(r, g, b);
      if (!colorMap[key]) {
        colorMap[key] = { count: 0, r: 0, g: 0, b: 0 };
      }
      colorMap[key].count++;
      colorMap[key].r += r;
      colorMap[key].g += g;
      colorMap[key].b += b;
    }

    // Sort by frequency and return top N
    const sorted = Object.values(colorMap).sort((a, b) => b.count - a.count);
    return sorted.slice(0, topN).map((c) => {
      const avgR = Math.round(c.r / c.count);
      const avgG = Math.round(c.g / c.count);
      const avgB = Math.round(c.b / c.count);
      return rgbToHex(avgR, avgG, avgB);
    });
  } catch (e) {
    // Canvas may be tainted by CORS - return empty array gracefully
    console.warn('Color extraction failed (possibly CORS-tainted canvas):', e.message);
    return [];
  }
}
