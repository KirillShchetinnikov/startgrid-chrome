import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { bootstrap } from './bootstrap';

describe('bookmark data preservation and large grids', () => {
  let browser, worker, page, extensionUrl, data;
  const errors = [];

  async function readImages() {
    return worker.evaluate(async() => {
      const db = await new Promise(resolve => {
        const request = indexedDB.open('startgrid', 1);
        request.onsuccess = () => resolve(request.result);
      });
      const rows = await new Promise(resolve => {
        const request = db.transaction('images').objectStore('images').getAll();
        request.onsuccess = () => resolve(request.result.map(row => ({ id: row.id, source: row.source })));
      });
      db.close();
      return rows;
    });
  }

  beforeAll(async() => {
    ({ browser, worker, extPage: page, extensionUrl } = await bootstrap());
    await page.waitForSelector('#add');
    await page.close();
    data = await worker.evaluate(async() => {
      await chrome.storage.local.set({ importingBookmarks: true });
      const parent = await chrome.bookmarks.create({ parentId: '1', title: 'Parent' });
      const home = await chrome.bookmarks.create({ parentId: parent.id, title: 'Home' });
      const ids = [];
      for (let index = 0; index < 1000; index += 1) {
        const item = await chrome.bookmarks.create({ parentId: home.id,
          title: `Tile ${index}`, url: `https://example.com/${index}` });
        ids.push(item.id);
      }
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, enable_sync: false,
        default_folder_id: home.id, show_last_opened_folder: false, performance_mode: 'full',
        download_favicons_by_default: false, thumbnails_auto_refresh: false,
        snow_mode: 'off', page_cascade_enabled: false, background_image: '',
        keyboard_shortcuts: { ...settings.keyboard_shortcuts, add_bookmark: 'Alt+KeyN' }
      } });
      const db = await new Promise(resolve => {
        const request = indexedDB.open('startgrid', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('images', { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result);
      });
      const tx = db.transaction('images', 'readwrite');
      const blob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>'],
        { type: 'image/svg+xml' });
      ids.slice(0, 2).forEach(id => tx.objectStore('images').put({ id, blob,
        source: 'local', sourceOverride: true, custom: true }));
      await new Promise(resolve => { tx.oncomplete = resolve; });
      db.close();
      await chrome.storage.local.remove('importingBookmarks');
      return { parent: parent.id, home: home.id, ids };
    });
    page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(extensionUrl);
    await page.waitForSelector(`#vb-${data.ids[999]}`);
    await page.waitForSelector('body.page-ready');
  });

  afterAll(async() => { await browser?.close(); });

  it('preserves local images when the home folder or its ancestor is renamed or moved', async() => {
    const before = await readImages();
    expect(before).toHaveLength(2);
    for (const [id, title] of [[data.home, 'Renamed home'], [data.parent, 'Renamed parent']]) {
      await page.evaluate(async({ id, title }) => {
        const changed = new Promise(resolve => {
          const listener = message => {
            if (message.bookmarksChanged?.id !== id) return;
            chrome.runtime.onMessage.removeListener(listener);
            resolve();
          };
          chrome.runtime.onMessage.addListener(listener);
        });
        await chrome.bookmarks.update(id, { title });
        await changed;
      }, { id, title });
      expect(await readImages()).toEqual(before);
    }
    await page.evaluate(async id => {
      const changed = new Promise(resolve => {
        const listener = message => {
          if (message.bookmarksChanged?.id !== id) return;
          chrome.runtime.onMessage.removeListener(listener);
          resolve();
        };
        chrome.runtime.onMessage.addListener(listener);
      });
      await chrome.bookmarks.move(id, { parentId: '2' });
      await changed;
    }, data.home);
    expect(await readImages()).toEqual(before);
  });

  it('keeps deferred tiles the same size and reachable by keyboard across the boundary', async() => {
    expect(await page.$$('.bookmark--deferred')).not.toHaveLength(0);
    const layout = await page.evaluate(() => {
      const tile = document.querySelector('.bookmark--deferred');
      const previous = tile.previousElementSibling;
      window.__deferredTile = tile;
      const height = tile.getBoundingClientRect().height;
      const scrollHeight = document.querySelector('.app').scrollHeight;
      previous.focus();
      return { height, scrollHeight };
    });
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement === window.__deferredTile)).toBe(true);
    expect(await page.evaluate(() => window.__deferredTile.getBoundingClientRect().height))
      .toBeCloseTo(layout.height, 0);
    expect(await page.$eval('.app', node => node.scrollHeight)).toBe(layout.scrollHeight);
    await page.$eval('.app', node => { node.scrollTop = 0; });
  });

  it('keeps distant titles searchable and prepares their controls when scrolled into view', async() => {
    expect(await page.$(`#vb-${data.ids[999]} .bookmark__action`)).toBeNull();
    expect(await page.evaluate(() => window.find('Tile 999'))).toBe(true);
    expect(await page.evaluate(() => window.getSelection().toString())).toBe('Tile 999');
    await page.$eval(`#vb-${data.ids[999]}`, tile => tile.scrollIntoView());
    await page.waitForSelector(`#vb-${data.ids[999]} .bookmark__action`);
    await page.evaluate(() => window.getSelection().removeAllRanges());
    await page.$eval('.app', node => { node.scrollTop = 0; });
  });

  it('renders outside captions fully without changing their row height on scroll', async() => {
    await worker.evaluate(async() => {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, bookmark_title_position: 'outside' } });
    });
    await page.reload();
    await page.waitForSelector('body.page-ready');
    expect(await page.$(`#vb-${data.ids[999]} .bookmark__action`)).not.toBeNull();
    const before = await page.$eval(`#vb-${data.ids[999]}`, tile => ({
      height: tile.getBoundingClientRect().height, visibility: getComputedStyle(tile).contentVisibility
    }));
    expect(before.visibility).toBe('visible');
    await page.$eval(`#vb-${data.ids[999]}`, tile => tile.scrollIntoView());
    expect(await page.$eval(`#vb-${data.ids[999]}`, tile => tile.getBoundingClientRect().height))
      .toBe(before.height);
    await worker.evaluate(async() => {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, bookmark_title_position: 'inside' } });
    });
    await page.reload();
    await page.waitForSelector('body.page-ready');
  });

  it('reports a failed image write and keeps the previous stored image', async() => {
    const before = await readImages();
    await worker.evaluate(() => {
      globalThis.auditPut = IDBObjectStore.prototype.put;
      globalThis.auditFetch = globalThis.fetch;
      IDBObjectStore.prototype.put = () => { throw new DOMException('Injected failure', 'QuotaExceededError'); };
      globalThis.fetch = async() => new Response('<svg xmlns="http://www.w3.org/2000/svg"/>',
        { headers: { 'content-type': 'image/svg+xml' } });
    });
    try {
      const response = await page.evaluate(id => chrome.runtime.sendMessage({ remoteThumbnail: {
        id, url: 'https://example.com/image.svg', source: 'url', sourceUrl: 'https://example.com/image.svg'
      } }), data.ids[0]);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('STORE_FAILED');
      expect(await readImages()).toEqual(before);
    } finally {
      await worker.evaluate(() => {
        IDBObjectStore.prototype.put = globalThis.auditPut;
        globalThis.fetch = globalThis.auditFetch;
      });
    }
  });

  it('cleans an image when its bookmark actually leaves the home folder', async() => {
    await worker.evaluate(({ id, parent }) => chrome.bookmarks.move(id, { parentId: parent }),
      { id: data.ids[1], parent: data.parent });
    await page.waitForSelector(`#vb-${data.ids[1]}`, { hidden: true });
    expect((await readImages()).map(row => row.id)).toEqual([data.ids[0]]);
  });

  it('saves once and closes the modal when adding by shortcut with the add tile hidden', async() => {
    await worker.evaluate(async() => {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, show_create_column: false } });
    });
    await page.reload();
    await page.waitForSelector('body.page-ready');
    expect(await page.$('#add')).toBeNull();
    await page.keyboard.down('Alt');
    await page.keyboard.press('KeyN');
    await page.keyboard.up('Alt');
    await page.waitForSelector('#modal.is-shown');
    await page.evaluate(() => {
      document.getElementById('title').value = 'Added by shortcut';
      document.getElementById('url').value = 'https://example.org/shortcut';
      document.getElementById('saveBookmarkBtn').click();
    });
    await page.waitForSelector('#modal.is-shown', { hidden: true });
    const matches = await worker.evaluate(() => chrome.bookmarks.search({ title: 'Added by shortcut' }));
    expect(matches).toHaveLength(1);
    await page.waitForSelector(`#vb-${matches[0].id}`);
    expect(errors).toEqual([]);
  });

  it('keeps the modal open on write failure and retries without creating a duplicate', async() => {
    await page.waitForFunction(() => !document.body.classList.contains('gmodal-open'));
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.down('Alt');
    await page.keyboard.press('KeyN');
    await page.keyboard.up('Alt');
    await page.waitForSelector('#modal.is-shown');
    await page.evaluate(() => {
      window.auditPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = () => { throw new DOMException('Injected failure', 'QuotaExceededError'); };
      document.getElementById('title').value = 'Retry after failed save';
      document.getElementById('url').value = 'https://example.org/retry';
      document.getElementById('saveBookmarkBtn').click();
    });
    try {
      await page.waitForSelector('.toast--error');
      expect(await page.$('#modal.is-shown')).not.toBeNull();
      expect(await worker.evaluate(() => chrome.bookmarks.search({ title: 'Retry after failed save' })))
        .toHaveLength(1);
    } finally {
      await page.evaluate(() => { IDBObjectStore.prototype.put = window.auditPut; });
    }
    await page.$eval('#saveBookmarkBtn', button => button.click());
    await page.waitForSelector('#modal.is-shown', { hidden: true });
    expect(await worker.evaluate(() => chrome.bookmarks.search({ title: 'Retry after failed save' })))
      .toHaveLength(1);
    expect(errors).toEqual([]);
  });

  it('preserves the live image and clears its overlay after failed reset and upload', async() => {
    await worker.evaluate(async() => {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, without_confirmation: true } });
    });
    await page.reload();
    await page.waitForSelector('body.page-ready');
    await page.evaluate(id => document.getElementById('context-menu').dispatchEvent(
      new CustomEvent('vb:contextmenu:select', { detail: {
        trigger: document.getElementById(`vb-${id}`), selection: 'edit'
      } })
    ), data.ids[0]);
    await page.waitForSelector('#modal.is-shown');
    await page.waitForFunction(() => !document.getElementById('modal').instance._isTransitiong, { timeout: 5000 });
    await page.evaluate(id => {
      window.auditPut = IDBObjectStore.prototype.put;
      window.auditRevoke = URL.revokeObjectURL;
      window.auditOldImage = document.getElementById(`vb-${id}`).image;
      window.auditWriteAttempts = 0;
      window.auditRevoked = [];
      URL.revokeObjectURL = url => { window.auditRevoked.push(url); window.auditRevoke(url); };
      IDBObjectStore.prototype.put = () => {
        window.auditWriteAttempts += 1;
        throw new DOMException('Injected failure', 'QuotaExceededError');
      };
    }, data.ids[0]);
    try {
      await page.$eval('#resetCustomImage', button => button.click());
      await page.waitForSelector('.toast--error');
      await page.evaluate(async id => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 8;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const transfer = new DataTransfer();
        transfer.items.add(new File([blob], 'thumbnail.png', { type: 'image/png' }));
        const input = document.getElementById('upload');
        input.dataset.id = id;
        input.dataset.modal = 'true';
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, data.ids[0]);
      await page.waitForFunction(id => window.auditWriteAttempts >= 2
        && !document.getElementById(`vb-${id}`).hasOverlay, { timeout: 5000 }, data.ids[0])
        .catch(async error => {
          throw new Error(`${error.message}: ${JSON.stringify(await page.evaluate(id => ({
            attempts: window.auditWriteAttempts,
            overlay: document.getElementById(`vb-${id}`).hasOverlay,
            upload: document.getElementById('upload').dataset,
            notices: [...document.querySelectorAll('.toast')].map(node => node.textContent)
          }), data.ids[0]))}`);
        });
      expect(await page.evaluate(id => ({
        same: document.getElementById(`vb-${id}`).image === window.auditOldImage,
        revoked: window.auditRevoked.includes(window.auditOldImage)
      }), data.ids[0])).toEqual({ same: true, revoked: false });
      expect((await readImages()).find(row => row.id === data.ids[0]).source).toBe('local');
      expect(errors).toEqual([]);
    } finally {
      await page.evaluate(() => {
        IDBObjectStore.prototype.put = window.auditPut;
        URL.revokeObjectURL = window.auditRevoke;
      });
      await page.$eval('#modal [data-gmodal="dismiss"]', button => button.click());
    }
  });
});
