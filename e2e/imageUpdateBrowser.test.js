import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { bootstrap } from './bootstrap';

describe('image updates across extension contexts', () => {
  let browser, page, worker, ids;

  const readImage = id => worker.evaluate(async id => {
    const db = await new Promise(resolve => {
      const request = indexedDB.open('startgrid', 1);
      request.onsuccess = () => resolve(request.result);
    });
    const record = await new Promise(resolve => {
      const request = db.transaction('images').objectStore('images').get(id);
      request.onsuccess = () => resolve(request.result);
    });
    db.close();
    return { source: record?.source, type: record?.blob?.type, size: record?.blob?.size,
      revision: record?.revision };
  }, id);

  beforeAll(async() => {
    ({ browser, extPage: page, worker } = await bootstrap());
    await page.waitForSelector('#add');
    ids = await worker.evaluate(async() => {
      await chrome.storage.local.set({ importingBookmarks: true });
      const home = await chrome.bookmarks.create({ parentId: '1', title: 'Image updates' });
      const ids = [];
      for (const title of ['Local winner', 'Favicon event', 'Timeout', 'Shared request']) {
        const bookmark = await chrome.bookmarks.create({ parentId: home.id, title,
          url: `https://example.com/${ids.length}` });
        ids.push(bookmark.id);
      }
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, default_folder_id: home.id,
        enable_sync: false, language: 'en', performance_mode: 'full', show_last_opened_folder: false,
        thumbnail_source: 'favicon', download_favicons_by_default: false, thumbnails_auto_refresh: false,
        background_image: '', snow_mode: 'off', page_cascade_enabled: false } });
      await chrome.storage.local.remove('importingBookmarks');
      return ids;
    });
    await page.reload();
    await page.waitForSelector('body.page-ready');
    await worker.evaluate(() => { globalThis.imageTestOriginalFetch = globalThis.fetch; });
  });

  afterAll(async() => { await browser?.close(); });

  async function interceptFetch() {
    await worker.evaluate(() => {
      globalThis.imageTestPending = false;
      globalThis.imageTestFetchCount = 0;
      globalThis.fetch = () => new Promise(resolve => {
        globalThis.imageTestFetchCount += 1;
        globalThis.imageTestPending = true;
        globalThis.imageTestResolve = resolve;
      });
    });
  }

  async function resolveFetch() {
    await worker.evaluate(() => {
      const response = new Response('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>',
        { headers: { 'content-type': 'image/svg+xml' } });
      Object.defineProperty(response, 'url', { value: 'https://example.com/page' });
      globalThis.fetch = async() => response;
      globalThis.imageTestResolve(response);
    });
  }

  async function waitForFetch() {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (await worker.evaluate(() => globalThis.imageTestPending)) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Worker did not start the intercepted image request');
  }

  it('keeps an actual user-uploaded PNG when an older remote request finishes', async() => {
    await interceptFetch();
    try {
      await page.evaluate(id => {
        window.imageTestResponse = chrome.runtime.sendMessage({ remoteThumbnail: {
          id, url: 'https://example.org/late.svg', source: 'url', sourceOverride: true
        } });
      }, ids[0]);
      await waitForFetch();
      await page.evaluate(async id => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 8;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const transfer = new DataTransfer();
        transfer.items.add(new File([blob], 'local.png', { type: 'image/png' }));
        const input = document.getElementById('upload');
        input.dataset.id = id;
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, ids[0]);
      await page.waitForFunction(id => !document.getElementById(`vb-${id}`).hasOverlay
        && document.getElementById(`vb-${id}`).thumbnailSource === 'local', {}, ids[0]);
      const uploaded = await readImage(ids[0]);
      expect(uploaded.source).toBe('local');
      expect(uploaded.type).toBe('image/webp');
      await resolveFetch();
      const response = await page.evaluate(() => window.imageTestResponse);
      expect(response.superseded).toBe(true);
      expect(await readImage(ids[0])).toEqual(uploaded);
    } finally {
      await worker.evaluate(() => { globalThis.fetch = globalThis.imageTestOriginalFetch; });
    }
  });

  it('shares one download for simultaneous messages requesting the same image', async() => {
    await interceptFetch();
    try {
      await page.evaluate(id => {
        const request = { remoteThumbnail: { id, url: 'https://example.org/shared.svg',
          source: 'url', sourceOverride: true, expectedRevision: null } };
        window.imageTestResponses = Promise.all([
          chrome.runtime.sendMessage(request), chrome.runtime.sendMessage(request)
        ]);
      }, ids[3]);
      await waitForFetch();
      expect(await worker.evaluate(() => globalThis.imageTestFetchCount)).toBe(1);
      await resolveFetch();
      const responses = await page.evaluate(() => window.imageTestResponses);
      expect(responses).toEqual([
        { success: true, updated: true }, { success: true, updated: true }
      ]);
      expect((await readImage(ids[3])).source).toBe('url');
    } finally {
      await worker.evaluate(() => { globalThis.fetch = globalThis.imageTestOriginalFetch; });
    }
  });

  it('broadcasts a rename before waiting for its favicon and broadcasts a successful image update', async() => {
    await page.evaluate(id => {
      window.imageTestMessages = [];
      chrome.runtime.onMessage.addListener(message => {
        if (message.bookmarksChanged?.id === id) window.imageTestMessages.push(message);
      });
    }, ids[1]);
    await worker.evaluate(async() => {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, download_favicons_by_default: true } });
      globalThis.imageTestContains = chrome.permissions.contains;
      chrome.permissions.contains = async() => true;
    });
    await interceptFetch();
    try {
      await worker.evaluate(id => chrome.bookmarks.update(id, { title: 'Renamed before the favicon' }), ids[1]);
      await page.waitForFunction(id => document.getElementById(`vb-${id}`).title === 'Renamed before the favicon',
        { timeout: 1000 }, ids[1]);
      await waitForFetch();
      expect(await page.evaluate(() => window.imageTestMessages.length)).toBe(1);
      await resolveFetch();
      await page.waitForFunction(() => window.imageTestMessages.length === 2);
      expect((await readImage(ids[1])).source).toBe('favicon');
    } finally {
      await worker.evaluate(() => {
        globalThis.fetch = globalThis.imageTestOriginalFetch;
        chrome.permissions.contains = globalThis.imageTestContains;
      });
    }
  });

  it('ends a stalled request after two seconds and prevents the late response from being stored', async() => {
    await interceptFetch();
    try {
      const started = Date.now();
      const response = await page.evaluate(id => chrome.runtime.sendMessage({ remoteThumbnail: {
        id, url: 'https://example.org/timeout.svg', source: 'url'
      } }), ids[2]);
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('TIMEOUT');
      expect(Date.now() - started).toBeLessThan(5000);
      const timedOut = await readImage(ids[2]);
      await resolveFetch();
      await worker.evaluate(async() => { await new Promise(resolve => setTimeout(resolve, 30)); });
      expect(await readImage(ids[2])).toEqual(timedOut);
      expect(timedOut.size).toBeUndefined();
    } finally {
      await worker.evaluate(() => { globalThis.fetch = globalThis.imageTestOriginalFetch; });
    }
  });
});
