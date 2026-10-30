import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { bootstrap } from './bootstrap';

describe('pending bookmark deletion lifetime', () => {
  let browser, worker, page, extensionUrl, homeId, folderId;
  const errors = [];

  async function openPage() {
    page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(6000);
    await page.goto(extensionUrl);
    await page.waitForSelector('body.page-ready');
  }

  async function createItems(count) {
    await page?.close();
    page = null;
    const ids = await worker.evaluate(async({ home, count }) => {
      await chrome.storage.local.set({ importingBookmarks: true });
      const ids = [];
      for (let index = 0; index < count; index += 1) {
        const item = await chrome.bookmarks.create({ parentId: home,
          title: `Pending ${Date.now()} ${index}`, url: `https://example.com/pending/${Date.now()}/${index}` });
        ids.push(item.id);
      }
      await chrome.storage.local.remove('importingBookmarks');
      return ids;
    }, { home: homeId, count });
    await openPage();
    await page.waitForSelector(`#vb-${ids.at(-1)}`);
    return ids;
  }

  async function removeSingle(id) {
    await page.evaluate(id => document.getElementById('context-menu').dispatchEvent(
      new CustomEvent('vb:contextmenu:select', { detail: {
        trigger: document.getElementById(`vb-${id}`), selection: 'remove'
      } })
    ), id);
    await page.waitForFunction(id => document.getElementById(`vb-${id}`)?.hidden, {}, id);
  }

  async function removeGroup(ids) {
    await page.keyboard.down('Shift');
    try {
      for (const id of ids) await page.click(`#vb-${id} [data-thumb]`);
    } finally {
      await page.keyboard.up('Shift');
    }
    await page.waitForSelector('#bookmarks-panel');
    await page.waitForFunction(() => document.getElementById('bookmarks-panel').getAnimations()
      .every(animation => animation.playState === 'finished'));
    await page.click('#bookmarks-panel [data-action="remove"]');
    await page.waitForFunction(ids => ids.every(id => document.getElementById(`vb-${id}`)?.hidden), {}, ids);
  }

  async function roundTrip(ids) {
    await page.click(`#vb-${folderId} [data-thumb]`);
    await page.waitForFunction(id => document.getElementById('bookmarks').dataset.folder === id, {}, folderId);
    await page.click('#bookmark-back');
    await page.waitForFunction(id => document.getElementById('bookmarks').dataset.folder === id, {}, homeId);
    await page.waitForSelector(`#vb-${folderId}`);
    expect(await page.evaluate(ids => ids.every(id => !document.getElementById(`vb-${id}`)), ids)).toBe(true);
  }

  async function waitForRemoval(ids, timeout = 12000) {
    await page.waitForFunction(async ids => {
      const remaining = await Promise.all(ids.map(id => chrome.bookmarks.get(id).catch(() => [])));
      return remaining.every(rows => rows.length === 0);
    }, { timeout }, ids);
    await page.waitForFunction(ids => ids.every(id => !document.getElementById(`vb-${id}`)), {}, ids);
  }

  async function closeWithPendingDeletion(ids) {
    await worker.evaluate(() => {
      globalThis.pendingDeletionMessages = [];
      if (!globalThis.pendingDeletionObserver) {
        globalThis.pendingDeletionObserver = message => {
          if (message.bookmarksToDelete) globalThis.pendingDeletionMessages.push(Object.keys(message.bookmarksToDelete));
        };
        chrome.runtime.onMessage.addListener(globalThis.pendingDeletionObserver);
      }
    });
    await page.close({ runBeforeUnload: true });
    page = null;
    const removed = await worker.evaluate(async ids => {
      const limit = Date.now() + 4000;
      do {
        const remaining = await Promise.all(ids.map(id => chrome.bookmarks.get(id).catch(() => [])));
        if (remaining.every(rows => rows.length === 0)) return { removed: true };
        await new Promise(resolve => setTimeout(resolve, 25));
      } while (Date.now() < limit);
      return { removed: false, remaining: await Promise.all(ids.map(id => chrome.bookmarks.get(id).catch(() => []))),
        messages: globalThis.pendingDeletionMessages };
    }, ids);
    expect(removed).toEqual({ removed: true });
    await openPage();
    expect(await page.evaluate(ids => ids.every(id => !document.getElementById(`vb-${id}`)), ids)).toBe(true);
  }

  beforeAll(async() => {
    ({ browser, worker, extPage: page, extensionUrl } = await bootstrap());
    await page.waitForSelector('#add');
    const data = await worker.evaluate(async() => {
      await chrome.storage.local.set({ importingBookmarks: true });
      const home = await chrome.bookmarks.create({ parentId: '1', title: 'Deletion lifetime' });
      const folder = await chrome.bookmarks.create({ parentId: home.id, title: 'Round trip' });
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, enable_sync: false, language: 'en',
        performance_mode: 'full', default_folder_id: home.id, show_last_opened_folder: false,
        without_confirmation: true, search_engine: 'bookmarks', download_favicons_by_default: false,
        thumbnails_auto_refresh: false, snow_mode: 'off', page_cascade_enabled: false, background_image: '',
        keyboard_shortcuts: { ...settings.keyboard_shortcuts, select_multiple_bookmarks: 'Shift' }
      } });
      await chrome.storage.local.remove('importingBookmarks');
      return { home: home.id, folder: folder.id };
    });
    homeId = data.home;
    folderId = data.folder;
  });

  afterAll(async() => { await browser?.close(); });

  it('expires a single pending deletion after navigating away and back', async() => {
    const ids = await createItems(1);
    await removeSingle(ids[0]);
    await roundTrip(ids);
    await waitForRemoval(ids);
    expect(errors).toEqual([]);
  });

  it('expires every selected pending deletion after navigating away and back', async() => {
    const ids = await createItems(2);
    await removeGroup(ids);
    await roundTrip(ids);
    await waitForRemoval(ids);
    expect(errors).toEqual([]);
  });

  it('restores every selected bookmark on undo after navigating away and back', async() => {
    const ids = await createItems(2);
    await removeGroup(ids);
    await roundTrip(ids);
    await page.click('.toast__action');
    for (const id of ids) await page.waitForSelector(`#vb-${id}`);
    expect(await worker.evaluate(async ids => {
      const rows = await Promise.all(ids.map(id => chrome.bookmarks.get(id)));
      return rows.every(rows => rows.length === 1);
    }, ids)).toBe(true);
    expect(errors).toEqual([]);
  });

  it('finalizes a single pending deletion when the new tab closes before expiry', async() => {
    const ids = await createItems(1);
    await removeSingle(ids[0]);
    await closeWithPendingDeletion(ids);
    expect(errors).toEqual([]);
  });

  it('finalizes every selected pending deletion when the new tab closes before expiry', async() => {
    const ids = await createItems(2);
    await removeGroup(ids);
    await closeWithPendingDeletion(ids);
    expect(errors).toEqual([]);
  });
});
