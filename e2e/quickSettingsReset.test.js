import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createStorageArea } from './syncHarness';
import { POLICY_PREFIX, valueKey } from '../src/js/selectiveSync';

describe('quick settings reset', () => {
  afterEach(() => {
    delete global.browser;
    jest.resetModules();
  });

  it('restores only quick settings without clearing local or sync storage', async() => {
    let localClear = jest.fn().mockResolvedValue();
    let syncClear = jest.fn().mockResolvedValue();
    let syncSet = jest.fn().mockResolvedValue();
    global.browser = {
      i18n: { getMessage: key => key },
      runtime: { getURL: path => `chrome-extension://test/${path}` },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({
            settings: {
              enable_sync: true,
              color_theme: 'dark',
              background_image: 'background_bing',
              background_color: '#123456',
              background_external: 'https://example.com/background.jpg',
              dial_width: 95,
              dial_title_color: '#ffffff',
              dial_background_blur: true,
              toolbar_match_tile_background: false,
              toolbar_background_color: '#112233',
              toolbar_background_opacity: 40,
              toolbar_background_blur: false,
              show_extension_icon: false,
              show_search: false,
              show_folder_picker: false,
              show_settings_icon: false,
              page_entrance_effect: 'rise',
              thumbnail_source: 'site',
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
              color_theme: 'dark',
              background_image: 'background_bing',
              background_color: '#123456',
              background_external: 'https://example.com/background.jpg',
              dial_width: 95,
              dial_title_color: '#ffffff',
              dial_background_blur: true,
              toolbar_match_tile_background: false,
              toolbar_background_color: '#112233',
              toolbar_background_opacity: 40,
              toolbar_background_blur: false,
              show_extension_icon: false,
              show_search: false,
              show_folder_picker: false,
              show_settings_icon: false,
              page_entrance_effect: 'zoom'
            },
            settings_search: { search_engine: 'google' }
          }),
          set: syncSet,
          clear: syncClear
        }
      }
    };

    global.browser.storage.local = createStorageArea(await global.browser.storage.local.get(null));
    global.browser.storage.sync = createStorageArea(await global.browser.storage.sync.get(null));
    localClear = global.browser.storage.local.clear;
    syncClear = global.browser.storage.sync.clear;
    syncSet = global.browser.storage.sync.set;
    const [{ settings }, { QUICK_SETTING_KEYS }] = await Promise.all([
      import('../src/js/settings'),
      import('../src/js/quickSettings')
    ]);
    await settings.init();
    syncSet.mockClear();

    const defaults = await settings.resetKeys(QUICK_SETTING_KEYS);

    expect(defaults).toHaveProperty('dial_width', 70);
    expect(defaults).toHaveProperty('dial_tile_size', 100);
    expect(defaults).toHaveProperty('dial_horizontal_gap', 16);
    expect(defaults).toHaveProperty('dial_vertical_gap', 16);
    expect(defaults).toHaveProperty('color_theme', 'os');
    expect(defaults).toHaveProperty('background_image', 'background_noimage');
    expect(defaults).toHaveProperty('background_color', '');
    expect(defaults).toHaveProperty('background_external', '');
    expect(defaults).toHaveProperty('thumbnail_source', 'favicon');
    expect(defaults).toHaveProperty('dial_title_color', '');
    expect(defaults).toHaveProperty('dial_background_blur', false);
    expect(defaults).toHaveProperty('toolbar_match_tile_background', true);
    expect(defaults).toHaveProperty('toolbar_background_color', '');
    expect(defaults).toHaveProperty('toolbar_background_opacity', 100);
    expect(defaults).toHaveProperty('toolbar_background_blur', true);
    expect(defaults).toHaveProperty('show_extension_icon', true);
    expect(settings.$.color_theme).toBe('os');
    expect(settings.$.background_image).toBe('background_noimage');
    expect(settings.$.background_color).toBe('');
    expect(settings.$.background_external).toBe('');
    expect(settings.$.thumbnail_source).toBe('favicon');
    expect(settings.$.dial_width).toBe(70);
    expect(settings.$.dial_tile_size).toBe(100);
    expect(settings.$.dial_horizontal_gap).toBe(16);
    expect(settings.$.dial_vertical_gap).toBe(16);
    expect(settings.$.dial_title_color).toBe('');
    expect(settings.$.dial_background_blur).toBe(false);
    expect(settings.$.toolbar_match_tile_background).toBe(true);
    expect(settings.$.toolbar_background_color).toBe('');
    expect(settings.$.toolbar_background_opacity).toBe(100);
    expect(settings.$.toolbar_background_blur).toBe(true);
    expect(settings.$.show_extension_icon).toBe(true);
    expect(settings.$.show_search).toBe(true);
    expect(settings.$.show_folder_picker).toBe(true);
    expect(settings.$.show_settings_icon).toBe(false);
    expect(settings.$.search_engine).toBe('google');
    expect(settings.$.enable_sync).toBe(true);
    expect(settings.$).not.toHaveProperty('page_entrance_effect');
    expect(localClear).not.toHaveBeenCalled();
    expect(syncClear).not.toHaveBeenCalled();
    expect(syncSet).toHaveBeenCalledTimes(1);
    const records = global.browser.storage.sync.data;
    expect(records[valueKey('dial_width', records[POLICY_PREFIX + 'dial_width'].epoch)].value.dial_width).toBe(70);
    expect(records[valueKey('search_engines', records[POLICY_PREFIX + 'search_engines'].epoch)].value.search_engine).toBe('google');
  });
});
