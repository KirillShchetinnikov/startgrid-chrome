/**
 * TODO: temporary promise wrapper for asynchronous work with browser.storage in manifest v2
 * storage[local|sync][set|get]
 * remove after switching to a new manifest (v3)
 */
import { storage } from './api/storage';
import { getFolders, resolveFolderSyncPath } from './api/bookmark';
import { DEFAULT_BOOKMARKS_FOLDER } from './constants';
import {
  createDefaultSearchEngineSettings,
  normalizeSearchEngineSettings
} from './searchEngines';
import {
  DEFAULT_SYNC_QUOTA_BYTES,
  DEFAULT_SYNC_QUOTA_BYTES_PER_ITEM,
  SYNC_QUOTA_ERROR_KEY,
  checkSyncQuotaBatch,
  isSyncStorageQuotaError
} from './syncQuota';
import {
  SYNC_STORAGE_KEYS,
  mergeSyncSettings,
  splitSyncSettings
} from './syncSettings';
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  normalizeKeyboardShortcuts
} from './keyboardShortcuts';
import { SUPPORTED_LANGUAGES } from './i18n';

const DEFAULTS = Object.freeze({
  language: 'auto',
  color_theme: 'os',
  background_image: 'background_noimage',
  background_external: '',
  background_entrance_effect: 'none',
  background_entrance_duration: 500,
  snow_mode: 'winter',
  page_cascade_enabled: true,
  page_cascade_mode: 'items',
  page_cascade_duration: 660,
  default_folder_id: DEFAULT_BOOKMARKS_FOLDER,
  sync_default_folder_id: DEFAULT_BOOKMARKS_FOLDER,
  sync_default_folder_path: null,
  show_last_opened_folder: false,
  dial_columns: 7,
  dial_width: 70, // value in percent (50,60,70,80,90)
  dial_gap: 16,
  dial_radius: 18,
  dial_aspect_ratio: '4 / 3',
  dial_shadow: 8,
  dial_hover_lift: 4,
  dial_background_color: '',
  dial_title_color: '',
  dial_background_opacity: 100,
  dial_background_blur: false,
  vertical_center: false,
  disable_main_page_scroll: false,
  drag_and_drop: true,
  download_favicons_by_default: false,
  favicon_size: 32,
  enable_sync: true,
  show_toolbar: true,
  toolbar_match_tile_background: true,
  toolbar_background_color: '',
  toolbar_background_opacity: 100,
  toolbar_background_blur: true,
  show_contextmenu_item: true,
  show_settings_icon: true,
  show_quick_settings_icon: true,
  show_extension_icon: true,
  show_back_column: true,
  show_create_column: true,
  show_bookmark_title: true,
  show_favicon: true,
  open_bookmarks_newtab: false,
  open_search_newtab: false,
  thumbnails_update_button: true,
  thumbnails_update_delay: 0.5,
  thumbnails_auto_refresh: false,
  thumbnails_auto_refresh_interval: 24,
  without_confirmation: false,
  folder_preview: false,
  close_tab_after_adding_bookmark: false,
  search_engine: 'bookmarks',
  search_engines: createDefaultSearchEngineSettings(),
  search_results_display: 'folder_name',
  move_to_start: false,
  home_sort_by: 'manual', // manual | date | alphabet | usage
  home_sort_date_direction: 'desc',
  home_sort_alphabet_direction: 'desc',
  home_sort_usage_tiebreaker: 'alphabet',
  show_usage_count: true,
  home_manual_sort_initialized: false,
  show_home_folders: true,
  bookmarks_sorting_type: 'together',
  navigation_sort_by: '', // '' | date | alphabet
  search_autofocus: false,
  keyboard_shortcuts: DEFAULT_KEYBOARD_SHORTCUTS
});

const SETTINGS_NOT_SYNCED = [
  'language',
  'default_folder_id',
  'sync_default_folder_id',
  'enable_sync'
];
const DEPRECATED_SETTINGS = [
  'custom_style',
  'services_enable',
  'services_list',
  'enable_virtual_pagination',
  'thumbnails_update_recursive',
  'auto_generate_thumbnail',
  'background_effect'
];

function removeNotSyncedSettings(currentSettings) {
  SETTINGS_NOT_SYNCED.forEach(key => delete currentSettings[key]);
  return currentSettings;
}

