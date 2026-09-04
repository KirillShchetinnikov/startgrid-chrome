import { describe, expect, it } from '@jest/globals';
import {
  canUseStoredThumbnail,
  getThumbnailSourceOverride,
  normalizeGlobalThumbnailSource,
  resolveThumbnailSource
} from '../src/js/thumbnailSource';

describe('thumbnail source preferences', () => {
  it('uses favicon as the safe global default', () => {
    expect(normalizeGlobalThumbnailSource('favicon')).toBe('favicon');
    expect(normalizeGlobalThumbnailSource('site')).toBe('site');
    expect(normalizeGlobalThumbnailSource('unknown')).toBe('favicon');
  });

  it('inherits the global source when no per-bookmark override exists', () => {
    expect(resolveThumbnailSource(null, 'site')).toBe('site');
    expect(resolveThumbnailSource({ source: 'favicon', sourceOverride: false }, 'site')).toBe('site');
  });

  it('keeps an explicit per-bookmark source', () => {
    const thumbnail = { source: 'url', sourceOverride: true };
    expect(getThumbnailSourceOverride(thumbnail)).toBe('url');
    expect(resolveThumbnailSource(thumbnail, 'site')).toBe('url');
  });

  it('treats legacy custom sources and favicon preferences as overrides', () => {
    expect(getThumbnailSourceOverride({ source: 'local' })).toBe('local');
    expect(getThumbnailSourceOverride({ source: 'site' })).toBe('site');
    expect(getThumbnailSourceOverride({ source: 'url' })).toBe('url');
    expect(getThumbnailSourceOverride({ source: 'favicon', downloadFavicon: false })).toBe('favicon');
    expect(getThumbnailSourceOverride({ source: 'favicon' })).toBe('inherit');
  });

  it('only displays a stored image that belongs to the resolved source', () => {
    const thumbnail = { source: 'favicon', blob: new Blob() };
    expect(canUseStoredThumbnail(thumbnail, 'favicon')).toBe(true);
    expect(canUseStoredThumbnail(thumbnail, 'site')).toBe(false);
  });
});
