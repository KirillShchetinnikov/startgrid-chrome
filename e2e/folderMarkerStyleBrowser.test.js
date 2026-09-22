import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { bootstrap } from './bootstrap';

describe('folder marker styles in the grid', () => {
  let browser, worker, page, extensionUrl, folders;

  beforeAll(async() => {
    ({ browser, worker, extPage: page, extensionUrl } = await bootstrap());
    await page.waitForSelector('#add');
    await page.close();
    folders = await worker.evaluate(async() => {
      const home = await chrome.bookmarks.create({ parentId: '1', title: 'Marker home' });
      const outer = await chrome.bookmarks.create({ parentId: home.id, title: 'Outer folder' });
      const nested = await chrome.bookmarks.create({ parentId: outer.id, title: 'Nested folder' });
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings,
        enable_sync: false, default_folder_id: home.id, show_last_opened_folder: false,
        folder_preview: false, folder_marker_style: 'none', show_bookmark_title: true,
        bookmark_title_position: 'inside', show_home_folders: true,
        snow_mode: 'off', page_cascade_enabled: false
      } });

      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('startgrid', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('images', { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const tx = db.transaction('images', 'readwrite');
      const blob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">'
        + '<rect width="32" height="32" fill="red"/></svg>'], { type: 'image/svg+xml' });
      tx.objectStore('images').put({
        id: outer.id, blob, source: 'local', sourceOverride: true, custom: true
      });
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      return { home: home.id, outer: outer.id, nested: nested.id };
    });
    page = await browser.newPage();
    await page.goto(`${extensionUrl}#${folders.home}`);
    await page.waitForSelector(`#vb-${folders.outer}`);
  });

  afterAll(async() => {
    await browser?.close();
  });

  async function selectStyle(style, folderId = folders.outer) {
    await page.select('#quick_folder_marker_style', style);
    await page.waitForFunction(({ id, style }) =>
      document.getElementById(`vb-${id}`)?.getAttribute('folder-marker-style') === style,
    {}, { id: folderId, style });
  }

  it('keeps the marker independent from a custom folder image', async() => {
    await page.waitForFunction(id =>
      Boolean(document.querySelector(`#vb-${id} [data-thumb]`)?.style.backgroundImage),
    {}, folders.outer);
    expect(await page.$eval(`#vb-${folders.outer} [data-thumb]`, node =>
      Boolean(node.style.backgroundImage))).toBe(true);

    await selectStyle('badge');
    expect(await page.$(`#vb-${folders.outer} .bookmark__folder-marker--badge`)).not.toBeNull();
  });

  it('switches between all styles and applies them inside nested folders', async() => {
    await selectStyle('title');
    expect(await page.$(`#vb-${folders.outer} .bookmark__folder-marker--title`)).not.toBeNull();
    expect(await page.$(`#vb-${folders.outer} .bookmark__favicon`)).toBeNull();

    await selectStyle('tab');
    expect(await page.$eval(`#vb-${folders.outer}`, node =>
      getComputedStyle(node, '::before').content)).not.toBe('none');

    await selectStyle('border');
    expect(await page.$eval(`#vb-${folders.outer}`, node =>
      getComputedStyle(node).outlineStyle)).toBe('solid');

    await page.click(`#vb-${folders.outer} > [data-thumb]`);
    await page.waitForSelector(`#vb-${folders.nested}[folder-marker-style="border"]`);
  });

  it('can be disabled globally', async() => {
    await selectStyle('none', folders.nested);
    expect(await page.$(`#vb-${folders.nested} .bookmark__folder-marker`)).toBeNull();
  });
});