function migrateSettings(currentSettings = {}) {
  const migrated = { ...currentSettings };

  if (Object.hasOwn(migrated, 'open_link_newtab')) {
    const openInNewTab = Boolean(migrated.open_link_newtab);
    if (!Object.hasOwn(migrated, 'open_bookmarks_newtab')) {
      migrated.open_bookmarks_newtab = openInNewTab;
    }
    if (!Object.hasOwn(migrated, 'open_search_newtab')) {
      migrated.open_search_newtab = openInNewTab;
    }
  }

  if (!Object.hasOwn(migrated, 'home_sort_by') && Object.hasOwn(migrated, 'sort_by')) {
    migrated.home_sort_by = ['date', 'alphabet'].includes(migrated.sort_by)
      ? migrated.sort_by
      : 'manual';
    // Existing profiles already have a browser-managed bookmark order that may
    // contain a manual arrangement, even if an automatic view was selected.
    migrated.home_manual_sort_initialized = true;
  }

  if (migrated.bookmarks_sorting_type === '') {
    migrated.bookmarks_sorting_type = 'together';
  }

  delete migrated.sort_by;
  delete migrated.sort_by_newest;
  delete migrated.open_link_newtab;
  return migrated;
}

export function getDefaultSettings(keys = Object.keys(DEFAULTS)) {
  const defaults = keys.reduce((result, key) => {
    if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
      result[key] = DEFAULTS[key];
    }
    return result;
  }, {});

  return JSON.parse(JSON.stringify(defaults));
}

function sanitizeSettings(currentSettings, normalizeSearchEngines = true) {
  DEPRECATED_SETTINGS.forEach(key => delete currentSettings[key]);
  delete currentSettings.sort_by;
  delete currentSettings.sort_by_newest;
  if (!SUPPORTED_LANGUAGES.includes(currentSettings.language)) {
    currentSettings.language = DEFAULTS.language;
  }
  if (!['manual', 'date', 'alphabet', 'usage'].includes(currentSettings.home_sort_by)) {
    currentSettings.home_sort_by = DEFAULTS.home_sort_by;
  }
  if (!['asc', 'desc'].includes(currentSettings.home_sort_date_direction)) {
    currentSettings.home_sort_date_direction = DEFAULTS.home_sort_date_direction;
  }
  if (!['asc', 'desc'].includes(currentSettings.home_sort_alphabet_direction)) {
    currentSettings.home_sort_alphabet_direction = DEFAULTS.home_sort_alphabet_direction;
  }
  if (!['alphabet', 'date'].includes(currentSettings.home_sort_usage_tiebreaker)) {
    currentSettings.home_sort_usage_tiebreaker = DEFAULTS.home_sort_usage_tiebreaker;
  }
  currentSettings.show_usage_count = currentSettings.show_usage_count !== false;
  currentSettings.home_manual_sort_initialized = currentSettings.home_manual_sort_initialized === true;
  currentSettings.show_home_folders = currentSettings.show_home_folders !== false;
  if (!['together', 'folders_top', 'folders_bottom'].includes(currentSettings.bookmarks_sorting_type)) {
    currentSettings.bookmarks_sorting_type = DEFAULTS.bookmarks_sorting_type;
  }
  if (!['', 'date', 'alphabet'].includes(currentSettings.navigation_sort_by)) {
    currentSettings.navigation_sort_by = DEFAULTS.navigation_sort_by;
  }
  if (!['none', 'zoom', 'blur', 'slide'].includes(currentSettings.background_entrance_effect)) {
    currentSettings.background_entrance_effect = DEFAULTS.background_entrance_effect;
  }
  const backgroundEntranceDuration = parseInt(currentSettings.background_entrance_duration);
  currentSettings.background_entrance_duration = Number.isFinite(backgroundEntranceDuration)
    ? Math.min(3000, Math.max(100, backgroundEntranceDuration))
    : DEFAULTS.background_entrance_duration;
  currentSettings.dial_background_blur = currentSettings.dial_background_blur === true;
  currentSettings.toolbar_background_blur = currentSettings.toolbar_background_blur !== false;
  if (!['always', 'winter', 'off'].includes(currentSettings.snow_mode)) {
    currentSettings.snow_mode = DEFAULTS.snow_mode;
  }
  currentSettings.page_cascade_enabled = currentSettings.page_cascade_enabled !== false;
  if (!['items', 'rows'].includes(currentSettings.page_cascade_mode)) {
    currentSettings.page_cascade_mode = DEFAULTS.page_cascade_mode;
  }
  const cascadeDuration = parseInt(currentSettings.page_cascade_duration);
  currentSettings.page_cascade_duration = Number.isFinite(cascadeDuration)
    ? Math.min(1500, Math.max(200, cascadeDuration))
    : DEFAULTS.page_cascade_duration;
  currentSettings.keyboard_shortcuts = normalizeKeyboardShortcuts(currentSettings.keyboard_shortcuts);
  if (!normalizeSearchEngines) return currentSettings;

  currentSettings.search_engines = normalizeSearchEngineSettings(currentSettings.search_engines);

  const enabledSearchEngineIds = currentSettings.search_engines
    .filter(engine => engine.enabled)
    .map(engine => engine.id);
  if (!enabledSearchEngineIds.includes(currentSettings.search_engine)) {
    [currentSettings.search_engine] = enabledSearchEngineIds;
  }
  return currentSettings;
}

