import './components/vb-select';
import { getMessage } from './i18n';
import { settings } from './settings';
import Localization from './plugins/localization';
import Ripple from './components/ripple';
import Toast from './components/toast';
import confirmPopup from './plugins/confirmPopup.js';
import { createFolderSyncPath, getFolders } from './api/bookmark';
import {
  $notifications,
  $resizeThumbnail,
  $trigger,
  getVideoPoster,
  $filePicker
} from './utils';
import Range from './components/range';
import ImageDB from './api/imageDB';
import {
  commitBackgroundUpload,
  BACKGROUND_FILE_PICKER_OPTIONS,
  createBackgroundPreview,
  FILES_ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  validateBackgroundFile
} from './backgroundFileValidation';
import settingsList from './constants/settingsList';
import { displaySettings } from './components/displaySettings';
import { containsPermissions, removePermissions, requestPermissions } from './api/permissions';
import { getEnabledSearchEngines } from './searchEngines';
import initSearchEngineSettings from './components/searchEngineSettings';
import initKeyboardShortcutSettings from './components/keyboardShortcutSettings';
import { SYNC_STORAGE_KEYS } from './syncSettings';
import { cssColorToHex } from './tileAppearance';
import {
  getGridLayoutLimits,
  getHorizontalGapLimits,
  getTileSizeLimits
} from './gridLayout';
import { scaleTileContentSettings } from './tileSizeSync';
import { exportSettings, SETTINGS_JSON_FILE_TYPES } from './settingsExport';
import { matchesSettingsSearch } from './settingsSearch';

let backgroundImage = null;
let searchEngineSettingsInstance = null;
let keyboardShortcutSettingsInstance = null;
let activeSettingsSection = null;
let sectionBeforeSearch = null;
const ranges = new Map();

const COLOR_SETTING_THEME_VARIABLES = Object.freeze({
  background_color: '--theme-background',
  dial_background_color: '--theme-background-2',
  dial_title_color: '--theme-text-color',
  toolbar_background_color: '--theme-background-2'
});

async function init() {
  // Set lang attr
  // Replacement underscore on the dash because underscore is not a valid language subtag
  document.documentElement.setAttribute(
    'lang',
    getMessage('@@ui_locale').replace('_', '-')
  );

  window.settings.innerHTML = displaySettings(settingsList);

  await settings.init();

  await enforceGridWidth();

  await window.vbToggleTheme();

  Localization();

  Ripple.init('.md-ripple');

  const background = await ImageDB.get('background');
  if (background) {
    backgroundImage = URL.createObjectURL(background.blobThumbnail);
  }

  // range settings
  Array.from(document.querySelectorAll('.js-range')).forEach(el => {
    const id = el.id;
    const range = new Range(el, {
      value: settings.$[id],
      postfix: el.dataset.outputPostfix,
      onBlur(e) {
        const { value } = e.target;
        settings.updateKey(id, value);
      },
      ...('thumbnails_update_delay' === id) && {
        format(value) {
          return parseFloat(value).toFixed(1);
        }
      }
    });
    ranges.set(id, range);
  });

  initSettingsNavigation();

  const manifest = browser.runtime.getManifest();
  document.getElementById('ext_name').textContent = manifest.name;
  document.getElementById('ext_version').textContent = `${getMessage('version')} ${manifest.version}`;

  searchEngineSettingsInstance = initSearchEngineSettings({
    container: document.getElementById('search_engines'),
    settings,
    onChange: () => {
      generateSearchEngineList();
      applySettingsFilter();
    }
  });
  keyboardShortcutSettingsInstance = initKeyboardShortcutSettings({
    container: document.getElementById('keyboard_shortcuts'),
    settings
  });
  getOptions();

  // Delegate change settings
  document.querySelector('.settings-shell').addEventListener('change', handleSetOptions);
  document.getElementById('background_local').addEventListener('click', handleRemoveFile);
  document.getElementById('restore_local').addEventListener('click', handleResetLocalSettings);
  document.getElementById('restore_sync').addEventListener('click', handleResetSyncSettings);
  document.getElementById('enable_sync').addEventListener('change', handleChangeSync);
  document.getElementById('clear_images').addEventListener('click', handleDeleteImages);
  document.getElementById('clear_cache').addEventListener('click', handleClearLocalCache);
  document.getElementById('toggle_clipboard_access').addEventListener('change', handleToggleClipboardAccess);

  document.getElementById('export').addEventListener('click', handleExportSettings);
  document.getElementById('import').addEventListener('click', handleImportSettingsFromPicker);
  document.getElementById('bgFile').addEventListener('click', handleChooseBackgroundFile);
  document.getElementById('set_background_external').addEventListener('click', handleExternalBackgroundSave);
  document.getElementById('delete_background_external').addEventListener('click', handleExternalBackgroundRemove);
  document.getElementById('back_to_main').addEventListener('click', handleBackToMain);
  document.querySelectorAll('[data-reset-color]').forEach(button => {
    button.addEventListener('click', handleResetColor);
  });

  // TODO until full support is available https://developer.mozilla.org/en-US/docs/Web/API/Window/showOpenFilePicker
  document.getElementById('bgFile').setAttribute(
    'accept',
    FILES_ALLOWED_EXTENSIONS.map(ext => `.${ext}`).join(', ')
  );
}

