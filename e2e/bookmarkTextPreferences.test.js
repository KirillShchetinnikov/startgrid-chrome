import { readFileSync } from 'node:fs';
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

  it('lets tiles without an override inherit the live global title size', () => {
    const bookmarksSource = readFileSync('src/js/components/bookmarks.js', 'utf8');

    expect(bookmarksSource).not.toContain(
      'titleSize: textPreferences.titleSize ?? settings.$.bookmark_title_size'
    );
    expect(bookmarksSource.match(/titleSize: textPreferences\.titleSize,/g)).toHaveLength(2);
  });

  it('uses the available horizontal gap to widen outside captions', () => {
    const bookmarkCss = readFileSync('src/css/components/_bookmark.css', 'utf8');

    expect(bookmarkCss).toMatch(/width:\s*calc\(100% \+ min\(var\(--grid-gap\), 24px\)\)/);
  });
});
