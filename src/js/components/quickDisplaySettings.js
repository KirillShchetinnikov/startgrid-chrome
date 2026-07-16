import { settings } from '../settings';
import UI from './ui';
import confirmPopup from '../plugins/confirmPopup';
import { updateMainPageScrollLock } from '../mainPageScroll';
import { cssColorToHex } from '../tileAppearance';
import { QUICK_SETTING_KEYS } from '../quickSettings';

const RERENDER_SETTINGS = new Set([
  'show_create_column',
  'show_back_column',
  'show_bookmark_title',
  'show_favicon',
  'folder_preview'
]);

const STYLE_SETTINGS = new Set([
  'dial_columns',
  'dial_width',
  'dial_gap',
  'dial_radius',
  'dial_aspect_ratio',
  'dial_shadow',
  'dial_hover_lift',
  'dial_background_color',
  'dial_background_opacity',
  'favicon_size'
]);

function message(id) {
  return browser.i18n.getMessage(id);
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
        <label class="quick-settings__field" for="quick_dial_gap">
          <span>${message('dial_gap')}</span>
          <span class="quick-settings__range">
            <input id="quick_dial_gap" type="range" min="0" max="40" step="1"
              data-setting="dial_gap" data-unit="px">
            <output id="quick_dial_gap_value" for="quick_dial_gap"></output>
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
        <label class="quick-settings__field" for="quick_dial_background_color">
          <span>${message('dial_background_color')}</span>
          <span class="quick-settings__color">
            <input id="quick_dial_background_color" type="color" data-setting="dial_background_color">
            <button type="button" data-quick-color-reset
              title="${message('reset_tile_background_color')}"
              aria-label="${message('reset_tile_background_color')}">↺</button>
          </span>
        </label>
        ${createSwitch('vertical_center')}
        ${createSwitch('disable_main_page_scroll')}
        ${createSwitch('show_extension_icon')}
        ${createSwitch('show_toolbar')}
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
  onRerender,
  onExtensionIconVisibilityChange,
  onToolbarVisibilityChange
}) {
  const trigger = document.createElement('button');
  trigger.id = 'quick_settings_trigger';
  trigger.className = 'circ-btn display-settings-link md-ripple';
  trigger.type = 'button';
  const triggerLabel = message('quick_display_settings');
  trigger.setAttribute('aria-label', triggerLabel);
  trigger.title = triggerLabel;
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = '<svg width="20" height="20"><use xlink:href="/img/symbol.svg#palette"></use></svg>';

  const panel = createPanel();
  document.body.append(panel);
  container.append(trigger);

  function getThemeTileColor() {
    return cssColorToHex(window.getComputedStyle(document.documentElement)
      .getPropertyValue('--theme-background-2'));
  }

  function syncControls() {
    panel.querySelectorAll('[data-setting]').forEach(control => {
      const key = control.dataset.setting;
      if (control.type === 'checkbox') {
        control.checked = Boolean(settings.$[key]);
      } else if (control.type === 'color') {
        const themeColor = getThemeTileColor();
        control.value = settings.$[key]
          ? cssColorToHex(settings.$[key], themeColor)
          : themeColor;
      } else {
        control.value = settings.$[key];
      }
      if (control.type === 'range') {
        const output = panel.querySelector(`#${control.id}_value`);
        output.textContent = `${settings.$[key]}${control.dataset.unit}`;
      }
    });
    panel.querySelector('[data-quick-color-reset]').disabled = !settings.$.dial_background_color;
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
    const value = control.type === 'checkbox' ? control.checked : control.value;

    if (persist) {
      await settings.updateKey(key, value);
    } else {
      settings.$[key] = value;
    }

    if (STYLE_SETTINGS.has(key)) {
      UI.calculateStyles();
    } else if (key === 'vertical_center') {
      document.getElementById('bookmarks').classList.toggle('grid--vcenter', Boolean(value));
      document.getElementById('content').classList.toggle('content--vcenter', Boolean(value));
    } else if (key === 'disable_main_page_scroll') {
      updateMainPageScrollLock(value);
    } else if (key === 'show_extension_icon') {
      onExtensionIconVisibilityChange(Boolean(value));
      UI.calculateStyles();
    } else if (key === 'show_toolbar') {
      onToolbarVisibilityChange(Boolean(value));
    } else if (RERENDER_SETTINGS.has(key)) {
      await onRerender();
    }
  }

  trigger.addEventListener('click', () => togglePanel());
  panel.querySelector('[data-quick-settings-close]').addEventListener('click', () => togglePanel(false));
  panel.addEventListener('change', event => {
    const control = event.target.closest('[data-setting]');
    if (control) {
      applySetting(control);
      if (control.type === 'color') {
        panel.querySelector('[data-quick-color-reset]').disabled = false;
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
  panel.querySelector('[data-quick-settings-reset]').addEventListener('click', async() => {
    const confirmed = await confirmPopup(message('confirm_reset_quick_settings'));
    if (!confirmed) return;

    await settings.resetKeys(QUICK_SETTING_KEYS);
    UI.calculateStyles();
    updateMainPageScrollLock(settings.$.disable_main_page_scroll);
    onExtensionIconVisibilityChange(settings.$.show_extension_icon);
    onToolbarVisibilityChange(settings.$.show_toolbar);
    document.getElementById('bookmarks')
      .classList.toggle('grid--vcenter', settings.$.vertical_center);
    document.getElementById('content')
      .classList.toggle('content--vcenter', settings.$.vertical_center);
    await onRerender();
    syncControls();
  });
  panel.querySelector('[data-quick-color-reset]').addEventListener('click', async() => {
    await settings.updateKey('dial_background_color', '');
    UI.calculateStyles();
    syncControls();
  });
  document.addEventListener('click', event => {
    if (!panel.hidden && !panel.contains(event.target) && !trigger.contains(event.target)) {
      togglePanel(false, false);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) togglePanel(false);
  });

  syncControls();
}
