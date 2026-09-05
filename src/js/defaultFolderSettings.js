import { createFolderSyncPath, getFolders } from './api/bookmark';

/**
 * Persists the default folder using the active local or synchronized storage model.
 * Folder IDs are profile-specific, so synchronized settings also keep a portable path.
 *
 * @param {Object} settingsStore
 * @param {string} folderId
 * @param {Array<Object>|null} folders
 * @returns {Promise<void>}
 */
export async function updateDefaultFolder(settingsStore, folderId, folders = null) {
  if (!settingsStore.$.enable_sync) {
    await settingsStore.updateKey('default_folder_id', folderId);
    return;
  }

  const folderTree = folders || await getFolders();
  await settingsStore.updateAll({
    sync_default_folder_id: folderId,
    sync_default_folder_path: createFolderSyncPath(folderTree, folderId)
  });
}
