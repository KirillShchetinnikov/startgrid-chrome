import { describe, expect, it } from '@jest/globals';
import {
  createTileBackground,
  cssColorToHex,
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
});
