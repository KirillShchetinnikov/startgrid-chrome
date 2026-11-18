import { createFolderSyncPath, getFolders, resolveFolderSyncPath } from './api/bookmark';

function portableSettings(values) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    throw new TypeError('Expected a settings object');
  }
  const portable = { ...values };
  for (const key of ['enable_sync', 'default_folder_id', 'sync_default_folder_id',
    'sync_default_folder_path', 'custom_dials', 'background_local']) {
    delete portable[key];
  }
  return portable;
}

export async function createSettingsBackup(store) {
  const values = portableSettings(store.$);
  const folderId = store.defaultFolderId;
  values.sync_default_folder_path = createFolderSyncPath(await getFolders(), folderId);
  return values;
}

export async function importSettingsBackup(store, backup) {
  const values = portableSettings(backup);
  const path = backup.sync_default_folder_path;
  let folderId = null;
  if (path != null) {
    if (!Array.isArray(path) || !path.length || !path.every(segment =>
      typeof segment?.title === 'string' && Number.isInteger(segment.index) && segment.index >= 0)) {
      throw new TypeError('Invalid home folder path');
    }
    const folders = await getFolders();
    folderId = resolveFolderSyncPath(folders, path, { strictRoot: true });
    if (folderId) {
      values.sync_default_folder_path = createFolderSyncPath(folders, folderId);
      values.sync_default_folder_id = folderId;
      if (!store.$.enable_sync || !store.isSynced('sync_default_folder_path')) values.default_folder_id = folderId;
    }
  }
  await store.updateAll(values);
  return { folderUnavailable: !folderId && Boolean(path || backup.sync_default_folder_id || backup.default_folder_id) };
}
