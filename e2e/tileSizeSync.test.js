import { describe, expect, it } from '@jest/globals';
import { scaleTileContentSettings } from '../src/js/tileSizeSync';

describe('tile content size synchronization', () => {
  it('scales the thumbnail image and title proportionally with the tile', () => {
    expect(scaleTileContentSettings({
      faviconSize: 32,
      fromTileSize: 100,
      titleSize: 14,
      toTileSize: 150
    })).toEqual({
      bookmark_title_size: 21,
      favicon_size: 48
    });
  });

  it('holds each related setting at its own lower and upper boundary', () => {
    expect(scaleTileContentSettings({
      faviconSize: 32,
      fromTileSize: 100,
      titleSize: 14,
      toTileSize: 50
    })).toEqual({
      bookmark_title_size: 10,
      favicon_size: 16
    });
    expect(scaleTileContentSettings({
      faviconSize: 128,
      fromTileSize: 100,
      titleSize: 24,
      toTileSize: 150
    })).toEqual({
      bookmark_title_size: 24,
      favicon_size: 128
    });
  });

  it('keeps the image size on the slider step while retaining proportional scaling', () => {
    expect(scaleTileContentSettings({
      faviconSize: 32,
      fromTileSize: 100,
      titleSize: 14,
      toTileSize: 110
    })).toEqual({
      bookmark_title_size: 15,
      favicon_size: 36
    });
  });
});
