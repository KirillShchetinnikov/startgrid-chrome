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

const DEFAULTS = Object.freeze({
  color_theme: 'os',
  background_image: 'background_noimage',
  background_external: '',
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
  dial_background_opacity: 100,
  vertical_center: false,
  disable_main_page_scroll: false,
  drag_and_drop: true,
  download_favicons_by_default: false,
  favicon_size: 32,
  enable_sync: true,
  show_toolbar: true,
  show_contextmenu_item: true,
  show_settings_icon: true,
  show_quick_settings_icon: true,
  show_extension_icon: true,
  show_back_column: true,
  show_create_column: true,
  show_bookmark_title: true,
  show_favicon: true,
  open_link_newtab: false,
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
  sort_by: '', // '' | date | alphabet
  bookmarks_sorting_type: '',
  search_autofocus: false
});

const SETTINGS_NOT_SYNCED = ['default_folder_id', 'sync_default_folder_id', 'enable_sync'];
const DEPRECATED_SETTINGS = [
  'custom_style',
  'services_enable',
  'services_list',
  'enable_virtual_pagination',
  'thumbnails_update_recursive',
  'auto_generate_thumbnail',
  'background_effect'
];

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
  const syncSettings = JSON.parse(JSON.stringify(currentSettings));
  SETTINGS_NOT_SYNCED.forEach(key => delete syncSettings[key]);
  return splitSyncSettings(sanitizeSettings(syncSettings));
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
      settings = Object.assign({}, DEFAULTS, settings);
      sanitizeSettings(settings);
      let syncRecords = {};
      let syncSettings = {};

      // if synchronization is enabled, we take data from the cloud
      if (settings.enable_sync) {
        syncRecords = await storage.sync.get(SYNC_STORAGE_KEYS);
        syncSettings = mergeSyncSettings(syncRecords);
        sanitizeSettings(syncSettings, false);
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
      $settings = sanitizeSettings(Object.assign({}, $settings, settings));
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
      const syncSettings = mergeSyncSettings(syncRecords);
      Object.assign($settings, sanitizeSettings(syncSettings, false));
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
