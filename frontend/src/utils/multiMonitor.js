/**
 * Work out which part of an image each monitor should show when the image spans
 * a whole multi-monitor layout. Pure logic, so it can be tested without a browser.
 *
 * A monitor is { width, height, x, y } in pixels, positioned as in the operating
 * system's display settings. The image covers the layout's bounding box, centered
 * and scaled without distortion, like background-size: cover.
 */
export const layoutBounds = (monitors) => {
  const left = Math.min(...monitors.map((m) => m.x));
  const top = Math.min(...monitors.map((m) => m.y));
  const right = Math.max(...monitors.map((m) => m.x + m.width));
  const bottom = Math.max(...monitors.map((m) => m.y + m.height));
  return { left, top, width: right - left, height: bottom - top };
};

export const validateLayout = (monitors) => {
  if (!monitors.length) return 'Add at least one monitor.';
  for (const [index, monitor] of monitors.entries()) {
    const values = [monitor.width, monitor.height, monitor.x, monitor.y];
    if (values.some((value) => !Number.isFinite(value))) return `Monitor ${index + 1} needs numbers for its size and position.`;
    if (monitor.width < 1 || monitor.height < 1) return `Monitor ${index + 1} must have a positive size.`;
    if (monitor.width > 16384 || monitor.height > 16384) return `Monitor ${index + 1} is too large.`;
  }
  for (let a = 0; a < monitors.length; a += 1) {
    for (let b = a + 1; b < monitors.length; b += 1) {
      const first = monitors[a];
      const second = monitors[b];
      const overlaps = first.x < second.x + second.width && second.x < first.x + first.width
        && first.y < second.y + second.height && second.y < first.y + first.height;
      if (overlaps) return `Monitors ${a + 1} and ${b + 1} overlap.`;
    }
  }
  return null;
};

/** Source rectangle in the image, in image pixels, for every monitor. */
export const computeMonitorCrops = (monitors, imageWidth, imageHeight) => {
  const bounds = layoutBounds(monitors);
  const scale = Math.max(bounds.width / imageWidth, bounds.height / imageHeight);
  const visibleWidth = bounds.width / scale;
  const visibleHeight = bounds.height / scale;
  const offsetX = (imageWidth - visibleWidth) / 2;
  const offsetY = (imageHeight - visibleHeight) / 2;

  return monitors.map((monitor) => ({
    sx: offsetX + (monitor.x - bounds.left) / scale,
    sy: offsetY + (monitor.y - bounds.top) / scale,
    sWidth: monitor.width / scale,
    sHeight: monitor.height / scale,
    width: monitor.width,
    height: monitor.height
  }));
};

export const PRESETS = [
  { label: 'Two 1080p side by side', monitors: [{ width: 1920, height: 1080, x: 0, y: 0 }, { width: 1920, height: 1080, x: 1920, y: 0 }] },
  { label: 'Three 1080p side by side', monitors: [{ width: 1920, height: 1080, x: 0, y: 0 }, { width: 1920, height: 1080, x: 1920, y: 0 }, { width: 1920, height: 1080, x: 3840, y: 0 }] },
  { label: '1440p with a 1080p portrait', monitors: [{ width: 2560, height: 1440, x: 0, y: 0 }, { width: 1080, height: 1920, x: 2560, y: -240 }] },
  { label: 'Two stacked 1080p', monitors: [{ width: 1920, height: 1080, x: 0, y: 0 }, { width: 1920, height: 1080, x: 0, y: 1080 }] }
];