function createSyncRecords(currentSettings) {
  const syncSettings = sanitizeSettings(JSON.parse(JSON.stringify(currentSettings)));
  return splitSyncSettings(removeNotSyncedSettings(syncSettings));
}

async function getSyncQuotaState(records) {
  let totalBytes = 0;
  let currentRecordsBytes = 0;

  try {
    [totalBytes, currentRecordsBytes] = await Promise.all([
      storage.sync.getBytesInUse(),
      storage.sync.getBytesInUse(SYNC_STORAGE_KEYS)
    ]);
  } catch (error) {
    console.warn('Could not read Chrome Sync storage usage', error);
  }

  return checkSyncQuotaBatch({
    records,
    totalBytes,
    currentRecordsBytes,
    quotaBytes: browser.storage.sync.QUOTA_BYTES || DEFAULT_SYNC_QUOTA_BYTES,
    quotaBytesPerItem: browser.storage.sync.QUOTA_BYTES_PER_ITEM || DEFAULT_SYNC_QUOTA_BYTES_PER_ITEM
  });
}

async function saveSyncQuotaError(quotaState, error) {
  const errorMessage = String(error?.message || error || '');
  const isTotalQuotaError = /QUOTA_BYTES(?!_PER_ITEM)/i.test(errorMessage);
  const fallbackLimit = isTotalQuotaError
    ? browser.storage.sync.QUOTA_BYTES || DEFAULT_SYNC_QUOTA_BYTES
    : browser.storage.sync.QUOTA_BYTES_PER_ITEM || DEFAULT_SYNC_QUOTA_BYTES_PER_ITEM;
  const fallbackUsed = isTotalQuotaError
    ? quotaState.projectedBytes
    : quotaState.itemBytes;
  await storage.local.set({
    [SYNC_QUOTA_ERROR_KEY]: {
      reason: quotaState.reason || (isTotalQuotaError ? 'total' : 'item'),
      storageKey: quotaState.storageKey || '',
      usedBytes: quotaState.usedBytes || (error ? Math.max(fallbackUsed, fallbackLimit + 1) : fallbackUsed),
      limitBytes: quotaState.limitBytes || fallbackLimit,
      message: errorMessage,
      createdAt: Date.now()
    }
  });
}

async function writeSyncSettings(syncRecords) {
  const quotaState = await getSyncQuotaState(syncRecords);
  if (quotaState.exceeded) {
    await saveSyncQuotaError(quotaState);
    return false;
  }

  try {
    await storage.sync.set(syncRecords);
    await storage.local.remove(SYNC_QUOTA_ERROR_KEY);
    return true;
  } catch (error) {
    if (!isSyncStorageQuotaError(error)) throw error;
    await saveSyncQuotaError(quotaState, error);
    return false;
  }
}

async function resolveSyncedDefaultFolder(currentSettings) {
  if (!currentSettings.sync_default_folder_path) return;

  const folders = await getFolders().catch(() => null);
  if (!folders) return;

  const folderId = resolveFolderSyncPath(folders, currentSettings.sync_default_folder_path);
  if (folderId) currentSettings.sync_default_folder_id = folderId;
}

export function getDefaultFolderId(currentSettings = {}) {
  if (currentSettings.enable_sync && currentSettings.sync_default_folder_id) {
    return currentSettings.sync_default_folder_id;
  }

  return currentSettings.default_folder_id ?? DEFAULT_BOOKMARKS_FOLDER;
}

