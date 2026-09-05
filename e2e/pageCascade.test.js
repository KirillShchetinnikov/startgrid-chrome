import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { calculateCascadeTiming, getCascadeGroupIndexes } from '../src/js/pageCascade';

const createItems = (...rowCounts) => rowCounts.flatMap((count, rowIndex) => (
  Array.from({ length: count }, () => ({ offsetTop: rowIndex * 180 }))
));

const mockSettingsStorage = storedSettings => {
  const localSet = jest.fn().mockResolvedValue();
  global.browser = {
    i18n: { getMessage: key => key },
    runtime: { getURL: path => `chrome-extension://test/${path}` },
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({ settings: storedSettings }),
        set: localSet,
        remove: jest.fn().mockResolvedValue(),
        clear: jest.fn().mockResolvedValue()
      },
      sync: {
        get: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue(),
        clear: jest.fn().mockResolvedValue()
      }
    }
  };
  return localSet;
};

describe('page opening cascade', () => {
  it('places every bookmark in its own group in item mode', () => {
    const items = createItems(4, 4, 3);
    expect(getCascadeGroupIndexes(items, 'items')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('places bookmarks from the same visual row in one group', () => {
    const items = createItems(4, 4, 3);
    expect(getCascadeGroupIndexes(items, 'rows')).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2]);
  });

  it('spreads delays across the configured total duration', () => {
    const items = createItems(2, 2);
    const itemTiming = calculateCascadeTiming(items, 'items', 1000);
    const rowTiming = calculateCascadeTiming(items, 'rows', 1000);

    expect(itemTiming.itemDuration).toBe(520);
    expect(itemTiming.delays).toEqual([0, 160, 320, 480]);
    expect(itemTiming.totalDuration).toBe(1000);
    expect(rowTiming.delays).toEqual([0, 0, 480, 480]);
    expect(rowTiming.totalDuration).toBe(1000);
  });

  it('uses one smooth tile animation that enters from below the viewport', () => {
    const css = readFileSync('src/css/pages/_newtab.css', 'utf8');

    expect(css).toMatch(/@keyframes page-tile-enter/);
    expect(css).toMatch(/\.page-entering \.grid > \*/);
    expect(css).toMatch(/translate3d\(0,\s*100vh,\s*0\)/);
    expect(css).toMatch(/transform:\s*translate3d\(0,\s*0,\s*0\)/);
    expect(css).toMatch(/animation-fill-mode:\s*both/);
    expect(css).not.toMatch(/page-panel-zoom-enter|page-soft-rise-enter/);
    expect(css).not.toMatch(/data-page-entrance-effect/);
  });

  it('keeps the grid centered without changing action-tile opacity after animation', () => {
    const css = readFileSync('src/css/pages/_newtab.css', 'utf8');
    const bookmarkCss = readFileSync('src/css/components/_bookmark.css', 'utf8');

    expect(css).toMatch(/\.app\s*\{[^}]*scrollbar-gutter:\s*stable both-edges/s);
    expect(bookmarkCss).toMatch(/\.bookmark-btn\s*\{[^}]*opacity:\s*1/s);
    expect(bookmarkCss).toMatch(/\.bookmark-btn--create\s*\{[^}]*border:\s*var\(--surface-border\)/s);
  });
});

describe('approved compatibility and cascade defaults', () => {
  afterEach(() => {
    delete global.browser;
    jest.resetModules();
  });

  it('targets Chrome 105 and newer in both the build and extension manifest', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
    const manifest = JSON.parse(readFileSync('static/manifest.json', 'utf8'));

    expect(packageJson.browserslist).toEqual(['chrome >= 105']);
    expect(manifest.minimum_chrome_version).toBe('105');
    expect(packageJson.browserslist[0])
      .toBe(`chrome >= ${manifest.minimum_chrome_version}`);
  });

  it('uses 650 ms for a new profile', async() => {
    mockSettingsStorage({ enable_sync: false });
    const { settings } = await import('../src/js/settings');

    await settings.init();

    expect(settings.$.page_cascade_duration).toBe(650);
  });

  it('preserves an existing 660 ms value until the setting is explicitly reset', async() => {
    const localSet = mockSettingsStorage({
      enable_sync: false,
      page_cascade_duration: 660
    });
    const { settings } = await import('../src/js/settings');

    await settings.init();

    expect(settings.$.page_cascade_duration).toBe(660);
    expect(localSet.mock.calls.at(-1)[0].settings.page_cascade_duration).toBe(660);

    await settings.resetKeys(['page_cascade_duration']);

    expect(settings.$.page_cascade_duration).toBe(650);
    expect(localSet.mock.calls.at(-1)[0].settings.page_cascade_duration).toBe(650);
  });
});
