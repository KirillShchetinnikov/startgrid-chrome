import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { bootstrap } from './bootstrap';

describe('selective sync controls in the extension', () => {
  let browser, worker, page;
  const errors = [];
  beforeAll(async() => {
    const context = await bootstrap();
    ({ browser, worker } = context);
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1000 });
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(context.extensionUrl.replace('newtab.html', 'options.html'));
    await page.waitForSelector('#sync-choice-color_theme');
    await page.click('[data-section-id="data"].settings-nav__item');
    await page.$eval('[data-sync-block="page"]', details => { details.open = true; });
  });
  afterAll(async() => { await browser?.close(); });

  it('renders labeled global controls and excludes local-only settings', async() => {
    expect(await page.$eval('#sync-choice-color_theme', input => input.checked)).toBe(true);
    expect(await page.$('#sync-choice-language')).toBeNull();
    expect(await page.$('#sync-choice-enable_sync')).toBeNull();
    expect(await page.$eval('label[for="sync-choice-color_theme"]', label => label.textContent.length)).toBeGreaterThan(0);
  });

  it('removes the cloud value when switched off and publishes local value when switched on', async() => {
    await page.click('.switch__label[for="sync-choice-color_theme"]');
    await page.waitForFunction(async() => {
      const records = await chrome.storage.sync.get(null);
      return records['startgrid.policy.color_theme']?.enabled === false
        && !Object.keys(records).some(key => key.startsWith('startgrid.setting.color_theme.'));
    });
    await page.waitForFunction(() => !document.getElementById('sync-choice-color_theme').disabled);
    await page.select('#color_theme', 'dark');
    await page.waitForFunction(async() => (await chrome.storage.local.get('settings')).settings.color_theme === 'dark');
    await page.click('.switch__label[for="sync-choice-color_theme"]');
    await page.waitForFunction(async() => {
      const records = await chrome.storage.sync.get(null);
      const policy = records['startgrid.policy.color_theme'];
      return policy?.enabled && records['startgrid.setting.color_theme.' + policy.epoch]?.value.color_theme === 'dark';
    });
    if (process.env.STARTGRID_SCREENSHOT_DIR) {
      await page.screenshot({ path: process.env.STARTGRID_SCREENSHOT_DIR + '/selective-sync.png' });
    }
  });

  it('applies cloud changes to an already open options page', async() => {
    await worker.evaluate(async() => {
      const policy = (await chrome.storage.sync.get('startgrid.policy.color_theme'))['startgrid.policy.color_theme'];
      await chrome.storage.sync.set({
        ['startgrid.setting.color_theme.' + policy.epoch]: { value: { color_theme: 'light' } }
      });
    });
    await page.waitForFunction(() => document.getElementById('color_theme').value === 'light');
    expect(errors).toEqual([]);
  });

  it('switches whole blocks and reflects individual exclusions as a mixed state', async() => {
    expect(await page.$$('#sync_selection details')).toHaveLength(18);
    await page.click('.switch__label[for="sync-choice-color_theme"]');
    await page.waitForFunction(() => document.getElementById('sync-block-page').indeterminate);
    await page.waitForFunction(() => !document.getElementById('sync-block-page').disabled);
    await page.click('.switch__label[for="sync-block-page"]');
    await page.waitForFunction(() => {
      const input = document.getElementById('sync-block-page');
      return input.checked && !input.indeterminate && !input.disabled;
    });
    await page.click('.switch__label[for="sync-block-page"]');
    await page.waitForFunction(async() => {
      const records = await chrome.storage.sync.get(null);
      return records['startgrid.policy.color_theme'].enabled === false
        && records['startgrid.policy.background_image'].enabled === false;
    });
    expect(await page.$eval('#sync-choice-background_image', input => input.checked)).toBe(false);
    await page.setViewport({ width: 390, height: 844 });
    await page.$eval('[data-sync-block="page"]', node => node.scrollIntoView({ block: 'start' }));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (process.env.STARTGRID_SCREENSHOT_DIR) {
      await page.screenshot({ path: process.env.STARTGRID_SCREENSHOT_DIR + '/selective-sync-mobile.png' });
    }
    expect(errors).toEqual([]);
  });
});