function activateSettingsSection(
  sectionId,
  { focus = false, persist = true, resetScroll = true } = {}
) {
  const navigationItems = [...document.querySelectorAll('.settings-nav__item')];
  const panels = [...document.querySelectorAll('.settings-panel')];
  const targetNavigation = navigationItems.find(item => {
    return item.dataset.sectionId === sectionId && !item.hidden;
  });
  if (!targetNavigation) return;

  activeSettingsSection = sectionId;
  navigationItems.forEach(item => {
    const isActive = item.dataset.sectionId === sectionId;
    item.setAttribute('aria-selected', String(isActive));
    item.tabIndex = isActive ? 0 : -1;
  });
  panels.forEach(panel => {
    const isActive = panel.dataset.sectionId === sectionId;
    const isFiltered = panel.dataset.filterHidden === 'true';
    panel.hidden = !isActive || isFiltered;
    panel.setAttribute('aria-hidden', String(!isActive || isFiltered));
  });

  const mobileSelect = document.getElementById('settings_section_select');
  if (mobileSelect) mobileSelect.value = sectionId;
  if (persist) localStorage.options_section = sectionId;
  if (focus) targetNavigation.focus();

  const viewport = document.querySelector('.settings-viewport');
  if (viewport && resetScroll) viewport.scrollTop = 0;
}

function updateSettingsRowVisibility(row, reason, hidden) {
  row.dataset[reason] = String(hidden);
  row.hidden = row.dataset.conditionHidden === 'true' || row.dataset.searchHidden === 'true';
}

function applySettingsFilter() {
  const searchInput = document.getElementById('settings_search');
  const query = searchInput.value.trim();
  const matchingSections = [];

  document.querySelectorAll('.settings-panel').forEach(panel => {
    const panelTitle = panel.querySelector('.settings-panel__title').textContent;
    const panelMatches = Boolean(query) && matchesSettingsSearch(query, panelTitle);
    let panelHasMatches = false;

    panel.querySelectorAll('.settings-card').forEach(card => {
      const cardHeader = card.querySelector('.settings-card__header').textContent;
      const cardMatches = panelMatches || (
        Boolean(query) && matchesSettingsSearch(query, panelTitle, cardHeader)
      );
      let cardHasMatches = false;

      card.querySelectorAll('.settings-card__content > .tbl').forEach(row => {
        const rowMatches = !query || cardMatches || matchesSettingsSearch(
          query,
          panelTitle,
          cardHeader,
          row.textContent
        );
        updateSettingsRowVisibility(row, 'searchHidden', !rowMatches);
        if (!row.hidden) cardHasMatches = true;
      });

      card.hidden = !cardHasMatches;
      if (cardHasMatches) panelHasMatches = true;
    });

    panel.dataset.filterHidden = String(!panelHasMatches);
    const sectionId = panel.dataset.sectionId;
    const navigationItem = document.querySelector(`.settings-nav__item[data-section-id="${sectionId}"]`);
    const mobileOption = document.querySelector(`#settings_section_select option[value="${sectionId}"]`);
    navigationItem.hidden = !panelHasMatches;
    if (mobileOption) {
      mobileOption.hidden = !panelHasMatches;
      mobileOption.disabled = !panelHasMatches;
    }
    if (panelHasMatches) matchingSections.push(sectionId);
  });

  const emptyState = document.getElementById('settings_empty');
  emptyState.hidden = matchingSections.length > 0;
  if (!matchingSections.includes(activeSettingsSection)) {
    activeSettingsSection = matchingSections[0] || null;
  }
  if (activeSettingsSection) {
    activateSettingsSection(activeSettingsSection, {
      persist: !query,
      resetScroll: false
    });
  } else {
    document.querySelectorAll('.settings-panel').forEach(panel => {
      panel.hidden = true;
    });
  }
}

