import { beforeAll, afterAll, describe, expect, it } from '@jest/globals';
import { bootstrap } from './bootstrap';

describe('remote backgrounds in Fast mode', () => {
  let browser, worker, page, extensionUrl;
  const errors = [];

  async function save(url) {
    await page.$eval('#quick_background_external', (input, value) => { input.value = value; }, url);
    await page.$eval('[data-quick-background-external-set]', button => button.click());
  }

  beforeAll(async() => {
    ({ browser, worker, extPage: page, extensionUrl } = await bootstrap());
    await page.waitForSelector('#add');
    await page.close();
    await worker.evaluate(async() => {
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, enable_sync: false,
        language: 'en', performance_mode: 'fast', background_image: 'background_external', background_external: '' } });
    });
    page = await browser.newPage();
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => errors.push(error.message));
    await page.evaluateOnNewDocument(() => {
      chrome.permissions.request = async() => true;
      const realFetch = window.fetch;
      window.__remoteRequests = [];
      window.fetch = async(input, options) => {
        const url = String(input);
        if (!url.startsWith('https://background.test/') && !url.startsWith('https://www.bing.com/')) {
          return realFetch(input, options);
        }
        window.__remoteRequests.push(url);
        if (sessionStorage.backgroundTestOffline) throw new Error('offline');
        if (url.includes('HPImageArchive')) {
          const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
          return new Response(JSON.stringify({ images: [{ urlbase: '/day', fullstartdate: `${date}0000` }] }),
            { headers: { 'content-type': 'application/json' } });
        }
        if (url.endsWith('/animated')) {
          const one = Uint8Array.from(atob('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='), c => c.charCodeAt(0));
          const frames = new Uint8Array(one.length + one.length - 20);
          frames.set(one.subarray(0, -1));
          frames.set(one.subarray(19), one.length - 1);
          return new Response(frames, { headers: { 'content-type': 'image/gif' } });
        }
        if (url.endsWith('/html')) return new Response('<html/>', { headers: { 'content-type': 'text/html' } });
        if (url.endsWith('/no-store')) return new Response('image',
          { headers: { 'content-type': 'image/png', 'cache-control': 'no-store' } });
        const canvas = new OffscreenCanvas(2400, 1200);
        const context = canvas.getContext('2d');
        context.fillStyle = 'teal';
        context.fillRect(0, 0, canvas.width, canvas.height);
        return new Response(await canvas.convertToBlob({ type: 'image/png' }),
          { headers: { 'content-type': 'image/png' } });
      };
    });
    await page.goto(extensionUrl);
    await page.waitForSelector('#quick_settings_trigger');
    await page.$eval('#quick_settings_trigger', button => button.click());
  });

  afterAll(async() => { await browser?.close(); });

  it('downloads, resizes and caches a still image before saving the URL', async() => {
    await save('https://background.test/static');
    await page.waitForSelector('#bg img');
    expect(await page.$eval('#bg img', async image => ({
      width: image.naturalWidth, height: image.naturalHeight,
      type: (await fetch(image.src)).headers.get('content-type')
    }))).toEqual({ width: 1920, height: 960, type: 'image/webp' });
    expect(await page.evaluate(() => window.__remoteRequests)).toEqual(['https://background.test/static']);
  });

  it.each([
    ['animated', 'Animated images from a URL'],
    ['html', 'Unsupported image format'],
    ['no-store', 'cannot be cached locally']
  ])('rejects %s and preserves the existing URL and background', async(path, message) => {
    await save(`https://background.test/${path}`);
    await page.waitForFunction(text => document.body.textContent.includes(text), {}, message);
    expect(await worker.evaluate(async() => (await chrome.storage.local.get('settings')).settings.background_external))
      .toBe('https://background.test/static');
    expect(await page.$eval('#bg img', image => image.naturalWidth)).toBe(1920);
  });

  it('opens the cached URL offline without another request', async() => {
    await page.evaluate(() => { sessionStorage.backgroundTestOffline = 'true'; });
    await page.reload();
    await page.waitForSelector('#bg img');
    expect(await page.evaluate(() => window.__remoteRequests)).toEqual([]);
  });

  it('loads Bing without UHD and reuses the cached picture offline', async() => {
    await page.evaluate(() => { delete sessionStorage.backgroundTestOffline; });
    await page.$eval('#quick_settings_trigger', button => button.click());
    await page.$eval('#quick_background_image', select => {
      select.value = 'background_bing'; select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForFunction(() => window.__remoteRequests.some(url => url.endsWith('_1920x1080.jpg')));
    await page.waitForSelector('#bg img');
    expect(await page.evaluate(() => window.__remoteRequests.some(url => url.includes('UHD')))).toBe(false);
    await page.evaluate(() => { sessionStorage.backgroundTestOffline = 'true'; });
    await page.reload();
    await page.waitForSelector('#bg img');
    expect(await page.evaluate(() => window.__remoteRequests)).toEqual([]);
    expect(errors).toEqual([]);
  });
});
