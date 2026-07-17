import { $createElement } from '../utils';
import { getMessage } from '../i18n';

function createSwitch(setting) {
  const input = $createElement('input', {
    id: setting.id,
    type: 'checkbox',
    name: setting.id,
    class: 'switch__input js-change'
  });

  Object.assign(input.dataset, setting.data);

  const switchElement = $createElement('div',
    {
      class: 'switch'
    },
    input,
    $createElement('label', {
      class: 'switch__label',
      for: setting.id
    })
  );

  return switchElement.outerHTML;
}

function createSelect(setting) {
  const selectElement = $createElement(
    'select',
    {
      id: setting.id,
      name: setting.id,
      class: 'form-control js-change'
    },
    {
      html: setting.options
        .map(
          (option) => {
            return `<option value="${option.value}"${option.selected ? ' selected' : ''}>${option.title}</option>`;
          }
        )
        .join('')
    }
  );
  Object.assign(selectElement.dataset, setting.data);

  if (setting.id === 'background_image') {
    return selectElement.outerHTML + createBackgroundSetting(setting);
  }

  return selectElement.outerHTML;
}

function createTextarea(setting) {
  const textarea = $createElement('textarea', {
    class: 'is-editor form-control js-change',
    name: setting.id,
    id: setting.id,
    spellcheck: setting.spellcheck,
    placeholder: setting.placeholder
  });
  Object.assign(textarea.dataset, setting.data);

  return textarea.outerHTML;
}

function createRange(setting) {
  const range = $createElement('input', {
    type: setting.type,
    class: 'range__input js-range',
    id: setting.id,
    name: setting.id,
    min: setting.min,
    max: setting.max,
    step: setting.step
  });

  Object.assign(range.dataset, setting.data);

  const rangeElement = $createElement(
    'div',
    {
      class: 'range'
    },
    range,
    $createElement('span', {
      id: setting.data.selectorOutput.replace('#', '')
    })
  );

  return rangeElement.outerHTML;
}

function createColor(setting) {
  return /* html */`<div class="tile-color-setting">
    <input type="color" class="tile-color-setting__input js-change" id="${setting.id}"
      name="${setting.id}" aria-label="${setting.title}">
    <button type="button" class="btn btn--clear tile-color-setting__reset"
      data-reset-color="${setting.id}">${setting.resetText}</button>
  </div>`;
}

function createButton(setting) {
  return $createElement(
    'button',
    {
      class: 'btn md-ripple',
      id: setting.id
    },
    setting.text
  ).outerHTML;
}

function createVbSelect(setting) {
  return $createElement('vb-select-folders', {
    id: setting.id,
    class: 'js-change'
  }).outerHTML;
}

function createBackup(setting) {
  return /* html */`<div class="btn-group btn-group--full">
      <div class="c-upload btn">
        <input type="file" name="import" id="${setting.import.id}" class="c-upload__input" accept="${setting.import.accept}">
        <label for="${setting.import.id}" class="c-upload__btn md-ripple"><span class="c-upload__name">${getMessage(setting.import.id)}</span></label>
      </div>
      <button class="btn md-ripple" id="${setting.export.id}">${getMessage(setting.export.id)}</button>
    </div>`;
}

function createSearchEngines(setting) {
  return $createElement('div', {
    id: setting.id,
    class: 'search-engine-editor'
  }).outerHTML;
}

function createKeyboardShortcuts(setting) {
  return $createElement('div', {
    id: setting.id,
    class: 'shortcut-editor'
  }).outerHTML;
}

function createBackgroundSetting() {
  return (/* html */
  `<div id="background_noimage" class="tbl__option js-background-settings js-change text-muted" hidden>${getMessage('background_noimage_text')}</div>
  <div id="background_bing" class="tbl__option js-background-settings js-change text-muted" hidden>${getMessage('background_bing_text')}</div>
  <div id="background_local" class="tbl__option js-background-settings">
    <div class="c-upload">
      <form action="#0" method="post">
        <input type="file" name="upload" id="bgFile" class="c-upload__input">
        <label for="bgFile" class="c-upload__btn md-ripple">
          <svg width="20" height="20" class="c-upload__icon"><use xlink:href="/img/symbol.svg#upload_outline"></use></svg>
          <span class="c-upload__name" data-locale-message="choose_file">Изображение или видео</span>
        </label>
        <small class="c-upload__hint text-muted" data-locale-message="background_local_video_note">Локальным фоном может быть изображение или MP4-видео. Видео воспроизводится без звука и автоматически повторяется.</small>
      </form>
      <div class="c-upload__preview">
        <div class="c-upload__remove">
          <button class="md-ripple" data-ripple-center id="delete_upload">
            <svg width="20" height="20"><use xlink:href="/img/symbol.svg#close"></use></svg>
          </button>
        </div>
        <div id="preview_upload">
          <div class="c-upload__preview-image"></div>
        </div>
      </div>
    </div>
  </div>
  <input type="url" id="background_external" name="external" class="form-control js-change tbl__option js-background-settings" placeholder="https://source.unsplash.com/1920x1080/daily?landscape" spellcheck="false">`);
}