function initSettingsNavigation() {
  const navigation = document.querySelector('.settings-nav');
  const navigationItems = [...navigation.querySelectorAll('.settings-nav__item')];
  const sectionIds = navigationItems.map(item => item.dataset.sectionId);
  const legacyIndex = Number.parseInt(localStorage.option_tab_slide, 10);
  const legacySectionIds = [
    'appearance',
    'appearance',
    'search',
    'bookmarks',
    'thumbnails',
    'data',
    'controls'
  ];
  const legacySection = Number.isFinite(legacyIndex) ? legacySectionIds[legacyIndex] : null;
  const initialSection = sectionIds.includes(localStorage.options_section)
    ? localStorage.options_section
    : legacySection || sectionIds[0];
  localStorage.removeItem('option_tab_slide');

  navigation.addEventListener('click', event => {
    const item = event.target.closest('.settings-nav__item');
    if (item) activateSettingsSection(item.dataset.sectionId);
  });
  navigation.addEventListener('keydown', event => {
    const currentItem = event.target.closest('.settings-nav__item');
    if (!currentItem) return;

    const visibleItems = navigationItems.filter(item => !item.hidden);
    const currentIndex = visibleItems.indexOf(currentItem);
    let nextIndex = currentIndex;
    if (['ArrowUp', 'ArrowLeft'].includes(event.key)) {
      nextIndex = (currentIndex - 1 + visibleItems.length) % visibleItems.length;
    } else if (['ArrowDown', 'ArrowRight'].includes(event.key)) {
      nextIndex = (currentIndex + 1) % visibleItems.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = visibleItems.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    activateSettingsSection(visibleItems[nextIndex].dataset.sectionId, { focus: true });
  });

  document.getElementById('settings_section_select').addEventListener('change', event => {
    activateSettingsSection(event.target.value);
  });

  const searchInput = document.getElementById('settings_search');
  searchInput.addEventListener('input', () => {
    const hasQuery = Boolean(searchInput.value.trim());
    if (hasQuery && !sectionBeforeSearch) sectionBeforeSearch = activeSettingsSection;
    if (!hasQuery && sectionBeforeSearch) {
      activeSettingsSection = sectionBeforeSearch;
      sectionBeforeSearch = null;
    }
    applySettingsFilter();
  });
  searchInput.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !searchInput.value) return;
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input'));
  });

  activateSettingsSection(initialSection);
}

function handleBackToMain(e) {
  e.preventDefault();

  const newTabUrl = navigator.userAgent.includes('Edg/')
    ? 'edge://newtab/'
    : 'chrome://newtab/';

  browser.tabs.update({ url: newTabUrl });
}

async function handleImportSettingsFromPicker() {
  try {
    const file = await $filePicker({
      types: SETTINGS_JSON_FILE_TYPES,
      excludeAcceptAllOption: true,
      multiple: false
    });
    if (!file) return;
    handleImportSettings({ target: { files: [file] } });
  } catch (error) {
    Toast.show(getMessage('import_settings_failed'));
    console.warn(error);
  }
}

async function handleChooseBackgroundFile() {
  try {
    const file = await $filePicker(BACKGROUND_FILE_PICKER_OPTIONS);
    if (!file) return;
    await handleUploadFile.call(
      { files: [file], closest: selector => document.getElementById('bgFile').closest(selector) }
    );
  } catch (error) {
    Toast.show(getMessage('notice_background_save_failed'));
    console.warn(error);
  }
}

function handleImportSettings(e) {
  const input = e.target;
  if (input.files && input.files[0]) {
    const reader = new FileReader();

    reader.addEventListener('load', async(e) => {
      try {
        const importSettings = JSON.parse(e.target.result);
        await settings.updateAll(importSettings);
        $notifications(
          getMessage('import_settings_success')
        );
        setTimeout(() => {
          location.reload();
        }, 0);
      } catch (error) {
        input.value = '';
        Toast.show(getMessage('import_settings_failed'));
        console.warn(error);
      }
    });
    reader.readAsText(input.files[0], 'UTF-8');
  }
}

async function handleExportSettings() {
  const data = Object.keys(settings.$).reduce((acc, cur) => {
    if (
      ![
        'default_folder_id',
        'custom_dials',
        'background_local'
      ].includes(cur)
    ) {
      acc[cur] = settings.$[cur];
    }
    return acc;
  }, {});

  const result = await exportSettings(data);
  if (!result.ok && !result.cancelled) {
    Toast.show(getMessage('import_settings_failed'));
    console.warn(result.error);
  }
}

