/** Turn a wallpaper's colors into theme files for other apps. */

const toRgb = (hex) => {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match ? match.slice(1).map((part) => parseInt(part, 16)) : [128, 128, 128];
};

const toHex = (rgb) => `#${rgb.map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;

const mix = (hex, target, amount) => {
  const from = toRgb(hex);
  const to = toRgb(target);
  return toHex(from.map((value, index) => value + (to[index] - value) * amount));
};

/** WCAG relative luminance, 0 (black) to 1 (white). */
export const luminance = (hex) => {
  const [r, g, b] = toRgb(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrastRatio = (first, second) => {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

/** Move a color toward white or black until it's readable on the background. */
const ensureReadable = (color, background, minimum = 4.5) => {
  const target = luminance(background) < 0.5 ? '#ffffff' : '#000000';
  let result = color;
  for (let step = 1; step <= 20 && contrastRatio(result, background) < minimum; step += 1) {
    result = mix(color, target, step / 20);
  }
  return result;
};

const normalize = (colors) => {
  const list = colors.map((color) => (typeof color === 'string' ? color : color?.hex)).filter(Boolean);
  return list.length ? list : ['#808080'];
};

/** The darkest color is the base, darkened further if needed, so text stays readable. */
const buildScheme = (colors) => {
  const palette = normalize(colors);
  const sorted = [...palette].sort((a, b) => luminance(a) - luminance(b));
  const background = luminance(sorted[0]) > 0.05 ? mix(sorted[0], '#000000', 0.7) : sorted[0];
  const foreground = ensureReadable(sorted[sorted.length - 1], background, 7);
  const accents = palette.map((color) => ensureReadable(color, background));
  const accent = (index) => accents[index % accents.length];
  return { palette, background, foreground, accent };
};

export const toCssVariables = (colors, title = 'wallpaper') => {
  const palette = normalize(colors);
  const lines = palette.map((color, index) => `  --palette-${index + 1}: ${color};`);
  return `/* Colors from "${title}" on FeeloWall */\n:root {\n${lines.join('\n')}\n}\n`;
};

export const toVSCodeTheme = (colors, title = 'FeeloWall') => {
  const { background, foreground, accent } = buildScheme(colors);
  const theme = {
    name: `FeeloWall: ${title}`,
    type: luminance(background) < 0.5 ? 'dark' : 'light',
    colors: {
      'editor.background': background,
      'editor.foreground': foreground,
      'activityBar.background': mix(background, '#000000', 0.2),
      'sideBar.background': mix(background, '#000000', 0.1),
      'statusBar.background': mix(background, '#000000', 0.2),
      'titleBar.activeBackground': mix(background, '#000000', 0.2),
      focusBorder: accent(0),
      'button.background': accent(0),
      'textLink.foreground': accent(1)
    },
    tokenColors: [
      { scope: 'comment', settings: { foreground: mix(foreground, background, 0.4), fontStyle: 'italic' } },
      { scope: 'keyword', settings: { foreground: accent(0) } },
      { scope: 'string', settings: { foreground: accent(1) } },
      { scope: ['entity.name.function', 'support.function'], settings: { foreground: accent(2) } },
      { scope: ['entity.name.type', 'support.type'], settings: { foreground: accent(3) } },
      { scope: 'constant', settings: { foreground: accent(4) } }
    ]
  };
  return `${JSON.stringify(theme, null, 2)}\n`;
};

export const toWindowsTerminalScheme = (colors, title = 'FeeloWall') => {
  const { background, foreground, accent } = buildScheme(colors);
  const names = ['red', 'green', 'yellow', 'blue', 'purple', 'cyan'];
  const scheme = {
    name: `FeeloWall ${title}`,
    background,
    foreground,
    cursorColor: accent(0),
    selectionBackground: mix(background, foreground, 0.3),
    black: background,
    white: foreground,
    brightBlack: mix(background, foreground, 0.4),
    brightWhite: mix(foreground, '#ffffff', 0.5)
  };
  names.forEach((name, index) => {
    scheme[name] = accent(index);
    scheme[`bright${name[0].toUpperCase()}${name.slice(1)}`] = mix(accent(index), '#ffffff', 0.25);
  });
  return `${JSON.stringify(scheme, null, 2)}\n`;
};

export const EXPORT_FORMATS = [
  { id: 'css', label: 'CSS variables', extension: 'css', build: toCssVariables },
  { id: 'vscode', label: 'VS Code theme', extension: 'json', build: toVSCodeTheme },
  { id: 'terminal', label: 'Windows Terminal scheme', extension: 'json', build: toWindowsTerminalScheme }
];