const settingsStore = () => {
  let $settings = {};

  return {
    /**
     * settings.$ getter
     * @return {Object} Settings object
     */
    get $() {
      return $settings;
    },

    get defaultFolderId() {
      return getDefaultFolderId($settings);
    },

    /**
     * Initializing the settings Store
     */
    async init() {
      // read local settings
      const localState = await storage.local.get(['settings', SYNC_QUOTA_ERROR_KEY]);
      let { settings } = localState;
      const hasPendingSyncQuotaError = Boolean(localState[SYNC_QUOTA_ERROR_KEY]);
      settings = Object.assign({}, DEFAULTS, migrateSettings(settings));
      sanitizeSettings(settings);
      let syncRecords = {};
      let syncSettings = {};

      // if synchronization is enabled, we take data from the cloud
      if (settings.enable_sync) {
        syncRecords = await storage.sync.get(SYNC_STORAGE_KEYS);
        syncSettings = migrateSettings(mergeSyncSettings(syncRecords));
        sanitizeSettings(syncSettings, false);
        removeNotSyncedSettings(syncSettings);
        if (!hasPendingSyncQuotaError) Object.assign(settings, syncSettings);
        sanitizeSettings(settings);
        await resolveSyncedDefaultFolder(settings);
      }

      await storage.local.set({ settings });

      // write the settings to the settings.$ object
      Object.assign($settings, settings);

      const currentSyncRecords = createSyncRecords($settings);
      if (
        settings.enable_sync
        && JSON.stringify(syncRecords) !== JSON.stringify(currentSyncRecords)
      ) {
        await writeSyncSettings(currentSyncRecords);
      }
    },

    /**
     * update setting value
     * @param {String} key
     * @param {<any>} value
     * @returns
     */
    async updateKey(key, value) {
      if (!$settings) {
        throw Error('Settings store must be initialized with the init method');
      }

      $settings[key] = value;
      // resave settings in local storage
      await storage.local.set({ settings: $settings });

      if ($settings.enable_sync) {
        if (!SETTINGS_NOT_SYNCED.includes(key)) {
          // if we change sync settings
          // start synchronization
          await this.syncToStorage();
        }
      }
    },

    async updateAll(settings = {}) {
      $settings = sanitizeSettings(Object.assign({}, $settings, migrateSettings(settings)));
      await storage.local.set({ settings: $settings });
      if ($settings.enable_sync) {
        await this.syncToStorage();
      }
    },

    /**
     * Restore selected settings to the extension defaults without clearing storage.
     * @param {String[]} keys
     * @returns {Promise<Object>}
     */
    async resetKeys(keys = []) {
      const defaults = getDefaultSettings(keys);
      await this.updateAll(defaults);
      return defaults;
    },

    /**
     * syncToStorage - update storage cloud
     * send the current settings to the cloud previously excluding local
     */
    syncToStorage() {
      return writeSyncSettings(createSyncRecords($settings));
    },

    /**
     * restoreFromSync - restore settings from cloud storage
     * @returns Promise
     */
    async restoreFromSync() {
      const syncRecords = await storage.sync.get(SYNC_STORAGE_KEYS);
      const syncSettings = migrateSettings(mergeSyncSettings(syncRecords));
      sanitizeSettings(syncSettings, false);
      Object.assign($settings, removeNotSyncedSettings(syncSettings));
      sanitizeSettings($settings);
      await resolveSyncedDefaultFolder($settings);
      await storage.local.set({ settings: $settings });
      await writeSyncSettings(createSyncRecords($settings));
    },

    /**
     * Reset local settings
     * @returns Promise
     */
    async resetLocal() {
      $settings = sanitizeSettings(Object.assign({}, DEFAULTS, { enable_sync: false }));
      await storage.local.set({ settings: $settings });
      localStorage.clear();
    },

    /**
     * Clear transient data without deleting settings or local images.
     * @returns Promise
     */
    async clearLocalCache() {
      const currentSettings = JSON.parse(JSON.stringify($settings));
      await storage.local.clear();
      await storage.local.set({ settings: currentSettings });
      localStorage.clear();
    },

    /**
     * Reset sync settings
     * @returns Promise
     */
    async resetSync() {
      $settings.enable_sync = false;
      await storage.local.set({ settings: $settings });
      await storage.sync.clear();
    }
  };
};

export const settings = settingsStore();

export const LAST_OPENED_FOLDER_ID = 'last_opened_folder_id';
