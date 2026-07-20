import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

describe('header section visibility', () => {
  afterEach(() => {
    delete global.browser;
    jest.resetModules();
  });

  it('migrates the previous toolbar setting to both section settings', async() => {
    const localSet = jest.fn().mockResolvedValue();
    global.browser = {
      i18n: { getMessage: key => key },
      runtime: { getURL: path => `chrome-extension://test/${path}` },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({
            settings: { enable_sync: false, show_toolbar: false }
          }),
          set: localSet,
          remove: jest.fn().mockResolvedValue(),
          clear: jest.fn().mockResolvedValue()
        },
        sync: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue(),
          clear: jest.fn().mockResolvedValue()
        }
      }
    };

    const { settings } = await import('../src/js/settings');
    await settings.init();

    expect(settings.$.show_search).toBe(false);
    expect(settings.$.show_folder_picker).toBe(false);
    expect(settings.$).not.toHaveProperty('show_toolbar');
    expect(localSet.mock.calls.at(-1)[0].settings).not.toHaveProperty('show_toolbar');
  });

  it('gives an individual new setting priority during migration', async() => {
    global.browser = {
      i18n: { getMessage: key => key },
      runtime: { getURL: path => `chrome-extension://test/${path}` },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({
            settings: {
              enable_sync: false,
              show_toolbar: false,
              show_search: true
            }
          }),
          set: jest.fn().mockResolvedValue(),
          remove: jest.fn().mockResolvedValue(),
          clear: jest.fn().mockResolvedValue()
        },
        sync: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue(),
          clear: jest.fn().mockResolvedValue()
        }
      }
    };

    const { settings } = await import('../src/js/settings');
    await settings.init();

    expect(settings.$.show_search).toBe(true);
    expect(settings.$.show_folder_picker).toBe(false);
  });

  it('centers a lone folder picker at a fixed responsive width', () => {
    const css = readFileSync('src/css/components/_header.css', 'utf8');

    expect(css).toMatch(
      /\.header--folder-only\s*\{[^}]*justify-content:\s*center/s
    );
    expect(css).toMatch(
      /\.header--folder-only[^}]*\.header__items--select\s*\{[^}]*flex:\s*0 1 320px[^}]*width:\s*min\(320px,\s*100%\)/s
    );
  });
});