function getThemeColor(settingId) {
  const variable = COLOR_SETTING_THEME_VARIABLES[settingId];
  const themeColor = window.getComputedStyle(document.documentElement).getPropertyValue(variable);
  return cssColorToHex(themeColor);
}

function syncColorControl(settingId) {
  const colorInput = document.getElementById(settingId);
  const resetButton = document.querySelector(`[data-reset-color="${settingId}"]`);
  const customColor = settings.$[settingId];
  const themeColor = getThemeColor(settingId);
  colorInput.value = customColor ? cssColorToHex(customColor, themeColor) : themeColor;
  if (resetButton) resetButton.disabled = !customColor;
}

async function handleResetColor(e) {
  e.preventDefault();
  const settingId = e.currentTarget.dataset.resetColor;
  await settings.updateKey(settingId, '');
  syncColorControl(settingId);
}

function getOptions() {
  generateFolderList();
  generateSearchEngineList();
  searchEngineSettingsInstance?.render();
  keyboardShortcutSettingsInstance?.render();
  getPermissions();

  for (let id of Object.keys(settings.$)) {
    const elOption = document.getElementById(id);

    // goto next if element not type
    if (!elOption || !elOption.type) continue;

    if (elOption.type === 'color') {
      syncColorControl(id);
    } else if (/checkbox|radio/.test(elOption.type)) {
      elOption.checked = settings.$[id];
    } else {
      elOption.value = settings.$[id];

      // update range slider
      if (elOption.type === 'range') {
        $trigger('change', elOption);
      }
    }
  }
  syncConditionalControls();
}

function syncConditionalControls() {
  const sortMode = document.getElementById('home_sort_by')?.value;
  const conditionalRows = {
    home_sort_date_direction: sortMode === 'date',
    home_sort_alphabet_direction: sortMode === 'alphabet',
    home_sort_usage_tiebreaker: sortMode === 'usage',
    show_usage_count: sortMode === 'usage',
    bookmarks_sorting_type: document.getElementById('show_home_folders')?.checked,
    background_entrance_duration: document.getElementById('background_entrance_effect')?.value !== 'none',
    page_cascade_mode: document.getElementById('page_cascade_enabled')?.checked,
    page_cascade_duration: document.getElementById('page_cascade_enabled')?.checked,
    thumbnails_auto_refresh_interval: document.getElementById('thumbnails_auto_refresh')?.checked,
    toolbar_background_color: !document.getElementById('toolbar_match_tile_background')?.checked,
    toolbar_background_opacity: !document.getElementById('toolbar_match_tile_background')?.checked
  };

  Object.entries(conditionalRows).forEach(([id, visible]) => {
    const row = document.getElementById(`setting_${id}`);
    if (row) updateSettingsRowVisibility(row, 'conditionHidden', !visible);
  });
  applySettingsFilter();
}

/**
 * Toggle background settings
 * @param {string} value - localStorage background_image value
 */
function toggleBackgroundControls(value) {
  Array.from(document.querySelectorAll('.js-background-settings')).forEach((item) => {
    item.hidden = true;
  });
  if (value === 'background_local') {
    if (backgroundImage) {
      document.getElementById('preview_upload').innerHTML = /* html */
        `<div class="c-upload__preview-image" style="background-image: url(${backgroundImage});"><div>`;
    } else {
      document.getElementById('preview_upload').innerHTML = '';
    }
    document.querySelector('.c-upload__preview').hidden = !backgroundImage;
  }
  if (value === 'background_external') {
    syncExternalBackgroundControls();
  }
  const activeControl = document.querySelector(`[data-background-setting="${value}"]`)
    || document.getElementById(value);
  if (activeControl) activeControl.hidden = false;
}

function syncExternalBackgroundControls() {
  const input = document.getElementById('background_external_url');
  const preview = document.getElementById('preview_external');
  const image = document.getElementById('preview_external_image');
  const url = settings.$.background_external;

  input.value = url;
  preview.hidden = true;
  image.removeAttribute('src');
  if (!url) return;

  image.addEventListener('load', () => {
    preview.hidden = false;
  }, { once: true });
  image.src = url;
}

