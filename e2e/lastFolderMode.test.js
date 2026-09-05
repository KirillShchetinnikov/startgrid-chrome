import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { bootstrap } from './bootstrap';

describe('limited last-folder mode', () => {
  let browser, worker, page, extensionUrl, folders;
  const errors = [];

  beforeAll(async() => {
    const context = await bootstrap({ launchAttempts: 2 });
    ({ browser, worker, extensionUrl } = context);
    await context.extPage.waitForSelector('#add');
    await context.extPage.close();
    folders = await worker.evaluate(async() => {
      const home = await chrome.bookmarks.create({ parentId: '1', title: 'Configured home' });
      const parent = await chrome.bookmarks.create({ parentId: '1', title: 'Other folder' });
      const nested = await chrome.bookmarks.create({ parentId: parent.id, title: 'Nested folder' });
      const bookmark = await chrome.bookmarks.create({ parentId: nested.id, title: 'Zulu', url: 'https://example.com' });
      await chrome.bookmarks.create({ parentId: nested.id, title: 'Alpha', url: 'https://example.org' });
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, enable_sync: false,
        default_folder_id: home.id, show_last_opened_folder: true, show_back_column: true,
        home_sort_by: 'usage', show_usage_count: true, download_favicons_by_default: false,
        disable_main_page_scroll: true, show_home_folders: true, bookmarks_sorting_type: 'together' } });
      return { home: home.id, parent: parent.id, nested: nested.id, bookmark: bookmark.id };
    });
    page = await browser.newPage();
    page.setDefaultTimeout(8000);
    await page.setViewport({ width: 1280, height: 900 });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${extensionUrl}#${folders.nested}`);
    await page.waitForSelector(`#vb-${folders.bookmark}`);
  });

  afterAll(async() => { await browser?.close(); });

  it('uses browser order, hides toolbar navigation and keeps the parent tile', async() => {
    expect(await page.evaluate(() => ({
      back: Boolean(document.querySelector('vb-header').backNode),
      home: Boolean(document.querySelector('vb-header').homeNode),
      parent: Boolean(document.getElementById('bookmark-back')),
      titles: [...document.querySelectorAll('.bookmark__title')].map(node => node.textContent),
      counts: document.querySelectorAll('.bookmark__usage-count').length
    }))).toEqual({ back: false, home: false, parent: true, titles: ['Zulu', 'Alpha'], counts: 0 });
    await page.click('#bookmark-back');
    await page.waitForSelector(`#vb-${folders.nested}`);
    await page.evaluate(() => history.back());
    await page.waitForSelector(`#vb-${folders.bookmark}`);
    await page.reload();
    await page.waitForSelector(`#vb-${folders.bookmark}`);
  });

  it('ignores individual appearance and preserves it when editing', async() => {
    await page.evaluate(async({ bookmark }) => {
      await chrome.storage.local.set({ [`bookmark_text_preferences:${bookmark}`]: { titleSize: 23 } });
      const db = await new Promise(resolve => {
        const request = indexedDB.open('startgrid');
        request.onsuccess = () => resolve(request.result);
      });
      await new Promise(resolve => {
        const tx = db.transaction('images', 'readwrite');
        tx.objectStore('images').put({ id: bookmark, source: 'local', sourceOverride: true,
          thumbnailSize: 100, blob: new Blob(['saved-image'], { type: 'image/png' }) });
        tx.oncomplete = resolve;
      });
      db.close();
    }, folders);
    await page.reload();
    await page.waitForSelector(`#vb-${folders.bookmark}`);
    expect(await page.$eval(`#vb-${folders.bookmark}`, node => ({
      source: node.thumbnailSource, size: node.style.getPropertyValue('--bookmark-thumbnail-size'),
      image: node.image
    }))).toEqual({ source: 'favicon', size: '', image: null });
    await page.evaluate(id => document.getElementById('context-menu').dispatchEvent(new CustomEvent('vb:contextmenu:select', {
      detail: { trigger: document.getElementById(`vb-${id}`), selection: 'edit' }
    })), folders.bookmark);
    await page.waitForFunction(() => document.getElementById('formBookmark').dataset.action !== 'New'
      && document.getElementById('title').value === 'Zulu');
    await page.waitForFunction(() => {
      const instance = document.getElementById('modal').instance;
      return instance?._isOpen && !instance._isTransitiong;
    });
    expect(await page.evaluate(() => ({
      titleSize: document.getElementById('bookmarkTitleSize').closest('.group').hidden,
      source: document.getElementById('thumbnailSourceWrap').hidden
    }))).toEqual({ titleSize: true, source: true });
    await page.$eval('#title', node => { node.value = 'Edited'; });
    await page.$eval('#saveBookmarkBtn', node => node.click());
    await page.waitForFunction(() => {
      const instance = document.getElementById('modal').instance;
      return !instance._isOpen && !instance._isTransitiong;
    });
    await page.waitForFunction(id => document.getElementById(`vb-${id}`)?.title === 'Edited', {}, folders.bookmark);
    expect(await page.evaluate(async({ bookmark }) => {
      const text = await chrome.storage.local.get(`bookmark_text_preferences:${bookmark}`);
      const image = await new Promise(resolve => {
        const request = indexedDB.open('startgrid');
        request.onsuccess = () => {
          const db = request.result;
          const read = db.transaction('images').objectStore('images').get(bookmark);
          read.onsuccess = () => { resolve(read.result); db.close(); };
        };
      });
      return { text: text[`bookmark_text_preferences:${bookmark}`], source: image.source,
        size: image.thumbnailSize, blob: await image.blob.text() };
    }, folders)).toEqual({ text: { titleSize: 23 }, source: 'local', size: 100, blob: 'saved-image' });
  });

  it('refreshes only current-folder icons without replacing a saved image', async() => {
    await worker.evaluate(() => {
      globalThis.originalFaviconFetch = globalThis.fetch;
      globalThis.faviconRequests = [];
      globalThis.fetch = async url => {
        globalThis.faviconRequests.push(url);
        return { ok: true, status: 200, url,
          headers: new Headers({ 'content-type': url.endsWith('.ico') ? 'image/png' : 'text/html' }),
          text: async() => '', blob: async() => new Blob(['favicon'], { type: 'image/png' }) };
      };
    });
    await page.evaluate(() => {
      window.originalPermissionsContains = chrome.permissions.contains;
      window.originalPermissionsRequest = chrome.permissions.request;
      chrome.permissions.contains = async() => true;
      chrome.permissions.request = async() => true;
    });
    await page.click('#quick_settings_trigger');
    await page.select('#quick_download_favicons_by_default', 'true');
    await page.waitForFunction(id => document.getElementById(`vb-${id}`)?.image?.startsWith('data:'), {}, folders.bookmark);
    await page.click('#quick_settings_trigger');
    await worker.evaluate(() => { globalThis.faviconRequests = []; });
    await page.evaluate(() => {
      window.limitedUpdateFinished = false;
      document.getElementById('bookmarks').addEventListener('thumbnails:updated', () => {
        window.limitedUpdateFinished = true;
      }, { once: true });
    });
    await page.$eval('.update-thumbnails', node => node.click());
    await page.waitForFunction(() => window.limitedUpdateFinished);
    const requests = await worker.evaluate(() => globalThis.faviconRequests);
    expect(requests).toContain('https://example.com/');
    expect(requests).toContain('https://example.org/');
    expect(requests.every(url => /^https:\/\/example\.(com|org)/.test(url))).toBe(true);
    expect(await page.evaluate(id => new Promise(resolve => {
      const request = indexedDB.open('startgrid');
      request.onsuccess = () => {
        const db = request.result;
        const read = db.transaction('images').objectStore('images').get(id);
        read.onsuccess = () => { resolve(read.result.source); db.close(); };
      };
    }), folders.bookmark)).toBe('local');
    await page.click('#quick_settings_trigger');
    await page.select('#quick_download_favicons_by_default', 'false');
    await page.waitForFunction(id => !document.getElementById(`vb-${id}`)?.image, {}, folders.bookmark);
    await page.click('#quick_settings_trigger');
    await page.evaluate(() => {
      chrome.permissions.contains = window.originalPermissionsContains;
      chrome.permissions.request = window.originalPermissionsRequest;
    });
    await worker.evaluate(() => { globalThis.fetch = globalThis.originalFaviconFetch; });
  });

  it('applies quick mode changes immediately and exposes only the icon source', async() => {
    await page.click('#quick_settings_trigger');
    expect(await page.$eval('#quick_thumbnail_source', node => node.closest('label').hidden)).toBe(true);
    if (process.env.STARTGRID_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.STARTGRID_SCREENSHOT_DIR}/startgrid-limited-quick.png` });
    expect(await page.$eval('#quick_download_favicons_by_default', node => node.value)).toBe('false');
    await page.$eval('[data-setting="show_last_opened_folder"]', node => node.click());
    await page.waitForFunction(id => document.getElementById('bookmarks').dataset.folder === id, {}, folders.home);
    expect(await page.$eval('#quick_thumbnail_source', node => node.closest('label').hidden)).toBe(false);
    await page.evaluate(() => {
      const input = document.querySelector('vb-header').inputNode;
      input.value = 'Alpha';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForFunction(() => document.body.classList.contains('has-search'));
    await page.$eval('[data-setting="show_last_opened_folder"]', node => node.click());
    await page.waitForFunction(() => document.querySelector('vb-header').homeNode === null);
    expect(await page.evaluate(() => document.body.classList.contains('has-search'))).toBe(false);
    await page.click('#quick_settings_trigger');
  });

  it('updates general settings when the mode changes', async() => {
    const options = await browser.newPage();
    await options.setViewport({ width: 1280, height: 900 });
    await options.goto(extensionUrl.replace('newtab.html', 'options.html'));
    await options.waitForSelector('#show_last_opened_folder');
    expect(await options.$eval('#setting_thumbnail_source', node => node.hidden)).toBe(true);
    expect(await options.$eval('#home_sort_by', node => node.value)).toBe('manual');
    await options.$eval('#show_last_opened_folder', node => node.click());
    await options.waitForFunction(() => !document.getElementById('setting_thumbnail_source').hidden);
    expect(await options.$eval('#home_sort_by', node => node.value)).toBe('usage');
    await options.$eval('#show_last_opened_folder', node => node.click());
    await options.waitForFunction(() => document.getElementById('setting_thumbnail_source').hidden);
    await options.close();
    await page.bringToFront();
    await page.waitForSelector('#add');
  });

  it('recovers a deleted last folder and a deleted default folder', async() => {
    await page.evaluate(id => localStorage.setItem('last_opened_folder_id', id), folders.nested);
    await worker.evaluate(id => chrome.bookmarks.removeTree(id), folders.parent);
    await page.reload();
    await page.waitForFunction(() => document.getElementById('bookmarks').dataset.folder === '1');
    expect(await page.evaluate(() => localStorage.getItem('last_opened_folder_id'))).toBe('1');
    await page.click('#quick_settings_trigger');
    await page.$eval('[data-setting="show_last_opened_folder"]', node => node.click());
    await page.waitForFunction(id => document.getElementById('bookmarks').dataset.folder === id, {}, folders.home);
    await worker.evaluate(id => chrome.bookmarks.removeTree(id), folders.home);
    await page.waitForFunction(() => document.getElementById('bookmarks').dataset.folder === '1');
    expect(await worker.evaluate(async() => (await chrome.storage.local.get('settings')).settings.default_folder_id)).toBe('1');
    expect(errors).toEqual([]);
  });
});
