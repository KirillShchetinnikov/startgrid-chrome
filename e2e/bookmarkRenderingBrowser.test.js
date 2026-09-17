import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { bootstrap } from './bootstrap';

describe('incremental bookmark rendering and image lifetime', () => {
  let browser, worker, page, extensionUrl, data;

  beforeAll(async() => {
    ({ browser, worker, extPage: page, extensionUrl } = await bootstrap());
    await page.waitForSelector('#add');
    await page.close();
    data = await worker.evaluate(async() => {
      const home = await chrome.bookmarks.create({ parentId: '1', title: 'Rendering home' });
      const folder = await chrome.bookmarks.create({ parentId: home.id, title: 'Empty folder' });
      const ids = [];
      for (let index = 0; index < 160; index++) {
        const item = await chrome.bookmarks.create({
          parentId: home.id, title: `Tile ${index}`, url: `https://example.com/${index}`
        });
        ids.push(item.id);
      }
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings,
        enable_sync: false, default_folder_id: home.id, show_last_opened_folder: false,
        folder_preview: false, thumbnail_source: 'favicon', download_favicons_by_default: false,
        snow_mode: 'off', page_cascade_enabled: false, disable_main_page_scroll: false,
        home_sort_by: 'manual', show_home_folders: true
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
      tx.objectStore('images').put({ id: ids[1], blob, source: 'local', sourceOverride: true, custom: true });
      // This record is loaded but deliberately not displayed (downloads are disabled).
      tx.objectStore('images').put({ id: ids[2], blob, source: 'favicon' });
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
      return { home: home.id, folder: folder.id, ids };
    });
    page = await browser.newPage();
    await page.evaluateOnNewDocument(() => {
      window.__activeBlobUrls = new Set();
      const create = URL.createObjectURL.bind(URL);
      const revoke = URL.revokeObjectURL.bind(URL);
      URL.createObjectURL = blob => {
        const url = create(blob);
        window.__activeBlobUrls.add(url);
        return url;
      };
      URL.revokeObjectURL = url => {
        window.__activeBlobUrls.delete(url);
        revoke(url);
      };
    });
    await page.goto(`${extensionUrl}#${data.home}`);
    await page.waitForSelector(`#vb-${data.ids[159]}`);
    await page.waitForFunction(id => document.querySelector(`#vb-${id} [data-thumb]`).style.backgroundImage,
      {}, data.ids[0]);
  });

  afterAll(async() => { await browser?.close(); });

  it('loads offscreen images only when approaching them', async() => {
    const selector = `#vb-${data.ids[159]}`;
    expect(await page.$eval(`${selector} [data-thumb]`, node => node.style.backgroundImage)).toBe('');
    expect(await page.$eval(`${selector} .bookmark__favicon`, node => node.hasAttribute('src'))).toBe(false);
    await page.$eval(selector, node => node.scrollIntoView());
    await page.waitForFunction(id => document.querySelector(`#vb-${id} [data-thumb]`).style.backgroundImage,
      {}, data.ids[159]);
    await page.$eval('.app', node => { node.scrollTop = 0; });
  });

  it('preserves tile, caption, image, focus and selection when a title changes', async() => {
    await page.evaluate(id => {
      const tile = document.getElementById(`vb-${id}`);
      tile.focus();
      tile.setAttribute('data-selected', '');
      window.__retained = { tile, title: tile.querySelector('.bookmark__title'),
        image: tile.querySelector('[data-thumb]') };
    }, data.ids[0]);
    await worker.evaluate(id => chrome.bookmarks.update(id, { title: 'Renamed tile' }), data.ids[0]);
    await page.waitForFunction(() => window.__retained.title.textContent === 'Renamed tile');
    expect(await page.evaluate(() => {
      const { tile, title, image } = window.__retained;
      return [tile.isConnected, tile.querySelector('.bookmark__title') === title,
        tile.querySelector('[data-thumb]') === image, document.activeElement === tile,
        tile.hasAttribute('data-selected')];
    })).toEqual([true, true, true, true, true]);
  });

  it('keeps tile identity through reordering and releases replaced URLs', async() => {
    const before = await page.evaluate(() => [...window.__activeBlobUrls]);
    expect(before).toHaveLength(2);
    const order = await worker.evaluate(async({ id, home }) => {
      await chrome.bookmarks.move(id, { parentId: home, index: 5 });
      return (await chrome.bookmarks.getChildren(home)).map(item => item.id);
    }, { id: data.ids[0], home: data.home });
    await page.waitForFunction(ids => JSON.stringify(Array.from(document.querySelectorAll('#bookmarks > .bookmark'))
      .map(node => node.dataset.id)) === JSON.stringify(ids), {}, order);
    expect(await page.evaluate(() => window.__retained.tile.isConnected
      && window.__retained.tile.querySelector('[data-thumb]') === window.__retained.image)).toBe(true);
    const after = await page.evaluate(() => [...window.__activeBlobUrls]);
    expect(after).toHaveLength(2);
    expect(before.some(url => after.includes(url))).toBe(false);
  });

  it('updates the URL in place without losing thumbnail sizing', async() => {
    await worker.evaluate(id => chrome.bookmarks.update(id, { url: 'https://example.org/changed' }), data.ids[0]);
    await page.waitForFunction(() => window.__retained.tile.url === 'https://example.org/changed');
    expect(await page.evaluate(() => {
      const { tile, image } = window.__retained;
      return [tile.isConnected, tile.querySelector('[data-thumb]') === image,
        image.classList.contains('bookmark__img--sized'),
        decodeURIComponent(image.style.backgroundImage).includes('https://example.org/changed')];
    })).toEqual([true, true, true, true]);
  });

  it('adds and removes individual tiles without disconnecting the others', async() => {
    const added = await worker.evaluate(home => chrome.bookmarks.create({
      parentId: home, title: 'Added tile', url: 'https://example.org/added'
    }), data.home);
    await page.waitForSelector(`#vb-${added.id}`);
    await worker.evaluate(id => chrome.bookmarks.remove(id), added.id);
    await page.waitForSelector(`#vb-${added.id}`, { hidden: true });
    expect(await page.evaluate(() => window.__retained.tile.isConnected)).toBe(true);
    expect(await page.evaluate(() => window.__activeBlobUrls.size)).toBe(2);
  });

  it('releases displayed and undisplayed thumbnail URLs on folder navigation', async() => {
    await page.click(`#vb-${data.folder} > [data-thumb]`);
    await page.waitForFunction(id => document.getElementById('bookmarks').dataset.folder === id
      && !document.querySelector('#bookmarks > .bookmark'), {}, data.folder);
    expect(await page.evaluate(() => window.__activeBlobUrls.size)).toBe(0);
    await page.click('#bookmark-back');
    await page.waitForSelector(`#vb-${data.ids[0]}`);
    expect(await page.evaluate(() => window.__activeBlobUrls.size)).toBe(2);
  });
});
