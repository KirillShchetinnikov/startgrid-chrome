import { afterEach, describe, expect, it } from '@jest/globals';
import { createStorageArea, createSyncDevice } from './syncHarness';
import {
  POLICY_PREFIX, SYNC_VERSION_KEY, SYNC_STATE_KEY, valueKey, applyKnownChanges, readSyncRecords
} from '../src/js/selectiveSync';

afterEach(() => { delete global.browser; delete global.crypto; });

const p = group => POLICY_PREFIX + group;
const remoteValue = (sync, group) => sync.data[valueKey(group, sync.data[p(group)].epoch)]?.value;
const refresh = settings => settings.handleSyncChange({ [SYNC_VERSION_KEY]: {} }, 'sync');

describe('forward-compatible selective sync', () => {
  it('preserves raw future values and unknown nested fields through startup and unrelated edits', async() => {
    const future = { new_action: 'KeyY', focus_search: 'Slash' };
    const sync = createStorageArea({
      settings: { snow_mode: 'future-season', future_setting: { nested: 17 } },
      settings_shortcuts: { keyboard_shortcuts: future }
    });
    const { settings } = await createSyncDevice(sync);
    expect(settings.$.snow_mode).toBe('winter');
    expect(settings.$.keyboard_shortcuts).not.toHaveProperty('new_action');
    await settings.updateKey('color_theme', 'dark');
    expect(remoteValue(sync, 'snow_mode').snow_mode).toBe('future-season');
    expect(remoteValue(sync, 'future_setting')).toEqual({ future_setting: { nested: 17 } });
    expect(remoteValue(sync, 'keyboard_shortcuts').keyboard_shortcuts).toEqual(future);
    expect(sync.data).not.toHaveProperty('settings');
    const before = JSON.stringify(sync.data);
    await createSyncDevice(sync);
    expect(JSON.stringify(sync.data)).toBe(before);
  });

  it('preserves unknown hotkeys when changing a known hotkey', async() => {
    const sync = createStorageArea({ settings_shortcuts: {
      keyboard_shortcuts: { focus_search: 'Slash', future_action: 'KeyY' }
    } });
    const { settings } = await createSyncDevice(sync);
    await settings.updateKey('keyboard_shortcuts', { ...settings.$.keyboard_shortcuts, focus_search: 'KeyF' });
    expect(remoteValue(sync, 'keyboard_shortcuts').keyboard_shortcuts).toMatchObject({
      focus_search: 'KeyF', future_action: 'KeyY'
    });
  });

  it('does not publish automatic layout or permission fallbacks during startup', async() => {
    const sync = createStorageArea({ settings: {
      dial_tile_size: 400, background_image: 'background_bing'
    } });
    const { settings } = await createSyncDevice(sync);
    sync.set.mockClear();
    await settings.updateAll({ dial_tile_size: 160 }, { sync: false });
    await settings.updateKey('background_image', 'background_local', { sync: false });
    await settings.updateKey('color_theme', 'dark');
    await refresh(settings);
    expect(settings.$.dial_tile_size).toBe(160);
    expect(settings.$.background_image).toBe('background_local');
    expect(remoteValue(sync, 'dial_tile_size').dial_tile_size).toBe(400);
    expect(remoteValue(sync, 'background_image').background_image).toBe('background_bing');
    expect(sync.set).toHaveBeenCalledTimes(1);
    await settings.restoreFromSync();
    expect(settings.$.dial_tile_size).toBe(300); // Current version's supported maximum.
  });

  it('applies identical cloud values again after a missed disable and enable cycle', async() => {
    const sync = createStorageArea();
    const a = await createSyncDevice(sync);
    const b = await createSyncDevice(sync);
    await b.settings.updateKey('color_theme', 'dark', { sync: false });
    await a.settings.setSyncEnabled('color_theme', false);
    await a.settings.setSyncEnabled('color_theme', true);
    await refresh(b.settings);
    expect(b.settings.$.color_theme).toBe(a.settings.$.color_theme);
  });

  it('keeps each device local when disabled and publishes the enabling device value', async() => {
    const sync = createStorageArea();
    const a = await createSyncDevice(sync);
    const b = await createSyncDevice(sync);
    await a.settings.setSyncEnabled('color_theme', false);
    await refresh(b.settings);
    await a.settings.updateKey('color_theme', 'dark');
    await b.settings.updateKey('color_theme', 'light');
    expect(remoteValue(sync, 'color_theme')).toBeUndefined();
    expect(a.settings.$.color_theme).toBe('dark');
    expect(b.settings.$.color_theme).toBe('light');
    await a.settings.setSyncEnabled('color_theme', true);
    await refresh(b.settings);
    expect(b.settings.$.color_theme).toBe('dark');
    expect(remoteValue(sync, 'color_theme')).toEqual({ color_theme: 'dark' });
  });

  it('cannot re-enable policy or replace a new generation with delayed offline data', async() => {
    const sync = createStorageArea();
    const { settings } = await createSyncDevice(sync);
    const oldKey = valueKey('color_theme', sync.data[p('color_theme')].epoch);
    await settings.setSyncEnabled('color_theme', false);
    await settings.updateKey('color_theme', 'dark');
    await settings.setSyncEnabled('color_theme', true);
    await sync.set({ [oldKey]: { value: { color_theme: 'light' } } });
    await refresh(settings);
    expect(settings.$.color_theme).toBe('dark');
    expect(sync.data[p('color_theme')].enabled).toBe(true);
    expect(sync.data).not.toHaveProperty(oldKey);
  });

  it('preserves hidden fields across disable, local editing, restart and re-enable', async() => {
    const sync = createStorageArea({ settings_shortcuts: {
      keyboard_shortcuts: { future_action: 'KeyY', focus_search: 'Slash' }
    } });
    let device = await createSyncDevice(sync);
    await device.settings.setSyncEnabled('keyboard_shortcuts', false);
    await device.settings.updateKey('keyboard_shortcuts', {
      ...device.settings.$.keyboard_shortcuts, focus_search: 'KeyF'
    });
    device = await createSyncDevice(sync, device.local);
    await device.settings.setSyncEnabled('keyboard_shortcuts', true);
    expect(remoteValue(sync, 'keyboard_shortcuts').keyboard_shortcuts).toMatchObject({
      future_action: 'KeyY', focus_search: 'KeyF'
    });
  });

  it('keeps pending local edits across write failures and restart, then retries them', async() => {
    const sync = createStorageArea();
    let device = await createSyncDevice(sync);
    const normalSet = sync.set.getMockImplementation();
    sync.set.mockImplementation(async() => { throw Error('offline'); });
    await device.settings.updateKey('dial_width', 91);
    expect(device.local.data[SYNC_STATE_KEY].pending).toHaveProperty('dial_width');
    device = await createSyncDevice(sync, device.local);
    expect(device.settings.$.dial_width).toBe(91);
    sync.set.mockImplementation(normalSet);
    await device.settings.init();
    expect(remoteValue(sync, 'dial_width').dial_width).toBe(91);
    expect(device.local.data[SYNC_STATE_KEY].pending).toEqual({});
  });

  it('invalidates a persisted edit when another device disables and re-enables its group', async() => {
    const sync = createStorageArea();
    const a = await createSyncDevice(sync);
    const b = await createSyncDevice(sync);
    sync.set.mockRejectedValueOnce(Error('offline'));
    await b.settings.updateKey('color_theme', 'light');
    await a.settings.setSyncEnabled('color_theme', false);
    await a.settings.updateKey('color_theme', 'dark');
    await a.settings.setSyncEnabled('color_theme', true);
    await refresh(b.settings);
    expect(b.settings.$.color_theme).toBe('dark');
    expect(remoteValue(sync, 'color_theme').color_theme).toBe('dark');
  });

  it('leaves unknown records untouched and refuses to write an unsupported protocol', async() => {
    const sync = createStorageArea({ [SYNC_VERSION_KEY]: { version: 9 }, future_record: { data: 7 } });
    const { settings } = await createSyncDevice(sync);
    await settings.updateKey('color_theme', 'dark');
    expect(sync.set).not.toHaveBeenCalled();
    expect(sync.remove).not.toHaveBeenCalled();
    expect(settings.$.color_theme).toBe('dark');
  });

  it('does not replace an unrelated setting from a stale page', async() => {
    const sync = createStorageArea();
    const a = await createSyncDevice(sync);
    const b = await createSyncDevice(sync);
    await a.settings.updateKey('dial_width', 91);
    await b.settings.updateKey('color_theme', 'dark');
    expect(remoteValue(sync, 'dial_width').dial_width).toBe(91);
  });

  it('keeps future array entries and fields but honors explicit removal of known entries', () => {
    const raw = [{ id: 'a', title: 'A', future: true }, { id: 'b' }, { id: 'future' }];
    const before = [{ id: 'a', title: 'A' }, { id: 'b' }];
    expect(applyKnownChanges(raw, before, [{ id: 'a', title: 'New' }])).toEqual([
      { id: 'a', title: 'New', future: true }, { id: 'future' }
    ]);
  });

  it('waits for the value when policy arrives before its generation', () => {
    const records = {
      [p('color_theme')]: { enabled: true, epoch: 'new' },
      [valueKey('color_theme', 'old')]: { value: { color_theme: 'light' } }
    };
    expect(readSyncRecords(records).values).toEqual({});
    records[valueKey('color_theme', 'new')] = { value: { color_theme: 'dark' } };
    expect(readSyncRecords(records).values).toEqual({ color_theme: 'dark' });
  });

  it('lists every supported sync group exactly once in the settings selector', async() => {
    await createSyncDevice(createStorageArea());
    const { getSyncChoices } = await import('../src/js/components/syncSelection');
    const { default: sections } = await import('../src/js/constants/settingsList');
    const { getDefaultSettings } = await import('../src/js/settings');
    const { groupValues } = await import('../src/js/selectiveSync');
    const choices = getSyncChoices(sections).flatMap(section => section.choices.map(choice => choice.group));
    expect(getSyncChoices(sections)).toHaveLength(18);
    expect(choices.sort()).toEqual(Object.keys(groupValues(getDefaultSettings())).sort());
  });

  it('changes a whole block in one batch and retains independent child policies', async() => {
    const sync = createStorageArea();
    const { settings } = await createSyncDevice(sync);
    sync.set.mockClear();
    await settings.setSyncEnabledMany(['color_theme', 'background_image'], false);
    expect(sync.set).toHaveBeenCalledTimes(1);
    expect(settings.isSynced('color_theme')).toBe(false);
    expect(settings.isSynced('background_color')).toBe(false);
    await settings.updateAll({ color_theme: 'dark', background_color: '#112233' });
    await settings.setSyncEnabled('color_theme', true);
    const themeEpoch = sync.data[p('color_theme')].epoch;
    await settings.setSyncEnabledMany(['color_theme', 'background_image'], true);
    expect(sync.data[p('color_theme')].epoch).toBe(themeEpoch);
    expect(remoteValue(sync, 'color_theme').color_theme).toBe('dark');
    expect(remoteValue(sync, 'background_image').background_color).toBe('#112233');
  });

  it('retries a failed block change together after restart', async() => {
    const sync = createStorageArea();
    let device = await createSyncDevice(sync);
    sync.set.mockRejectedValueOnce(Error('write limit'));
    expect(await device.settings.setSyncEnabledMany(['color_theme', 'background_image'], false)).toBe(false);
    expect(Object.keys(device.local.data[SYNC_STATE_KEY].pending)).toEqual(['color_theme', 'background_image']);
    device = await createSyncDevice(sync, device.local);
    expect(device.settings.isSynced('color_theme')).toBe(false);
    expect(device.settings.isSynced('background_image')).toBe(false);
    expect(remoteValue(sync, 'color_theme')).toBeUndefined();
    expect(remoteValue(sync, 'background_image')).toBeUndefined();
  });

  it('does not repopulate the cloud after another active device explicitly clears it', async() => {
    const sync = createStorageArea();
    const device = await createSyncDevice(sync);
    await sync.clear();
    await device.settings.handleSyncChange({ [SYNC_VERSION_KEY]: { oldValue: { version: 1 } } }, 'sync');
    expect(sync.data).toEqual({});
    expect(device.settings.$.enable_sync).toBe(false);
  });

  it('keeps exclusions during import, explicit upload and resetting selected keys', async() => {
    const sync = createStorageArea();
    const { settings } = await createSyncDevice(sync);
    await settings.setSyncEnabled('color_theme', false);
    await settings.updateAll({ color_theme: 'dark', dial_width: 88 });
    await settings.syncToStorage();
    expect(remoteValue(sync, 'color_theme')).toBeUndefined();
    expect(remoteValue(sync, 'dial_width').dial_width).toBe(88);
    await settings.resetKeys(['color_theme', 'dial_width']);
    expect(remoteValue(sync, 'color_theme')).toBeUndefined();
    expect(remoteValue(sync, 'dial_width').dial_width).toBe(70);
  });

  it('does not delete legacy data when migration fails its quota check', async() => {
    const sync = createStorageArea({ settings: { future: 'x'.repeat(9000) } });
    const { local } = await createSyncDevice(sync);
    expect(sync.data.settings.future).toHaveLength(9000);
    expect(sync.data).not.toHaveProperty(SYNC_VERSION_KEY);
    expect(sync.remove).not.toHaveBeenCalled();
    expect(local.data.sync_quota_error.reason).toBe('item');
  });

  it('keeps selection after local reset and removes it only on explicit cloud reset', async() => {
    const sync = createStorageArea();
    const device = await createSyncDevice(sync);
    global.localStorage = { clear() {} };
    await device.settings.setSyncEnabled('color_theme', false);
    await device.settings.resetLocal();
    expect(sync.data[p('color_theme')].enabled).toBe(false);
    expect(device.settings.$.enable_sync).toBe(false);
    await device.settings.resetSync();
    expect(sync.data).toEqual({});
    delete global.localStorage;
  });
});
