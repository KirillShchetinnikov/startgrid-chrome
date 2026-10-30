import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { bootstrap } from './bootstrap';

describe('search request cancellation, background retry and nested dialogs', () => {
  let browser, worker, page, extensionUrl, defaults, bookmarkId;
  const errors = [];
  const backgroundUrl = 'https://example.test/persisted-background.svg';

  async function openPage(settings = {}, backgroundState = null) {
    await page?.close();
    await worker.evaluate(settings => chrome.storage.local.set({ settings }), { ...defaults, ...settings });
    page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(7000);
    if (backgroundState) {
      await page.setRequestInterception(true);
      page.on('request', request => {
        if (request.url() !== backgroundUrl) return request.continue();
        if (backgroundState === 'offline') return request.abort('internetdisconnected');
        return request.respond({ status: 200, contentType: 'image/svg+xml',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">'
            + '<rect width="10" height="10" fill="red"/></svg>' });
      });
    }
    await page.goto(extensionUrl);
    await page.waitForSelector('body.page-ready');
  }

  beforeAll(async() => {
    ({ browser, worker, extPage: page, extensionUrl } = await bootstrap());
    await page.waitForSelector('#add');
    const setup = await worker.evaluate(async() => {
      await chrome.storage.local.set({ importingBookmarks: true });
      const home = await chrome.bookmarks.create({ parentId: '1', title: 'Dialog tests' });
      const bookmark = await chrome.bookmarks.create({ parentId: home.id,
        title: 'Editable thumbnail', url: 'https://example.com/' });
      const { settings } = await chrome.storage.local.get('settings');
      const db = await new Promise(resolve => {
        const request = indexedDB.open('startgrid', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('images', { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result);
      });
      const tx = db.transaction('images', 'readwrite');
      tx.objectStore('images').put({ id: bookmark.id, source: 'local', custom: true, sourceOverride: true,
        blob: new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>'],
          { type: 'image/svg+xml' }) });
      await new Promise(resolve => { tx.oncomplete = resolve; });
      db.close();
      await chrome.storage.local.remove('importingBookmarks');
      return { settings, home: home.id, bookmark: bookmark.id };
    });
    bookmarkId = setup.bookmark;
    defaults = { ...setup.settings, enable_sync: false, default_folder_id: setup.home,
      performance_mode: 'full', language: 'en', show_last_opened_folder: false,
      search_engine: 'bookmarks', snow_mode: 'off', page_cascade_enabled: false,
      background_image: '', thumbnails_auto_refresh: false, download_favicons_by_default: false,
      without_confirmation: false };
  });

  afterAll(async() => { await browser?.close(); });

  it('ignores suggestions that arrive after switching to bookmark search', async() => {
    await openPage({ search_engine: 'google' });
    await page.waitForSelector('#suggest');
    await page.evaluate(() => {
      const header = document.querySelector('vb-header');
      header.suggestRequest = () => new Promise(resolve => { window.finishSuggestion = resolve; });
      window.pendingSuggestion = header.suggestSearch('old query');
      header.engine = 'bookmarks';
    });
    await page.waitForFunction(() => document.querySelector('vb-header').suggestNode === null);
    await page.evaluate(async() => {
      window.finishSuggestion(['old answer']);
      await window.pendingSuggestion;
    });
    expect(await page.$('#suggest')).toBeNull();
    expect(errors).toEqual([]);
  });

  it('does not reopen a hidden list when a dismissed request finishes', async() => {
    await openPage({ search_engine: 'google' });
    await page.waitForSelector('#suggest');
    const state = await page.evaluate(async() => {
      const header = document.querySelector('vb-header');
      let finish;
      header.suggestRequest = () => new Promise(resolve => { finish = resolve; });
      const pending = header.suggestSearch('old query');
      header.closeSuggest();
      finish(['old answer']);
      await pending;
      return { hidden: header.suggestNode.hidden, list: header.suggestList };
    });
    expect(state).toEqual({ hidden: true, list: [] });
  });

  it('keeps a saved external background URL after a transient outage and retries later', async() => {
    const settings = { background_image: 'background_external', background_external: backgroundUrl };
    await openPage(settings, 'online');
    await page.waitForSelector('#bg.is-visible img');
    await openPage(settings, 'offline');
    await page.waitForSelector('.toast');
    expect(await worker.evaluate(async() => (await chrome.storage.local.get('settings')).settings.background_external))
      .toBe(backgroundUrl);
    // Reuse the saved value, without restoring it from the test fixture.
    defaults = await worker.evaluate(async() => (await chrome.storage.local.get('settings')).settings);
    await openPage({}, 'online');
    await page.waitForSelector('#bg.is-visible img');
    defaults = { ...defaults, background_image: '', background_external: '' };
  });

  it('keeps the background inert after cancelling an inner confirmation', async() => {
    await openPage();
    await page.evaluate(id => document.getElementById('context-menu').dispatchEvent(
      new CustomEvent('vb:contextmenu:select', { detail: {
        trigger: document.getElementById(`vb-${id}`), selection: 'edit'
      } })
    ), bookmarkId);
    await page.waitForSelector('#modal.is-shown');
    await page.waitForFunction(() => !document.getElementById('modal').instance._isTransitiong);
    expect(await page.$eval('.app', node => node.inert)).toBe(true);
    await page.click('#deleteThumbnail');
    await page.waitForSelector('#popup.is-shown');
    await page.waitForFunction(() => !document.getElementById('popup').instance._isTransitiong);
    await page.click('#popup [data-popup="reject"]');
    await page.waitForSelector('#popup', { hidden: true });
    await page.keyboard.press('Slash');
    expect(await page.evaluate(() => ({
      inert: document.querySelector('.app').inert,
      scrollLocked: document.body.classList.contains('gmodal-open'),
      modalOpen: document.getElementById('modal').classList.contains('is-shown'),
      focusInModal: document.getElementById('modal').contains(document.activeElement)
    }))).toEqual({ inert: true, scrollLocked: true, modalOpen: true, focusInModal: true });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('modal').instance._isOpen);
    expect(await page.$eval('.app', node => node.inert)).toBe(false);
    expect(errors).toEqual([]);
  });

  it('closes both dialogs on Back and restores background access', async() => {
    await openPage();
    await page.evaluate(id => document.getElementById('context-menu').dispatchEvent(
      new CustomEvent('vb:contextmenu:select', { detail: {
        trigger: document.getElementById(`vb-${id}`), selection: 'edit'
      } })
    ), bookmarkId);
    await page.waitForFunction(() => document.getElementById('modal').instance._isOpen
      && !document.getElementById('modal').instance._isTransitiong);
    await page.click('#deleteThumbnail');
    await page.waitForFunction(() => document.getElementById('popup')?.instance._isOpen
      && !document.getElementById('popup').instance._isTransitiong);
    await page.evaluate(() => {
      history.pushState(history.state, '');
      history.back();
    });
    await page.waitForFunction(() => !document.getElementById('modal').instance._isOpen);
    await page.waitForSelector('#popup', { hidden: true });
    expect(await page.evaluate(() => ({ inert: document.querySelector('.app').inert,
      scrollLocked: document.body.classList.contains('gmodal-open') })))
      .toEqual({ inert: false, scrollLocked: false });
    await page.click('vb-header input');
    expect(await page.$eval('vb-header input', node => node === document.activeElement)).toBe(true);
    expect(errors).toEqual([]);
  });
});
