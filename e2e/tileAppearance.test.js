import { describe, expect, it } from '@jest/globals';
import {
  createTileBackground,
  createToolbarBackground,
  cssColorToHex,
  getTileShadowOpacities,
  parseTileColor
} from '../src/js/tileAppearance';

describe('tile appearance settings', () => {
  it('parses custom hex and theme RGB colors', () => {
    expect(parseTileColor('#5b4fd6')).toEqual([91, 79, 214]);
    expect(parseTileColor('rgb(34 31 48)')).toEqual([34, 31, 48]);
    expect(cssColorToHex('rgb(34 31 48)')).toBe('#221f30');
  });

  it('uses the theme color when no custom color is configured', () => {
    expect(createTileBackground('', 65, 'rgb(34 31 48)'))
      .toBe('rgb(34 31 48 / 65%)');
  });

  it('uses the custom color and clamps opacity', () => {
    expect(createTileBackground('#ff0080', 150, 'rgb(255 255 255)'))
      .toBe('rgb(255 0 128 / 100%)');
    expect(createTileBackground('#ff0080', -1, 'rgb(255 255 255)'))
      .toBe('rgb(255 0 128 / 0%)');
  });

  it('matches the tile background or uses an independent toolbar color', () => {
    const settings = {
      tileColor: '#5b4fd6',
      tileOpacity: 65,
      toolbarColor: '#112233',
      toolbarOpacity: 75,
      themeColor: 'rgb(255 255 255)'
    };

    expect(createToolbarBackground({ ...settings, matchTileBackground: true }))
      .toBe('rgb(91 79 214 / 65%)');
    expect(createToolbarBackground({ ...settings, matchTileBackground: false }))
      .toBe('rgb(17 34 51 / 75%)');
  });

  it('strengthens tile shadows for the dark theme and preserves zero', () => {
    expect(getTileShadowOpacities(8, false)).toEqual({
      resting: 8,
      hover: 15
    });
    expect(getTileShadowOpacities(8, true)).toEqual({
      resting: 14,
      hover: 20
    });
    expect(getTileShadowOpacities(0, true)).toEqual({
      resting: 0,
      hover: 0
    });
  });

  it('clamps tile shadow opacity to the supported range', () => {
    expect(getTileShadowOpacities(100, false)).toEqual({
      resting: 30,
      hover: 45
    });
    expect(getTileShadowOpacities(100, true)).toEqual({
      resting: 52.5,
      hover: 75
    });
  });
});
