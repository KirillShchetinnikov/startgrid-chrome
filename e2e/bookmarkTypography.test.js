import { describe, expect, it } from '@jest/globals';
import { BOOKMARK_TITLE_FONTS, normalizeBookmarkTitleFont } from '../src/js/bookmarkTypography';

describe('caption fonts', () => {
  it('accepts supported fonts and rejects arbitrary CSS from imported settings', () => {
    Object.keys(BOOKMARK_TITLE_FONTS).forEach(font => {
      expect(normalizeBookmarkTitleFont(font)).toBe(font);
    });
    [undefined, null, '', 'unknown', 'url(https://example.com/font)', '__proto__'].forEach(font => {
      expect(normalizeBookmarkTitleFont(font)).toBe('default');
    });
  });
});
