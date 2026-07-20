import { describe, expect, it } from '@jest/globals';
import {
  mergeSyncSettings,
  splitSyncSettings
} from '../src/js/syncSettings';

describe('split Chrome Sync settings', () => {
  it('stores search, thumbnail, and shortcut settings in dedicated records', () => {
    const records = splitSyncSettings({
      color_theme: 'dark',
      dial_background_color: '#5b4fd6',
      dial_title_color: '#ffffff',
      dial_background_opacity: 70,
      dial_background_blur: true,
      toolbar_match_tile_background: false,
      toolbar_background_color: '#112233',
      toolbar_background_opacity: 75,
      toolbar_background_blur: false,
      search_engine: 'google',
      search_autofocus: true,
      favicon_size: 48,
      thumbnails_auto_refresh: true,
      home_sort_by: 'usage',
      home_sort_usage_tiebreaker: 'date',
      show_usage_count: true,
      show_home_folders: false,
      navigation_sort_by: 'alphabet',
      open_bookmarks_newtab: true,
      open_search_newtab: true,
      keyboard_shortcuts: { focus_search: 'Slash' }
    });

    expect(records.settings).toEqual({
      color_theme: 'dark',
      dial_background_color: '#5b4fd6',
      dial_title_color: '#ffffff',
      dial_background_opacity: 70,
      dial_background_blur: true,
      toolbar_match_tile_background: false,
      toolbar_background_color: '#112233',
      toolbar_background_opacity: 75,
      toolbar_background_blur: false,
      home_sort_by: 'usage',
      home_sort_usage_tiebreaker: 'date',
      show_usage_count: true,
      show_home_folders: false,
      open_bookmarks_newtab: true
    });
    expect(records.settings_search).toEqual({
      search_engine: 'google',
      search_autofocus: true,
      navigation_sort_by: 'alphabet',
      open_search_newtab: true
    });
    expect(records.settings_thumbnails).toEqual({
      favicon_size: 48,
      thumbnails_auto_refresh: true
    });
    expect(records.settings_shortcuts).toEqual({
      keyboard_shortcuts: { focus_search: 'Slash' }
    });
  });

  it('merges split records and ignores categorized values in the core record', () => {
    const settings = mergeSyncSettings({
      settings: {
        color_theme: 'dark',
        search_engine: 'bookmarks',
        favicon_size: 32,
        keyboard_shortcuts: { focus_search: 'KeyF' }
      },
      settings_search: { search_engine: 'google' },
      settings_thumbnails: { favicon_size: 64 },
      settings_shortcuts: { keyboard_shortcuts: { focus_search: 'Slash' } }
    });

    expect(settings).toEqual({
      color_theme: 'dark',
      search_engine: 'google',
      favicon_size: 64,
      keyboard_shortcuts: { focus_search: 'Slash' }
    });
  });

  it('does not migrate categorized values from the old single record', () => {
    const settings = mergeSyncSettings({
      settings: {
        color_theme: 'dark',
        search_engine: 'google',
        favicon_size: 64,
        keyboard_shortcuts: { focus_search: 'Slash' }
      }
    });

    expect(settings).toEqual({ color_theme: 'dark' });
  });
});
