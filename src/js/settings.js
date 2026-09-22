import { getEffectiveSetting } from './performanceMode';
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
import { SYNC_STORAGE_KEYS } from './syncSettings';
import {
  SYNC_PREFIX, POLICY_PREFIX, valueKey, SYNC_VERSION_KEY, SYNC_STATE_KEY, SYNC_ERROR_KEY, LOCAL_SETTING_KEYS,
  copy, equal, syncGroup, groupValues, applyKnownChanges, readSyncRecords,
  createInitialSyncRecords, withSettingsLock
} from './selectiveSync';
import {
  DEFAULT_KEYBOARD_SHORTCUTS,
  normalizeKeyboardShortcuts
} from './keyboardShortcuts';
import { SUPPORTED_LANGUAGES } from './i18n';
import { normalizeGlobalThumbnailSource } from './thumbnailSource';

const DEFAULTS = Object.freeze({
  performance_mode: 'full',
  language: 'auto',
  color_theme: 'os',
  background_image: 'background_noimage',
  background_color: '',
  background_external: '',
  background_entrance_effect: 'none',
  background_entrance_duration: 500,
  snow_mode: 'winter',
  page_cascade_enabled: true,
  page_cascade_mode: 'items',
  page_cascade_duration: 650,
  default_folder_id: DEFAULT_BOOKMARKS_FOLDER,
  sync_default_folder_id: DEFAULT_BOOKMARKS_FOLDER,
  sync_default_folder_path: null,
  show_last_opened_folder: false,
  dial_columns: 7,
  dial_width: 70, // value in percent (50,60,70,80,90)
  dial_tile_size: 100,
  dial_horizontal_gap: 16,
  dial_vertical_gap: 16,
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
  thumbnail_source: 'favicon',
  download_favicons_by_default: false,
  favicon_size: 32,
  enable_sync: true,
  show_search: true,
  show_folder_picker: true,
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
  bookmark_title_size: 14,
  bookmark_title_position: 'inside',
  show_favicon: true,
  open_bookmarks_newtab: false,
  open_search_newtab: false,
  thumbnails_update_button: true,
  thumbnails_update_delay: 0.5,
  thumbnails_auto_refresh: false,
  thumbnails_auto_refresh_interval: 24,
  without_confirmation: false,
  folder_preview: false,
  folder_marker_style: 'none',
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
  show_home_folders: true,
  bookmarks_sorting_type: 'together',
  navigation_sort_by: '', // '' | date | alphabet
  search_autofocus: false,
  keyboard_shortcuts: DEFAULT_KEYBOARD_SHORTCUTS
});

export const NUMERIC_SETTING_LIMITS = Object.freeze({
  dial_columns: { min: 1, max: 10 },
  dial_width: { min: 50, max: 99 },
  dial_tile_size: { min: 50, max: 300 },
  dial_horizontal_gap: { min: 0, max: 160 },
  dial_vertical_gap: { min: 0, max: 160 },
  dial_radius: { min: 0, max: 40 },
  dial_shadow: { min: 0, max: 30 },
  dial_hover_lift: { min: 0, max: 12 },
  dial_background_opacity: { min: 0, max: 100 },
  bookmark_title_size: { min: 10, max: 24 },
  background_entrance_duration: { min: 100, max: 3000 },
  page_cascade_duration: { min: 200, max: 1500 },
  toolbar_background_opacity: { min: 0, max: 100 },
  favicon_size: { min: 16, max: 128 },
  thumbnails_update_delay: { min: 0.5, max: 15 },
  thumbnails_auto_refresh_interval: { min: 1, max: 168 }
});

function normalizeNumericSettings(currentSettings) {
  Object.entries(NUMERIC_SETTING_LIMITS).forEach(([key, limits]) => {
    const value = Number.parseFloat(currentSettings[key]);
    currentSettings[key] = Number.isFinite(value)
      ? Math.min(limits.max, Math.max(limits.min, value))
      : DEFAULTS[key];
  });
}

const SETTINGS_NOT_SYNCED = LOCAL_SETTING_KEYS;
const DEPRECATED_SETTINGS = [
  'custom_style',
  'services_enable',
  'services_list',
  'enable_virtual_pagination',
  'thumbnails_update_recursive',
  'auto_generate_thumbnail',
  'dial_gap',
  'background_effect',
  'page_entrance_effect'
];

