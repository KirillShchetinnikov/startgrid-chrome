import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';

describe('portable settings backups', () => {
  let createSettingsBackup, importSettingsBackup;
  const folderPath = [{ title: 'Bar', folderType: 'bookmarks-bar', index: 0 }, { title: 'Work', index: 0 }];
  beforeAll(async() => {
    global.browser = { bookmarks: { getTree: async() => [{ children: [
      { id: '1', title: 'Bar', folderType: 'bookmarks-bar', children: [{ id: '42', title: 'Work', children: [] }] }
    ] }] } };
    ({ createSettingsBackup, importSettingsBackup } = await import('../src/js/settingsBackup'));
  });
  afterAll(() => { delete global.browser; });

  it('exports the effective folder even when Sync is off and its old path is stale', async() => {
    const data = await createSettingsBackup({ defaultFolderId: '42', $: {
      enable_sync: false, default_folder_id: '42', sync_default_folder_id: '99',
      sync_default_folder_path: [], color_theme: 'light'
    } });
    expect(data).toEqual({ color_theme: 'light', sync_default_folder_path: folderPath });
  });

  it.each([true, false])('resolves an imported path to this device with Sync %s', async enabled => {
    const store = { $: { enable_sync: enabled }, isSynced: () => true, updateAll: jest.fn() };
    await importSettingsBackup(store, { enable_sync: !enabled, default_folder_id: '7',
      sync_default_folder_id: '7', sync_default_folder_path: folderPath });
    expect(store.updateAll).toHaveBeenCalledWith({
      ...(!enabled && { default_folder_id: '42' }), sync_default_folder_id: '42', sync_default_folder_path: folderPath
    });
  });

  it('ignores a foreign numeric ID in a legacy backup with no folder path', async() => {
    const store = { updateAll: jest.fn() };
    expect(await importSettingsBackup(store, { sync_default_folder_id: '42', color_theme: 'dark' }))
      .toEqual({ folderUnavailable: true });
    expect(store.updateAll).toHaveBeenCalledWith({ color_theme: 'dark' });
  });

  it('restores the account folder when identical local and account roots change order', async() => {
    const local = { id: '1', title: 'Bar', folderType: 'bookmarks-bar', syncing: false,
      children: [{ id: '42', title: 'Work', children: [] }] };
    const account = { id: '2', title: 'Bar', folderType: 'bookmarks-bar', syncing: true,
      children: [{ id: '84', title: 'Work', children: [] }] };
    const tree = jest.spyOn(browser.bookmarks, 'getTree');
    tree.mockResolvedValueOnce([{ children: [local, account] }]);
    tree.mockResolvedValueOnce([{ children: [account, local] }]);
    try {
      const backup = await createSettingsBackup({ defaultFolderId: '84', $: {} });
      expect(backup.sync_default_folder_path[0]).toMatchObject({ index: 1, syncing: true });

      const store = { $: { enable_sync: false }, updateAll: jest.fn() };
      const result = await importSettingsBackup(store, backup);
      expect(result.folderUnavailable).toBe(false);
      expect(store.updateAll).toHaveBeenCalledWith(expect.objectContaining({ default_folder_id: '84' }));
    } finally {
      tree.mockRestore();
    }
  });

  it('rejects a malformed folder path before saving other settings', async() => {
    const store = { updateAll: jest.fn() };
    await expect(importSettingsBackup(store, { color_theme: 'dark', sync_default_folder_path: [null] })).rejects.toThrow();
    expect(store.updateAll).not.toHaveBeenCalled();
  });
});
