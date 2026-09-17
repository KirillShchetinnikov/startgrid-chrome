import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { bootstrap } from './bootstrap';

describe('Full / Fast mode in the extension', () => {
  let browser, worker, page, options, extensionUrl, bookmarkId;
  const errors = [];
  const observe = target => target.on('pageerror', error => errors.push(error.message));

  async function switchMode(mode) {
    await options.bringToFront();
    await Promise.all([
      page.waitForNavigation(), options.waitForNavigation(),
      options.$eval(`input[name="performance_mode"][value="${mode}"]`, input => input.click())
    ]);
    await options.waitForSelector('#setting_dial_shadow');
    await page.waitForSelector(`#vb-${bookmarkId}`);
  }

  async function putBackground(video) {
    await worker.evaluate(async isVideo => {
      const db = await new Promise(resolve => {
        const request = indexedDB.open('startgrid', 1);
        request.onsuccess = () => resolve(request.result);
      });
      const preview = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">'
        + '<rect width="20" height="20" fill="red"><animate attributeName="fill" values="red;blue;red" '
        + 'dur="1s" repeatCount="indefinite"/></rect></svg>'], { type: 'image/svg+xml' });
      const blob = isVideo ? new Blob(['retained-video'], { type: 'video/mp4' }) : preview;
      const tx = db.transaction('images', 'readwrite');
      tx.objectStore('images').put({ id: 'background', blob, blobThumbnail: preview });
      await new Promise(resolve => { tx.oncomplete = resolve; });
      db.close();
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, background_image: 'background_local' } });
    }, video);
  }

  beforeAll(async() => {
    ({ browser, worker, extPage: page, extensionUrl } = await bootstrap());
    await page.waitForSelector('#add');
    observe(page);
    page.setDefaultTimeout(8000);
    page.setDefaultNavigationTimeout(8000);
    bookmarkId = await worker.evaluate(async() => {
      await chrome.storage.local.set({ importingBookmarks: true });
      const home = await chrome.bookmarks.create({ parentId: '1', title: 'Performance test' });
      const bookmark = await chrome.bookmarks.create({ parentId: home.id, title: 'Saved thumbnail', url: 'https://example.com/' });
      const db = await new Promise(resolve => {
        const request = indexedDB.open('startgrid', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('images', { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result);
      });
      const tx = db.transaction('images', 'readwrite');
      const blob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>'], { type: 'image/svg+xml' });
      tx.objectStore('images').put({ id: bookmark.id, blob, source: 'local', sourceOverride: true, custom: true });
      await new Promise(resolve => { tx.oncomplete = resolve; });
      db.close();
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, performance_mode: 'full',
        language: 'en', enable_sync: false, default_folder_id: home.id, show_last_opened_folder: false,
        background_color: '#123456',
        dial_shadow: 19, dial_hover_lift: 7, snow_mode: 'always', page_cascade_enabled: true,
        toolbar_match_tile_background: true, thumbnails_auto_refresh: false, home_sort_by: 'usage'
      } });
      await chrome.storage.local.remove('importingBookmarks');
      return bookmark.id;
    });
    await page.goto(extensionUrl);
    await page.waitForSelector(`#vb-${bookmarkId}`);
    options = await browser.newPage();
    observe(options);
    options.setDefaultTimeout(8000);
    options.setDefaultNavigationTimeout(8000);
    await options.setViewport({ width: 1280, height: 900 });
    await options.goto(extensionUrl.replace('newtab.html', 'options.html'));
    await options.waitForSelector('#setting_dial_shadow');
  });

  afterAll(async() => { await browser?.close(); });

  it('switches every open page, preserves raw values, disables effects and hides quick controls', async() => {
    await switchMode('fast');
    expect(await page.evaluate(() => document.documentElement.dataset.performanceMode)).toBe('fast');
    expect(await worker.evaluate(async() => (await chrome.storage.local.get('settings')).settings.dial_shadow)).toBe(19);
    expect(await options.$eval('#dial_shadow', input => input.disabled)).toBe(true);
    expect(await options.$eval('#home_sort_by', input => input.value)).toBe('manual');
    expect(await options.$eval('#setting_home_sort_by', row => row.dataset.unavailableReason)).toContain('Fast mode');
    expect(await options.$eval('#home_sort_by', input => input.disabled)).toBe(false);
    expect(await page.$eval(`#vb-${bookmarkId}`, tile => ({
      image: tile.getAttribute('image'), transition: getComputedStyle(tile).transitionDuration,
      shadow: getComputedStyle(tile).boxShadow
    }))).toEqual({ image: null, transition: '0s', shadow: 'none' });
    await page.$eval('#quick_settings_trigger', button => button.click());
    await page.waitForFunction(() => !document.querySelector('[data-quick-default-folder]').disabled);
    expect(await page.$eval('#quick_thumbnail_source', input => input.closest('label').hidden)).toBe(true);
    expect(await page.$eval('#quick_dial_shadow', input => input.closest('label').hidden)).toBe(true);
    expect(await page.$eval('#quick_dial_radius', input => input.closest('label').hidden)).toBe(false);
    expect(await page.$('input[name="performance_mode"]')).toBeNull();
    await options.screenshot({ path: join(tmpdir(), 'startgrid-fast-options.png') });
    await options.setViewport({ width: 390, height: 844 });
    expect(await options.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await options.$eval('.settings-viewport', node => node.clientHeight)).toBeGreaterThan(100);
    await options.screenshot({ path: join(tmpdir(), 'startgrid-fast-options-mobile.png') });
    await options.setViewport({ width: 1280, height: 900 });
  });

  it('explains disabled settings on keyboard focus and retains ordinary dependencies', async() => {
    await options.evaluate(() => {
      document.querySelector('#setting_toolbar_background_blur').closest('.settings-panel').hidden = false;
      document.querySelector('#setting_toolbar_background_blur .setting-availability-help').focus();
    });
    const reason = await options.$eval('#setting_toolbar_background_blur', row => row.dataset.unavailableReason);
    expect(reason).toContain('Fast mode');
    expect(reason).toContain('Match tile background');
    expect(await options.$eval('.setting-availability-tooltip', tooltip => tooltip.hidden)).toBe(false);
    await options.keyboard.press('Escape');
    expect(await options.$eval('.setting-availability-tooltip', tooltip => tooltip.hidden)).toBe(true);
  });

  it('rejects optional worker requests without fetching or creating a capture window', async() => {
    await worker.evaluate(() => { globalThis.__fetchCount = 0; globalThis.__originalFetch = fetch;
      globalThis.fetch = (...args) => { globalThis.__fetchCount++; return globalThis.__originalFetch(...args); }; });
    const results = await page.evaluate(async() => Promise.all([
      chrome.runtime.sendMessage({ searchSuggestions: { engine: { id: 'google' }, query: 'test' } }),
      chrome.runtime.sendMessage({ capture: { id: 'test', captureUrl: 'https://example.com' } }),
      chrome.runtime.sendMessage({ remoteThumbnail: { id: 'test', url: 'https://example.com/icon.png' } })
    ]));
    expect(results[0]).toEqual({ suggestions: [] });
    expect(results[1]).toMatchObject({ ok: false, code: 'FAST_MODE' });
    expect(results[2]).toMatchObject({ success: false, error: { code: 'FAST_MODE' } });
    expect(await worker.evaluate(() => { fetch = globalThis.__originalFetch; return globalThis.__fetchCount; })).toBe(0);
  });

  it('applies a shared quick setting in Full mode while restoring saved effects and thumbnails', async() => {
    await page.$eval('#quick_dial_radius', input => { input.value = '23'; input.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.waitForFunction(async() => Number((await chrome.storage.local.get('settings')).settings.dial_radius) === 23);
    await switchMode('full');
    expect(await options.$eval('#dial_radius', input => input.value)).toBe('23');
    expect(await options.$eval('#dial_shadow', input => ({ disabled: input.disabled, value: input.value })))
      .toEqual({ disabled: false, value: '19' });
    expect(await options.$eval('#toolbar_background_blur', input => input.disabled)).toBe(true);
    expect(await page.$eval(`#vb-${bookmarkId}`, tile => tile.getAttribute('image'))).toContain('blob:');
    expect(await options.$eval('#home_sort_by', input => input.value)).toBe('usage');
  });

  it('keeps a video stored but removes it in Fast mode, then restores it in Full mode', async() => {
    await putBackground(true);
    await switchMode('fast');
    expect(await page.$('#bg video')).toBeNull();
    await page.waitForFunction(() => document.body.textContent.includes('Video is not supported in Fast mode'));
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--body-background'))).toBe('#123456');
    await switchMode('full');
    await page.waitForSelector('#bg video');
    expect(await page.$eval('#bg video', video => video.src)).toContain('blob:');
  });

  it('renders an animated local image as a static frame and keeps the replacement in Full mode', async() => {
    await switchMode('fast');
    await putBackground(false);
    await page.bringToFront();
    await page.evaluateOnNewDocument(() => {
      window.__backgroundEncodes = 0;
      const original = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function(...args) {
        window.__backgroundEncodes++;
        return original.apply(this, args);
      };
    });
    await page.reload();
    await page.waitForSelector('#bg img');
    expect(await page.$eval('#bg img', async image => (await fetch(image.src)).headers.get('content-type'))).toBe('image/webp');
    expect(await page.evaluate(() => window.__backgroundEncodes)).toBe(1);
    await page.reload();
    await page.waitForSelector('#bg img');
    expect(await page.evaluate(() => window.__backgroundEncodes)).toBe(0);
    await switchMode('full');
    await page.bringToFront();
    await page.waitForSelector('#bg img');
    expect(await page.$('#bg video')).toBeNull();
    expect(errors).toEqual([]);
  });
});