async function handleExternalBackgroundSave() {
  const input = document.getElementById('background_external_url');
  if (!input.reportValidity()) return;

  const hasPermission = await requestPermissions({ origins: ['<all_urls>'] });
  if (!hasPermission) return;

  await settings.updateAll({
    background_image: 'background_external',
    background_external: input.value.trim()
  });
  toggleBackgroundControls('background_external');
  Toast.show(getMessage('notice_bg_image_updated'));
}

async function handleExternalBackgroundRemove() {
  const confirmAction = await confirmPopup(getMessage('confirm_delete_image'));
  if (!confirmAction) return;

  await settings.updateKey('background_external', '');
  syncExternalBackgroundControls();
  Toast.show(getMessage('notice_image_removed'));
}

function relationToggleOption(target) {
  // Settings that depend on each other.
  // When enabling one setting, the related setting must be disabled
  if (target.dataset.relationToggleId) {
    const checkedRegexp = /checkbox|radio/;
    // association can be with multiple selectors
    // create an array of settings IDs from the string
    const ids = target.dataset.relationToggleId.split(',');
    // get value regardless of element type
    const value = checkedRegexp.test(target.type) ? target.checked : target.value;
    ids.forEach(id => {
      const relationEl = document.getElementById(id);

      // This whole relationship-handling logic needs to be reworked.
      // For now, this is a dirty workaround for the relation item's action
      if (target.dataset.relationAction) {
        relationEl[target.dataset.relationAction] = target.checked;
        return;
      }

      // disable the related option only if it was initially enabled
      // if relation element => checkbox|radio
      if (checkedRegexp.test(relationEl.type) && relationEl.checked) {
        // if relation with boolean type
        if (typeof value === 'boolean') {
          relationEl.checked = !target.checked;
        } else {
        // otherwise we try to get the string value of the data attribute
        // convert string to array
        // and search by keyword
        // if array includes keyword, we need to turn off the setting
          const values = target.dataset.relationToggleValues.split(',');
          relationEl.checked = !values.includes(value);
        }
        // update extension setting
        settings.updateKey(id, relationEl.checked);
      } else {
        // if relation element => select
        if (relationEl.tagName === 'SELECT') {
          relationEl.selectedIndex = 0;
        } else {
        // if relation element => input
          relationEl.value = '';
        }
        // update extension setting
        settings.updateKey(id, relationEl.value);
      }
    });
  }
}

async function handleSetOptions(e) {
  const target = e.target.closest('.js-change');
  if (!target) return;

  const id = target.id;
  const previousTileSize = settings.$.dial_tile_size;
  if (id === 'enable_sync') return;
  if (id === 'language') {
    await settings.updateKey(id, target.value);
    window.location.reload();
    return;
  }

  if (/checkbox|radio/.test(target.type)) {
    if (
      ['thumbnails_auto_refresh', 'download_favicons_by_default'].includes(id)
      && target.checked
    ) {
      const hasPermission = await requestPermissions({ origins: ['<all_urls>'] });
      if (!hasPermission) target.checked = false;
    }
    await settings.updateKey(id, target.checked);
  } else {
    if (id === 'thumbnail_source' && target.value === 'site') {
      const hasPermission = await requestPermissions({ origins: ['<all_urls>'] });
      if (!hasPermission) {
        target.value = settings.$.thumbnail_source;
        return;
      }
    }

    if (id === 'background_image') {
      if (target.value === 'background_bing') {
        const bingHostPermission = await requestPermissions({ origins: ['https://www.bing.com/*'] });
        if (!bingHostPermission) {
          target.value = 'background_local';
        }
      }

      toggleBackgroundControls(target.value);
    }

    if (id === 'default_folder_id') {
      await updateDefaultFolder(target.value);
    } else if (id === 'dial_tile_size') {
      const tileContentSettings = scaleTileContentSettings({
        faviconSize: settings.$.favicon_size,
        fromTileSize: previousTileSize,
        titleSize: settings.$.bookmark_title_size,
        toTileSize: target.value
      });
      await settings.updateAll({
        dial_tile_size: target.value,
        ...tileContentSettings
      });
      syncTileContentControls(tileContentSettings);
    } else {
      await settings.updateKey(id, target.value);
    }
  }

  relationToggleOption(target);

  if (['dial_columns', 'dial_width', 'dial_tile_size', 'dial_horizontal_gap'].includes(id)) {
    await enforceGridWidth();
  }

  if ([
    'home_sort_by',
    'show_home_folders',
    'background_entrance_effect',
    'page_cascade_enabled',
    'thumbnails_auto_refresh',
    'toolbar_match_tile_background'
  ].includes(id)) {
    syncConditionalControls();
  }

  // dark theme
  if (target.id === 'color_theme') {
    await window.vbToggleTheme();
    Object.keys(COLOR_SETTING_THEME_VARIABLES).forEach(settingId => {
      if (!settings.$[settingId]) syncColorControl(settingId);
    });
  } else if (Object.hasOwn(COLOR_SETTING_THEME_VARIABLES, target.id)) {
    const resetButton = document.querySelector(`[data-reset-color="${target.id}"]`);
    if (resetButton) resetButton.disabled = false;
  }
}

