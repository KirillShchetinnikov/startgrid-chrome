import { getMessage } from '../i18n';
import { getDefaultSettings } from '../settings';
import { LOCAL_SETTING_KEYS, SYNC_ERROR_KEY, SYNC_STATE_KEY, syncGroup } from '../selectiveSync';
import { SYNC_QUOTA_ERROR_KEY } from '../syncQuota';

export function getSyncChoices(sections) {
  const defaults = getDefaultSettings();
  const byId = new Map(sections.flatMap(section => section.sections.flatMap(part =>
    part.list.flatMap(item => item.group || [item]))).map(setting => [setting.id, setting]));
  const blocks = [
    ['start', 'settings_group_start', ['default_folder_id', 'show_last_opened_folder']],
    ['sorting', 'settings_group_sorting', ['home_sort_by', 'home_sort_date_direction',
      'home_sort_alphabet_direction', 'home_sort_usage_tiebreaker', 'show_usage_count',
      'drag_and_drop', 'show_home_folders', 'bookmarks_sorting_type']],
    ['page', 'settings_group_page', ['color_theme', 'background_image']],
    ['grid', 'settings_group_grid', ['dial_columns', 'dial_width', 'dial_tile_size',
      'dial_horizontal_gap', 'dial_vertical_gap', 'dial_aspect_ratio', 'vertical_center', 'disable_main_page_scroll']],
    ['tile-style', 'settings_group_tile_style', ['dial_radius', 'dial_shadow', 'dial_hover_lift']],
    ['tile-background', 'dial_background_color', ['dial_background_color',
      'dial_background_opacity', 'dial_background_blur']],
    ['tile-content', 'settings_group_tile_content', ['show_bookmark_title', 'bookmark_title_size',
      'bookmark_title_position', 'dial_title_color', 'show_favicon', 'folder_preview',
      'folder_marker_style']],
    ['search-folder', 'settings_group_search_folder', ['show_search', 'show_folder_picker',
      'toolbar_match_tile_background', 'toolbar_background_color', 'toolbar_background_opacity',
      'toolbar_background_blur']],
    ['interface', 'settings_group_interface', ['show_settings_icon', 'show_quick_settings_icon',
      'show_extension_icon', 'show_create_column', 'show_back_column']],
    ['background-animation', 'background_entrance_effect',
      ['background_entrance_effect', 'background_entrance_duration']],
    ['page-animation', 'page_cascade_enabled', ['page_cascade_enabled', 'page_cascade_mode', 'page_cascade_duration']],
    ['snow', 'snow_mode', ['snow_mode']],
    ['opening', 'settings_group_opening', ['open_bookmarks_newtab', 'move_to_start',
      'show_contextmenu_item', 'close_tab_after_adding_bookmark', 'without_confirmation']],
    ['search', 'settings_group_search_behavior', ['search_results_display',
      'navigation_sort_by', 'open_search_newtab', 'search_autofocus']],
    ['engines', 'search_engines', ['search_engines']],
    ['thumbnails', 'settings_group_thumbnail_generation', ['thumbnail_source', 'thumbnails_update_button',
      'download_favicons_by_default', 'favicon_size', 'thumbnails_update_delay']],
    ['auto-refresh', 'settings_group_auto_refresh', ['thumbnails_auto_refresh', 'thumbnails_auto_refresh_interval']],
    ['shortcuts', 'keyboard_shortcuts_setting', ['keyboard_shortcuts']]
  ];
  const seen = new Set();
  return blocks.map(([id, titleKey, keys]) => {
    const choices = [];
    keys.forEach(id => {
      const setting = byId.get(id);
      if (setting) {
        const key = setting.id === 'default_folder_id' ? 'sync_default_folder_path' : setting.id;
        const group = syncGroup(key);
        if (!Object.hasOwn(defaults, key) || LOCAL_SETTING_KEYS.includes(key) || seen.has(group)) return;
        seen.add(group);
        choices.push({ key, group, title: setting.title });
      }
    });
    return { id, title: getMessage(titleKey), choices };
  }).filter(section => section.choices.length);
}

