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
    expect(await page.$eval('#dial_tile_size', node => node.max)).toBe('300');
    expect(await readPreferences()).toEqual(preferences);
    expect(await readCloud()).toEqual(cloudPreferences);
  });

  it('quick settings show the preferred size even when tiles are smaller', async() => {
    await page.goto(extensionUrl);
    await page.waitForSelector('.display-settings-link');
    await page.click('.display-settings-link');
    expect(await page.$eval('#quick_dial_tile_size', node => node.value)).toBe('200');
    expect(await page.$eval('#quick_dial_tile_size', node => node.max)).toBe('300');
    expect(await readSize()).toBeLessThan(200);
    expect(await readPreferences()).toEqual(preferences);
    expect(await readCloud()).toEqual(cloudPreferences);
  });
});
