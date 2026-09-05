export function usesHomeLayout(currentSettings, folderId, defaultFolderId) {
  return Boolean(currentSettings.show_last_opened_folder)
    || String(folderId) === String(defaultFolderId);
}

export function allowsIndividualAppearance(currentSettings, folderId, defaultFolderId) {
  return !currentSettings.show_last_opened_folder
    && String(folderId) === String(defaultFolderId);
}

export function effectiveHomeSort(currentSettings) {
  return currentSettings.show_last_opened_folder && currentSettings.home_sort_by === 'usage'
    ? 'manual'
    : currentSettings.home_sort_by;
}

export const FULL_MODE_SETTINGS = [
  'thumbnail_source', 'thumbnails_update_delay', 'thumbnails_auto_refresh',
  'thumbnails_auto_refresh_interval', 'navigation_sort_by',
  'home_sort_usage_tiebreaker', 'show_usage_count', 'toggle_clipboard_access', 'clear_images'
];
