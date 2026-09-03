import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

let getBookmarkTitleSizeOverride;

beforeAll(async() => {
  const storageArea = {
    get: async() => ({}),
    set: async() => {},
    remove: async() => {},
    clear: async() => {}
  };
  global.browser = {
    runtime: { lastError: null },
    storage: {
      local: storageArea,
      sync: storageArea
    }
  };
  ({ getBookmarkTitleSizeOverride } = await import('../src/js/api/bookmarkTextPreferences'));
});

afterAll(() => {
  delete global.browser;
});

describe('bookmark text preferences', () => {
  it('normalizes individual title sizes', () => {
    expect(getBookmarkTitleSizeOverride('16')).toBe(16);
    expect(getBookmarkTitleSizeOverride(4)).toBe(10);
    expect(getBookmarkTitleSizeOverride(30)).toBe(24);
    expect(getBookmarkTitleSizeOverride('')).toBeNull();
  });

  it('uses the global title position for every tile', () => {
    const newtabHtml = readFileSync('src/newtab.html', 'utf8');
    const bookmarksSource = readFileSync('src/js/components/bookmarks.js', 'utf8');
    const preferencesSource = readFileSync('src/js/api/bookmarkTextPreferences.js', 'utf8');

    expect(newtabHtml).not.toContain('bookmarkTitlePosition');
    expect(bookmarksSource).not.toContain('textPreferences.titlePosition');
    expect(bookmarksSource.match(/titlePosition: settings\.\$\.bookmark_title_position,/g))
      .toHaveLength(2);
    expect(preferencesSource).not.toContain('titlePosition');
  });

  it('lets tiles without an override inherit the live global title size', () => {
    const bookmarksSource = readFileSync('src/js/components/bookmarks.js', 'utf8');

    expect(bookmarksSource).not.toContain(
      'titleSize: textPreferences.titleSize ?? settings.$.bookmark_title_size'
    );
    expect(bookmarksSource.match(/titleSize: textPreferences\.titleSize,/g)).toHaveLength(2);
  });

  it('uses the horizontal gap to widen outside captions', () => {
    const bookmarkCss = readFileSync('src/css/components/_bookmark.css', 'utf8');

    expect(bookmarkCss).toMatch(
      /width:\s*calc\(100% \+ min\(var\(--grid-column-gap\), 24px\)\)/
    );
  });

  it('keeps the inside caption vertically compact', () => {
    const bookmarkCss = readFileSync('src/css/components/_bookmark.css', 'utf8');
    const insideCaption = bookmarkCss.match(
      /\.bookmark__caption\s*\{(?<styles>[\s\S]*?)\n\}/
    )?.groups?.styles;

    expect(insideCaption).toMatch(/height:\s*min\(22%, 26px\)/);
  });
});