function removeNotSyncedSettings(currentSettings) {
  SETTINGS_NOT_SYNCED.forEach(key => delete currentSettings[key]);
  return currentSettings;
}

function migrateSettings(currentSettings = {}) {
  const migrated = { ...currentSettings };

  if (Object.hasOwn(migrated, 'dial_gap')) {
    if (!Object.hasOwn(migrated, 'dial_horizontal_gap')) {
      migrated.dial_horizontal_gap = migrated.dial_gap;
    }
    if (!Object.hasOwn(migrated, 'dial_vertical_gap')) {
      migrated.dial_vertical_gap = migrated.dial_gap;
    }
    delete migrated.dial_gap;
  }

  if (Object.hasOwn(migrated, 'show_toolbar')) {
    const showToolbar = migrated.show_toolbar !== false;
    if (!Object.hasOwn(migrated, 'show_search')) {
      migrated.show_search = showToolbar;
    }
    if (!Object.hasOwn(migrated, 'show_folder_picker')) {
      migrated.show_folder_picker = showToolbar;
    }
  }

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
  }

  if (migrated.bookmarks_sorting_type === '') {
    migrated.bookmarks_sorting_type = 'together';
  }

  delete migrated.sort_by;
  delete migrated.home_manual_sort_initialized;
  delete migrated.sort_by_newest;
  delete migrated.open_link_newtab;
  delete migrated.show_toolbar;
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
  if (!['full', 'fast'].includes(currentSettings.performance_mode)) currentSettings.performance_mode = 'full';
  DEPRECATED_SETTINGS.forEach(key => delete currentSettings[key]);
  delete currentSettings.sort_by;
  delete currentSettings.sort_by_newest;
  normalizeNumericSettings(currentSettings);
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
  delete currentSettings.home_manual_sort_initialized;
  currentSettings.show_home_folders = currentSettings.show_home_folders !== false;
  currentSettings.show_search = currentSettings.show_search !== false;
  currentSettings.show_folder_picker = currentSettings.show_folder_picker !== false;
  currentSettings.thumbnail_source = normalizeGlobalThumbnailSource(currentSettings.thumbnail_source);
  if (!['inside', 'outside'].includes(currentSettings.bookmark_title_position)) {
    currentSettings.bookmark_title_position = DEFAULTS.bookmark_title_position;
  }
  if (!['none', 'badge', 'title', 'tab', 'border'].includes(currentSettings.folder_marker_style)) {
    currentSettings.folder_marker_style = DEFAULTS.folder_marker_style;
  }
  if (!['together', 'folders_top', 'folders_bottom'].includes(currentSettings.bookmarks_sorting_type)) {
    currentSettings.bookmarks_sorting_type = DEFAULTS.bookmarks_sorting_type;
  }
  if (!['', 'date', 'alphabet'].includes(currentSettings.navigation_sort_by)) {
    currentSettings.navigation_sort_by = DEFAULTS.navigation_sort_by;
  }
  if (!['none', 'zoom', 'blur', 'slide'].includes(currentSettings.background_entrance_effect)) {
    currentSettings.background_entrance_effect = DEFAULTS.background_entrance_effect;
  }
  currentSettings.dial_background_blur = currentSettings.dial_background_blur === true;
  currentSettings.toolbar_background_blur = currentSettings.toolbar_background_blur !== false;
  if (!['always', 'winter', 'off'].includes(currentSettings.snow_mode)) {
    currentSettings.snow_mode = DEFAULTS.snow_mode;
  }
  currentSettings.page_cascade_enabled = currentSettings.page_cascade_enabled !== false;
  if (!['items', 'rows'].includes(currentSettings.page_cascade_mode)) {
    currentSettings.page_cascade_mode = DEFAULTS.page_cascade_mode;
  }
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

