import { readFileSync } from 'node:fs';
import puppeteer from 'puppeteer';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';

describe('image controls and UI interactions', () => {
  let browser;
  let page;
  beforeAll(async() => {
    browser = await puppeteer.launch({ headless: true });
    page = await browser.newPage();
  });
  afterAll(async() => { await browser?.close(); });
  beforeEach(async() => {
    await page.goto('about:blank');
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);
    await page.setContent(`<html data-performance-mode="full"><body>
      <section id="background_external"><input id="background_external_url" type="url"
        value="https://example.com/picture.png" required><button id="set_background_external">Apply</button>
        <button id="delete_background_external" disabled>Remove</button></section>
      <details class="quick-settings__group"><summary class="quick-settings__group-summary">Settings</summary>
        <div style="height:120px">Content</div></details>
      <button id="icon" aria-label="Close" title="Close">×</button></body></html>`);
    const source = readFileSync('src/js/components/imageFeedback.js', 'utf8')
      .replace(/^import .*;\s*/m, 'const getMessage = key => key;\n')
      .replaceAll('export function', 'function');
    await page.addScriptTag({ content: source });
  });

  it.each(['options', 'quick'])('keeps failed URL drafts and retries without duplicate requests: %s', async(surface) => {
    const file = surface === 'options' ? 'src/js/options.js' : 'src/js/components/quickDisplaySettings.js';
    const source = readFileSync(file, 'utf8');
    const start = source.indexOf('async function handleExternalBackgroundSave()');
    const end = source.indexOf(surface === 'options'
      ? 'async function handleExternalBackgroundRemove' : 'function showBackgroundRemovalConfirmation', start);
    await page.evaluate(kind => {
      if (kind === 'quick') {
        document.querySelector('input').id = 'quick_background_external';
        document.querySelector('#set_background_external').setAttribute('data-quick-background-external-set', '');
      }
    }, surface);
    await page.addScriptTag({ content: `
      const panel = document.body;
      const message = getMessage;
      const Toast = { show() {} };
      const settings = { $: { background_external: '' }, async updateAll(value) { this.$ = value; } };
      const normalizeBackgroundImageURL = value => value;
      const requestPermissions = async () => true;
      const isFastMode = () => false;
      let requests = 0;
      let resolveRequest;
      const canLoadBackgroundImageURL = () => { requests++; return new Promise(resolve => { resolveRequest = resolve; }); };
      const toggleBackgroundControls = () => {};
      const syncBackgroundControls = () => {};
      const UI = { async setBG() {} };
      ${source.slice(start, end)}
      document.querySelector('#set_background_external').onclick = handleExternalBackgroundSave;
    ` });
    await page.click('#set_background_external');
    await page.evaluate(() => handleExternalBackgroundSave());
    expect(await page.evaluate(() => requests)).toBe(1);
    await page.evaluate(() => resolveRequest(false));
    await page.waitForSelector('.image-feedback[data-state="error"] button');
    expect(await page.$eval('input', input => input.value)).toBe('https://example.com/picture.png');
    expect(await page.$eval('#set_background_external', button => button.disabled)).toBe(false);
    await page.click('.image-feedback button');
    expect(await page.evaluate(() => requests)).toBe(2);
    await page.evaluate(() => resolveRequest(true));
    await page.waitForSelector('.image-feedback[data-state="success"]');
    expect(await page.evaluate(() => settings.$.background_external)).toBe('https://example.com/picture.png');
  });

  it('restores controls after cancellation and preserves disabled controls', async() => {
    expect(await page.evaluate(() => {
      const host = document.querySelector('section');
      const button = document.querySelector('#set_background_external');
      const operation = beginImageOperation(host, button);
      const duplicate = beginImageOperation(host, button);
      operation.finish();
      return [duplicate, button.disabled, document.querySelector('#delete_background_external').disabled,
        host.hasAttribute('aria-busy'), host.querySelector('.image-feedback').textContent];
    })).toEqual([null, false, true, false, '']);
  });

  async function installInteractions() {
    await page.addScriptTag({ content: readFileSync('src/js/components/uiInteractions.js', 'utf8')
      .replace('export function', 'function') + '\ninitUIInteractions();' });
  }

  it('finishes accordion animation when switching to Fast mode and respects reduced motion', async() => {
    await installInteractions();
    await page.click('summary');
    await page.evaluate(() => { document.documentElement.dataset.performanceMode = 'fast'; });
    expect(await page.$eval('details', element => [element.open, element.getAnimations().length])).toEqual([true, 0]);
    await page.click('summary');
    expect(await page.$eval('details', element => element.open)).toBe(false);
    await page.evaluate(() => { document.documentElement.dataset.performanceMode = 'full'; });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.click('summary');
    expect(await page.$eval('details', element => [element.open, element.getAnimations().length])).toEqual([true, 0]);
  });

  it('shows keyboard tooltips and restores native attributes on Escape', async() => {
    await installInteractions();
    await page.focus('#icon');
    await page.waitForSelector('.ui-tooltip:not([hidden])');
    expect(await page.$eval('#icon', button => button.getAttribute('aria-describedby'))).toBe('ui-icon-tooltip');
    await page.keyboard.press('Escape');
    expect(await page.$eval('#icon', button => [button.title, button.getAttribute('aria-describedby')]))
      .toEqual(['Close', null]);
    expect(await page.$eval('.ui-tooltip', tooltip => tooltip.hidden)).toBe(true);
  });
});
