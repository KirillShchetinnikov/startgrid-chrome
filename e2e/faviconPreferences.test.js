import { describe, expect, it } from '@jest/globals';
import {
  getThumbnailSizeOverride,
  normalizeThumbnailSize,
  shouldDownloadFavicon
} from '../src/js/api/faviconPreferences';

describe('thumbnail preferences', () => {
  it('uses the global download setting when a tile has no override', () => {
    expect(shouldDownloadFavicon({}, true)).toBe(true);
    expect(shouldDownloadFavicon({}, false)).toBe(false);
  });

  it('gives the tile download setting priority over the global setting', () => {
    expect(shouldDownloadFavicon({ downloadFavicon: true }, false)).toBe(true);
    expect(shouldDownloadFavicon({ downloadFavicon: false }, true)).toBe(false);
  });

  it('normalizes global and individual thumbnail sizes', () => {
    expect(normalizeThumbnailSize(8)).toBe(16);
    expect(normalizeThumbnailSize(256)).toBe(128);
    expect(getThumbnailSizeOverride('48')).toBe(48);
    expect(getThumbnailSizeOverride('')).toBeNull();
  });
});