export default function initSyncSelection(container, sections, settings) {
  const inputs = [];
  const blockInputs = [];
  let busy = false;
  const instructions = document.createElement('p');
  instructions.textContent = getMessage('sync_selection_blocks');
  container.append(instructions);
  const note = document.createElement('p');
  note.id = 'sync-selection-help';
  note.className = 'text-muted';
  note.textContent = getMessage('sync_selection_behavior');
  container.append(note);
  getSyncChoices(sections).forEach(section => {
    const block = document.createElement('section');
    block.className = 'sync-selection__block';
    const details = document.createElement('details');
    details.dataset.syncBlock = section.id;
    const summary = document.createElement('summary');
    const title = document.createElement('span');
    title.textContent = section.title;
    title.id = `sync-block-title-${section.id}`;
    const count = document.createElement('span');
    count.className = 'sync-selection__count';
    summary.append(title, count);
    details.append(summary);
    const blockToggle = document.createElement('div');
    blockToggle.className = 'switch sync-selection__block-toggle';
    const blockInput = document.createElement('input');
    blockInput.type = 'checkbox';
    blockInput.id = `sync-block-${section.id}`;
    blockInput.name = blockInput.id;
    blockInput.className = 'switch__input';
    blockInput.setAttribute('aria-labelledby', title.id);
    blockInput.setAttribute('aria-describedby', note.id);
    const blockDecoration = document.createElement('label');
    blockDecoration.className = 'switch__label';
    blockDecoration.htmlFor = blockInput.id;
    blockDecoration.setAttribute('aria-hidden', 'true');
    blockToggle.append(blockInput, blockDecoration);
    blockInputs.push({ input: blockInput, choices: section.choices, count });
    blockInput.addEventListener('change', () => save(section.choices.map(choice => choice.key), blockInput.checked));
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = section.title;
    fieldset.append(legend);
    section.choices.forEach(choice => {
      const row = document.createElement('div');
      row.className = 'sync-selection__row';
      const label = document.createElement('label');
      const id = `sync-choice-${choice.group}`;
      label.htmlFor = id;
      label.textContent = choice.title;
      const toggle = document.createElement('div');
      toggle.className = 'switch';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = id;
      input.name = id;
      input.className = 'switch__input';
      input.setAttribute('aria-describedby', note.id);
      const decoration = document.createElement('label');
      decoration.className = 'switch__label';
      decoration.htmlFor = id;
      decoration.setAttribute('aria-hidden', 'true');
      toggle.append(input, decoration);
      row.append(label, toggle);
      fieldset.append(row);
      inputs.push({ input, key: choice.key });
      input.addEventListener('change', () => save([choice.key], input.checked));
    });
    details.append(fieldset);
    block.append(details, blockToggle);
    container.append(block);
  });
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  container.append(status);
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'btn';
  retry.textContent = getMessage('sync_selection_retry');
  retry.hidden = true;
  retry.addEventListener('click', async() => {
    retry.disabled = true;
    try {
      await settings.init();
    } finally {
      await render();
    }
  });
  container.append(retry);

  async function save(keys, enabled) {
    if (busy) return;
    busy = true;
    [...inputs, ...blockInputs].forEach(({ input }) => {
      input.disabled = true;
    });
    try {
      const saved = await settings.setSyncEnabledMany(keys, enabled);
      status.textContent = saved ? '' : getMessage('sync_selection_pending');
    } catch (error) {
      console.warn('Could not update sync selection', error);
      await browser.storage.local.set({ [SYNC_ERROR_KEY]: String(error?.message || error) });
      status.textContent = getMessage('sync_selection_pending');
    } finally {
      busy = false;
      await render();
    }
  }

  async function render() {
    const local = await browser.storage.local.get([SYNC_STATE_KEY, SYNC_ERROR_KEY, SYNC_QUOTA_ERROR_KEY]);
    const pending = local[SYNC_STATE_KEY]?.pending || {};
    const hasError = Boolean(local[SYNC_ERROR_KEY] || local[SYNC_QUOTA_ERROR_KEY] || Object.keys(pending).length);
    const isEnabled = key => pending[syncGroup(key)]?.kind === 'policy'
      ? pending[syncGroup(key)].enabled : settings.isSynced(key);
    inputs.forEach(({ input, key }) => {
      input.checked = isEnabled(key);
      input.disabled = busy || !settings.$.enable_sync;
    });
    blockInputs.forEach(({ input, choices, count }) => {
      const selected = choices.filter(choice => isEnabled(choice.key)).length;
      input.checked = selected === choices.length;
      input.indeterminate = selected > 0 && selected < choices.length;
      input.disabled = busy || !settings.$.enable_sync;
      count.textContent = `${selected} / ${choices.length}`;
    });
    status.textContent = !settings.$.enable_sync ? getMessage('sync_selection_paused')
      : hasError ? getMessage('sync_selection_pending') : '';
    retry.hidden = !hasError || !settings.$.enable_sync;
    retry.disabled = false;
  }
  return { render };
}
