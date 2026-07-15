/**
 * TODO: temporary promise wrapper for asynchronous work with browser.storage in manifest v2
 * storage[local|sync][set|get]
 * remove after switching to a new manifest (v3)
 */
import { storage } from './api/storage';
import { getFolders, resolveFolderSyncPath } from './api/bookmark';
import { DEFAULT_BOOKMARKS_FOLDER } from './constants';

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
  vertical_center: false,
  drag_and_drop: true,
  auto_generate_thumbnail: true,
  enable_sync: true,
  show_toolbar: true,
  show_contextmenu_item: true,
  show_settings_icon: true,
  show_quick_settings_icon: true,
  show_back_column: true,
  show_create_column: true,
  show_bookmark_title: true,
  show_favicon: true,
  open_link_newtab: false,
  thumbnails_update_button: true,
  thumbnails_update_recursive: false,
  thumbnails_update_delay: 0.5,
  thumbnails_auto_refresh: false,
  thumbnails_auto_refresh_interval: 24,
  without_confirmation: false,
  folder_preview: false,
  close_tab_after_adding_bookmark: false,
  logo_external: false,
  logo_external_url: '',
  search_engine: 'bookmarks',
  move_to_start: false,
  sort_by: '', // '' | date | alphabet
  bookmarks_sorting_type: '',
  search_autofocus: false,
  background_effect: 'none' // none | distortion
});

const SETTINGS_NOT_SYNCED = ['default_folder_id', 'sync_default_folder_id', 'enable_sync'];
const DEPRECATED_SETTINGS = [
  'custom_style',
  'services_enable',
  'services_list',
  'enable_virtual_pagination'
];

function sanitizeSettings(currentSettings) {
  DEPRECATED_SETTINGS.forEach(key => delete currentSettings[key]);
  return currentSettings;
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
      let { settings } = await storage.local.get('settings');

      // if there are no settings, set default
      if (!settings) {
        settings = Object.assign({}, DEFAULTS);
        storage.local.set({ settings });
      } else {
        // if the settings are already there
        // but default settings object is expanded
        // we need to add these properties immediately
        Object.assign($settings, DEFAULTS, settings);
      }

      // if synchronization is enabled, we take data from the cloud
      if (settings.enable_sync) {
        const { settings: syncSettings } = await storage.sync.get('settings');
        Object.assign(settings, syncSettings);
        sanitizeSettings(settings);
        await resolveSyncedDefaultFolder(settings);
        await storage.local.set({ settings });
      }

      // write the settings to the settings.$ object
      Object.assign($settings, sanitizeSettings(settings));
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
          this.syncToStorage();
        }
      }
    },

    async updateAll(settings = {}) {
      Object.assign($settings, sanitizeSettings(settings));
      // await setLocalSettings({ settings: $settings });
      await storage.local.set({ settings: $settings });
    },

    /**
     * syncToStorage - update storage cloud
     * send the current settings to the cloud previously excluding local
     */
    syncToStorage() {
      // TODO: вместо JSON[method] использовать structuredClone
      const settings = JSON.parse(JSON.stringify($settings));
      SETTINGS_NOT_SYNCED.forEach(key => delete settings[key]);
      sanitizeSettings(settings);
      storage.sync.set({ settings });
    },

    /**
     * restoreFromSync - restore settings from cloud storage
     * @returns Promise
     */
    async restoreFromSync() {
      let { settings = {} } = await storage.sync.get('settings');
      Object.assign($settings, sanitizeSettings(settings));
      await resolveSyncedDefaultFolder($settings);
      await storage.local.set({ settings: $settings });
    },

    /**
     * Reset local settings
     * @returns Promise
     */
    async resetLocal() {
      $settings = Object.assign({}, DEFAULTS);
      await storage.local.set({ settings: $settings });
      localStorage.clear();
    },

    /**
     * Reset sync settings
     * @returns Promise
     */
    resetSync() {
      return new Promise(resolve => {
        browser.storage.sync.clear(resolve);
      });
    }
  };
};

export const settings = settingsStore();

export const LAST_OPENED_FOLDER_ID = 'last_opened_folder_id';
