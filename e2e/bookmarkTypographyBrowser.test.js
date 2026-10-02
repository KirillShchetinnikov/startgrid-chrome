import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { bootstrap } from './bootstrap';

describe('caption typography in the browser', () => {
  let browser, worker, page, extensionUrl;

  beforeAll(async() => {
    ({ browser, worker, extPage: page, extensionUrl } = await bootstrap());
    await page.waitForSelector('#add');
    await worker.evaluate(async() => {
      const folder = await chrome.bookmarks.create({ parentId: '1', title: 'Typography' });
      await chrome.bookmarks.create({ parentId: folder.id, title: 'Caption example', url: 'https://example.com' });
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, enable_sync: false,
        default_folder_id: folder.id, snow_mode: 'off', page_cascade_enabled: false } });
    });
    await page.reload();
    await page.waitForSelector('.bookmark__title');
  });

  afterAll(async() => { await browser?.close(); });

  it('changes the actual caption through quick controls and preserves it after reload', async() => {
    await page.select('#quick_bookmark_title_font', 'georgia');
    await page.$eval('#quick_bookmark_title_bold', node => {
      node.checked = false;
      node.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.$eval('#quick_bookmark_title_italic', node => {
      node.checked = true;
      node.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const readStyle = () => page.$eval('.bookmark__title', node => {
      const style = getComputedStyle(node);
      return { family: style.fontFamily, weight: style.fontWeight, style: style.fontStyle };
    });
    await page.waitForFunction(() => {
      const style = getComputedStyle(document.querySelector('.bookmark__title'));
      return style.fontFamily.includes('Georgia') && style.fontWeight === '400' && style.fontStyle === 'italic';
    });
    expect(await readStyle()).toEqual({ family: 'Georgia, "Times New Roman", serif', weight: '400', style: 'italic' });
    await page.reload();
    await page.waitForSelector('.bookmark__title');
    expect((await readStyle()).style).toBe('italic');
    expect((await readStyle()).weight).toBe('400');
    expect((await readStyle()).family).toContain('Georgia');
    const options = await browser.newPage();
    await options.goto(extensionUrl.replace('newtab.html', 'options.html'));
    await options.waitForSelector('#bookmark_title_font');
    expect(await options.$eval('#bookmark_title_font', node => node.value)).toBe('georgia');
    expect(await options.$eval('#bookmark_title_bold', node => node.checked)).toBe(false);
    expect(await options.$eval('#bookmark_title_italic', node => node.checked)).toBe(true);
    await options.close();
  });
});
