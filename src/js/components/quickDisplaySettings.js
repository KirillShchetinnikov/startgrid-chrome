import { settings } from '../settings';
import { getMessage } from '../i18n';
import UI from './ui';
import Toast from './toast';
import confirmPopup from '../plugins/confirmPopup';
import { updateMainPageScrollLock } from '../mainPageScroll';
import { cssColorToHex } from '../tileAppearance';
import { QUICK_SETTING_KEYS } from '../quickSettings';
import { scaleTileContentSettings } from '../tileSizeSync';
import { requestPermissions } from '../api/permissions';
import ImageDB from '../api/imageDB';
import { $filePicker, $resizeThumbnail, getVideoPoster } from '../utils';
import {
  BACKGROUND_FILE_PICKER_OPTIONS,
  commitBackgroundUpload,
  createBackgroundPreview,
  FILES_ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  validateBackgroundFile
} from '../backgroundFileValidation';

const RERENDER_SETTINGS = new Set([
  'show_create_column',
  'show_back_column',
  'show_bookmark_title',
  'bookmark_title_position',
  'show_favicon',
  'folder_preview',
  'thumbnail_source'
]);

const STYLE_SETTINGS = new Set([
  'dial_columns',
  'dial_width',
  'dial_tile_size',
  'dial_horizontal_gap',
  'dial_vertical_gap',
  'dial_radius',
  'dial_aspect_ratio',
  'dial_shadow',
  'dial_hover_lift',
  'dial_background_color',
  'dial_title_color',
  'dial_background_opacity',
  'dial_background_blur',
  'toolbar_match_tile_background',
  'toolbar_background_color',
  'toolbar_background_opacity',
  'toolbar_background_blur',
  'favicon_size',
  'bookmark_title_size'
]);

const COLOR_SETTING_THEME_VARIABLES = Object.freeze({
  background_color: '--theme-background',
  dial_background_color: '--theme-background-2',
  dial_title_color: '--theme-text-color',
  toolbar_background_color: '--theme-background-2'
});

function message(id, substitutions) {
  return getMessage(id, substitutions);
}

function createSwitch(id) {
  return /* html */`
    <label class="quick-settings__switch-row" for="quick_${id}">
      <span>${message(id)}</span>
      <span class="switch">
        <input class="switch__input" id="quick_${id}" type="checkbox" data-setting="${id}">
        <span class="switch__label" aria-hidden="true"></span>
      </span>
    </label>`;
}