function syncTileContentControls(tileContentSettings) {
  Object.entries(tileContentSettings).forEach(([key, value]) => {
    const control = document.getElementById(key);
    if (!control) return;

    control.value = String(value);
    ranges.get(key)?.setValue(value);
  });
}

async function enforceGridWidth() {
  const gridWidthControl = document.getElementById('dial_width');
  const tileSizeControl = document.getElementById('dial_tile_size');
  const horizontalGapControl = document.getElementById('dial_horizontal_gap');
  if (!gridWidthControl || !tileSizeControl || !horizontalGapControl) return;

  const { gridWidth, minimumGridWidth } = getGridLayoutLimits({
    columns: settings.$.dial_columns,
    gridWidth: settings.$.dial_width,
    horizontalGap: settings.$.dial_horizontal_gap,
    tileSize: settings.$.dial_tile_size,
    viewportWidth: document.documentElement.clientWidth
  });

  gridWidthControl.min = String(minimumGridWidth);
  ranges.get('dial_width')?.setMin(minimumGridWidth);
  if (Number(settings.$.dial_width) !== gridWidth) {
    await settings.updateKey('dial_width', gridWidth);
  }
  gridWidthControl.value = String(gridWidth);
  ranges.get('dial_width')?.setValue(gridWidth);

  const { minimumTileSize, maximumTileSize } = getTileSizeLimits({
    columns: settings.$.dial_columns,
    gridWidth,
    horizontalGap: settings.$.dial_horizontal_gap,
    viewportWidth: document.documentElement.clientWidth
  });
  const tileSize = Math.min(
    maximumTileSize,
    Math.max(minimumTileSize, Number(settings.$.dial_tile_size))
  );

  if (Number(settings.$.dial_tile_size) !== tileSize) {
    const tileContentSettings = scaleTileContentSettings({
      faviconSize: settings.$.favicon_size,
      fromTileSize: settings.$.dial_tile_size,
      titleSize: settings.$.bookmark_title_size,
      toTileSize: tileSize
    });
    await settings.updateAll({ dial_tile_size: tileSize, ...tileContentSettings });
    syncTileContentControls(tileContentSettings);
  }
  const { minimumHorizontalGap, maximumHorizontalGap } = getHorizontalGapLimits({
    columns: settings.$.dial_columns,
    gridWidth,
    tileSize,
    viewportWidth: document.documentElement.clientWidth
  });
  const horizontalGap = Math.min(
    maximumHorizontalGap,
    Math.max(minimumHorizontalGap, Number(settings.$.dial_horizontal_gap))
  );
  if (Number(settings.$.dial_horizontal_gap) !== horizontalGap) {
    await settings.updateKey('dial_horizontal_gap', horizontalGap);
  }

  const finalTileSizeLimits = getTileSizeLimits({
    columns: settings.$.dial_columns,
    gridWidth,
    horizontalGap,
    viewportWidth: document.documentElement.clientWidth
  });
  tileSizeControl.min = String(finalTileSizeLimits.minimumTileSize);
  tileSizeControl.max = String(finalTileSizeLimits.maximumTileSize);
  ranges.get('dial_tile_size')?.setMin(finalTileSizeLimits.minimumTileSize);
  ranges.get('dial_tile_size')?.setMax(finalTileSizeLimits.maximumTileSize);
  tileSizeControl.value = String(tileSize);
  ranges.get('dial_tile_size')?.setValue(tileSize);

  horizontalGapControl.min = String(minimumHorizontalGap);
  horizontalGapControl.max = String(maximumHorizontalGap);
  ranges.get('dial_horizontal_gap')?.setMin(minimumHorizontalGap);
  ranges.get('dial_horizontal_gap')?.setMax(maximumHorizontalGap);
  horizontalGapControl.value = String(horizontalGap);
  ranges.get('dial_horizontal_gap')?.setValue(horizontalGap);
}

