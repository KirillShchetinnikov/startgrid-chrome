import { $createElement } from '../utils';
import Toast from './toast';
import {
  MAX_SEARCH_ENGINES,
  MAX_SEARCH_ENGINE_TITLE_LENGTH,
  MAX_SEARCH_ENGINE_URL_LENGTH,
  getSearchEngines,
  isValidSearchUrlTemplate,
  normalizeSearchEngineSettings
} from '../searchEngines';

const message = (key, substitutions) => browser.i18n.getMessage(key, substitutions);

function createActionButton(action, label, text) {
  return $createElement('button', {
    class: 'search-engine-editor__action',
    type: 'button',
    'data-action': action,
    'aria-label': label,
    title: label
  }, text);
}

export default function initSearchEngineSettings({ container, settings, onChange }) {
  const getConfiguredEngines = () => getSearchEngines(settings.$.search_engines, message);

  async function save(nextSettings) {
    const normalized = normalizeSearchEngineSettings(nextSettings);
    await settings.updateKey('search_engines', normalized);

    const enabledIds = normalized.filter(engine => engine.enabled).map(engine => engine.id);
    if (!enabledIds.includes(settings.$.search_engine)) {
      await settings.updateKey('search_engine', enabledIds[0]);
    }

    render();
    onChange?.();
  }

  function createToggle(engine) {
    const inputId = `search_engine_enabled_${engine.id.replace(/[^a-z0-9_-]/gi, '_')}`;
    const input = $createElement('input', {
      id: inputId,
      class: 'switch__input',
      type: 'checkbox',
      'data-action': 'toggle',
      'data-engine-id': engine.id,
      'aria-label': message('search_engine_enabled')
    });
    input.checked = engine.enabled;

    return $createElement('div', { class: 'switch' },
      input,
      $createElement('label', {
        class: 'switch__label',
        for: inputId,
        title: message('search_engine_enabled')
      })
    );
  }

  function createEngineName(engine) {
    if (!engine.custom) {
      return $createElement('strong', { class: 'search-engine-editor__name' }, engine.title);
    }

    return $createElement('input', {
      class: 'form-control search-engine-editor__name-input',
      type: 'text',
      value: engine.title,
      maxlength: MAX_SEARCH_ENGINE_TITLE_LENGTH,
      placeholder: message('search_engine_name'),
      'aria-label': message('search_engine_name'),
      'data-action': 'title',
      'data-engine-id': engine.id
    });
  }

  function createEngineRow(engine, index, count) {
    const controls = $createElement('div', { class: 'search-engine-editor__controls' },
      createActionButton('up', message('move_search_engine_up'), '↑'),
      createActionButton('down', message('move_search_engine_down'), '↓')
    );
    controls.children[0].dataset.engineId = engine.id;
    controls.children[0].disabled = index === 0;
    controls.children[1].dataset.engineId = engine.id;
    controls.children[1].disabled = index === count - 1;

    if (engine.kind === 'external') {
      const removeButton = createActionButton(
        'remove',
        message('remove_search_engine'),
        '×'
      );
      removeButton.dataset.engineId = engine.id;
      controls.append(removeButton);
    }

    const header = $createElement('div', { class: 'search-engine-editor__header' },
      createToggle(engine),
      createEngineName(engine),
      controls
    );

    const row = $createElement('div', {
      class: 'search-engine-editor__item',
      'data-engine-row': engine.id
    }, header);

    if (engine.kind === 'external') {
      row.append($createElement('label', { class: 'search-engine-editor__url-field' },
        $createElement('span', { class: 'search-engine-editor__url-label' }, message('search_engine_url')),
        $createElement('input', {
          class: 'form-control search-engine-editor__url-input',
          type: 'url',
          value: engine.url,
          maxlength: MAX_SEARCH_ENGINE_URL_LENGTH,
          placeholder: `https://example.com/search?q={query}`,
          spellcheck: 'false',
          'data-action': 'url',
          'data-engine-id': engine.id
        })
      ));

      if (engine.custom) {
        row.append($createElement('label', { class: 'search-engine-editor__url-field' },
          $createElement('span', { class: 'search-engine-editor__url-label' }, message('search_suggestion_url')),
          $createElement('input', {
            class: 'form-control search-engine-editor__url-input',
            type: 'url',
            value: engine.suggestUrl || '',
            maxlength: MAX_SEARCH_ENGINE_URL_LENGTH,
            placeholder: `https://example.com/suggest?q={query}`,
            spellcheck: 'false',
            'data-action': 'suggestUrl',
            'data-engine-id': engine.id
          })
        ));
      }
    }

    return row;
  }

  function render(focusEngineId) {
    const engines = getConfiguredEngines();
    const list = $createElement('div', { class: 'search-engine-editor__list' });
    engines.forEach((engine, index) => {
      list.append(createEngineRow(engine, index, engines.length));
    });

    const addButton = $createElement('button', {
      class: 'btn search-engine-editor__add md-ripple',
      type: 'button',
      'data-action': 'add'
    }, `${message('add_search_engine')} (${engines.length}/${MAX_SEARCH_ENGINES})`);
    addButton.disabled = engines.length >= MAX_SEARCH_ENGINES;

    container.replaceChildren(
      list,
      $createElement('small', { class: 'text-muted search-engine-editor__note' }, message('search_engine_url_note')),
      addButton
    );

    if (focusEngineId) {
      container.querySelector(`[data-engine-row="${focusEngineId}"] .search-engine-editor__name-input`)?.focus();
    }
  }

  container.addEventListener('change', async(event) => {
    const target = event.target.closest('[data-action][data-engine-id]');
    if (!target) return;

    const nextSettings = normalizeSearchEngineSettings(settings.$.search_engines);
    const engine = nextSettings.find(item => item.id === target.dataset.engineId);
    if (!engine) return;

    if (target.dataset.action === 'toggle') {
      if (!target.checked && nextSettings.filter(item => item.enabled).length === 1) {
        target.checked = true;
        Toast.show(message('search_engine_at_least_one'));
        return;
      }
      if (target.checked && 'url' in engine && !isValidSearchUrlTemplate(engine.url)) {
        target.checked = false;
        Toast.show(message('search_engine_invalid_url'));
        return;
      }
      engine.enabled = target.checked;
    }

    if (target.dataset.action === 'title') {
      const title = target.value.trim();
      if (!title) {
        target.classList.add('has-error');
        Toast.show(message('search_engine_name_required'));
        return;
      }
      engine.title = title;
    }

    if (target.dataset.action === 'url') {
      const url = target.value.trim();
      if (!isValidSearchUrlTemplate(url)) {
        target.classList.add('has-error');
        Toast.show(message('search_engine_invalid_url'));
        return;
      }
      engine.url = url;
    }

    if (target.dataset.action === 'suggestUrl') {
      const suggestUrl = target.value.trim();
      if (suggestUrl && !isValidSearchUrlTemplate(suggestUrl)) {
        target.classList.add('has-error');
        Toast.show(message('search_suggestion_invalid_url'));
        return;
      }
      if (suggestUrl) engine.suggestUrl = suggestUrl;
      else delete engine.suggestUrl;
    }

    await save(nextSettings);
  });

  container.addEventListener('input', (event) => {
    event.target.closest('.has-error')?.classList.remove('has-error');
  });

  container.addEventListener('click', async(event) => {
    const target = event.target.closest('button[data-action]');
    if (!target) return;

    const nextSettings = normalizeSearchEngineSettings(settings.$.search_engines);
    const index = nextSettings.findIndex(engine => engine.id === target.dataset.engineId);

    if (target.dataset.action === 'add') {
      const visibleCount = getSearchEngines(nextSettings).length;
      const customCount = nextSettings.filter(engine => engine.id.startsWith('custom:')).length;
      if (visibleCount >= MAX_SEARCH_ENGINES) return;

      const id = `custom:${crypto.randomUUID().slice(0, 8)}`;
      nextSettings.push({
        id,
        enabled: false,
        title: `${message('custom_search_engine')} ${customCount + 1}`,
        url: ''
      });
      await save(nextSettings);
      render(id);
      return;
    }

    if (index < 0) return;

    if (target.dataset.action === 'remove') {
      const [removedEngine] = nextSettings.splice(index, 1);
      if (!removedEngine.id.startsWith('custom:')) {
        nextSettings.push({ id: removedEngine.id, removed: true });
      }
    } else if (target.dataset.action === 'up' && index > 0) {
      [nextSettings[index - 1], nextSettings[index]] = [nextSettings[index], nextSettings[index - 1]];
    } else if (target.dataset.action === 'down' && index < nextSettings.length - 1) {
      [nextSettings[index], nextSettings[index + 1]] = [nextSettings[index + 1], nextSettings[index]];
    } else {
      return;
    }

    await save(nextSettings);
  });

  render();
  return { render };
}
