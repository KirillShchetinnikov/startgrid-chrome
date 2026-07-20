import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

const readCss = path => readFileSync(path, 'utf8');

function relativeLuminance([red, green, blue]) {
  const [r, g, b] = [red, green, blue].map(channel => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('theme contrast styles', () => {
  it('uses a gradient-compatible background property for upload buttons', () => {
    const uploadCss = readCss('src/css/components/_c-upload.css');

    expect(uploadCss).toMatch(/background:\s*var\(--btn\)/);
    expect(uploadCss).not.toMatch(/background-color:\s*var\(--btn\)/);
  });

  it('keeps muted text readable on every theme surface', () => {
    const variablesCss = readCss('src/css/base/_vars.css');
    const mutedColors = [...variablesCss.matchAll(
      /--theme-muted-color:\s*rgb\((\d+)\s+(\d+)\s+(\d+)\)/g
    )].map(match => match.slice(1).map(Number));

    expect(mutedColors).toHaveLength(2);

    const [lightMuted, darkMuted] = mutedColors;
    const lightSurfaces = [
      [255, 255, 255],
      [249, 248, 252],
      [239, 237, 247]
    ];
    const darkSurfaces = [
      [24, 22, 34],
      [34, 31, 48],
      [48, 44, 65]
    ];

    lightSurfaces.forEach(surface => {
      expect(contrastRatio(lightMuted, surface)).toBeGreaterThanOrEqual(4.5);
    });
    darkSurfaces.forEach(surface => {
      expect(contrastRatio(darkMuted, surface)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('does not use the low-contrast gray for semantic text', () => {
    const semanticCss = [
      'src/css/base/_utilities.css',
      'src/css/components/_gmodal.css',
      'src/css/components/_header.css',
      'src/css/components/_tabs.css'
    ].map(readCss).join('\n');

    const usesLowContrastText = semanticCss
      .split('\n')
      .some(line => /^\s*color:\s*#999\b/.test(line));

    expect(usesLowContrastText).toBe(false);
  });

  it('controls toolbar and tile blur through independent variables', () => {
    const headerCss = readCss('src/css/components/_header.css');
    const bookmarkCss = readCss('src/css/components/_bookmark.css');
    const variablesCss = readCss('src/css/base/_vars.css');

    expect(headerCss.match(/backdrop-filter:\s*var\(--toolbar-backdrop-filter\)/g))
      .toHaveLength(4);
    expect(headerCss).not.toMatch(/backdrop-filter:\s*blur/);
    expect(headerCss).not.toMatch(/transition-property:[^;]*background-color/);
    expect(variablesCss).toMatch(/--toolbar-backdrop-filter:\s*none/);
    expect(bookmarkCss.match(/backdrop-filter:\s*var\(--bookmark-backdrop-filter\)/g))
      .toHaveLength(2);
    expect(variablesCss).toMatch(/--bookmark-backdrop-filter:\s*none/);
  });

  it('keeps search suggestions and the folder picker on the toolbar surface', () => {
    const headerCss = readCss('src/css/components/_header.css');

    expect(headerCss).toMatch(
      /\.suggest\s*\{[^}]*background-color:\s*var\(--toolbar-bg\)[^}]*backdrop-filter:\s*var\(--toolbar-backdrop-filter\)/s
    );
    expect(headerCss).toMatch(
      /\.header select::picker\(select\)\s*\{[^}]*background-color:\s*var\(--toolbar-bg\)[^}]*backdrop-filter:\s*var\(--toolbar-backdrop-filter\)/s
    );
  });
});
