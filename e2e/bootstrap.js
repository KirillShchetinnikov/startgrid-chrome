import path from 'path';
import puppeteer from 'puppeteer';

const EXTENSION_DIR = path.join(process.cwd(), '/extension_chrome');

async function bootstrap(options = {}) {
  const {
    devtools = false,
    slowMo = false,
    launchTimeout = 30000,
    targetTimeout = 30000,
    navigationTimeout = 30000,
    openExtensionPage = true
  } = options;
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      devtools,
      timeout: launchTimeout,
      args: [
        `--disable-extensions-except=${EXTENSION_DIR}`,
        `--load-extension=${EXTENSION_DIR}`
      ],
      ...(slowMo && { slowMo })
    });

    const backgroundPageTarget = await browser.waitForTarget(
      target => target.type() === 'service_worker',
      { timeout: targetTimeout }
    );

    const partialExtensionUrl = backgroundPageTarget.url() || '';
    const [, , extensionId] = partialExtensionUrl.split('/');
    const worker = await backgroundPageTarget.worker();
    if (!worker) throw new Error('Extension service worker is unavailable');

    const extensionUrl = `chrome-extension://${extensionId}/newtab.html`;
    let extPage;
    if (openExtensionPage) {
      extPage = await browser.newPage();
      await extPage.goto(extensionUrl, {
        waitUntil: 'load',
        timeout: navigationTimeout
      });
    }

    return {
      browser,
      extensionUrl,
      extPage,
      worker
    };
  } catch (error) {
    await browser?.close().catch(() => undefined);
    throw error;
  }
}

export { bootstrap };
