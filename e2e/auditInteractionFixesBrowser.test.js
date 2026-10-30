import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { bootstrap } from './bootstrap';

describe('audited bookmark interactions', () => {
  let browser, worker, page, extensionUrl, data, defaults;
  const errors = [];

  async function fresh(values = {}) {
    if (page && !page.isClosed()) await page.close();
    await worker.evaluate(settings => chrome.storage.local.set({ settings }), { ...defaults, ...values });
    page = await browser.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(8000);
    await page.goto(extensionUrl);
    await page.waitForSelector('body.page-ready');
  }

  async function select(id, modifier = 'shiftKey') {
    await page.evaluate(({ id, modifier }) => document.getElementById(`vb-${id}`).dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, [modifier]: true })
    ), { id, modifier });
  }

  async function edit(id) {
    await page.evaluate(id => document.getElementById('context-menu').dispatchEvent(
      new CustomEvent('vb:contextmenu:select', { detail: {
        trigger: document.getElementById(`vb-${id}`), selection: 'edit'
      } })
    ), id);
    await page.waitForSelector('#modal.is-shown');
    await page.waitForFunction(() => !document.getElementById('modal').instance._isTransitiong);
  }

  beforeAll(async() => {
    ({ browser, worker, extPage: page, extensionUrl } = await bootstrap());
    await page.waitForSelector('#add');
    await page.close();
    const initial = await worker.evaluate(async() => {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ importingBookmarks: true });
      const home = await chrome.bookmarks.create({ parentId: '1', title: 'Audit home' });
      const folder = await chrome.bookmarks.create({ parentId: home.id, title: 'Subfolder' });
      const a = await chrome.bookmarks.create({ parentId: home.id, title: 'Alpha', url: 'https://example.com/a' });
      const b = await chrome.bookmarks.create({ parentId: home.id, title: 'Beta', url: 'https://example.com/b' });
      const nested = await chrome.bookmarks.create({ parentId: folder.id, title: 'Nested unique', url: 'https://example.com/nested' });
      const internal = await chrome.bookmarks.create({ parentId: home.id, title: 'Internal', url: 'chrome://version/' });
      await chrome.storage.local.remove('importingBookmarks');
      return { settings, data: { home: home.id, folder: folder.id, a: a.id, b: b.id, nested: nested.id, internal: internal.id } };
    });
    data = initial.data;
    defaults = { ...initial.settings, language: 'en', enable_sync: false, performance_mode: 'full',
      default_folder_id: data.home, show_last_opened_folder: false, background_image: '',
      snow_mode: 'off', page_cascade_enabled: false, thumbnail_source: 'favicon',
      download_favicons_by_default: false, thumbnails_auto_refresh: false,
      without_confirmation: true, search_engine: 'bookmarks' };
  });

  afterAll(async() => { await browser?.close(); });

  it('serializes duplicate submit events until the first save finishes', async() => {
    await fresh();
    await page.$eval('#add', node => node.click());
    await page.waitForSelector('#modal.is-shown');
    await page.evaluate(() => {
      document.getElementById('title').value = 'One saved bookmark';
      document.getElementById('url').value = 'https://example.org/one';
      const form = document.getElementById('formBookmark');
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await page.waitForSelector('#modal.is-shown', { hidden: true });
    expect(await worker.evaluate(() => chrome.bookmarks.search({ title: 'One saved bookmark' }))).toHaveLength(1);
    expect(await page.$eval('#saveBookmarkBtn', button => button.disabled)).toBe(false);
  });

  it('cancels a queued search on reset and on folder navigation', async() => {
    await fresh();
    await page.evaluate(() => {
      const header = document.querySelector('vb-header');
      header.inputNode.value = 'Alpha';
      header.inputNode.dispatchEvent(new Event('input', { bubbles: true }));
      header.resetNode.click();
    });
    await page.waitForFunction(() => !document.body.classList.contains('has-search'));
    await new Promise(resolve => setTimeout(resolve, 650));
    expect(await page.$(`#vb-${data.b}`)).not.toBeNull();
    expect(await page.$eval('vb-header input', node => node.value)).toBe('');
    await page.evaluate(() => {
      const input = document.querySelector('vb-header').inputNode;
      input.value = 'Alpha'; input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.$eval(`#vb-${data.folder} [data-thumb]`, node => node.click());
    await page.waitForSelector(`#vb-${data.nested}`);
    await new Promise(resolve => setTimeout(resolve, 650));
    expect(await page.$(`#vb-${data.nested}`)).not.toBeNull();
    expect(await page.$(`#vb-${data.a}`)).toBeNull();
    expect(await page.$eval('body', node => node.classList.contains('has-search'))).toBe(false);
  });

  it.each(['Shift', 'Ctrl'])('selects with %s without recording an opening or navigating', async modifier => {
    await fresh({ keyboard_shortcuts: { ...defaults.keyboard_shortcuts, select_multiple_bookmarks: modifier } });
    await page.evaluate(() => {
      localStorage.removeItem('bookmark_usage_counts');
      window.selectionTabUpdates = [];
      chrome.tabs.update = async(...args) => { window.selectionTabUpdates.push(args); return {}; };
    });
    const id = modifier === 'Ctrl' ? data.internal : data.a;
    await select(id, modifier === 'Ctrl' ? 'ctrlKey' : 'shiftKey');
    await page.waitForSelector('#bookmarks-panel');
    expect(await page.evaluate(id => ({
      selected: document.getElementById(`vb-${id}`).hasAttribute('data-selected'),
      counts: JSON.parse(localStorage.getItem('bookmark_usage_counts') || '{}'),
      updates: window.selectionTabUpdates
    }), id)).toEqual({ selected: true, counts: {}, updates: [] });
  });

  it('invalidates all pending panel reads when Escape clears a selection', async() => {
    await fresh();
    await page.evaluate(() => {
      const original = chrome.bookmarks.getTree.bind(chrome.bookmarks);
      window.panelReadReleases = [];
      chrome.bookmarks.getTree = async(...args) => {
        const tree = await original(...args);
        await new Promise(resolve => window.panelReadReleases.push(resolve));
        return tree;
      };
    });
    await select(data.a);
    await select(data.b);
    await page.waitForFunction(() => window.panelReadReleases.length === 2);
    await page.keyboard.press('Escape');
    await page.evaluate(async() => {
      window.panelReadReleases.forEach(resolve => resolve());
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(await page.$$('#bookmarks-panel')).toHaveLength(0);
    expect(await page.$$('#bookmarks [data-selected]')).toHaveLength(0);
  });

  it('moves a nested search result into the current home folder', async() => {
    await fresh();
    await page.evaluate(() => {
      const input = document.querySelector('vb-header').inputNode;
      input.value = 'Nested unique'; input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForSelector(`#vb-${data.nested}`);
    await select(data.nested);
    await page.waitForSelector('#bookmarks-panel');
    await page.select('#bookmarks-panel select', data.home);
    expect(await page.$eval('#panel_bookmark_selector', node => ({ hidden: node.hidden, disabled: node.disabled })))
      .toEqual({ hidden: false, disabled: false });
    await page.$eval('#panel_bookmark_selector', node => node.click());
    await page.waitForFunction(async({ id, home }) => (await chrome.bookmarks.get(id))[0].parentId === home,
      {}, { id: data.nested, home: data.home });
  });

  it('keeps an edited caption inheriting the global size when no override is specified', async() => {
    await fresh(); await edit(data.a);
    await page.$eval('#bookmarkTitleSize', node => { node.value = ''; });
    await page.$eval('#saveBookmarkBtn', node => node.click());
    await page.waitForSelector('#modal.is-shown', { hidden: true });
    await page.$eval('#quick_bookmark_title_size', node => {
      node.value = '22'; node.dispatchEvent(new Event('input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForFunction(id => {
      const tile = document.getElementById(`vb-${id}`);
      const globalSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bookmark-title-size'));
      return !tile.style.getPropertyValue('--bookmark-title-size')
        && Math.abs(parseFloat(getComputedStyle(tile.querySelector('.bookmark__title')).fontSize) - globalSize) < 0.1;
    }, {}, data.a);
  });

  it('preserves title preferences through the real cache cleanup action', async() => {
    await fresh();
    await worker.evaluate(id => chrome.storage.local.set({ [`bookmark_text_preferences:${id}`]: { titleSize: 22 }, cache_probe: true }), data.a);
    const options = await browser.newPage();
    try {
      await options.goto(extensionUrl.replace('newtab.html', 'options.html'));
      await options.waitForSelector('body:not([data-options-loading])');
      await options.$eval('#clear_cache', node => node.click());
      await options.waitForSelector('#popup.is-shown');
      await options.waitForFunction(() => !document.getElementById('popup').instance._isTransitiong);
      await options.$eval('#popup [data-popup="resolve"]', node => node.click());
      await options.waitForSelector('#popup', { hidden: true });
      await options.waitForFunction(async() => !(await chrome.storage.local.get('cache_probe')).cache_probe);
      expect(await worker.evaluate(id => chrome.storage.local.get(`bookmark_text_preferences:${id}`), data.a))
        .toEqual({ [`bookmark_text_preferences:${data.a}`]: { titleSize: 22 } });
    } finally { await options.close(); }
  });

  it('keeps a pending removal absent after navigation and restores it on undo', async() => {
    const item = await worker.evaluate(home => chrome.bookmarks.create({ parentId: home,
      title: 'Pending removal', url: 'https://example.org/pending' }), data.home);
    await fresh();
    await page.evaluate(id => document.getElementById('context-menu').dispatchEvent(new CustomEvent('vb:contextmenu:select',
      { detail: { trigger: document.getElementById(`vb-${id}`), selection: 'remove' } })), item.id);
    await page.waitForFunction(id => document.getElementById(`vb-${id}`).hidden, {}, item.id);
    await page.$eval(`#vb-${data.folder} [data-thumb]`, node => node.click());
    await page.waitForFunction(id => document.getElementById('bookmarks').dataset.folder === id, {}, data.folder);
    await page.$eval('#bookmark-back', node => node.click());
    await page.waitForSelector(`#vb-${data.a}`);
    expect(await page.$(`#vb-${item.id}`)).toBeNull();
    await page.$eval('.toast__action', node => node.click());
    await page.waitForSelector(`#vb-${item.id}`);
    expect((await worker.evaluate(id => chrome.bookmarks.get(id), item.id))).toHaveLength(1);
    expect(errors).toEqual([]);
  });
});
