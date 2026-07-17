import { afterEach, describe, expect, it, jest } from '@jest/globals';

describe('search settings synchronization', () => {
  afterEach(() => {
    delete global.browser;
    jest.resetModules();
  });

  it('migrates the shared new-tab option to separate bookmark and search options', async() => {
    const localSet = jest.fn().mockResolvedValue();
    global.browser = {
      i18n: { getMessage: key => key },
      runtime: { getURL: path => `chrome-extension://test/${path}` },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({
            settings: { enable_sync: false, open_link_newtab: true }
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

    expect(settings.$.open_bookmarks_newtab).toBe(true);
    expect(settings.$.open_search_newtab).toBe(true);
    expect(settings.$).not.toHaveProperty('open_link_newtab');
    expect(localSet.mock.calls.at(-1)[0].settings).not.toHaveProperty('open_link_newtab');
  });

  it('writes the search configuration, default engine, and order to sync storage', async() => {
    const localSet = jest.fn().mockResolvedValue();
    const localRemove = jest.fn().mockResolvedValue();
    const syncSet = jest.fn().mockResolvedValue();
    global.browser = {
      i18n: { getMessage: key => key },
      runtime: { getURL: path => `chrome-extension://test/${path}` },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({
            settings: { enable_sync: true, language: 'ru' }
          }),
          set: localSet,
          remove: localRemove,
          clear: jest.fn().mockResolvedValue()
        },
        sync: {
          get: jest.fn().mockResolvedValue({
            settings: { language: 'en' }
          }),
          set: syncSet,
          clear: jest.fn().mockResolvedValue()
        }
      }
    };

    const { settings } = await import('../src/js/settings');
    await settings.init();
    expect(settings.$.language).toBe('ru');
    syncSet.mockClear();

    const customEngines = Array.from({ length: 18 }, (_, index) => ({
      id: `custom:${String(index).padStart(8, '0')}`,
      enabled: true,
      title: `Custom ${index}`.padEnd(50, 'x'),
      url: `https://example.com/?q={query}&engine=${index}&padding=${'x'.repeat(120)}`
    }));
    const reorderedEngines = [
      ...customEngines,
      { id: 'browser', enabled: true },
      { id: 'bookmarks', enabled: false },
      { id: 'google', removed: true }
    ];

    await settings.updateKey('search_engines', reorderedEngines);
    await settings.updateKey('search_engine', customEngines[0].id);

    const payload = syncSet.mock.calls.at(-1)[0];
    expect(payload.settings_search.search_engine).toBe(customEngines[0].id);
    expect(payload.settings_search.search_engines.slice(0, 2).map(engine => engine.id)).toEqual([
      customEngines[0].id,
      customEngines[1].id
    ]);
    expect(payload.settings_search.search_engines.filter(engine => engine.id.startsWith('custom:')))
      .toHaveLength(18);
    expect(payload.settings_search.search_engines).toContainEqual({ id: 'google', removed: true });
    Object.entries(payload).forEach(([key, value]) => {
      expect(Buffer.byteLength(key) + Buffer.byteLength(JSON.stringify(value))).toBeLessThan(8192);
    });
    expect(payload.settings).not.toHaveProperty('search_engine');
    expect(payload.settings).not.toHaveProperty('favicon_size');
    expect(payload.settings).not.toHaveProperty('default_folder_id');
    expect(payload.settings).not.toHaveProperty('language');
    expect(payload.settings_thumbnails.favicon_size).toBe(32);
    expect(payload.settings_shortcuts.keyboard_shortcuts.focus_search).toBe('Slash');
    expect(localRemove).toHaveBeenCalledWith('sync_quota_error');
  });

  it('stores a local error and skips Chrome Sync when the settings item is too large', async() => {
    const localSet = jest.fn().mockResolvedValue();
    const syncSet = jest.fn().mockResolvedValue();
    global.browser = {
      i18n: { getMessage: key => key },
      runtime: { getURL: path => `chrome-extension://test/${path}` },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({ settings: { enable_sync: true } }),
          set: localSet,
          remove: jest.fn().mockResolvedValue(),
          clear: jest.fn().mockResolvedValue()
        },
        sync: {
          QUOTA_BYTES: 102400,
          QUOTA_BYTES_PER_ITEM: 8192,
          get: jest.fn().mockResolvedValue({ settings: {} }),
          getBytesInUse: jest.fn().mockResolvedValue(0),
          set: syncSet,
          clear: jest.fn().mockResolvedValue()
        }
      }
    };

    const { settings } = await import('../src/js/settings');
    await settings.init();
    syncSet.mockClear();
    localSet.mockClear();

    await settings.updateKey('background_external', `https://example.com/${'x'.repeat(9000)}`);

    expect(syncSet).not.toHaveBeenCalled();
    const errorPayload = localSet.mock.calls
      .map(([payload]) => payload)
      .find(payload => payload.sync_quota_error);
    expect(errorPayload.sync_quota_error.reason).toBe('item');
    expect(errorPayload.sync_quota_error.usedBytes).toBeGreaterThan(8192);
    expect(errorPayload.sync_quota_error.limitBytes).toBe(8192);
  });

  it('stores the error reported by Chrome when the browser rejects the write', async() => {
    const localSet = jest.fn().mockResolvedValue();
    const syncSet = jest.fn().mockResolvedValue();
    global.browser = {
      i18n: { getMessage: key => key },
      runtime: { getURL: path => `chrome-extension://test/${path}` },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({ settings: { enable_sync: true } }),
          set: localSet,
          remove: jest.fn().mockResolvedValue(),
          clear: jest.fn().mockResolvedValue()
        },
        sync: {
          QUOTA_BYTES: 102400,
          QUOTA_BYTES_PER_ITEM: 8192,
          get: jest.fn().mockResolvedValue({ settings: {} }),
          getBytesInUse: jest.fn().mockResolvedValue(0),
          set: syncSet,
          clear: jest.fn().mockResolvedValue()
        }
      }
    };

    const { settings } = await import('../src/js/settings');
    await settings.init();
    localSet.mockClear();
    syncSet.mockRejectedValueOnce(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'));

    await settings.updateKey('dial_width', 80);

    const errorPayload = localSet.mock.calls
      .map(([payload]) => payload)
      .find(payload => payload.sync_quota_error);
    expect(errorPayload.sync_quota_error.reason).toBe('item');
    expect(errorPayload.sync_quota_error.message).toContain('QUOTA_BYTES_PER_ITEM');
    expect(errorPayload.sync_quota_error.usedBytes).toBeGreaterThan(8192);
  });

  it('keeps local settings authoritative while a quota error is pending', async() => {
    const syncSet = jest.fn().mockResolvedValue();
    global.browser = {
      i18n: { getMessage: key => key },
      runtime: { getURL: path => `chrome-extension://test/${path}` },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({
            settings: { enable_sync: true, dial_width: 91 },
            sync_quota_error: { reason: 'item', usedBytes: 8200, limitBytes: 8192 }
          }),
          set: jest.fn().mockResolvedValue(),
          remove: jest.fn().mockResolvedValue(),
          clear: jest.fn().mockResolvedValue()
        },
        sync: {
          QUOTA_BYTES: 102400,
          QUOTA_BYTES_PER_ITEM: 8192,
          get: jest.fn().mockResolvedValue({ settings: { dial_width: 70 } }),
          getBytesInUse: jest.fn().mockResolvedValue(0),
          set: syncSet,
          clear: jest.fn().mockResolvedValue()
        }
      }
    };

    const { settings } = await import('../src/js/settings');
    await settings.init();

    expect(settings.$.dial_width).toBe(91);
    expect(syncSet.mock.calls.at(-1)[0].settings.dial_width).toBe(91);
  });

});
