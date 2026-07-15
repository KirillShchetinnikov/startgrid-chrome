import { settings } from '../settings';
import UI from './ui';

const RERENDER_SETTINGS = new Set([
  'show_create_column',
  'show_back_column',
  'show_bookmark_title',
  'show_favicon',
  'folder_preview',
  'logo_external',
  'logo_external_url'
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
            <input id="quick_dial_width" type="range" min="50" max="99" step="1" data-setting="dial_width">
            <output id="quick_dial_width_value" for="quick_dial_width"></output>
          </span>
        </label>
        ${createSwitch('vertical_center')}
        ${createSwitch('show_create_column')}
        ${createSwitch('show_back_column')}
        ${createSwitch('show_bookmark_title')}
        ${createSwitch('show_favicon')}
        ${createSwitch('folder_preview')}
        ${createSwitch('logo_external')}
        <label class="quick-settings__field quick-settings__external-logo" for="quick_logo_external_url">
          <span>${message('logo_external_url')}</span>
          <input class="form-control" id="quick_logo_external_url" type="text"
            data-setting="logo_external_url" placeholder="https://img.logo.dev/{{website}}" spellcheck="false">
        </label>
      </div>
      <a class="btn quick-settings__more" href="options.html">${message('more_settings')}</a>
    </section>`;

  return wrapper.firstElementChild;
}

export default function initQuickDisplaySettings({ container, onRerender }) {
  const trigger = document.createElement('button');
  trigger.id = 'quick_settings_trigger';
  trigger.className = 'circ-btn display-settings-link md-ripple';
  trigger.type = 'button';
  trigger.setAttribute('aria-label', message('quick_display_settings'));
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = '<svg width="20" height="20"><use xlink:href="/img/symbol.svg#apps"></use></svg>';

  const panel = createPanel();
  document.body.append(panel);
  container.append(trigger);

  const externalLogoField = panel.querySelector('.quick-settings__external-logo');

  function syncControls() {
    panel.querySelectorAll('[data-setting]').forEach(control => {
      const key = control.dataset.setting;
      if (control.type === 'checkbox') {
        control.checked = Boolean(settings.$[key]);
      } else {
        control.value = settings.$[key];
      }
    });
    panel.querySelector('#quick_dial_width_value').textContent = `${settings.$.dial_width}%`;
    externalLogoField.hidden = !settings.$.logo_external;
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

    if (key === 'dial_columns' || key === 'dial_width') {
      UI.calculateStyles();
    } else if (key === 'vertical_center') {
      document.getElementById('bookmarks').classList.toggle('grid--vcenter', Boolean(value));
    } else if (RERENDER_SETTINGS.has(key)) {
      await onRerender();
    }

    if (key === 'logo_external') {
      externalLogoField.hidden = !value;
    }
  }

  trigger.addEventListener('click', () => togglePanel());
  panel.querySelector('[data-quick-settings-close]').addEventListener('click', () => togglePanel(false));
  panel.addEventListener('change', event => {
    const control = event.target.closest('[data-setting]');
    if (control) applySetting(control);
  });
  panel.querySelector('#quick_dial_width').addEventListener('input', event => {
    panel.querySelector('#quick_dial_width_value').textContent = `${event.target.value}%`;
    applySetting(event.target, false);
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
