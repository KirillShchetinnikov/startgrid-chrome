import { describe, expect, it } from '@jest/globals';
import {
  getFaviconSizeOverride,
  normalizeFaviconSize,
  shouldDownloadFavicon
} from '../src/js/api/faviconPreferences';

describe('favicon preferences', () => {
  it('uses the global download setting when a tile has no override', () => {
    expect(shouldDownloadFavicon({}, true)).toBe(true);
    expect(shouldDownloadFavicon({}, false)).toBe(false);
  });

  it('gives the tile download setting priority over the global setting', () => {
    expect(shouldDownloadFavicon({ downloadFavicon: true }, false)).toBe(true);
    expect(shouldDownloadFavicon({ downloadFavicon: false }, true)).toBe(false);
  });

  it('normalizes global and individual favicon sizes', () => {
    expect(normalizeFaviconSize(8)).toBe(16);
    expect(normalizeFaviconSize(256)).toBe(128);
    expect(getFaviconSizeOverride('48')).toBe(48);
    expect(getFaviconSizeOverride('')).toBeNull();
  });
});
