import { describe, expect, it } from '@jest/globals';
import {
  getBookmarkTitlePositionOverride,
  getBookmarkTitleSizeOverride
} from '../src/js/api/bookmarkTextPreferences';

describe('bookmark text preferences', () => {
  it('normalizes individual title sizes', () => {
    expect(getBookmarkTitleSizeOverride('16')).toBe(16);
    expect(getBookmarkTitleSizeOverride(4)).toBe(10);
    expect(getBookmarkTitleSizeOverride(30)).toBe(24);
    expect(getBookmarkTitleSizeOverride('')).toBeNull();
  });

  it('accepts only supported individual title positions', () => {
    expect(getBookmarkTitlePositionOverride('inside')).toBe('inside');
    expect(getBookmarkTitlePositionOverride('outside')).toBe('outside');
    expect(getBookmarkTitlePositionOverride('inherit')).toBeNull();
  });
});
