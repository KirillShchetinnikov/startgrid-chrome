import { afterEach, describe, expect, it } from '@jest/globals';
import { createStorageArea, createSyncDevice } from './syncHarness';
import { POLICY_PREFIX, valueKey } from '../src/js/selectiveSync';

afterEach(() => { delete global.browser; delete global.crypto; });
const value = (sync, group) => sync.data[valueKey(group, sync.data[POLICY_PREFIX + group].epoch)]?.value;

describe('search settings synchronization', () => {
  it('migrates the shared new-tab option to separate bookmark and search options', async() => {
    const local = createStorageArea({ settings: { enable_sync: false, open_link_newtab: true } });
    const { settings } = await createSyncDevice(createStorageArea(), local);
    expect(settings.$.open_bookmarks_newtab).toBe(true);
    expect(settings.$.open_search_newtab).toBe(true);
    expect(local.data.settings).not.toHaveProperty('open_link_newtab');
  });

  it('writes search configuration and engine together without publishing local settings', async() => {
    const sync = createStorageArea();
    const { settings } = await createSyncDevice(sync);
    const customEngines = Array.from({ length: 18 }, (_, index) => ({
      id: 'custom:' + String(index).padStart(8, '0'),
      enabled: true,
      title: ('Custom ' + index).padEnd(50, 'x'),
      url: 'https://example.com/?q={query}&engine=' + index
    }));
    await settings.updateAll({ search_engines: customEngines, search_engine: customEngines[0].id });
    expect(value(sync, 'search_engines').search_engine).toBe(customEngines[0].id);
    expect(value(sync, 'search_engines').search_engines.filter(engine => !engine.removed)).toHaveLength(20);
    expect(sync.data).not.toHaveProperty(POLICY_PREFIX + 'language');
    expect(sync.data).not.toHaveProperty(POLICY_PREFIX + 'default_folder_id');
  });

  it('stores a local error and skips a value exceeding the per-item quota', async() => {
    const sync = createStorageArea();
    const { settings, local } = await createSyncDevice(sync);
    sync.set.mockClear();
    await settings.updateKey('background_external', 'https://example.com/' + 'x'.repeat(9000));
    expect(sync.set).not.toHaveBeenCalled();
    expect(local.data.sync_quota_error).toMatchObject({ reason: 'item', limitBytes: 8192 });
    expect(local.data.sync_quota_error.usedBytes).toBeGreaterThan(8192);
    expect(settings.$.background_external.length).toBeGreaterThan(9000);
  });

  it('stores the error reported by Chrome when the browser rejects a write', async() => {
    const sync = createStorageArea();
    const { settings, local } = await createSyncDevice(sync);
    sync.set.mockRejectedValueOnce(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'));
    await settings.updateKey('dial_width', 80);
    expect(local.data.sync_quota_error.reason).toBe('item');
    expect(local.data.sync_quota_error.message).toContain('QUOTA_BYTES_PER_ITEM');
    expect(settings.$.dial_width).toBe(80);
  });

  it('keeps legacy local settings authoritative while migrating a pending quota error', async() => {
    const sync = createStorageArea({ settings: { dial_width: 70 } });
    const local = createStorageArea({
      settings: { enable_sync: true, dial_width: 91 },
      sync_quota_error: { reason: 'item', usedBytes: 8200, limitBytes: 8192 }
    });
    const { settings } = await createSyncDevice(sync, local);
    expect(settings.$.dial_width).toBe(91);
    expect(value(sync, 'dial_width').dial_width).toBe(91);
  });
});
