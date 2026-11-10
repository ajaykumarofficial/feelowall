const sharp = require('sharp');

/**
 * 64-bit difference hash. Shrinks the image to a 9x8 grayscale grid and records
 * whether each pixel is brighter than its right-hand neighbour, so resized or
 * re-compressed copies of an image produce nearly the same hash.
 */
const computeDHash = async (input) => {
  const { data } = await sharp(input)
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = '';
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      bits += data[row * 9 + col] > data[row * 9 + col + 1] ? '1' : '0';
    }
  }
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
};

const hammingDistance = (hashA, hashB) => {
  let diff = BigInt(`0x${hashA}`) ^ BigInt(`0x${hashB}`);
  let count = 0;
  while (diff > 0n) {
    count += Number(diff & 1n);
    diff >>= 1n;
  }
  return count;
};

/** Up to this many differing bits (of 64) counts as the same picture. */
const DUPLICATE_THRESHOLD = 5;

/**
 * Find an earlier wallpaper with a near-identical hash. Blank or solid images
 * hash to all zeros, so they are skipped rather than matched with each other.
 */
const findDuplicate = async (Wallpaper, wallpaperId, hash) => {
  if (/^0+$/.test(hash)) return null;
  const candidates = await Wallpaper.find({
    _id: { $ne: wallpaperId },
    perceptualHash: { $ne: null },
    status: { $ne: 'removed' }
  }).select('perceptualHash uploadedById').sort({ uploadedAt: 1 }).lean();

  return candidates.find((candidate) => hammingDistance(hash, candidate.perceptualHash) <= DUPLICATE_THRESHOLD) || null;
};

const describeDimensions = (width, height) => {
  if (!width || !height) return {};
  const aspectRatio = Math.round((width / height) * 1000) / 1000;
  let orientation = 'square';
  if (aspectRatio > 1.05) orientation = 'landscape';
  else if (aspectRatio < 0.95) orientation = 'portrait';
  return { width, height, aspectRatio, orientation };
};

module.exports = { computeDHash, hammingDistance, findDuplicate, describeDimensions, DUPLICATE_THRESHOLD };