function create(setting) {
  let method;

  switch (setting.type) {
    case 'switch':
      method = createSwitch;
      break;
    case 'select':
      method = createSelect;
      break;
    case 'range':
      method = createRange;
      break;
    case 'color':
      method = createColor;
      break;
    case 'textarea':
      method = createTextarea;
      break;
    case 'button':
      method = createButton;
      break;
    case 'vb-select-folders':
      method = createVbSelect;
      break;
    case 'backup':
      method = createBackup;
      break;
    case 'search-engines':
      method = createSearchEngines;
      break;
    case 'keyboard-shortcuts':
      method = createKeyboardShortcuts;
      break;
  }
  return method(setting);
}

function createRow(setting, row = false) {
  const classRow = row ? 'tbl__row' : 'tbl';
  const classSearchEngines = setting.type === 'search-engines' ? ' tbl--search-engines' : '';
  const hidden = setting.hidden ? ' hidden' : '';
  const conditionHidden = setting.hidden ? 'true' : 'false';
  return /* html */ `<div id="setting_${setting.id}" class="${classRow}${classSearchEngines}"
    data-condition-hidden="${conditionHidden}" data-search-hidden="false"${hidden}>
    <div class="tbl__setting">
      ${setting.title}
      ${
        setting.note
          ? `<small class="text-muted"${setting.noteId ? ` id="${setting.noteId}"` : ''}>${setting.note}</small>`
          : ``
      }
    </div>
    <div class="tbl__value">${create(setting)}</div>
  </div>`;
}

export function displaySettings(settings) {
  const navigation = [];
  const mobileNavigation = [];
  const panels = [];

  settings.forEach((setting, index) => {
    const navigationId = `settings-nav-${setting.id}`;
    const panelId = `settings-panel-${setting.id}`;
    navigation.push(`<button class="settings-nav__item" id="${navigationId}" type="button"
      role="tab" data-section-id="${setting.id}" aria-selected="false"
      aria-controls="${panelId}" tabindex="-1">
      <span class="settings-nav__label">${setting.key}</span>
    </button>`);
    mobileNavigation.push(`<option value="${setting.id}">${setting.key}</option>`);

    const sectionCards = setting.sections.map((section, sectionIndex) => {
      const list = section.list.map(item => {
        if (item.group) {
          return `<div class="tbl settings-row-group">
              ${item.group.map(settingItem => createRow(settingItem, 'row')).join('')}
            </div>`;
        }
        return createRow(item);
      }).join('');

      const dangerClass = section.danger ? ' settings-card--danger' : '';
      return `<section class="settings-card${dangerClass}"
        data-card-id="${setting.id}-${sectionIndex}">
        <header class="settings-card__header">
          <h3 class="settings-card__title">${section.key}</h3>
          ${section.description
            ? `<p class="settings-card__description">${section.description}</p>`
            : ''}
        </header>
        <div class="settings-card__content">${list}</div>
      </section>`;
    }).join('');

    panels.push(`<section class="settings-panel" id="${panelId}" role="tabpanel"
      data-section-id="${setting.id}" aria-labelledby="${navigationId}"${index ? ' hidden' : ''}>
      <h2 class="settings-panel__title">${setting.key}</h2>
      ${sectionCards}
    </section>`);
  });

  return (/* html*/
  `<div class="settings-shell">
      <aside class="settings-sidebar">
        <h1 class="settings-sidebar__title">${getMessage('options')}</h1>
        <nav class="settings-nav" role="tablist" aria-orientation="vertical">
          ${navigation.join('')}
        </nav>
        <label class="settings-mobile-nav">
          <span class="settings-mobile-nav__label">${getMessage('settings_mobile_section')}</span>
          <select class="form-control" id="settings_section_select">
            ${mobileNavigation.join('')}
          </select>
        </label>
      </aside>
      <main class="settings-main">
        <header class="settings-toolbar">
          <label class="settings-search">
            <svg class="settings-search__icon" width="18" height="18" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>
            </svg>
            <input class="form-control settings-search__input" id="settings_search" type="search"
              aria-label="${getMessage('settings_search_label')}"
              placeholder="${getMessage('settings_search_placeholder')}" autocomplete="off">
          </label>
          <p class="settings-autosave">${getMessage('settings_autosave')}</p>
        </header>
        <div class="settings-viewport">
          <div class="settings-panels">
            ${panels.join('')}
            <p class="settings-empty" id="settings_empty" hidden>
              ${getMessage('settings_no_results')}
            </p>
          </div>
        </div>
      </main>
    </div>
  `);
}
