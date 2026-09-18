import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { bootstrap } from './bootstrap';

describe('folder previews in the grid', () => {
  let browser, worker, page, extensionUrl, folders;

  beforeAll(async() => {
    ({ browser, worker, extPage: page, extensionUrl } = await bootstrap());
    await page.waitForSelector('#add');
    await page.close();
    folders = await worker.evaluate(async() => {
      const home = await chrome.bookmarks.create({ parentId: '1', title: 'Preview home' });
      const outer = await chrome.bookmarks.create({ parentId: home.id, title: 'Only folders' });
      const nested = await chrome.bookmarks.create({ parentId: outer.id, title: 'Sites' });
      const empty = await chrome.bookmarks.create({ parentId: outer.id, title: 'Empty' });
      await chrome.bookmarks.create({ parentId: nested.id, title: 'Site', url: 'https://example.com' });
      const site = await chrome.bookmarks.create({ parentId: home.id, title: 'Home site', url: 'https://example.org' });
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, enable_sync: false,
        default_folder_id: home.id, show_last_opened_folder: false, folder_preview: true,
        bookmark_title_position: 'outside', show_home_folders: true,
        thumbnail_source: 'favicon', download_favicons_by_default: false } });
      return { home: home.id, outer: outer.id, nested: nested.id, empty: empty.id, site: site.id };
    });
    page = await browser.newPage();
    await page.goto(`${extensionUrl}#${folders.home}`);
    await page.waitForSelector(`#vb-${folders.outer} .bookmark__img--children`);
  });

  afterAll(async() => { await browser?.close(); });

  it('shows child folder icons and keeps the same surface as a site tile', async() => {
    expect(await page.$$eval(`#vb-${folders.outer} .bookmark__img--children`, nodes =>
      nodes.map(node => node.classList.contains('bookmark__img--folder')))).toEqual([true, true]);
    const surfaces = await page.evaluate(({ outer, site }) => [outer, site].map(id => {
      const node = document.querySelector(`#vb-${id} > [data-thumb]`);
      const style = getComputedStyle(node);
      return [style.backgroundColor, style.borderRadius, style.boxShadow, style.filter,
        Math.round(node.getBoundingClientRect().height)];
    }), folders);
    expect(surfaces[0]).toEqual(surfaces[1]);
    expect(await page.$eval(`#vb-${folders.outer} .bookmark__img--children`, node =>
      getComputedStyle(node).boxShadow)).toBe('none');
  });

  it('previews sites in nested folders and falls back for empty folders', async() => {
    // Wait for the entrance animation before Puppeteer computes click coordinates.
    await page.$eval(`#vb-${folders.outer}`, async node => {
      await Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished));
    });
    await page.click(`#vb-${folders.outer} > [data-thumb]`);
    await page.waitForSelector(`#vb-${folders.nested} .bookmark__img--children`);
    expect(await page.$$eval(`#vb-${folders.nested} .bookmark__img--children`, nodes => nodes.length)).toBe(1);
    expect(await page.$(`#vb-${folders.empty} > .bookmark__img--folder`)).not.toBeNull();
    expect(await page.$(`#vb-${folders.empty} .bookmark__img--children`)).toBeNull();
  });

  it('toggles previews live while inside a nested folder', async() => {
    await page.$eval('#quick_folder_preview', node => node.click());
    await page.waitForSelector(`#vb-${folders.nested} > .bookmark__img--folder`);
    expect(await page.$(`#vb-${folders.nested} .bookmark__img--children`)).toBeNull();
    await page.$eval('#quick_folder_preview', node => node.click());
    await page.waitForSelector(`#vb-${folders.nested} .bookmark__img--children`);
  });
});
