/**
 * Choose the version of a wallpaper that best fits a screen: the closest shape,
 * preferring the right light or dark version. Variants without a known size are
 * judged by their label. Falls back to the original image.
 */
const LABEL_RATIOS = { desktop: 16 / 9, mobile: 9 / 19.5, tablet: 4 / 3, ultrawide: 21 / 9 };

export const pickBestVariant = (wallpaper, screenWidth, screenHeight, theme = null) => {
  const target = screenWidth / screenHeight;
  const original = {
    label: 'original',
    imageUrl: wallpaper.imageUrl,
    ratio: wallpaper.width && wallpaper.height ? wallpaper.width / wallpaper.height : null
  };

  const options = (wallpaper.variants || []).map((variant) => ({
    label: variant.label,
    imageUrl: variant.imageUrl,
    ratio: variant.width && variant.height ? variant.width / variant.height : LABEL_RATIOS[variant.label] ?? null
  }));

  const score = (option) => {
    const shape = option.ratio ? Math.abs(Math.log(option.ratio / target)) : 0.5;
    const themeBonus = theme && option.label === theme ? 0.25 : 0;
    return shape - themeBonus;
  };

  return [original, ...options].reduce((best, option) => (score(option) < score(best) ? option : best));
};
