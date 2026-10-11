import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { bootstrap } from './bootstrap';

describe('responsive grid preferences', () => {
  let browser, worker, page, extensionUrl, cloudPreferences;
  const preferences = {
    dial_columns: 7, dial_width: 70, dial_tile_size: 200,
    dial_horizontal_gap: 20, dial_vertical_gap: 20,
    favicon_size: 64, bookmark_title_size: 20
  };
  const readPreferences = () => worker.evaluate(async keys => {
    const { settings } = await chrome.storage.local.get('settings');
    return Object.fromEntries(keys.map(key => [key, settings[key]]));
  }, Object.keys(preferences));
  const readSize = () => page.$eval('html', node =>
    parseFloat(node.style.getPropertyValue('--grid-column-width')));
  const readCloud = () => worker.evaluate(() => chrome.storage.sync.get(null));

  beforeAll(async() => {
    const context = await bootstrap();
    ({ browser, worker, extensionUrl } = context);
    await context.extPage.waitForSelector('#add');
    await context.extPage.close();
    await worker.evaluate(async values => {
      const records = {};
      Object.entries(values).forEach(([key, value]) => {
        records[`startgrid.policy.${key}`] = { enabled: true, epoch: 'responsive-test' };
        records[`startgrid.setting.${key}.responsive-test`] = { value: { [key]: value } };
      });
      await chrome.storage.sync.set(records);
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, ...values,
        enable_sync: true, snow_mode: 'off', page_cascade_enabled: false
      } });
    }, preferences);
    page = await browser.newPage();
  });

  afterAll(async() => { await browser?.close(); });

  it('preserves preferences on narrow startup and restores sizes after widening', async() => {
    await page.setViewport({ width: 800, height: 700 });
    await page.goto(extensionUrl);
    await page.waitForSelector('#add');
    const smallSize = await readSize();
    expect(smallSize).toBeLessThan(200);
    expect(await readPreferences()).toEqual(preferences);
    cloudPreferences = await readCloud();
    expect(cloudPreferences['startgrid.setting.dial_tile_size.responsive-test'].value)
      .toEqual({ dial_tile_size: 200 });
    const smallTitle = await page.$eval('html', node =>
      parseFloat(node.style.getPropertyValue('--bookmark-title-size')));
    expect(smallTitle).toBeLessThan(20);
    await page.reload();
    await page.waitForSelector('#add');
    expect(await readSize()).toBe(smallSize);
    expect(await readPreferences()).toEqual(preferences);
    expect(await readCloud()).toEqual(cloudPreferences);
    await page.setViewport({ width: 2400, height: 1200 });
    await page.waitForFunction(() =>
      document.documentElement.style.getPropertyValue('--grid-column-width') === '200px');
    expect(await readPreferences()).toEqual(preferences);
    expect(await readCloud()).toEqual(cloudPreferences);
  });

  it('opening options on a small screen does not rewrite grid preferences', async() => {
    await page.setViewport({ width: 800, height: 700 });
    await page.goto(extensionUrl.replace('newtab.html', 'options.html'));
    await page.waitForFunction(() => document.getElementById('dial_tile_size')?.value === '200');
    expect(await page.$eval('#dial_tile_size', node => node.max)).toBe('200');
    expect(await readPreferences()).toEqual(preferences);
    expect(await readCloud()).toEqual(cloudPreferences);
  });

  it('quick settings show the preferred size even when tiles are smaller', async() => {
    await page.goto(extensionUrl);
    await page.waitForSelector('.display-settings-link');
    await page.click('.display-settings-link');
    expect(await page.$eval('#quick_dial_tile_size', node => node.value)).toBe('200');
    expect(await page.$eval('#quick_dial_tile_size', node => node.max)).toBe('200');
    expect(await readSize()).toBeLessThan(200);
    expect(await readPreferences()).toEqual(preferences);
    expect(await readCloud()).toEqual(cloudPreferences);
  });

  it.each([640, 800, 1280, 1920])('caps enlargement without compressing spacing at %ipx', async width => {
    await worker.evaluate(async() => {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, enable_sync: false,
        dial_tile_size: 50, dial_horizontal_gap: 20, dial_columns: 7,
        show_settings_icon: true, show_quick_settings_icon: true
      } });
    });
    await page.setViewport({ width, height: 800 });
    await page.goto(extensionUrl);
    await page.waitForSelector('#add');
    await page.click('.display-settings-link');
    const selector = '#quick_dial_tile_size';
    const max = await page.$eval(selector, node => Number(node.max));
    expect(max).toBeLessThan(300);
    await page.$eval(selector, node => {
      node.closest('details').open = true;
      node.value = node.max;
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForFunction(value =>
      document.documentElement.style.getPropertyValue('--grid-column-width') === `${value}px`, {}, max);
    await page.focus(selector);
    await page.keyboard.press('ArrowRight');
    expect(await page.$eval(selector, node => Number(node.value))).toBe(max);
    expect(await page.$eval('html', node => node.style.getPropertyValue('--grid-column-gap'))).toBe('20px');
    expect(await readSize()).toBe(max);
    expect(await page.$eval('#bookmarks', node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.setViewport({ width: 2400, height: 1000 });
    await page.waitForFunction(() => document.getElementById('quick_dial_tile_size').max === '300');
    await page.setViewport({ width, height: 800 });
    await page.waitForFunction(value => Number(document.getElementById('quick_dial_tile_size').max) === value, {}, max);
    await page.goto(extensionUrl.replace('newtab.html', 'options.html'));
    await page.waitForFunction(value => Number(document.getElementById('dial_tile_size')?.max) === value, {}, max);
    expect(await page.$eval('#dial_tile_size', node => Number(node.value))).toBe(max);
  });
});