async function handleUploadFile() {
  const form = this.closest('form');
  const file = this.files[0];
  if (!file) return;

  form.reset();

  const validation = validateBackgroundFile(file);
  if (!validation.ok && validation.reason === 'type') {
    return Toast.show(getMessage(
      'alert_file_type_fail_type',
      [FILES_ALLOWED_EXTENSIONS.join(' | ')]
    ));
  }
  if (!validation.ok && validation.reason === 'size') {
    return Toast.show(getMessage(
      'alert_file_type_fail_size',
      [MAX_FILE_SIZE_BYTES / 10 ** 6]
    ));
  }

  form.classList.add('is-upload');
  try {
    const blob = new Blob([new Uint8Array(await file.arrayBuffer())], {
      type: file.type
    });
    const blobThumbnail = await createBackgroundPreview({
      blob,
      file,
      validation,
      resizeImage: value => $resizeThumbnail(value),
      getVideoPoster: value => getVideoPoster(value)
    });
    const previousObjectURL = backgroundImage;
    const previousRecord = await ImageDB.get('background');
    const result = await commitBackgroundUpload({
      record: {
        id: 'background',
        blob,
        blobThumbnail
      },
      persist: record => ImageDB.update(record),
      createObjectURL: value => URL.createObjectURL(value),
      previousObjectURL,
      revokeObjectURL: value => URL.revokeObjectURL(value),
      rollback: async() => {
        const restored = previousRecord
          ? await ImageDB.update(previousRecord)
          : await ImageDB.delete('background');
        if (restored === undefined || restored === false) throw new Error('Background rollback failed');
        const preview = document.getElementById('preview_upload');
        preview.innerHTML = previousObjectURL
          ? `<div class="c-upload__preview-image" style="background-image: url(${previousObjectURL});"><div>`
          : '';
        preview.closest('.c-upload__preview').hidden = !previousObjectURL;
        backgroundImage = previousObjectURL;
      },
      reportError: () => Toast.show(getMessage('notice_background_save_failed')),
      apply(objectURL) {
        document.getElementById('preview_upload').innerHTML = /* html */
          `<div class="c-upload__preview-image"
            style="background-image: url(${objectURL});">
          <div>`;
        document.querySelector('.c-upload__preview').hidden = false;
        backgroundImage = objectURL;
      }
    });

    if (!result.ok) {
      return;
    }
    Toast.show(getMessage('notice_bg_image_updated'));
  } catch {
    Toast.show(getMessage('notice_background_save_failed'));
  } finally {
    form.classList.remove('is-upload');
  }
}

async function handleRemoveFile(evt) {
  const target = evt.target.closest('#delete_upload, #delete_local_background');
  if (!target) return;

  const confirmAction = await confirmPopup(getMessage('confirm_delete_image'));
  if (!confirmAction) return;

  evt.preventDefault();
  const preview = document.getElementById('preview_upload');
  const previewParent = preview.closest('.c-upload__preview');

  await ImageDB.delete('background');
  if (backgroundImage) {
    URL.revokeObjectURL(backgroundImage);
    backgroundImage = null;
  }

  preview.innerHTML = '';
  previewParent.hidden = true;
  Toast.show(getMessage('notice_image_removed'));
}

async function handleDeleteImages(evt) {
  evt.preventDefault();

  const confirmAction = await confirmPopup(getMessage('confirm_delete_images'));
  if (!confirmAction) return;

  const cleared = await ImageDB.clearThumbnails();
  if (!cleared) return;
  Toast.show(getMessage('notice_images_removed'));
}

async function handleClearLocalCache(evt) {
  evt.preventDefault();

  const confirmAction = await confirmPopup(getMessage('confirm_clear_local_cache'));
  if (!confirmAction) return;

  await settings.clearLocalCache();
  Toast.show(getMessage('notice_local_cache_cleared'));
}

async function handleResetLocalSettings() {
  const confirmAction = await confirmPopup(getMessage('confirm_restore_default_settings'));
  if (!confirmAction) return;

  const previousLanguage = settings.$.language;
  await settings.resetLocal();
  if (previousLanguage !== settings.$.language) {
    window.location.reload();
    return;
  }

  await window.vbToggleTheme();
  await enforceGridWidth();
  getOptions();
  toggleBackgroundControls(settings.$.background_image);
  updateDefaultFolderControl();
  Toast.show(getMessage('notice_reset_default_settings'));
}
async function handleResetSyncSettings() {
  const confirmAction = await confirmPopup(getMessage('confirm_clear_sync_settings'));
  if (!confirmAction) return;

  await settings.resetSync();
  await enforceGridWidth();
  getOptions();
  updateDefaultFolderControl();
  Toast.show(getMessage('notice_sync_settings_cleared'));
}
async function updateDefaultFolder(folderId) {
  if (!settings.$.enable_sync) {
    await settings.updateKey('default_folder_id', folderId);
    return;
  }

  await settings.updateKey('sync_default_folder_id', folderId);
  const folders = await getFolders();
  const folderPath = createFolderSyncPath(folders, folderId);
  await settings.updateKey('sync_default_folder_path', folderPath);
}

