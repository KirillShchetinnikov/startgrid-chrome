import { afterEach, describe, expect, it, jest } from '@jest/globals';

describe('quick settings reset', () => {
  afterEach(() => {
    delete global.browser;
    jest.resetModules();
  });

  it('restores only quick settings without clearing local or sync storage', async() => {
    const localClear = jest.fn().mockResolvedValue();
    const syncClear = jest.fn().mockResolvedValue();
    const syncSet = jest.fn().mockResolvedValue();
    global.browser = {
      i18n: { getMessage: key => key },
      runtime: { getURL: path => `chrome-extension://test/${path}` },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({
            settings: {
              enable_sync: true,
              dial_width: 95,
              show_extension_icon: false,
              show_toolbar: false,
              show_settings_icon: false,
              search_engine: 'google'
            }
          }),
          set: jest.fn().mockResolvedValue(),
          remove: jest.fn().mockResolvedValue(),
          clear: localClear
        },
        sync: {
          get: jest.fn().mockResolvedValue({
            settings: {
              dial_width: 95,
              show_extension_icon: false,
              show_toolbar: false,
              show_settings_icon: false
            },
            settings_search: { search_engine: 'google' }
          }),
          set: syncSet,
          clear: syncClear
        }
      }
    };

    const [{ settings }, { QUICK_SETTING_KEYS }] = await Promise.all([
      import('../src/js/settings'),
      import('../src/js/quickSettings')
    ]);
    await settings.init();
    syncSet.mockClear();

    const defaults = await settings.resetKeys(QUICK_SETTING_KEYS);

    expect(defaults).toHaveProperty('dial_width', 70);
    expect(defaults).toHaveProperty('show_extension_icon', true);
    expect(settings.$.dial_width).toBe(70);
    expect(settings.$.show_extension_icon).toBe(true);
    expect(settings.$.show_toolbar).toBe(true);
    expect(settings.$.show_settings_icon).toBe(false);
    expect(settings.$.search_engine).toBe('google');
    expect(settings.$.enable_sync).toBe(true);
    expect(localClear).not.toHaveBeenCalled();
    expect(syncClear).not.toHaveBeenCalled();
    expect(syncSet).toHaveBeenCalledTimes(1);
    expect(syncSet.mock.calls[0][0].settings.dial_width).toBe(70);
    expect(syncSet.mock.calls[0][0].settings_search.search_engine).toBe('google');
  });
});
