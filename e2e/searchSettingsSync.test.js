import { afterEach, describe, expect, it, jest } from '@jest/globals';

describe('search settings synchronization', () => {
  afterEach(() => {
    delete global.browser;
    jest.resetModules();
  });

  it('writes the search configuration, default engine, and order to sync storage', async() => {
    const localSet = jest.fn().mockResolvedValue();
    const syncSet = jest.fn().mockResolvedValue();
    global.browser = {
      i18n: { getMessage: key => key },
      runtime: { getURL: path => `chrome-extension://test/${path}` },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({ settings: { enable_sync: true } }),
          set: localSet,
          clear: jest.fn().mockResolvedValue()
        },
        sync: {
          get: jest.fn().mockResolvedValue({ settings: {} }),
          set: syncSet,
          clear: jest.fn().mockResolvedValue()
        }
      }
    };

    const { settings } = await import('../src/js/settings');
    await settings.init();
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
    expect(payload.settings.search_engine).toBe(customEngines[0].id);
    expect(payload.settings.search_engines.slice(0, 2).map(engine => engine.id)).toEqual([
      customEngines[0].id,
      customEngines[1].id
    ]);
    expect(payload.settings.search_engines.filter(engine => engine.id.startsWith('custom:')))
      .toHaveLength(18);
    expect(payload.settings.search_engines).toContainEqual({ id: 'google', removed: true });
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeLessThan(8192);
    expect(payload.settings).not.toHaveProperty('default_folder_id');
  });
});