function createPanel() {
  const columns = Array.from({ length: 10 }, (_, index) => {
    const value = index + 1;
    return `<option value="${value}">${value}</option>`;
  }).join('');

  const wrapper = document.createElement('div');
  wrapper.innerHTML = /* html */`
    <section class="quick-settings" id="quick_settings" hidden aria-labelledby="quick_settings_title">
      <div class="quick-settings__header">
        <div>
          <h2 id="quick_settings_title">${message('quick_display_settings')}</h2>
          <p>${message('quick_display_settings_description')}</p>
        </div>
        <button class="quick-settings__close md-ripple" type="button" data-quick-settings-close
          aria-label="${message('modal_dismiss')}">
          <svg width="20" height="20"><use xlink:href="/img/symbol.svg#close"></use></svg>
        </button>
      </div>
      <div class="quick-settings__controls">
        <label class="quick-settings__field" for="quick_color_theme">
          <span>${message('color_theme')}</span>
          <select class="form-control" id="quick_color_theme" data-setting="color_theme">
            <option value="dark">${message('dark_theme')}</option>
            <option value="light">${message('light_theme')}</option>
            <option value="os">${message('os_theme')}</option>
          </select>
        </label>
        <label class="quick-settings__field" for="quick_background_image">
          <span>${message('background')}</span>
          <select class="form-control" id="quick_background_image" data-setting="background_image">
            <option value="background_noimage">${message('background_noimage')}</option>
            <option value="background_color">${message('color')}</option>
            <option value="background_external">${message('background_external')}</option>
            <option value="background_local">${message('background_local')}</option>
            <option value="background_bing">${message('background_bing')}</option>
          </select>
        </label>
        <div class="quick-settings__background-settings">
          <p class="quick-settings__background-note" data-quick-background-setting="background_noimage" hidden>
            ${message('background_noimage_text')}
          </p>
          <label class="quick-settings__field" data-quick-background-setting="background_color"
            for="quick_background_color" hidden>
            <span>${message('color')}</span>
            <input id="quick_background_color" type="color" data-setting="background_color">
          </label>
          <section class="quick-settings__background-external"
            data-quick-background-setting="background_external" hidden>
            <label for="quick_background_external">${message('background_external')}</label>
            <input class="form-control" id="quick_background_external" type="url" required
              autocomplete="url" spellcheck="false" aria-describedby="quick_background_external_note">
            <small id="quick_background_external_note">${message('background_external_note')}</small>
            <div class="quick-settings__background-actions">
              <button class="btn md-ripple" type="button" data-quick-background-external-set>
                ${message('btn_apply')}
              </button>
              <button class="btn btn--clear md-ripple" type="button" data-quick-background-external-remove disabled>
                ${message('contextmenu_remove')}
              </button>
            </div>
          </section>
          <section class="quick-settings__background-local" data-quick-background-setting="background_local" hidden>
            <div>
              <strong>${message('background_local')}</strong>
              <small>${message('background_local_video_note')}</small>
            </div>
            <div class="quick-settings__background-actions">
              <button class="btn md-ripple" type="button" data-quick-background-upload>
                ${message('btn_open')}
              </button>
              <button class="btn btn--clear md-ripple" type="button" data-quick-background-remove disabled>
                ${message('contextmenu_remove')}
              </button>
            </div>
          </section>
          <p class="quick-settings__background-note" data-quick-background-setting="background_bing" hidden>
            ${message('background_bing_text')}
          </p>
          <section class="quick-settings__background-confirmation" data-quick-background-confirmation
            aria-live="polite" hidden>
            <p>${message('confirm_delete_image')}</p>
            <div class="quick-settings__background-actions">
              <button class="btn btn--clear md-ripple" type="button" data-quick-background-confirm-cancel>
                ${message('btn_close')}
              </button>
              <button class="btn md-ripple" type="button" data-quick-background-confirm-remove>
                ${message('contextmenu_remove')}
              </button>
            </div>
          </section>
        </div>
        <label class="quick-settings__field" for="quick_dial_columns">
          <span>${message('number_of_columns')}</span>
          <select class="form-control" id="quick_dial_columns" data-setting="dial_columns">${columns}</select>
        </label>
        <label class="quick-settings__field" for="quick_dial_width">
          <span>${message('dial_width')}</span>
          <span class="quick-settings__range">
            <input id="quick_dial_width" type="range" min="50" max="99" step="1"
              data-setting="dial_width" data-unit="%">
            <output id="quick_dial_width_value" for="quick_dial_width"></output>
          </span>
        </label>
        <label class="quick-settings__field" for="quick_dial_tile_size">
          <span>${message('dial_tile_size')}</span>
          <span class="quick-settings__range">
            <input id="quick_dial_tile_size" type="range" min="50" max="300" step="1"
              data-setting="dial_tile_size" data-unit="px">
            <output id="quick_dial_tile_size_value" for="quick_dial_tile_size"></output>
          </span>
        </label>
        <label class="quick-settings__field" for="quick_dial_horizontal_gap">
          <span>${message('dial_horizontal_gap')}</span>
          <span class="quick-settings__range">
            <input id="quick_dial_horizontal_gap" type="range" min="0" max="160" step="1"
              data-setting="dial_horizontal_gap" data-unit="px">
            <output id="quick_dial_horizontal_gap_value" for="quick_dial_horizontal_gap"></output>
          </span>
        </label>
        <label class="quick-settings__field" for="quick_dial_vertical_gap">
          <span>${message('dial_vertical_gap')}</span>
          <span class="quick-settings__range">
            <input id="quick_dial_vertical_gap" type="range" min="0" max="160" step="1"
              data-setting="dial_vertical_gap" data-unit="px">
            <output id="quick_dial_vertical_gap_value" for="quick_dial_vertical_gap"></output>
          </span>
        </label>
        <label class="quick-settings__field" for="quick_dial_radius">
          <span>${message('dial_radius')}</span>
          <span class="quick-settings__range">
            <input id="quick_dial_radius" type="range" min="0" max="40" step="1"
              data-setting="dial_radius" data-unit="px">
            <output id="quick_dial_radius_value" for="quick_dial_radius"></output>
          </span>
        </label>
        <label class="quick-settings__field" for="quick_dial_aspect_ratio">
          <span>${message('dial_aspect_ratio')}</span>
          <select class="form-control" id="quick_dial_aspect_ratio" data-setting="dial_aspect_ratio">
            <option value="1 / 1">${message('dial_aspect_ratio_square')}</option>
            <option value="4 / 3">${message('dial_aspect_ratio_standard')}</option>
            <option value="3 / 2">${message('dial_aspect_ratio_photo')}</option>
            <option value="16 / 9">${message('dial_aspect_ratio_wide')}</option>
          </select>
        </label>
        <label class="quick-settings__field" for="quick_favicon_size">
          <span>${message('favicon_size')}</span>
          <span class="quick-settings__range">
            <input id="quick_favicon_size" type="range" min="16" max="128" step="4"
              data-setting="favicon_size" data-unit="px">
            <output id="quick_favicon_size_value" for="quick_favicon_size"></output>
          </span>
        </label>
        <label class="quick-settings__field" for="quick_thumbnail_source">
          <span>${message('thumbnail_source')}</span>
          <select class="form-control" id="quick_thumbnail_source" data-setting="thumbnail_source">
            <option value="favicon">${message('thumbnail_source_favicon')}</option>
            <option value="site">${message('thumbnail_source_site')}</option>
          </select>
        </label>
        <label class="quick-settings__field" for="quick_bookmark_title_size">
          <span>${message('bookmark_title_size')}</span>
          <span class="quick-settings__range">
            <input id="quick_bookmark_title_size" type="range" min="10" max="24" step="1"
              data-setting="bookmark_title_size" data-unit="px">
            <output id="quick_bookmark_title_size_value"
              for="quick_bookmark_title_size"></output>
          </span>
        </label>
        <label class="quick-settings__field" for="quick_bookmark_title_position">
          <span>${message('bookmark_title_position')}</span>
          <select class="form-control" id="quick_bookmark_title_position"
            data-setting="bookmark_title_position">
            <option value="inside">${message('bookmark_title_position_inside')}</option>
            <option value="outside">${message('bookmark_title_position_outside')}</option>
          </select>
        </label>

        <label class="quick-settings__field" for="quick_dial_shadow">
          <span>${message('dial_shadow')}</span>
          <span class="quick-settings__range">
            <input id="quick_dial_shadow" type="range" min="0" max="30" step="1"
              data-setting="dial_shadow" data-unit="%">
            <output id="quick_dial_shadow_value" for="quick_dial_shadow"></output>
          </span>
        </label>
        <label class="quick-settings__field" for="quick_dial_hover_lift">
          <span>${message('dial_hover_lift')}</span>
          <span class="quick-settings__range">
            <input id="quick_dial_hover_lift" type="range" min="0" max="12" step="1"
              data-setting="dial_hover_lift" data-unit="px">
            <output id="quick_dial_hover_lift_value" for="quick_dial_hover_lift"></output>
          </span>
        </label>
        <label class="quick-settings__field" for="quick_dial_background_opacity">
          <span>${message('dial_background_opacity')}</span>
          <span class="quick-settings__range">
            <input id="quick_dial_background_opacity" type="range" min="0" max="100" step="1"
              data-setting="dial_background_opacity" data-unit="%">
            <output id="quick_dial_background_opacity_value" for="quick_dial_background_opacity"></output>
          </span>
        </label>
        ${createSwitch('dial_background_blur')}
        <label class="quick-settings__field" for="quick_dial_background_color">
          <span>${message('dial_background_color')}</span>
          <span class="quick-settings__color">
            <input id="quick_dial_background_color" type="color" data-setting="dial_background_color">
            <button type="button" data-quick-color-reset="dial_background_color"
              title="${message('reset_tile_background_color')}"
              aria-label="${message('reset_tile_background_color')}">↺</button>
          </span>
        </label>
        <label class="quick-settings__field" for="quick_dial_title_color">
          <span>${message('dial_title_color')}</span>
          <span class="quick-settings__color">
            <input id="quick_dial_title_color" type="color" data-setting="dial_title_color">
            <button type="button" data-quick-color-reset="dial_title_color"
              title="${message('reset_tile_title_color')}"
              aria-label="${message('reset_tile_title_color')}">↺</button>
          </span>
        </label>
        ${createSwitch('vertical_center')}
        ${createSwitch('disable_main_page_scroll')}
        ${createSwitch('show_extension_icon')}
        ${createSwitch('show_search')}
        ${createSwitch('show_folder_picker')}
        ${createSwitch('toolbar_match_tile_background')}
        <label class="quick-settings__field" for="quick_toolbar_background_color"
          data-quick-toolbar-background>
          <span>${message('toolbar_background_color')}</span>
          <span class="quick-settings__color">
            <input id="quick_toolbar_background_color" type="color"
              data-setting="toolbar_background_color">
            <button type="button" data-quick-color-reset="toolbar_background_color"
              title="${message('reset_toolbar_background_color')}"
              aria-label="${message('reset_toolbar_background_color')}">↺</button>
          </span>
        </label>
        <label class="quick-settings__field" for="quick_toolbar_background_opacity"
          data-quick-toolbar-background>
          <span>${message('toolbar_background_opacity')}</span>
          <span class="quick-settings__range">
            <input id="quick_toolbar_background_opacity" type="range" min="0" max="100" step="1"
              data-setting="toolbar_background_opacity" data-unit="%">
            <output id="quick_toolbar_background_opacity_value"
              for="quick_toolbar_background_opacity"></output>
          </span>
        </label>
        ${createSwitch('toolbar_background_blur')}
        ${createSwitch('show_create_column')}
        ${createSwitch('show_back_column')}
        ${createSwitch('show_bookmark_title')}
        ${createSwitch('show_favicon')}
        ${createSwitch('folder_preview')}
      </div>
      <div class="quick-settings__reset">
        <button class="btn btn--clear quick-settings__reset-button md-ripple" type="button"
          data-quick-settings-reset>${message('reset_quick_settings')}</button>
        <small class="text-muted">${message('reset_quick_settings_description')}</small>
      </div>
      <a class="btn quick-settings__more" href="options.html">${message('more_settings')}</a>
    </section>`;

  return wrapper.firstElementChild;
}

