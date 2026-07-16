export const SYNC_STORAGE_KEYS = Object.freeze([
  'settings',
  'settings_search',
  'settings_thumbnails',
  'settings_shortcuts'
]);

export const SEARCH_SETTINGS_KEYS = new Set([
  'search_engine',
  'search_engines',
  'search_results_display',
  'navigation_sort_by',
  'open_search_newtab',
  'search_autofocus'
]);

export const SHORTCUT_SETTINGS_KEYS = new Set(['keyboard_shortcuts']);

export const THUMBNAIL_SETTINGS_KEYS = new Set([
  'thumbnails_update_button',
  'download_favicons_by_default',
  'favicon_size',
  'thumbnails_update_delay',
  'thumbnails_auto_refresh',
  'thumbnails_auto_refresh_interval'
]);

export function splitSyncSettings(settings) {
  return Object.entries(settings).reduce((records, [key, value]) => {
    if (SEARCH_SETTINGS_KEYS.has(key)) records.settings_search[key] = value;
    else if (THUMBNAIL_SETTINGS_KEYS.has(key)) records.settings_thumbnails[key] = value;
    else if (SHORTCUT_SETTINGS_KEYS.has(key)) records.settings_shortcuts[key] = value;
    else records.settings[key] = value;
    return records;
  }, {
    settings: {},
    settings_search: {},
    settings_thumbnails: {},
    settings_shortcuts: {}
  });
}

export function mergeSyncSettings(records = {}) {
  const coreSettings = Object.entries(records.settings || {}).reduce((settings, [key, value]) => {
    if (
      !SEARCH_SETTINGS_KEYS.has(key)
      && !THUMBNAIL_SETTINGS_KEYS.has(key)
      && !SHORTCUT_SETTINGS_KEYS.has(key)
    ) {
      settings[key] = value;
    }
    return settings;
  }, {});

  return Object.assign(
    {},
    coreSettings,
    records.settings_search || {},
    records.settings_thumbnails || {},
    records.settings_shortcuts || {}
  );
}
