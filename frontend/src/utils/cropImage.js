/**
 * cropImage.js
 * Center-crops an image to a target aspect ratio and triggers download as PNG.
 * Uses the HTML5 Canvas API — no external libraries.
 */

/**
 * Available crop presets
 */
export const CROP_PRESETS = [
  { label: 'Original', value: 'original', icon: '🖼️' },
  { label: 'Desktop 16:9', value: '16:9', icon: '🖥️', ratio: 16 / 9 },
  { label: 'Mobile 9:16', value: '9:16', icon: '📱', ratio: 9 / 16 },
  { label: 'Square 1:1', value: '1:1', icon: '⬛', ratio: 1 },
  { label: 'Tablet 4:3', value: '4:3', icon: '📟', ratio: 4 / 3 },
  { label: 'Ultrawide 21:9', value: '21:9', icon: '📺', ratio: 21 / 9 },
];

/**
 * Center-crop an image to the target aspect ratio and trigger download.
 * @param {string} imageUrl - Full URL to the image
 * @param {string} fileName - Desired download filename (without extension)
 * @param {number|null} targetRatio - Width/Height ratio. null = original.
 * @param {object} adjustments - CSS filter values to apply: { blur, brightness, contrast, grayscale }
 * @param {Function} onStart - Callback when download starts
 * @param {Function} onSuccess - Callback on success
 * @param {Function} onError - Callback on error
 */
export function cropAndDownload(imageUrl, fileName, targetRatio, adjustments, onStart, onSuccess, onError, cropOffset) {
  onStart?.();

  const img = new Image();
  img.crossOrigin = 'anonymous';

  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;

      if (targetRatio) {
        const imageRatio = img.naturalWidth / img.naturalHeight;

        if (imageRatio > targetRatio) {
          // Image is wider than target: crop width
          sw = Math.round(img.naturalHeight * targetRatio);
          if (cropOffset && typeof cropOffset.x === 'number') {
            sx = Math.round(cropOffset.x * img.naturalWidth);
            sx = Math.max(0, Math.min(img.naturalWidth - sw, sx));
          } else {
            sx = Math.round((img.naturalWidth - sw) / 2);
          }
        } else {
          // Image is taller than target: crop height
          sh = Math.round(img.naturalWidth / targetRatio);
          if (cropOffset && typeof cropOffset.y === 'number') {
            sy = Math.round(cropOffset.y * img.naturalHeight);
            sy = Math.max(0, Math.min(img.naturalHeight - sh, sy));
          } else {
            sy = Math.round((img.naturalHeight - sh) / 2);
          }
        }
      }

      canvas.width = sw;
      canvas.height = sh;

      // Apply image adjustments as canvas filter
      if (adjustments) {
        const { blur = 0, brightness = 100, contrast = 100, grayscale = 0 } = adjustments;
        ctx.filter = `blur(${blur}px) brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%)`;
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            onError?.('Failed to generate image blob.');
            return;
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          a.download = `${fileName}.png`;
          document.body.appendChild(a);
          a.click();
          URL.revokeObjectURL(url);
          document.body.removeChild(a);
          onSuccess?.();
        },
        'image/png'
      );
    } catch (err) {
      onError?.(err.message || 'Canvas crop failed.');
    }
  };

  img.onerror = () => {
    onError?.('Could not load image. It may be CORS-restricted.');
  };

  img.src = imageUrl;
}
