import { afterEach, describe, expect, it, jest } from '@jest/globals';
import puppeteer from 'puppeteer';
import { bootstrap } from './bootstrap';

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: {
    launch: jest.fn()
  }
}));

describe('extension browser bootstrap', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('closes a launched browser when later initialization fails', async() => {
    const initializationError = new Error('service worker missing');
    const browser = {
      waitForTarget: jest.fn().mockRejectedValue(initializationError),
      close: jest.fn().mockResolvedValue()
    };
    puppeteer.launch.mockResolvedValue(browser);

    await expect(bootstrap({
      launchTimeout: 101,
      targetTimeout: 202,
      navigationTimeout: 303
    })).rejects.toBe(initializationError);

    expect(puppeteer.launch).toHaveBeenCalledWith(expect.objectContaining({
      timeout: 101
    }));
    expect(browser.waitForTarget).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 202 }
    );
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it('can return the worker and URL without opening an extension page', async() => {
    const worker = { evaluate: jest.fn() };
    const target = {
      type: jest.fn(() => 'service_worker'),
      url: jest.fn(() => 'chrome-extension://extension-id/background.js'),
      worker: jest.fn().mockResolvedValue(worker)
    };
    const browser = {
      waitForTarget: jest.fn(predicate => {
        expect(predicate(target)).toBe(true);
        return Promise.resolve(target);
      }),
      newPage: jest.fn(),
      close: jest.fn().mockResolvedValue()
    };
    puppeteer.launch.mockResolvedValue(browser);

    await expect(bootstrap({
      openExtensionPage: false
    })).resolves.toEqual({
      browser,
      extensionUrl: 'chrome-extension://extension-id/newtab.html',
      extPage: undefined,
      worker
    });

    expect(browser.newPage).not.toHaveBeenCalled();
    expect(browser.close).not.toHaveBeenCalled();
  });

  it('retries a launch when the extension worker does not start', async() => {
    const firstBrowser = {
      waitForTarget: jest.fn().mockRejectedValue(new Error('worker timeout')),
      close: jest.fn().mockResolvedValue()
    };
    const worker = { evaluate: jest.fn() };
    const target = {
      type: jest.fn(() => 'service_worker'),
      url: jest.fn(() => 'chrome-extension://extension-id/background.js'),
      worker: jest.fn().mockResolvedValue(worker)
    };
    const secondBrowser = {
      waitForTarget: jest.fn(predicate => Promise.resolve(
        predicate(target) ? target : undefined
      )),
      newPage: jest.fn(),
      close: jest.fn().mockResolvedValue()
    };
    puppeteer.launch
      .mockResolvedValueOnce(firstBrowser)
      .mockResolvedValueOnce(secondBrowser);

    await expect(bootstrap({
      launchAttempts: 2,
      openExtensionPage: false
    })).resolves.toEqual(expect.objectContaining({
      browser: secondBrowser,
      worker
    }));

    expect(firstBrowser.close).toHaveBeenCalledTimes(1);
    expect(secondBrowser.close).not.toHaveBeenCalled();
  });
});