async function getSyncQuotaState(records) {
  let totalBytes = 0;
  let currentRecordsBytes = 0;

  try {
    [totalBytes, currentRecordsBytes] = await Promise.all([
      storage.sync.getBytesInUse(),
      storage.sync.getBytesInUse(Object.keys(records))
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
    await storage.local.remove(SYNC_ERROR_KEY);
    return true;
  } catch (error) {
    if (!isSyncStorageQuotaError(error)) {
      await storage.local.set({ [SYNC_ERROR_KEY]: String(error?.message || error) });
      return false;
    }
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
  let baseline = {};
  let policy = {};
  let initialized = false;
  const effective = new Proxy({}, {
    get: (_, key) => getEffectiveSetting($settings, key),
    ownKeys: () => Reflect.ownKeys($settings),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true })
  });

  function adopt(value) {
    $settings = sanitizeSettings({ ...DEFAULTS, ...migrateSettings(value) });
    baseline = copy($settings);
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.performanceMode = $settings.performance_mode;
    }
  }

  async function readState() {
    const local = await storage.local.get(['settings', SYNC_STATE_KEY, SYNC_QUOTA_ERROR_KEY]);
    return {
      local,
      state: { pending: {}, ...(local[SYNC_STATE_KEY] || {}) }
    };
  }

  async function remoteRecords(current) {
    let records = await storage.sync.get(null);
    if (!records[SYNC_VERSION_KEY]) {
      // Preserve the original payload, including unknown and formerly grouped keys.
      const legacy = Object.assign({}, ...SYNC_STORAGE_KEYS.map(key => records[key] || {}));
      const initial = createInitialSyncRecords({
        ...removeNotSyncedSettings(copy(current)), ...migrateSettings(legacy), ...legacy
      }, records);
      if (!await writeSyncSettings(initial)) return null;
      records = { ...records, ...initial };
    }
    if (records[SYNC_VERSION_KEY]?.version !== 1) {
      await storage.local.set({ [SYNC_ERROR_KEY]: 'unsupported_sync_version' });
      return null;
    }
    // Remove the old copies only after the new format has been persisted.
    // Released legacy clients can recreate them, but cannot overwrite new records.
    const legacyKeys = SYNC_STORAGE_KEYS.filter(key => Object.hasOwn(records, key));
    if (legacyKeys.length) await storage.sync.remove(legacyKeys);
    return records;
  }

  async function flush(state, records) {
    const writes = {};
    const completed = [];
    Object.entries(state.pending).forEach(([group, operation]) => {
      const key = POLICY_PREFIX + group;
      const remote = records[key];
      // A disable/enable cycle invalidates edits queued under the previous policy.
      if (operation.epoch !== (remote?.epoch || 'initial')) {
        completed.push(group);
        return;
      }
      if (operation.kind === 'policy') {
        writes[key] = {
          ...remote,
          enabled: operation.enabled,
          epoch: operation.nextEpoch,
          retired: [...new Set([...(remote?.retired || []), ...(remote ? [remote.epoch] : [])])]
        };
        if (operation.enabled) writes[valueKey(group, operation.nextEpoch)] = { value: copy(operation.value) };
      } else if (remote?.enabled !== false) {
        if (!remote) writes[key] = { enabled: true, epoch: 'initial' };
        const dataKey = valueKey(group, remote?.epoch);
        writes[dataKey] = {
          ...records[dataKey],
          value: applyKnownChanges(records[dataKey]?.value || {}, operation.before, operation.after)
        };
      }
      completed.push(group);
    });
    if (Object.keys(writes).length && !await writeSyncSettings(writes)) return records;
    completed.forEach(group => delete state.pending[group]);
    await storage.local.set({ [SYNC_STATE_KEY]: state });
    const updated = { ...records, ...writes };
    const retiredKeys = [];
    Object.entries(updated).forEach(([key, record]) => {
      if (!key.startsWith(POLICY_PREFIX)) return;
      const group = key.slice(POLICY_PREFIX.length);
      (record.retired || []).forEach(epoch => {
        const retiredKey = valueKey(group, epoch);
        if (Object.hasOwn(updated, retiredKey)) retiredKeys.push(retiredKey);
      });
    });
    if (retiredKeys.length) {
      await storage.sync.remove(retiredKeys);
      retiredKeys.forEach(key => delete updated[key]);
    }
    return updated;
  }

  async function receive(current, state, records, forceRead = false) {
    const decoded = readSyncRecords(records);
    if (state.policy?.sync_default_folder_path !== false && decoded.policy.sync_default_folder_path === false) {
      current.default_folder_id = current.sync_default_folder_id || current.default_folder_id;
    }
    policy = decoded.policy;
    state.policy = policy;
    state.raw ||= {};
    state.epochs ||= {};
    const changed = new Set();
    Object.entries(policy).forEach(([group, enabled]) => {
      const record = records[POLICY_PREFIX + group];
      const raw = records[valueKey(group, record.epoch)]?.value;
      if (enabled && raw && !state.pending[group]) {
        // Echoes of our own writes must not undo device-specific layout or
        // permission fallbacks. A new generation still applies identical data.
        if (forceRead || state.epochs[group] !== record.epoch || !equal(state.raw[group], raw)) changed.add(group);
        state.raw[group] = copy(raw);
        state.epochs[group] = record.epoch;
      }
    });
    const incoming = { ...current };
    Object.entries(decoded.values).forEach(([key, value]) => {
      if (changed.has(syncGroup(key))) incoming[key] = value;
    });
    adopt(incoming);
    if (policy.sync_default_folder_path !== false) await resolveSyncedDefaultFolder($settings);
    else $settings.sync_default_folder_id = $settings.default_folder_id;
    if (!equal(current, $settings)) state.appliedRevision = crypto.randomUUID();
    baseline = copy($settings);
    await storage.local.set({ settings: $settings, [SYNC_STATE_KEY]: state });
  }

  async function synchronize(current, state, forceRead = false) {
    try {
      let records = await remoteRecords(current);
      if (!records) return;
      records = await flush(state, records);
      await receive(current, state, records, forceRead);
      if (!Object.keys(state.pending).length) {
        await storage.local.remove([SYNC_ERROR_KEY, SYNC_QUOTA_ERROR_KEY]);
      }
    } catch (error) {
      await storage.local.set({ [SYNC_ERROR_KEY]: String(error?.message || error) });
    }
  }

  function change(values, force = false, sync = true) {
    return withSettingsLock(async() => {
      const { local, state } = await readState();
      const current = { ...DEFAULTS, ...migrateSettings(local.settings || $settings) };
      const before = copy(baseline);
      const next = sanitizeSettings({ ...current, ...migrateSettings(values) });
      const groupedBefore = groupValues(before);
      const groupedAfter = groupValues(next);
      const requestedGroups = new Set(Object.keys(values)
        .filter(key => !SETTINGS_NOT_SYNCED.includes(key)).map(syncGroup));
      let records = {};
      if (sync && next.enable_sync && requestedGroups.size) {
        try {
          records = await remoteRecords(current) || {};
        } catch (error) {
          await storage.local.set({ [SYNC_ERROR_KEY]: String(error?.message || error) });
        }
      }
      if (sync && next.enable_sync) {
        requestedGroups.forEach(group => {
          const record = records[POLICY_PREFIX + group];
          if (record?.enabled === false || (!record && policy[group] === false)) return;
          const after = groupedAfter[group];
          const old = state.pending[group];
          if (!after || (!force && equal(groupedBefore[group], after))) return;
          if (old?.kind === 'policy') {
            if (old.enabled) old.value = applyKnownChanges(old.value, groupedBefore[group] || {}, after);
            return;
          }
          state.pending[group] = {
            kind: 'edit',
            epoch: record?.epoch || 'initial',
            before: old?.before || (force || !record ? {} : groupedBefore[group] || {}),
            after: copy(after)
          };
        });
      }
      adopt(next);
      // Persist intent before attempting any cloud write; quota failures/restarts
      // must not cause local edits to be replaced by old cloud values.
      await storage.local.set({ settings: $settings, [SYNC_STATE_KEY]: state });
      if (sync && next.enable_sync && requestedGroups.size) await synchronize($settings, state);
    });
  }

  return {
    get effective() {
      return effective;
    },
    get $() {
      return $settings;
    },
    get defaultFolderId() {
      return getDefaultFolderId($settings);
    },
    get syncPolicy() {
      return { ...policy };
    },
    isSynced(key) {
      return policy[syncGroup(key)] !== false;
    },

    async init() {
      await withSettingsLock(async() => {
        const { local, state } = await readState();
        adopt(local.settings);
        policy = state.policy || {};
        if (local[SYNC_QUOTA_ERROR_KEY] && !local[SYNC_STATE_KEY]) {
          Object.entries(groupValues($settings)).forEach(([group, after]) => {
            state.pending[group] = { kind: 'edit', epoch: 'initial', before: {}, after };
          });
        }
        await storage.local.set({ settings: $settings, [SYNC_STATE_KEY]: state });
        if ($settings.enable_sync) await synchronize($settings, state);
        else await storage.local.set({ settings: $settings });
        initialized = true;
      });
    },

    updateKey(key, value, { sync = true } = {}) {
      const values = { [key]: value };
      if (key === 'enable_sync' && !value) values.default_folder_id = this.defaultFolderId;
      return change(values, false, sync);
    },

    updateAll(values = {}, { sync = true } = {}) {
      return change(values, false, sync);
    },

    async resetKeys(keys = []) {
      const defaults = getDefaultSettings(keys);
      await change(defaults);
      return defaults;
    },

    // Explicit "use this device" operation. Ordinary edits use change() and
    // publish only the requested keys, never the entire normalized store.
    syncToStorage() {
      return change($settings, true);
    },

    restoreFromSync() {
      return withSettingsLock(async() => {
        const { local, state } = await readState();
        state.pending = {};
        await storage.local.set({ [SYNC_STATE_KEY]: state });
        await synchronize(local.settings || $settings, state, true);
      });
    },

    setSyncEnabled(key, enabled) {
      return this.setSyncEnabledMany([key], enabled);
    },

    setSyncEnabledMany(keys, enabled) {
      return withSettingsLock(async() => {
        if (!keys.length || keys.some(key => !Object.hasOwn(DEFAULTS, key) || SETTINGS_NOT_SYNCED.includes(key))) {
          return false;
        }
        const groups = [...new Set(keys.map(syncGroup))];
        const { local, state } = await readState();
        const current = local.settings || $settings;
        if (!current.enable_sync) return false;
        const records = await remoteRecords(current);
        if (!records) return false;
        state.raw ||= {};
        const grouped = groupValues(current);
        groups.forEach(group => {
          const remote = records[POLICY_PREFIX + group];
          if ((remote?.enabled !== false) === enabled && !state.pending[group]) return;
          const raw = records[valueKey(group, remote?.epoch)]?.value;
          if (raw) state.raw[group] = copy(raw);
          if (!enabled && group === 'sync_default_folder_path') {
            current.default_folder_id = current.sync_default_folder_id || current.default_folder_id;
          }
          state.pending[group] = {
            kind: 'policy',
            epoch: remote?.epoch || 'initial',
            nextEpoch: crypto.randomUUID(),
            enabled,
            // Publish the initiating device's local values, including retained
            // future fields. All selected policies are saved in one batch.
            value: enabled ? applyKnownChanges(raw || state.raw[group] || {}, {}, grouped[group]) : undefined
          };
        });
        await storage.local.set({ [SYNC_STATE_KEY]: state });
        const updated = await flush(state, records);
        await receive(current, state, updated);
        return groups.every(group => !state.pending[group]);
      });
    },

    async handleSyncChange(changes, area) {
      if (area !== 'sync' || !Object.keys(changes).some(key =>
        key.startsWith(SYNC_PREFIX) || key.startsWith(POLICY_PREFIX) || key === SYNC_VERSION_KEY)) return;
      await withSettingsLock(async() => {
        const { local, state } = await readState();
        if (!local.settings?.enable_sync) return;
        if (changes[SYNC_VERSION_KEY]?.oldValue && !changes[SYNC_VERSION_KEY]?.newValue) {
          // An explicit cloud reset must not be immediately undone by another
          // open device treating the now-empty cloud as a first installation.
          adopt({ ...local.settings, enable_sync: false });
          await storage.local.set({ settings: $settings });
          await storage.local.remove(SYNC_STATE_KEY);
          return;
        }
        // Events caused by our own writes reach this lock after the writer.
        // Receiving never creates a new write except retrying persisted intent.
        await synchronize(local.settings, state);
      });
      if (initialized && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('startgrid-sync-applied'));
      }
    },

    resetLocal() {
      return withSettingsLock(async() => {
        adopt({ ...DEFAULTS, enable_sync: false });
        await storage.local.set({ settings: $settings });
        await storage.local.remove(SYNC_STATE_KEY);
        localStorage.clear();
      });
    },

    clearLocalCache() {
      return withSettingsLock(async() => {
        const saved = await storage.local.get(['settings', SYNC_STATE_KEY, SYNC_QUOTA_ERROR_KEY, SYNC_ERROR_KEY]);
        await storage.local.clear();
        await storage.local.set(saved);
        localStorage.clear();
      });
    },

    resetSync() {
      return withSettingsLock(async() => {
        adopt({ ...$settings, enable_sync: false });
        await storage.local.set({ settings: $settings });
        await storage.local.remove(SYNC_STATE_KEY);
        await storage.sync.clear();
      });
    }
  };
};
export const settings = settingsStore();

export const LAST_OPENED_FOLDER_ID = 'last_opened_folder_id';
