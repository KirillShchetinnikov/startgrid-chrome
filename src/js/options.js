import '../css/options.css';
import './components/vb-select';
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
  getVideoPoster
} from './utils';
import Range from './components/range';
import ImageDB from './api/imageDB';
import {
  FILES_ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES
} from './constants';
import settingsList from './constants/settingsList';
import { displaySettings } from './components/displaySettings';
import { containsPermissions, removePermissions, requestPermissions } from './api/permissions';
import { getEnabledSearchEngines } from './searchEngines';
import initSearchEngineSettings from './components/searchEngineSettings';
import initKeyboardShortcutSettings from './components/keyboardShortcutSettings';
import { cssColorToHex } from './tileAppearance';

let backgroundImage = null;
let searchEngineSettingsInstance = null;
let keyboardShortcutSettingsInstance = null;
let activeSettingsSection = null;
let sectionBeforeSearch = null;

async function init() {
  // Set lang attr
  // Replacement underscore on the dash because underscore is not a valid language subtag
  document.documentElement.setAttribute(
    'lang',
    browser.i18n.getMessage('@@ui_locale').replace('_', '-')
  );

  window.settings.innerHTML = displaySettings(settingsList);

  await settings.init();

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
    new Range(el, {
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
  });

  initSettingsNavigation();

  const manifest = browser.runtime.getManifest();
  document.getElementById('ext_name').textContent = manifest.name;
  document.getElementById('ext_version').textContent = `${browser.i18n.getMessage('version')} ${manifest.version}`;

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
  document.getElementById('import').addEventListener('change', handleImportSettings);
  document.getElementById('bgFile').addEventListener('change', handleUploadFile);
  document.getElementById('back_to_main').addEventListener('click', handleBackToMain);
  document.querySelector('[data-reset-color="dial_background_color"]')
    .addEventListener('click', handleResetTileBackgroundColor);

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
  const query = searchInput.value.trim().toLocaleLowerCase();
  const matchingSections = [];

  document.querySelectorAll('.settings-panel').forEach(panel => {
    const panelTitle = panel.querySelector('.settings-panel__title').textContent.toLocaleLowerCase();
    const panelMatches = Boolean(query) && panelTitle.includes(query);
    let panelHasMatches = false;

    panel.querySelectorAll('.settings-card').forEach(card => {
      const cardHeader = card.querySelector('.settings-card__header').textContent.toLocaleLowerCase();
      const cardMatches = panelMatches || (Boolean(query) && cardHeader.includes(query));
      let cardHasMatches = false;

      card.querySelectorAll('.settings-card__content > .tbl').forEach(row => {
        const rowMatches = !query || cardMatches || row.textContent.toLocaleLowerCase().includes(query);
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

function handleImportSettings(e) {
  const input = e.target;
  if (input.files && input.files[0]) {
    const reader = new FileReader();

    reader.addEventListener('load', async(e) => {
      try {
        const importSettings = JSON.parse(e.target.result);
        await settings.updateAll(importSettings);
        $notifications(
          browser.i18n.getMessage('import_settings_success')
        );
        setTimeout(() => {
          location.reload();
        }, 0);
      } catch (error) {
        input.value = '';
        Toast.show(browser.i18n.getMessage('import_settings_failed'));
        console.warn(error);
      }
    });
    reader.readAsText(input.files[0], 'UTF-8');
  }
}

function handleExportSettings() {
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

  const file = new Blob([JSON.stringify(data)], { type: 'text/plain' });
  // TODO: permission is required to download
  // browser.downloads.download({
  //   url: URL.createObjectURL(file),
  //   filename: 'startgrid-settings.backup'
  // });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = 'startgrid-settings.backup';
  a.click();
  a.remove();
}

function getThemeTileColor() {
  const themeColor = window.getComputedStyle(document.documentElement)
    .getPropertyValue('--theme-background-2');
  return cssColorToHex(themeColor);
}

function syncTileColorControl() {
  const colorInput = document.getElementById('dial_background_color');
  const resetButton = document.querySelector('[data-reset-color="dial_background_color"]');
  const customColor = settings.$.dial_background_color;
  const themeColor = getThemeTileColor();
  colorInput.value = customColor ? cssColorToHex(customColor, themeColor) : themeColor;
  resetButton.disabled = !customColor;
}

async function handleResetTileBackgroundColor(e) {
  e.preventDefault();
  await settings.updateKey('dial_background_color', '');
  syncTileColorControl();
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
      syncTileColorControl();
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
    thumbnails_auto_refresh_interval: document.getElementById('thumbnails_auto_refresh')?.checked
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
  document.getElementById(value).hidden = false;
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
  if (id === 'enable_sync') return;

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
    } else {
      await settings.updateKey(id, target.value);
    }
  }

  relationToggleOption(target);

  if ([
    'home_sort_by',
    'show_home_folders',
    'background_entrance_effect',
    'page_cascade_enabled',
    'thumbnails_auto_refresh'
  ].includes(id)) {
    syncConditionalControls();
  }

  // dark theme
  if (target.id === 'color_theme') {
    await window.vbToggleTheme();
    if (!settings.$.dial_background_color) syncTileColorControl();
  } else if (target.id === 'dial_background_color') {
    document.querySelector('[data-reset-color="dial_background_color"]').disabled = false;
  }
}

async function handleUploadFile() {
  const form = this.closest('form');
  const file = this.files[0];
  if (!file) return;

  form.reset();

  const isSizeExceeded = MAX_FILE_SIZE_BYTES < file.size;
  const isAllowedType = FILES_ALLOWED_EXTENSIONS.some(type => file.type.endsWith(type));
  if (!isAllowedType) {
    return Toast.show(browser.i18n.getMessage(
      'alert_file_type_fail_type',
      [FILES_ALLOWED_EXTENSIONS.join(' | ')]
    ));
  }
  if (isSizeExceeded) {
    return Toast.show(browser.i18n.getMessage(
      'alert_file_type_fail_size',
      [MAX_FILE_SIZE_BYTES / 10 ** 6]
    ));
  }

  form.classList.add('is-upload');

  const blob = new Blob([new Uint8Array(await file.arrayBuffer())], {
    type: file.type
  });
  const blobThumbnail = file.type.startsWith('video')
    ? await getVideoPoster(file)
    : await $resizeThumbnail(blob);

  if (backgroundImage) {
    URL.revokeObjectURL(backgroundImage);
  }
  backgroundImage = URL.createObjectURL(blobThumbnail);
  ImageDB.update({
    id: 'background',
    blob,
    blobThumbnail
  });

  form.classList.remove('is-upload');

  document.querySelector('.c-upload__preview').hidden = false;
  document.getElementById('preview_upload').innerHTML = /* html */
          `<div class="c-upload__preview-image"
            style="background-image: url(${backgroundImage});">
          <div>`;

  Toast.show(browser.i18n.getMessage('notice_bg_image_updated'));
}

async function handleRemoveFile(evt) {
  const target = evt.target.closest('#delete_upload');
  if (!target) return;

  const confirmAction = await confirmPopup(browser.i18n.getMessage('confirm_delete_image'));
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
  Toast.show(browser.i18n.getMessage('notice_image_removed'));
}

async function handleDeleteImages(evt) {
  evt.preventDefault();

  const confirmAction = await confirmPopup(browser.i18n.getMessage('confirm_delete_images'));
  if (!confirmAction) return;

  const cleared = await ImageDB.clearThumbnails();
  if (!cleared) return;
  Toast.show(browser.i18n.getMessage('notice_images_removed'));
}

async function handleClearLocalCache(evt) {
  evt.preventDefault();

  const confirmAction = await confirmPopup(browser.i18n.getMessage('confirm_clear_local_cache'));
  if (!confirmAction) return;

  await settings.clearLocalCache();
  Toast.show(browser.i18n.getMessage('notice_local_cache_cleared'));
}

async function handleResetLocalSettings() {
  const confirmAction = await confirmPopup(browser.i18n.getMessage('confirm_restore_default_settings'));
  if (!confirmAction) return;

  await settings.resetLocal();

  await window.vbToggleTheme();
  getOptions();
  toggleBackgroundControls(settings.$.background_image);
  updateDefaultFolderControl();
  Toast.show(browser.i18n.getMessage('notice_reset_default_settings'));
}
async function handleResetSyncSettings() {
  const confirmAction = await confirmPopup(browser.i18n.getMessage('confirm_clear_sync_settings'));
  if (!confirmAction) return;

  await settings.resetSync();
  getOptions();
  updateDefaultFolderControl();
  Toast.show(browser.i18n.getMessage('notice_sync_settings_cleared'));
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
    storageNote.textContent = browser.i18n.getMessage(messageId);
  }
}

function getSyncBytesInUse() {
  return new Promise(resolve => browser.storage.sync.getBytesInUse(null, resolve));
}

async function handleChangeSync() {
  if (!this.checked) {
    await settings.updateKey('enable_sync', false);
    updateDefaultFolderControl();
    return;
  }

  const bytes = await getSyncBytesInUse();
  if (bytes > 0) {
    const confirmAction = await confirmPopup(browser.i18n.getMessage('confirm_sync_remote_settings'));

    if (!confirmAction) {
      this.checked = false;
      await settings.updateKey('enable_sync', false);
      updateDefaultFolderControl();
      return;
    }

    await settings.updateKey('enable_sync', true);
    await settings.restoreFromSync();
    await window.vbToggleTheme();
    getOptions();
  } else {
    const localFolderId = settings.$.default_folder_id;
    await settings.updateKey('enable_sync', true);
    await updateDefaultFolder(localFolderId);
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
    key => browser.i18n.getMessage(key)
  );
  select.replaceChildren(...engines.map(engine => {
    return new Option(engine.title, engine.id);
  }));
  select.value = settings.$.search_engine;
}

init();