function updateDefaultFolderControl() {
  const folderSelect = document.getElementById('default_folder_id');
  const storageNote = document.getElementById('default_folder_storage_note');

  if (folderSelect) folderSelect.value = settings.defaultFolderId;
  if (storageNote) {
    const messageId = settings.$.enable_sync
      ? 'default_folder_sync_note'
      : 'default_folder_local_note';
    storageNote.textContent = getMessage(messageId);
  }
}

async function handleChangeSync() {
  if (!this.checked) {
    await settings.updateKey('enable_sync', false);
    updateDefaultFolderControl();
    return;
  }

  const localFolderId = settings.$.default_folder_id;
  const syncRecords = await browser.storage.sync.get(SYNC_STORAGE_KEYS);
  const hasRemoteSettings = SYNC_STORAGE_KEYS.some(key => {
    return Object.keys(syncRecords[key] || {}).length > 0;
  });

  if (!hasRemoteSettings) {
    await settings.updateKey('enable_sync', true);
    await updateDefaultFolder(localFolderId);
    updateDefaultFolderControl();
    return;
  }

  const direction = await confirmPopup(getMessage('sync_direction_note'), {
    choices: [
      { value: 'cloud', text: getMessage('sync_replace_local') },
      { value: 'local', text: getMessage('sync_replace_cloud') }
    ]
  });
  if (!direction) {
    this.checked = false;
    return;
  }

  await settings.updateKey('enable_sync', true);
  if (direction === 'cloud') {
    await settings.restoreFromSync();
    await window.vbToggleTheme();
    await enforceGridWidth();
    getOptions();
  } else {
    await updateDefaultFolder(localFolderId);
    await settings.syncToStorage();
  }
  updateDefaultFolderControl();
}
async function handleToggleClipboardAccess(e) {
  e.preventDefault();
  const clipboardInput = document.getElementById('toggle_clipboard_access');

  if (clipboardInput.dataset.active !== 'true') {
    const requestPermission = await requestPermissions({ permissions: ['clipboardRead'] });
    clipboardInput.dataset.active = requestPermission;
  } else {
    const removePermission = await removePermissions({ permissions: ['clipboardRead'] });
    clipboardInput.dataset.active = !removePermission;
  }
  clipboardInput.checked = clipboardInput.dataset.active === 'true';
}

async function getPermissions() {
  const clipboardInput = document.getElementById('toggle_clipboard_access');
  const clipboardReadPermission = await containsPermissions({ permissions: ['clipboardRead'] });
  clipboardInput.checked = clipboardReadPermission;
  clipboardInput.dataset.active = clipboardReadPermission;

  const optionBackgroundSelect = document.getElementById('background_image');
  let selectedBackgroundValue = settings.$.background_image;
  if (selectedBackgroundValue === 'background_bing') {
    const bingHostPermission = await containsPermissions({ origins: ['https://www.bing.com/*'] });
    if (!bingHostPermission) {
      selectedBackgroundValue = 'background_local';
      settings.updateKey('background_image', selectedBackgroundValue);
    }
  }
  optionBackgroundSelect.value = selectedBackgroundValue;
  toggleBackgroundControls(selectedBackgroundValue);
}

async function generateFolderList() {
  const folders = await getFolders().catch(console.warn);
  if (folders) {
    const vbSelect = document.getElementById('default_folder_id');
    vbSelect.folders = folders;
    vbSelect.value = settings.defaultFolderId;
    vbSelect.disabled = settings.$.show_last_opened_folder;
    updateDefaultFolderControl();
  }
}

function generateSearchEngineList() {
  const select = document.getElementById('search_engine');
  const engines = getEnabledSearchEngines(
    settings.$.search_engines,
    key => getMessage(key)
  );
  select.replaceChildren(...engines.map(engine => {
    return new Option(engine.title, engine.id);
  }));
  select.value = settings.$.search_engine;
}

init();
