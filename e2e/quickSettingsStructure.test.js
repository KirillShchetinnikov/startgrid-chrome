import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

describe('quick settings structure', () => {
  const source = readFileSync('src/js/components/quickDisplaySettings.js', 'utf8');
  const styles = readFileSync('src/css/components/_quick-settings.css', 'utf8');

  it('groups controls into seven stable sections', () => {
    const groups = [...source.matchAll(/createGroup\('([^']+)'/g)]
      .map(match => match[1]);

    expect(groups).toEqual([
      'start',
      'sorting',
      'page',
      'grid',
      'tile-style',
      'tile-content',
      'interface'
    ]);
    expect(source).toContain('<details class="quick-settings__group"');
    expect(source).toContain('<summary class="quick-settings__group-summary">');
  });

  it('includes every sorting control and updates dependent fields', () => {
    const resetKeys = readFileSync('src/js/quickSettings.js', 'utf8');

    [
      'drag_and_drop',
      'home_sort_by',
      'home_sort_date_direction',
      'home_sort_alphabet_direction',
      'home_sort_usage_tiebreaker',
      'show_usage_count',
      'show_home_folders',
      'bookmarks_sorting_type'
    ].forEach(key => {
      const renderedAsSwitch = [
        'drag_and_drop',
        'show_usage_count',
        'show_home_folders'
      ].includes(key);
      expect(source).toContain(renderedAsSwitch
        ? `createSwitch('${key}'`
        : `data-setting="${key}"`);
    });
    expect(source).toContain('data-quick-sort-mode="date"');
    expect(source).toContain('data-quick-sort-mode="alphabet"');
    expect(source).toContain('data-quick-sort-mode="usage"');
    expect(source).toContain('function syncSortingControls()');
    expect(source).toContain("['home_sort_by', 'show_home_folders'].includes(key)");
    expect(resetKeys).toContain("'bookmarks_sorting_type'");
  });

  it('offers default and last-opened folder controls without resetting them', () => {
    const resetKeys = readFileSync('src/js/quickSettings.js', 'utf8');

    expect(source).toContain('id="quick_default_folder_id"');
    expect(source).toContain('data-quick-default-folder');
    expect(source).toContain(`createSwitch('show_last_opened_folder')`);
    expect(source).toContain('updateDefaultFolder(settings, folderSelect.value, folderTree)');
    expect(source).toContain('onDefaultFolderChange(folderSelect.value)');
    expect(resetKeys).not.toContain(`'default_folder_id'`);
    expect(resetKeys).not.toContain(`'show_last_opened_folder'`);
  });

  it('keeps toolbar appearance controls visible and disables them when linked', () => {
    expect(source).toContain("createSwitch('toolbar_background_blur', 'data-quick-toolbar-background')");
    expect(source).toContain("control.classList.toggle('is-disabled', disabled)");
    expect(source).toContain('field.disabled = disabled || hasNoCustomColor');
    expect(source).not.toContain('control.hidden = Boolean(settings.$.toolbar_match_tile_background)');
  });

  it('connects the trigger to the panel and keeps decoration silent', () => {
    expect(source).toContain(`trigger.setAttribute('aria-controls', 'quick_settings')`);
    expect(source).toContain(`trigger.classList.toggle('is-active', willOpen)`);
    expect(source).toContain('aria-hidden="true"><use xlink:href="/img/symbol.svg#close"');
  });

  it('anchors hidden checkbox inputs inside their switch rows', () => {
    expect(styles).toMatch(/quick-settings__switch-row[\s\S]*& \.switch \{\s*position: relative;/);
  });

  it('keeps reset inside the scrollable list without a full-settings footer', () => {
    expect(source).toContain('<section class="quick-settings__reset">');
    expect(source).toContain("message('reset_quick_settings_description')");
    expect(source).not.toContain('quick-settings__footer');
    expect(source).not.toContain("message('more_settings')");
    expect(source).not.toContain("message('quick_display_settings_description')");
    expect(source).not.toContain('data-quick-default-folder-note');
  });
});