export default function initQuickDisplaySettings({
  container,
  showTrigger = true,
  onRerender,
  onExtensionIconVisibilityChange,
  onHeaderVisibilityChange
}) {
  const trigger = document.createElement('button');
  trigger.id = 'quick_settings_trigger';
  trigger.className = 'circ-btn display-settings-link md-ripple';
  trigger.type = 'button';
  const triggerLabel = message('quick_display_settings');
  trigger.setAttribute('aria-label', triggerLabel);
  trigger.title = triggerLabel;
  trigger.setAttribute('aria-expanded', 'false');
  trigger.hidden = !showTrigger;
  trigger.innerHTML = '<svg width="20" height="20"><use xlink:href="/img/symbol.svg#palette"></use></svg>';

  const panel = createPanel();
  document.body.append(panel);
  container.append(trigger);
  let tileSizeScaleAnchor = null;
  let pendingBackgroundRemoval = null;
  let hasLocalBackground = false;

  function syncBackgroundControls() {
    const backgroundMode = settings.$.background_image;
    panel.querySelector('#quick_background_external').value = settings.$.background_external;
    panel.querySelector('[data-quick-background-external-remove]').disabled = !settings.$.background_external;
    panel.querySelector('[data-quick-background-remove]').disabled = !hasLocalBackground;
    panel.querySelectorAll('[data-quick-background-setting]').forEach(control => {
      control.hidden = control.dataset.quickBackgroundSetting !== backgroundMode;
    });
  }

  async function handleExternalBackgroundSave() {
    const input = panel.querySelector('#quick_background_external');
    if (!input.reportValidity()) return;

    const hasPermission = await requestPermissions({ origins: ['<all_urls>'] });
    if (!hasPermission) return;

    await settings.updateAll({
      background_image: 'background_external',
      background_external: input.value.trim()
    });
    await UI.setBG();
    Toast.show(message('notice_bg_image_updated'));
  }

  function showBackgroundRemovalConfirmation(source) {
    pendingBackgroundRemoval = source;
    const confirmation = panel.querySelector('[data-quick-background-confirmation]');
    confirmation.hidden = false;
    confirmation.querySelector('[data-quick-background-confirm-cancel]').focus();
  }

  async function handleLocalBackgroundUpload() {
    try {
      const file = await $filePicker(BACKGROUND_FILE_PICKER_OPTIONS, panel);
      if (!file) return;

      const validation = validateBackgroundFile(file);
      if (!validation.ok) {
        const messageId = validation.reason === 'size'
          ? 'alert_file_type_fail_size'
          : 'alert_file_type_fail_type';
        const value = validation.reason === 'size'
          ? MAX_FILE_SIZE_BYTES / 10 ** 6
          : FILES_ALLOWED_EXTENSIONS.join(' | ');
        Toast.show(message(messageId, [value]));
        return;
      }

      const blob = new Blob([new Uint8Array(await file.arrayBuffer())], { type: file.type });
      const blobThumbnail = await createBackgroundPreview({
        blob,
        file,
        validation,
        resizeImage: value => $resizeThumbnail(value),
        getVideoPoster: value => getVideoPoster(value)
      });
      const previousRecord = await ImageDB.get('background');
      const result = await commitBackgroundUpload({
        record: { id: 'background', blob, blobThumbnail },
        persist: record => ImageDB.update(record),
        createObjectURL: value => URL.createObjectURL(value),
        previousObjectURL: null,
        revokeObjectURL: value => URL.revokeObjectURL(value),
        apply: objectURL => URL.revokeObjectURL(objectURL),
        rollback: async() => {
          if (previousRecord) await ImageDB.update(previousRecord);
          else await ImageDB.delete('background');
        },
        reportError: () => Toast.show(message('notice_background_save_failed'))
      });
      if (!result.ok) return;

      hasLocalBackground = true;
      syncBackgroundControls();
      await UI.setBG();
      Toast.show(message('notice_bg_image_updated'));
    } catch (error) {
      Toast.show(message('notice_background_save_failed'));
      console.warn(error);
    }
  }

  async function handleConfirmedBackgroundRemove() {
    const source = pendingBackgroundRemoval;
    pendingBackgroundRemoval = null;
    panel.querySelector('[data-quick-background-confirmation]').hidden = true;

    if (source === 'external') {
      await settings.updateKey('background_external', '');
      syncBackgroundControls();
    } else if (source === 'local') {
      await ImageDB.delete('background');
      hasLocalBackground = false;
      syncBackgroundControls();
    } else {
      return;
    }
    await UI.setBG();
    Toast.show(message('notice_image_removed'));
  }

  function getThemeColor(settingId) {
    const variable = COLOR_SETTING_THEME_VARIABLES[settingId];
    return cssColorToHex(window.getComputedStyle(document.documentElement)
      .getPropertyValue(variable));
  }

  function syncControls() {
    const gridLayout = UI.calculateStyles();
    const gridWidthControl = panel.querySelector('[data-setting="dial_width"]');
    const tileSizeControl = panel.querySelector('[data-setting="dial_tile_size"]');
    const horizontalGapControl = panel.querySelector('[data-setting="dial_horizontal_gap"]');
    gridWidthControl.min = String(gridLayout.minimumGridWidth);
    tileSizeControl.min = String(gridLayout.minimumTileSize);
    tileSizeControl.max = String(gridLayout.maximumTileSize);
    horizontalGapControl.min = String(gridLayout.minimumHorizontalGap);
    horizontalGapControl.max = String(gridLayout.maximumHorizontalGap);

    panel.querySelectorAll('[data-setting]').forEach(control => {
      const key = control.dataset.setting;
      const value = key === 'dial_width'
        ? gridLayout.gridWidth
        : key === 'dial_tile_size'
          ? gridLayout.tileSize
          : key === 'dial_horizontal_gap'
            ? gridLayout.horizontalGap
            : settings.$[key];
      if (control.type === 'checkbox') {
        control.checked = Boolean(settings.$[key]);
      } else if (control.type === 'color') {
        const themeColor = getThemeColor(key);
        control.value = settings.$[key]
          ? cssColorToHex(settings.$[key], themeColor)
          : themeColor;
      } else {
        control.value = value;
      }
      if (control.type === 'range') {
        const output = panel.querySelector(`#${control.id}_value`);
        output.textContent = `${value}${control.dataset.unit}`;
      }
    });
    panel.querySelectorAll('[data-quick-color-reset]').forEach(button => {
      button.disabled = !settings.$[button.dataset.quickColorReset];
    });
    panel.querySelectorAll('[data-quick-toolbar-background]').forEach(control => {
      control.hidden = Boolean(settings.$.toolbar_match_tile_background);
    });
    syncBackgroundControls();
  }

  function togglePanel(force, restoreFocus = true) {
    const willOpen = force ?? panel.hidden;
    panel.hidden = !willOpen;
    trigger.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) {
      syncControls();
      panel.querySelector('[data-setting]')?.focus();
    } else if (restoreFocus) {
      trigger.focus();
    }
  }

  async function applySetting(control, persist = true) {
    const key = control.dataset.setting;
    let value = control.type === 'checkbox' ? control.checked : control.value;
    let tileContentSettings;

    if (persist && key === 'thumbnail_source' && value === 'site') {
      const hasPermission = await requestPermissions({ origins: ['<all_urls>'] });
      if (!hasPermission) {
        syncControls();
        return;
      }
    }

    if (persist && key === 'background_image' && value === 'background_bing') {
      const hasPermission = await requestPermissions({ origins: ['https://www.bing.com/*'] });
      if (!hasPermission) {
        value = 'background_local';
        control.value = value;
      }
    }

    if (key === 'dial_tile_size') {
      tileSizeScaleAnchor ??= {
        faviconSize: settings.$.favicon_size,
        tileSize: settings.$.dial_tile_size,
        titleSize: settings.$.bookmark_title_size
      };
      tileContentSettings = scaleTileContentSettings({
        faviconSize: tileSizeScaleAnchor.faviconSize,
        fromTileSize: tileSizeScaleAnchor.tileSize,
        titleSize: tileSizeScaleAnchor.titleSize,
        toTileSize: value
      });
    }

    if (persist) {
      if (tileContentSettings) {
        await settings.updateAll({
          dial_tile_size: value,
          ...tileContentSettings
        });
        tileSizeScaleAnchor = null;
      } else {
        await settings.updateKey(key, value);
      }
    } else {
      Object.assign(settings.$, tileContentSettings
        ? { dial_tile_size: value, ...tileContentSettings }
        : { [key]: value });
    }

    if (key === 'color_theme') {
      await window.vbToggleTheme();
      UI.calculateStyles();
      syncControls();
    } else if (key === 'background_image') {
      syncBackgroundControls();
      await UI.setBG();
    } else if (key === 'background_color' && settings.$.background_image === 'background_color') {
      await UI.setBG();
    } else if (STYLE_SETTINGS.has(key)) {
      const gridLayout = UI.calculateStyles();
      if (['dial_columns', 'dial_width', 'dial_tile_size', 'dial_horizontal_gap'].includes(key)) {
        syncControls();
      }
      if (
        persist
        && ['dial_columns', 'dial_width', 'dial_tile_size', 'dial_horizontal_gap'].includes(key)
        && Number(settings.$.dial_width) !== gridLayout.gridWidth
      ) {
        await settings.updateKey('dial_width', gridLayout.gridWidth);
        syncControls();
      }
      if (key === 'toolbar_match_tile_background') {
        panel.querySelectorAll('[data-quick-toolbar-background]').forEach(control => {
          control.hidden = Boolean(value);
        });
      }
    } else if (key === 'vertical_center') {
      document.getElementById('bookmarks').classList.toggle('grid--vcenter', Boolean(value));
      document.getElementById('content').classList.toggle('content--vcenter', Boolean(value));
    } else if (key === 'disable_main_page_scroll') {
      updateMainPageScrollLock(value);
    } else if (key === 'show_extension_icon') {
      onExtensionIconVisibilityChange(Boolean(value));
      UI.calculateStyles();
    } else if (['show_search', 'show_folder_picker'].includes(key)) {
      onHeaderVisibilityChange({
        showSearch: settings.$.show_search,
        showFolderPicker: settings.$.show_folder_picker
      });
    } else if (RERENDER_SETTINGS.has(key)) {
      await onRerender();
    }
  }

  trigger.addEventListener('click', () => togglePanel());
  panel.querySelector('[data-quick-settings-close]').addEventListener('click', () => togglePanel(false));
  panel.querySelector('[data-quick-background-upload]').addEventListener('click', handleLocalBackgroundUpload);
  panel.querySelector('[data-quick-background-remove]').addEventListener('click', () => {
    showBackgroundRemovalConfirmation('local');
  });
  panel.querySelector('[data-quick-background-external-set]')
    .addEventListener('click', handleExternalBackgroundSave);
  panel.querySelector('[data-quick-background-external-remove]').addEventListener('click', () => {
    showBackgroundRemovalConfirmation('external');
  });
  panel.querySelector('[data-quick-background-confirm-cancel]').addEventListener('click', () => {
    pendingBackgroundRemoval = null;
    panel.querySelector('[data-quick-background-confirmation]').hidden = true;
  });
  panel.querySelector('[data-quick-background-confirm-remove]')
    .addEventListener('click', handleConfirmedBackgroundRemove);
  panel.addEventListener('change', event => {
    const control = event.target.closest('[data-setting]');
    if (control) {
      applySetting(control);
      if (control.type === 'color') {
        const resetButton = panel.querySelector(
          `[data-quick-color-reset="${control.dataset.setting}"]`
        );
        if (resetButton) resetButton.disabled = false;
      }
    }
  });
  panel.querySelectorAll('input[type="range"][data-setting]').forEach(control => {
    control.addEventListener('input', event => {
      const output = panel.querySelector(`#${event.target.id}_value`);
      output.textContent = `${event.target.value}${event.target.dataset.unit}`;
      applySetting(event.target, false);
    });
  });
  panel.querySelectorAll('input[type="color"][data-setting]').forEach(control => {
    control.addEventListener('input', event => {
      applySetting(event.target, false);
      const resetButton = panel.querySelector(
        `[data-quick-color-reset="${event.target.dataset.setting}"]`
      );
      if (resetButton) resetButton.disabled = false;
    });
  });
  panel.querySelector('[data-quick-settings-reset]').addEventListener('click', async() => {
    const confirmed = await confirmPopup(message('confirm_reset_quick_settings'));
    if (!confirmed) return;

    await settings.resetKeys(QUICK_SETTING_KEYS);
    await window.vbToggleTheme();
    UI.calculateStyles();
    await UI.setBG();
    updateMainPageScrollLock(settings.$.disable_main_page_scroll);
    onExtensionIconVisibilityChange(settings.$.show_extension_icon);
    onHeaderVisibilityChange({
      showSearch: settings.$.show_search,
      showFolderPicker: settings.$.show_folder_picker
    });
    document.getElementById('bookmarks')
      .classList.toggle('grid--vcenter', settings.$.vertical_center);
    document.getElementById('content')
      .classList.toggle('content--vcenter', settings.$.vertical_center);
    await onRerender();
    syncControls();
  });
  panel.querySelectorAll('[data-quick-color-reset]').forEach(button => {
    button.addEventListener('click', async() => {
      await settings.updateKey(button.dataset.quickColorReset, '');
      UI.calculateStyles();
      syncControls();
    });
  });
  document.addEventListener('click', event => {
    const isModalInteraction = event.target.closest('.gmodal, .gmodal-backdrop');
    if (!panel.hidden && !isModalInteraction && !panel.contains(event.target) && !trigger.contains(event.target)) {
      togglePanel(false, false);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) togglePanel(false);
  });

  ImageDB.get('background').then(record => {
    hasLocalBackground = Boolean(record?.blob);
    syncBackgroundControls();
  });
  syncControls();
  return {
    toggle: () => togglePanel()
  };
}
