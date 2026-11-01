import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { bootstrap } from './bootstrap';

describe('image uploads in the extension', () => {
  let browser;
  let page;
  let options;
  beforeAll(async() => {
    const setup = await bootstrap();
    browser = setup.browser;
    page = setup.extPage;
    await page.waitForSelector('#add');
    await page.close();
    await setup.worker.evaluate(async() => {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, language: 'en', enable_sync: false,
        background_image: 'background_local', performance_mode: 'full', snow_mode: 'off',
        page_cascade_enabled: false } });
    });
    page = await browser.newPage();
    page.setDefaultTimeout(8000);
    await page.goto(setup.extensionUrl);
    options = await browser.newPage();
    options.setDefaultTimeout(8000);
    await options.goto(setup.extensionUrl.replace('newtab.html', 'options.html'));
    await options.waitForSelector('body:not([data-options-loading])');
    await options.click('[data-section-id="appearance"]');
    for (const target of [page, options]) {
      await target.evaluate(() => {
        window.__pickerCalls = 0;
        window.showOpenFilePicker = async() => {
          window.__pickerCalls++;
          return [{ getFile: async() => new File([
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200">'
            + '<rect width="400" height="200" fill="#5146a8"/>'
            + '<circle cx="280" cy="60" r="45" fill="#f1b674"/></svg>'
          ], 'evening.svg', { type: 'image/svg+xml' }) }];
        };
      });
    }
  });
  afterAll(async() => { await browser?.close(); });

  it('retries a failed local save with the selected file and displays the preview', async() => {
    await options.evaluate(() => {
      const original = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function(value, ...args) {
        if (value?.id === 'background') {
          IDBObjectStore.prototype.put = original;
          throw new Error('Simulated save failure');
        }
        return original.call(this, value, ...args);
      };
    });
    await options.click('#bgFile');
    await options.waitForSelector('#background_local .image-feedback[data-state="error"] button');
    await options.click('#background_local .image-feedback button');
    await options.waitForSelector('#background_local .image-feedback[data-state="success"]');
    expect(await options.evaluate(() => window.__pickerCalls)).toBe(1);
    expect(await options.$eval('#background_local .image-feedback', node => node.textContent)).toContain('evening.svg');
    expect(await options.$eval('#bgFile', button => [button.disabled, button.textContent])).toEqual([false, 'Replace image']);
    expect(await options.$eval('.c-upload__preview', node => node.hidden)).toBe(false);
  });

  it('uploads and previews the local image in quick settings', async() => {
    await page.bringToFront();
    await page.click('#quick_settings_trigger');
    await page.$eval('[data-quick-group="page"]', group => { group.open = true; });
    await page.click('[data-quick-background-upload]');
    await page.waitForSelector('.quick-settings__background-local .image-feedback[data-state="success"]');
    expect(await page.$eval('.image-upload-preview', image => image.complete && image.naturalWidth > 0)).toBe(true);
    expect(await page.$eval('[data-quick-background-upload]', button => button.textContent)).toBe('Replace image');
    await page.click('[data-quick-settings-close]');
    expect(await page.$eval('.image-upload-preview', image => image.hasAttribute('src'))).toBe(false);
  });

  it('renders upload blocks without horizontal overflow in both themes', async() => {
    for (const target of [page, options]) {
      await target.bringToFront();
      await target.setViewport({ width: 1000, height: 760 });
      for (const theme of ['', 'dark']) {
        await target.evaluate(value => { document.documentElement.className = value; }, theme);
        if (target === page) {
          await page.click('#quick_settings_trigger');
          await page.$eval('[data-quick-group="page"]', group => { group.open = true; });
        }
        const selector = target === page ? '.quick-settings__background-local' : '#background_local';
        await target.$eval(selector, node => node.scrollIntoView({ block: 'center' }));
        expect(await target.$eval(selector, node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        if (process.env.UI_SCREENSHOT_DIR) {
          await target.screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/${target === page ? 'quick' : 'options'}-${theme || 'light'}.png` });
        }
        if (target === page) await page.click('[data-quick-settings-close]');
      }
    }
  });

  it('shows the selected thumbnail name and replacement action in the bookmark dialog', async() => {
    await page.bringToFront();
    await page.click('#add');
    await page.waitForSelector('#modal.is-shown');
    await page.select('#thumbnailSource', 'local');
    await page.evaluate(async() => {
      const canvas = document.createElement('canvas');
      canvas.width = 40;
      canvas.height = 40;
      canvas.getContext('2d').fillRect(0, 0, 40, 40);
      const blob = await new Promise(resolve => canvas.toBlob(resolve));
      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], 'thumbnail.png', { type: 'image/png' }));
      const input = document.getElementById('upload');
      input.dataset.id = 'New';
      input.dataset.modal = 'true';
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForSelector('#thumbnailActions .image-feedback[data-state="success"]');
    expect(await page.$eval('#thumbnailActions .image-feedback', node => node.textContent)).toContain('thumbnail.png');
    expect(await page.$eval('#uploadThumbnail', node => node.textContent)).toBe('Replace image');
    expect(await page.$eval('#customScreen img', image => image.complete && image.naturalWidth > 0)).toBe(true);
  });
});
