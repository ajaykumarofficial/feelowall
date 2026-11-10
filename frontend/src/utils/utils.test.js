import { describe, expect, it } from 'vitest';
import { computeMonitorCrops, layoutBounds, validateLayout } from './multiMonitor';
import { pickBestVariant } from './variants';
import { contrastRatio, toCssVariables, toVSCodeTheme, toWindowsTerminalScheme } from './paletteExport';
import { detectLanguage, translate } from '../i18n/translate';
import { LANGUAGES, MESSAGES } from '../i18n/locales';

describe('multi-monitor spanning', () => {
  const pair = [{ width: 1920, height: 1080, x: 0, y: 0 }, { width: 1920, height: 1080, x: 1920, y: 0 }];

  it('finds the bounding box, including negative positions', () => {
    expect(layoutBounds([{ width: 100, height: 100, x: -50, y: -20 }, { width: 100, height: 200, x: 50, y: 0 }]))
      .toEqual({ left: -50, top: -20, width: 200, height: 220 });
  });

  it('splits an image that exactly fits into two halves', () => {
    const [left, right] = computeMonitorCrops(pair, 3840, 1080);
    expect(left).toMatchObject({ sx: 0, sy: 0, sWidth: 1920, sHeight: 1080, width: 1920, height: 1080 });
    expect(right).toMatchObject({ sx: 1920, sy: 0, sWidth: 1920, sHeight: 1080 });
  });

  it('centers and crops rather than distorting an image of another shape', () => {
    const [left, right] = computeMonitorCrops(pair, 1920, 1080);
    // 32:9 layout on a 16:9 image: full width, a centered band of height
    expect(left.sWidth).toBeCloseTo(960);
    expect(left.sHeight).toBeCloseTo(540);
    expect(left.sy).toBeCloseTo(270);
    expect(right.sx).toBeCloseTo(960);
    expect(left.sWidth / left.sHeight).toBeCloseTo(left.width / left.height);
  });

  it('never reads outside the image', () => {
    const layouts = [pair, [{ width: 2560, height: 1440, x: 0, y: 0 }, { width: 1080, height: 1920, x: 2560, y: -240 }]];
    for (const layout of layouts) {
      for (const [w, h] of [[1000, 3000], [5000, 800], [1920, 1080]]) {
        for (const crop of computeMonitorCrops(layout, w, h)) {
          expect(crop.sx).toBeGreaterThanOrEqual(-0.001);
          expect(crop.sy).toBeGreaterThanOrEqual(-0.001);
          expect(crop.sx + crop.sWidth).toBeLessThanOrEqual(w + 0.001);
          expect(crop.sy + crop.sHeight).toBeLessThanOrEqual(h + 0.001);
        }
      }
    }
  });

  it('rejects empty, invalid, and overlapping layouts', () => {
    expect(validateLayout([])).toBeTruthy();
    expect(validateLayout([{ width: 0, height: 100, x: 0, y: 0 }])).toBeTruthy();
    expect(validateLayout([{ width: NaN, height: 100, x: 0, y: 0 }])).toBeTruthy();
    expect(validateLayout([{ width: 100, height: 100, x: 0, y: 0 }, { width: 100, height: 100, x: 50, y: 0 }])).toContain('overlap');
    expect(validateLayout(pair)).toBeNull();
  });
});

describe('choosing a variant', () => {
  const wallpaper = {
    imageUrl: '/original.jpg',
    width: 1920,
    height: 1080,
    variants: [
      { label: 'mobile', imageUrl: '/mobile.jpg', width: 1080, height: 1920 },
      { label: 'ultrawide', imageUrl: '/wide.jpg' },
      { label: 'dark', imageUrl: '/dark.jpg', width: 1920, height: 1080 }
    ]
  };

  it('uses the original when it fits best', () => {
    expect(pickBestVariant(wallpaper, 1920, 1080).imageUrl).toBe('/original.jpg');
  });

  it('chooses by shape, using the label if the size is unknown', () => {
    expect(pickBestVariant(wallpaper, 390, 844).imageUrl).toBe('/mobile.jpg');
    expect(pickBestVariant(wallpaper, 3440, 1440).imageUrl).toBe('/wide.jpg');
  });

  it('prefers the matching theme when the shapes are equal', () => {
    expect(pickBestVariant(wallpaper, 1920, 1080, 'dark').imageUrl).toBe('/dark.jpg');
  });

  it('works with no variants', () => {
    expect(pickBestVariant({ imageUrl: '/only.jpg' }, 390, 844).imageUrl).toBe('/only.jpg');
  });
});

describe('palette export', () => {
  const colors = [{ hex: '#ff6b6b' }, { hex: '#fbc531' }, { hex: '#1b2a56' }, { hex: '#2ed573' }, { hex: '#70a1ff' }];

  it('writes CSS variables', () => {
    const css = toCssVariables(colors, 'Sunset');
    expect(css).toContain('--palette-1: #ff6b6b;');
    expect(css).toContain('--palette-5: #70a1ff;');
    expect(css).toContain('Sunset');
  });

  it('writes a readable VS Code theme as valid JSON', () => {
    const theme = JSON.parse(toVSCodeTheme(colors, 'Sunset'));
    expect(theme.name).toContain('Sunset');
    expect(contrastRatio(theme.colors['editor.foreground'], theme.colors['editor.background'])).toBeGreaterThanOrEqual(7);
    for (const token of theme.tokenColors.filter((item) => item.scope !== 'comment')) {
      expect(contrastRatio(token.settings.foreground, theme.colors['editor.background'])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('stays readable when every color is pale', () => {
    const theme = JSON.parse(toVSCodeTheme(['#f0f0f0', '#fafafa']));
    expect(contrastRatio(theme.colors['editor.foreground'], theme.colors['editor.background'])).toBeGreaterThanOrEqual(7);
  });

  it('writes a complete Windows Terminal scheme', () => {
    const scheme = JSON.parse(toWindowsTerminalScheme(colors, 'Sunset'));
    for (const key of ['background', 'foreground', 'black', 'red', 'green', 'yellow', 'blue', 'purple', 'cyan', 'white',
      'brightBlack', 'brightRed', 'brightGreen', 'brightYellow', 'brightBlue', 'brightPurple', 'brightCyan', 'brightWhite']) {
      expect(scheme[key]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('copes with an empty palette', () => {
    expect(() => JSON.parse(toVSCodeTheme([]))).not.toThrow();
  });
});

describe('translations', () => {
  it('uses a saved language first, then the browser, then English', () => {
    expect(detectLanguage('es', ['en-US'])).toBe('es');
    expect(detectLanguage(null, ['es-MX', 'en'])).toBe('es');
    expect(detectLanguage(null, ['fr-FR', 'de'])).toBe('en');
    expect(detectLanguage('klingon', [])).toBe('en');
  });

  it('fills in values, and falls back to English and then the key', () => {
    expect(translate('es', 'notifications.unread', { count: 3 })).toBe('3 sin leer');
    expect(translate('xx', 'nav.explore')).toBe('Explore');
    expect(translate('en', 'no.such.key')).toBe('no.such.key');
  });

  it('has every English key translated in every language', () => {
    const english = Object.keys(MESSAGES.en).sort();
    for (const { code } of LANGUAGES) {
      expect(Object.keys(MESSAGES[code]).sort()).toEqual(english);
    }
  });
});
