import { describe, expect, it } from '@jest/globals';
import {
  mergeSyncSettings,
  splitSyncSettings
} from '../src/js/syncSettings';

describe('split Chrome Sync settings', () => {
  it('stores search and thumbnail settings in dedicated records', () => {
    const records = splitSyncSettings({
      color_theme: 'dark',
      dial_background_color: '#5b4fd6',
      dial_background_opacity: 70,
      search_engine: 'google',
      search_autofocus: true,
      favicon_size: 48,
      thumbnails_auto_refresh: true
    });

    expect(records.settings).toEqual({
      color_theme: 'dark',
      dial_background_color: '#5b4fd6',
      dial_background_opacity: 70
    });
    expect(records.settings_search).toEqual({
      search_engine: 'google',
      search_autofocus: true
    });
    expect(records.settings_thumbnails).toEqual({
      favicon_size: 48,
      thumbnails_auto_refresh: true
    });
  });

  it('merges split records and ignores categorized values in the core record', () => {
    const settings = mergeSyncSettings({
      settings: {
        color_theme: 'dark',
        search_engine: 'bookmarks',
        favicon_size: 32
      },
      settings_search: { search_engine: 'google' },
      settings_thumbnails: { favicon_size: 64 }
    });

    expect(settings).toEqual({
      color_theme: 'dark',
      search_engine: 'google',
      favicon_size: 64
    });
  });

  it('does not migrate search and thumbnail values from the old single record', () => {
    const settings = mergeSyncSettings({
      settings: {
        color_theme: 'dark',
        search_engine: 'google',
        favicon_size: 64
      }
    });

    expect(settings).toEqual({ color_theme: 'dark' });
  });
});
