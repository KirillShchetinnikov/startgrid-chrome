import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { bootstrap } from './bootstrap';

describe('theme controls, inline rename, empty states and tile feedback', () => {
  let browser, page, worker, extensionUrl, data;
  const errors = [];
  beforeAll(async() => {
    ({ browser, extPage: page, worker, extensionUrl } = await bootstrap());
    await page.waitForSelector('#add');
    await page.close();
    data = await worker.evaluate(async() => {
      const home = await chrome.bookmarks.create({ parentId: '1', title: 'UI home' });
      const a = await chrome.bookmarks.create({ parentId: home.id, title: 'Alpha', url: 'https://example.com/a' });
      const b = await chrome.bookmarks.create({ parentId: home.id, title: 'Beta', url: 'https://example.com/b' });
      const folder = await chrome.bookmarks.create({ parentId: home.id, title: 'Empty folder' });
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, language: 'en', enable_sync: false,
        default_folder_id: home.id, show_last_opened_folder: false, performance_mode: 'full',
        background_image: '', color_theme: 'os', snow_mode: 'off', page_cascade_enabled: false,
        home_sort_by: 'manual', bookmarks_sorting_type: 'together', show_home_folders: true,
        download_favicons_by_default: false, thumbnails_auto_refresh: false } });
      return { home: home.id, a: a.id, b: b.id, folder: folder.id };
    });
    page = await browser.newPage();
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1100, height: 800 });
    await page.goto(extensionUrl);
    await page.waitForSelector(`#vb-${data.a}`);
  });
  afterAll(async() => { await browser?.close(); });

  async function rename(id, title) {
    await page.focus(`#vb-${id}`);
    await page.keyboard.press('F2');
    await page.waitForSelector('.inline-rename input');
    await page.$eval('.inline-rename input', (input, text) => { input.value = text; }, title);
  }

  it('renames only the title, cancels with Escape and handles empty names', async() => {
    await rename(data.a, 'Renamed Alpha');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.inline-rename', { hidden: true });
    expect(await worker.evaluate(async id => (await chrome.bookmarks.get(id))[0], data.a))
      .toMatchObject({ title: 'Renamed Alpha', url: 'https://example.com/a', parentId: data.home });
    await rename(data.a, 'Discard this');
    await page.keyboard.press('Escape');
    expect(await page.$eval(`#vb-${data.a}`, node => node.title)).toBe('Renamed Alpha');
    await rename(data.a, '   ');
    await page.keyboard.press('Enter');
    expect(await page.$eval('#inline-rename-error', node => node.textContent)).not.toBe('');
    await page.keyboard.press('Escape');
  });

  it('preserves the draft on a save error and prevents duplicate submits', async() => {
    await rename(data.a, 'Saved after retry');
    await page.evaluate(() => {
      window.__renameUpdates = 0;
      const original = chrome.bookmarks.update;
      chrome.bookmarks.update = async(...args) => {
        window.__renameUpdates++;
        if (window.__renameUpdates === 1) throw new Error('Simulated failure');
        await new Promise(resolve => setTimeout(resolve, 100));
        return original(...args);
      };
    });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#inline-rename-error').textContent.length > 0);
    expect(await page.$eval('.inline-rename input', input => input.value)).toBe('Saved after retry');
    await page.evaluate(() => {
      const form = document.querySelector('.inline-rename');
      form.requestSubmit();
      form.requestSubmit();
    });
    await page.waitForSelector('.inline-rename', { hidden: true });
    expect(await page.evaluate(() => window.__renameUpdates)).toBe(2);
  });

  it('does not overwrite a name changed in another window', async() => {
    await rename(data.b, 'My draft');
    await worker.evaluate(id => chrome.bookmarks.update(id, { title: 'External change' }), data.b);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#inline-rename-error').textContent.includes('elsewhere'));
    expect(await worker.evaluate(async id => (await chrome.bookmarks.get(id))[0].title, data.b)).toBe('External change');
    await page.keyboard.press('Escape');
  });

  it('renames folders from the context menu', async() => {
    await page.evaluate(id => document.getElementById('context-menu').dispatchEvent(
      new CustomEvent('vb:contextmenu:select', { detail: {
        trigger: document.getElementById(`vb-${id}`), selection: 'rename'
      } })
    ), data.folder);
    await page.waitForSelector('.inline-rename input');
    await page.$eval('.inline-rename input', input => { input.value = 'Renamed folder'; });
    await page.keyboard.press('Enter');
    await page.waitForSelector('.inline-rename', { hidden: true });
    expect(await worker.evaluate(async id => (await chrome.bookmarks.get(id))[0].title, data.folder)).toBe('Renamed folder');
  });

  it('persists theme segments in quick and full settings and supports arrow keys', async() => {
    await page.click('#quick_settings_trigger');
    await page.$eval('[data-quick-group="page"]', group => { group.open = true; });
    await page.click('.theme-segments label:has(input[value="dark"])');
    await page.waitForFunction(async() => (await chrome.storage.local.get('settings')).settings.color_theme === 'dark');
    expect(await page.$eval('#quick_color_theme', select => [select.hidden, select.value])).toEqual([true, 'dark']);
    await page.focus('.theme-segments input[value="dark"]');
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(async() => (await chrome.storage.local.get('settings')).settings.color_theme === 'os');
    await page.click('[data-quick-settings-close]');
    const options = await browser.newPage();
    try {
      await options.goto(extensionUrl.replace('newtab.html', 'options.html'));
      await options.waitForSelector('body:not([data-options-loading])');
      await options.click('.theme-segments label:has(input[value="light"])');
      await options.waitForFunction(async() => (await chrome.storage.local.get('settings')).settings.color_theme === 'light');
      expect(await options.$eval('#color_theme', select => [select.hidden, select.value])).toEqual([true, 'light']);
    } finally { await options.close(); await page.bringToFront(); }
  });

  it('offers an action for an empty folder and clears a search with no results', async() => {
    await page.click(`#vb-${data.folder}`);
    await page.waitForSelector('.empty-state #add');
    expect(await page.$eval('.empty-state h2', node => node.textContent)).toBe('This folder is empty');
    await page.click('#add');
    await page.waitForSelector('#modal.is-shown');
    await page.waitForFunction(() => !document.getElementById('modal').instance._isTransitiong);
    await page.keyboard.press('Escape');
    await page.waitForSelector('#modal.is-shown', { hidden: true });
    await page.reload();
    await page.waitForSelector(`#vb-${data.a}`);
    await page.evaluate(() => {
      const input = document.querySelector('vb-header').inputNode;
      input.value = 'no-such-bookmark-unique';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForSelector('[data-empty-search-reset]');
    await page.click('[data-empty-search-reset]');
    await page.waitForSelector(`#vb-${data.a}`);
    expect(await page.$eval('vb-header input', node => node.value)).toBe('');
  });

  it('loads the replacement before fading and skips motion in Fast/reduced modes', async() => {
    await page.evaluate(id => {
      const tile = document.getElementById(`vb-${id}`);
      tile.loadImages();
      window.__oldThumb = tile.querySelector('[data-thumb]');
      window.__originalDecode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = function() {
        return new Promise(resolve => { window.__releaseImage = () => resolve(window.__originalDecode.call(this)); });
      };
      tile.image = 'data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="red"/></svg>');
    }, data.a);
    expect(await page.evaluate(() => window.__oldThumb.isConnected)).toBe(true);
    await page.evaluate(() => window.__releaseImage());
    await page.waitForFunction(() => !window.__oldThumb.isConnected);
    for (const mode of ['fast', 'reduced']) {
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: mode === 'reduced' ? 'reduce' : 'no-preference' }]);
      expect(await page.evaluate(({ id, mode }) => {
        HTMLImageElement.prototype.decode = window.__originalDecode;
        document.documentElement.dataset.performanceMode = mode === 'fast' ? 'fast' : 'full';
        const tile = document.getElementById(`vb-${id}`);
        tile.image = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="41" height="${mode === 'fast' ? 41 : 42}"/>`;
        return tile.querySelector('.bookmark__previous-image') === null;
      }, { id: data.a, mode })).toBe(true);
    }
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
  });

  it('shows the drop position and target and preserves order when dragging is cancelled', async() => {
    const before = await worker.evaluate(id => chrome.bookmarks.getChildren(id).then(items => items.map(item => item.id)), data.home);
    await page.evaluate(({ a, folder }) => {
      window.__dragData = new DataTransfer();
      document.getElementById(`vb-${a}`).dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: window.__dragData }));
      document.querySelector(`#vb-${folder} .dropzone-bookmark`).dispatchEvent(new DragEvent('dragover', {
        bubbles: true, cancelable: true, dataTransfer: window.__dragData
      }));
    }, data);
    await page.waitForSelector('.dropzone-bookmark.has-highlight');
    expect(await page.$eval('.bookmark.dragging', node => node.dataset.dragLabel)).toBe('Place here');
    expect(await page.$eval('.dropzone-bookmark.has-highlight', node => node.dataset.dropLabel)).toBe('Move here');
    await page.evaluate(id => document.getElementById(`vb-${id}`).dispatchEvent(new DragEvent('dragend', {
      bubbles: true, dataTransfer: window.__dragData
    })), data.a);
    expect(await worker.evaluate(id => chrome.bookmarks.getChildren(id).then(items => items.map(item => item.id)), data.home)).toEqual(before);
    expect(await page.$('.has-dragging')).toBeNull();
    expect(errors).toEqual([]);
  });

  it('keeps the theme segments usable on a narrow screen and captures the finished UI', async() => {
    await page.click('#quick_settings_trigger');
    await page.$eval('[data-quick-group="page"]', group => { group.open = true; });
    await page.click('.theme-segments label:has(input[value="dark"])');
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'));
    await page.setViewport({ width: 420, height: 780 });
    await page.$eval('.theme-segments', node => node.scrollIntoView({ block: 'center' }));
    expect(await page.$eval('.theme-segments', node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    if (process.env.UI_SCREENSHOT_DIR) {
      await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/theme-segments-mobile.png` });
    }
    await page.click('[data-quick-settings-close]');
    await page.setViewport({ width: 1100, height: 800 });
    await rename(data.a, 'A clearer bookmark name');
    if (process.env.UI_SCREENSHOT_DIR) {
      await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/inline-rename.png` });
    }
    await page.keyboard.press('Escape');
    await page.click(`#vb-${data.folder}`);
    await page.waitForSelector('.empty-state');
    if (process.env.UI_SCREENSHOT_DIR) {
      await page.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/empty-folder.png` });
    }
  });
});
