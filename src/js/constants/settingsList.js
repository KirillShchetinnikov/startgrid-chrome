import { getMessage, LANGUAGE_OPTIONS } from '../i18n';

const columns = Array.from({ length: 10 }, (_, index) => ({
  value: index + 1,
  title: index + 1
}));

const appearanceSettings = [
  {
    id: 'dial_columns',
    title: getMessage('number_of_columns'),
    type: 'select',
    options: columns
  },
  {
    id: 'dial_width',
    title: getMessage('dial_width'),
    type: 'range',
    min: 50,
    max: 99,
    step: 1,
    data: {
      selectorOutput: '#dial_width_value',
      outputPostfix: '%'
    }
  },
  {
    id: 'dial_gap',
    title: getMessage('dial_gap'),
    type: 'range',
    min: 0,
    max: 40,
    step: 1,
    data: {
      selectorOutput: '#dial_gap_value',
      outputPostfix: 'px'
    }
  },
  {
    id: 'dial_radius',
    title: getMessage('dial_radius'),
    type: 'range',
    min: 0,
    max: 40,
    step: 1,
    data: {
      selectorOutput: '#dial_radius_value',
      outputPostfix: 'px'
    }
  },
  {
    id: 'dial_aspect_ratio',
    title: getMessage('dial_aspect_ratio'),
    type: 'select',
    options: [
      {
        value: '1 / 1',
        title: getMessage('dial_aspect_ratio_square')
      },
      {
        value: '4 / 3',
        title: getMessage('dial_aspect_ratio_standard')
      },
      {
        value: '3 / 2',
        title: getMessage('dial_aspect_ratio_photo')
      },
      {
        value: '16 / 9',
        title: getMessage('dial_aspect_ratio_wide')
      }
    ]
  },
  {
    id: 'dial_shadow',
    title: getMessage('dial_shadow'),
    type: 'range',
    min: 0,
    max: 30,
    step: 1,
    data: {
      selectorOutput: '#dial_shadow_value',
      outputPostfix: '%'
    }
  },
  {
    id: 'dial_hover_lift',
    title: getMessage('dial_hover_lift'),
    type: 'range',
    min: 0,
    max: 12,
    step: 1,
    data: {
      selectorOutput: '#dial_hover_lift_value',
      outputPostfix: 'px'
    }
  },
  {
    id: 'dial_background_color',
    title: getMessage('dial_background_color'),
    note: getMessage('dial_background_color_note'),
    resetText: getMessage('reset_tile_background_color'),
    type: 'color'
  },
  {
    id: 'dial_title_color',
    title: getMessage('dial_title_color'),
    note: getMessage('dial_title_color_note'),
    resetText: getMessage('reset_tile_title_color'),
    type: 'color'
  },
  {
    id: 'dial_background_opacity',
    title: getMessage('dial_background_opacity'),
    note: getMessage('dial_background_opacity_note'),
    type: 'range',
    min: 0,
    max: 100,
    step: 1,
    data: {
      selectorOutput: '#dial_background_opacity_value',
      outputPostfix: '%'
    }
  },
  {
    id: 'dial_background_blur',
    title: getMessage('dial_background_blur'),
    type: 'switch'
  },
  {
    id: 'vertical_center',
    title: getMessage('vertical_center'),
    type: 'switch'
  },
  {
    id: 'show_create_column',
    title: getMessage('show_create_column'),
    type: 'switch'
  },
  {
    id: 'show_back_column',
    title: getMessage('show_back_column'),
    type: 'switch'
  },
  {
    id: 'show_bookmark_title',
    title: getMessage('show_bookmark_title'),
    type: 'switch'
  },
  {
    id: 'show_favicon',
    title: getMessage('show_favicon'),
    type: 'switch'
  },
  {
    id: 'folder_preview',
    title: getMessage('folder_preview'),
    note: getMessage('folder_preview_description'),
    type: 'switch'
  }
];

const legacySettings = [
  {
    key: getMessage('bookmark_appearance_setting'),
    list: appearanceSettings
  },
  {
    key: getMessage('page_appearance_setting'),
    list: [
      {
        id: 'language',
        title: getMessage('language'),
        type: 'select',
        options: LANGUAGE_OPTIONS.map(option => ({
          value: option.value,
          title: option.title || getMessage(option.titleKey)
        }))
      },
      {
        id: 'color_theme',
        title: getMessage('color_theme'),
        type: 'select',
        options: [
          { value: 'dark', title: getMessage('dark_theme') },
          { value: 'light', title: getMessage('light_theme') },
          { value: 'os', title: getMessage('os_theme') }
        ]
      },
      {
        id: 'background_image',
        title: getMessage('background'),
        type: 'select',
        options: [
          { value: 'background_noimage', title: getMessage('background_noimage') },
          { value: 'background_external', title: getMessage('background_external') },
          { value: 'background_local', title: getMessage('background_local') },
          { value: 'background_bing', title: getMessage('background_bing') }
        ]
      },
      {
        id: 'background_entrance_effect',
        title: getMessage('background_entrance_effect'),
        type: 'select',
        options: [
          { value: 'none', title: getMessage('background_entrance_none') },
          { value: 'zoom', title: getMessage('background_entrance_zoom') },
          { value: 'blur', title: getMessage('background_entrance_blur') },
          { value: 'slide', title: getMessage('background_entrance_slide') }
        ]
      },
      {
        id: 'background_entrance_duration',
        title: getMessage('background_entrance_duration'),
        type: 'range',
        min: 100,
        max: 3000,
        step: 100,
        data: {
          selectorOutput: '#background_entrance_duration_value',
          outputPostfix: ' ms'
        }
      },
      {
        id: 'snow_mode',
        title: getMessage('snow_mode'),
        type: 'select',
        options: [
          { value: 'always', title: getMessage('snow_mode_always') },
          { value: 'winter', title: getMessage('snow_mode_winter') },
          { value: 'off', title: getMessage('snow_mode_off') }
        ]
      },
      {
        id: 'page_cascade_enabled',
        title: getMessage('page_cascade_enabled'),
        type: 'switch'
      },
      {
        id: 'page_entrance_effect',
        title: getMessage('page_entrance_effect'),
        type: 'select',
        options: [
          { value: 'reveal', title: getMessage('page_entrance_effect_reveal') },
          { value: 'zoom', title: getMessage('page_entrance_effect_zoom') },
          { value: 'rise', title: getMessage('page_entrance_effect_rise') }
        ]
      },
      {
        id: 'page_cascade_mode',
        title: getMessage('page_cascade_mode'),
        type: 'select',
        options: [
          { value: 'items', title: getMessage('page_cascade_mode_items') },
          { value: 'rows', title: getMessage('page_cascade_mode_rows') }
        ]
      },
      {
        id: 'page_cascade_duration',
        title: getMessage('page_cascade_duration'),
        type: 'range',
        min: 200,
        max: 1500,
        step: 50,
        data: {
          selectorOutput: '#page_cascade_duration_value',
          outputPostfix: ' ms'
        }
      },
      {
        id: 'show_search',
        title: getMessage('show_search'),
        type: 'switch'
      },
      {
        id: 'show_folder_picker',
        title: getMessage('show_folder_picker'),
        type: 'switch'
      },
      {
        id: 'toolbar_match_tile_background',
        title: getMessage('toolbar_match_tile_background'),
        type: 'switch'
      },
      {
        id: 'toolbar_background_color',
        title: getMessage('toolbar_background_color'),
        note: getMessage('toolbar_background_color_note'),
        resetText: getMessage('reset_toolbar_background_color'),
        type: 'color',
        hidden: true
      },
      {
        id: 'toolbar_background_opacity',
        title: getMessage('toolbar_background_opacity'),
        note: getMessage('toolbar_background_opacity_note'),
        type: 'range',
        min: 0,
        max: 100,
        step: 1,
        data: {
          selectorOutput: '#toolbar_background_opacity_value',
          outputPostfix: '%'
        },
        hidden: true
      },
      {
        id: 'toolbar_background_blur',
        title: getMessage('toolbar_background_blur'),
        type: 'switch'
      },
      {
        id: 'disable_main_page_scroll',
        title: getMessage('disable_main_page_scroll'),
        note: getMessage('disable_main_page_scroll_description'),
        type: 'switch'
      },
      {
        id: 'show_settings_icon',
        title: getMessage('show_settings_icon'),
        type: 'switch'
      },
      {
        id: 'show_quick_settings_icon',
        title: getMessage('show_quick_settings_icon'),
        type: 'switch'
      },
      {
        id: 'show_extension_icon',
        title: getMessage('show_extension_icon'),
        type: 'switch'
      },
      {
        group: [
          {
            id: 'default_folder_id',
            title: getMessage('default_folder_id'),
            note: getMessage('default_folder_sync_note'),
            noteId: 'default_folder_storage_note',
            type: 'vb-select-folders',
            options: []
          },
          {
            id: 'show_last_opened_folder',
            title: getMessage('show_last_opened_folder'),
            type: 'switch',
            data: {
              relationToggleId: 'default_folder_id',
              relationAction: 'disabled'
            }
          }
        ]
      },
      {
        group: [
          {
            id: 'drag_and_drop',
            title: getMessage('drag_and_drop'),
            type: 'switch'
          },
          {
            id: 'home_sort_by',
            title: getMessage('home_sort_by'),
            type: 'select',
            options: [
              { value: 'manual', title: getMessage('manual_sorting') },
              { value: 'date', title: getMessage('sort_by_date') },
              { value: 'alphabet', title: getMessage('sort_by_alphabet') },
              { value: 'usage', title: getMessage('sort_by_usage') }
            ]
          },
          {
            id: 'home_sort_date_direction',
            title: getMessage('sort_direction'),
            type: 'select',
            hidden: true,
            options: [
              { value: 'desc', title: getMessage('newest_first') },
              { value: 'asc', title: getMessage('oldest_first') }
            ]
          },
          {
            id: 'home_sort_alphabet_direction',
            title: getMessage('sort_direction'),
            type: 'select',
            hidden: true,
            options: [
              { value: 'desc', title: getMessage('alphabet_descending') },
              { value: 'asc', title: getMessage('alphabet_ascending') }
            ]
          },
          {
            id: 'home_sort_usage_tiebreaker',
            title: getMessage('usage_tiebreaker'),
            type: 'select',
            hidden: true,
            options: [
              { value: 'alphabet', title: getMessage('sort_by_alphabet') },
              { value: 'date', title: getMessage('sort_by_date') }
            ]
          },
          {
            id: 'show_usage_count',
            title: getMessage('show_usage_count'),
            type: 'switch',
            hidden: true
          }
        ]
      },
      {
        group: [
          {
            id: 'show_home_folders',
            title: getMessage('show_home_folders'),
            type: 'switch'
          },
          {
            id: 'bookmarks_sorting_type',
            title: getMessage('bookmarks_sorting_type'),
            type: 'select',
            options: [
              { value: 'together', title: getMessage('folders_together') },
              { value: 'folders_top', title: getMessage('folders_on_top') },
              { value: 'folders_bottom', title: getMessage('folders_at_the_bottom') }
            ]
          }
        ]
      }
    ]
  },
  {
    key: getMessage('search_settings'),
    description: getMessage('search_settings_description'),
    list: [
      {
        id: 'search_engine',
        title: getMessage('search_engine'),
        type: 'select',
        options: []
      },
      {
        id: 'search_results_display',
        title: getMessage('search_results_display'),
        type: 'select',
        options: [
          {
            value: 'flat',
            title: getMessage('search_results_display_flat')
          },
          {
            value: 'folder_name',
            title: getMessage('search_results_display_folder_name')
          },
          {
            value: 'folder_path',
            title: getMessage('search_results_display_folder_path')
          },
          {
            value: 'grouped',
            title: getMessage('search_results_display_grouped')
          }
        ]
      },
      {
        id: 'navigation_sort_by',
        title: getMessage('navigation_sort_by'),
        type: 'select',
        options: [
          { value: '', title: getMessage('browser_default_order') },
          { value: 'alphabet', title: getMessage('sort_by_alphabet') },
          { value: 'date', title: getMessage('sort_by_date') }
        ]
      },
      {
        id: 'open_bookmarks_newtab',
        title: getMessage('open_bookmarks_newtab'),
        type: 'switch'
      },
      {
        id: 'open_search_newtab',
        title: getMessage('open_search_newtab'),
        type: 'switch'
      },
      {
        id: 'search_autofocus',
        title: getMessage('search_autofocus'),
        type: 'switch'
      },
      {
        id: 'search_engines',
        title: getMessage('search_engines'),
        note: getMessage('search_engines_description'),
        type: 'search-engines'
      }
    ]
  },
  {
    key: getMessage('bookmark_behavior_setting'),
    list: [
      {
        id: 'move_to_start',
        title: getMessage('move_to_start'),
        type: 'switch'
      },
      {
        id: 'show_contextmenu_item',
        title: getMessage('show_contextmenu_item'),
        type: 'switch'
      },
      {
        id: 'close_tab_after_adding_bookmark',
        title: getMessage('close_tab_after_adding_bookmark'),
        note: getMessage('close_tab_after_adding_bookmark_note'),
        type: 'switch'
      },
      {
        id: 'without_confirmation',
        title: getMessage('without_confirmation'),
        type: 'switch'
      }
    ]
  },
  {
    key: getMessage('thumbnails_setting'),
    description: getMessage('thumbnails_setting_description'),
    list: [
      {
        id: 'thumbnails_update_button',
        title: getMessage('thumbnails_update_button'),
        note: getMessage('thumbnails_update_warn'),
        type: 'switch'
      },
      {
        id: 'download_favicons_by_default',
        title: getMessage('download_favicons_by_default'),
        note: getMessage('download_favicons_by_default_note'),
        type: 'switch'
      },
      {
        id: 'favicon_size',
        title: getMessage('favicon_size'),
        note: getMessage('favicon_size_note'),
        type: 'range',
        min: 16,
        max: 128,
        step: 4,
        data: {
          selectorOutput: '#favicon_size_output',
          outputPostfix: 'px'
        }
      },
      {
        id: 'thumbnails_update_delay',
        title: getMessage('thumbnails_update_delay'),
        note: getMessage('thumbnails_update_delay_note'),
        type: 'range',
        min: 0.5,
        max: 15,
        step: 0.5,
        data: {
          selectorOutput: '#thumbnail_delay_output',
          outputPostfix: 's'
        }
      },
      {
        id: 'thumbnails_auto_refresh',
        title: getMessage('thumbnails_auto_refresh'),
        note: getMessage('thumbnails_auto_refresh_note'),
        type: 'switch'
      },
      {
        id: 'thumbnails_auto_refresh_interval',
        title: getMessage('thumbnails_auto_refresh_interval'),
        note: getMessage('thumbnails_auto_refresh_interval_note'),
        type: 'range',
        min: 1,
        max: 168,
        step: 1,
        data: {
          selectorOutput: '#thumbnail_auto_refresh_interval_output',
          outputPostfix: getMessage('hours_short')
        }
      },
      {
        id: 'clear_images',
        title: getMessage('clear_background_locals'),
        type: 'button',
        text: getMessage('btn_apply')
      }
    ]
  },
  {
    key: getMessage('data_privacy_setting'),
    list: [
      {
        id: 'enable_sync',
        title: getMessage('enable_sync'),
        type: 'switch'
      },
      {
        id: 'clear_cache',
        title: getMessage('clear_local_cache'),
        type: 'button',
        text: getMessage('btn_apply')
      },
      {
        id: 'backup',
        title: getMessage('backup_settings'),
        note: getMessage('backup_settings_description'),
        type: 'backup',
        import: { id: 'import', accept: '.backup' },
        export: { id: 'export' }
      },
      {
        id: 'restore_local',
        title: getMessage('reset_local_default'),
        note: getMessage('reset_local_default_description'),
        type: 'button',
        text: getMessage('btn_apply')
      },
      {
        id: 'restore_sync',
        title: getMessage('reset_sync_text'),
        note: getMessage('reset_sync_description'),
        type: 'button',
        text: getMessage('btn_apply')
      },
      {
        id: 'toggle_clipboard_access',
        title: getMessage('toggle_clipboard_access'),
        note: getMessage('toggle_clipboard_access_description'),
        type: 'switch'
      }
    ]
  },
  {
    key: getMessage('keyboard_shortcuts_setting'),
    description: getMessage('keyboard_shortcuts_description'),
    list: [
      {
        id: 'keyboard_shortcuts',
        title: getMessage('keyboard_shortcuts_title'),
        note: getMessage('keyboard_shortcuts_note'),
        type: 'keyboard-shortcuts'
      }
    ]
  }
];

const settingsById = new Map();

legacySettings.forEach(section => {
  section.list.forEach(item => {
    const items = item.group || [item];
    items.forEach(setting => settingsById.set(setting.id, setting));
  });
});

function pickSettings(...ids) {
  return ids.map(id => {
    const setting = settingsById.get(id);
    if (!setting) throw new Error(`Unknown option setting: ${id}`);
    return setting;
  });
}

export default [
  {
    id: 'appearance',
    key: getMessage('settings_appearance'),
    sections: [
      {
        key: getMessage('settings_group_page'),
        list: pickSettings('language', 'color_theme', 'background_image')
      },
      {
        key: getMessage('settings_group_interface'),
        list: pickSettings(
          'show_search',
          'show_folder_picker',
          'toolbar_match_tile_background',
          'toolbar_background_color',
          'toolbar_background_opacity',
          'toolbar_background_blur',
          'show_settings_icon',
          'show_quick_settings_icon',
          'show_extension_icon',
          'show_create_column',
          'show_back_column'
        )
      },
      {
        key: getMessage('settings_group_animations'),
        list: pickSettings(
          'background_entrance_effect',
          'background_entrance_duration',
          'snow_mode',
          'page_cascade_enabled',
          'page_entrance_effect',
          'page_cascade_mode',
          'page_cascade_duration'
        )
      },
      {
        key: getMessage('settings_group_grid'),
        list: pickSettings(
          'dial_columns',
          'dial_width',
          'dial_gap',
          'dial_aspect_ratio',
          'vertical_center',
          'disable_main_page_scroll'
        )
      },
      {
        key: getMessage('settings_group_tile_style'),
        list: pickSettings(
          'dial_radius',
          'dial_shadow',
          'dial_hover_lift',
          'dial_background_color',
          'dial_title_color',
          'dial_background_opacity',
          'dial_background_blur'
        )
      },
      {
        key: getMessage('settings_group_tile_content'),
        list: pickSettings('show_bookmark_title', 'show_favicon', 'folder_preview')
      }
    ]
  },
  {
    id: 'bookmarks',
    key: getMessage('bookmark_appearance_setting'),
    sections: [
      {
        key: getMessage('settings_group_start'),
        list: pickSettings('default_folder_id', 'show_last_opened_folder')
      },
      {
        key: getMessage('settings_group_sorting'),
        list: pickSettings(
          'drag_and_drop',
          'home_sort_by',
          'home_sort_date_direction',
          'home_sort_alphabet_direction',
          'home_sort_usage_tiebreaker',
          'show_usage_count',
          'show_home_folders',
          'bookmarks_sorting_type'
        )
      },
      {
        key: getMessage('settings_group_navigation'),
        list: pickSettings('open_bookmarks_newtab')
      },
      {
        key: getMessage('settings_group_opening'),
        list: pickSettings(
          'move_to_start',
          'show_contextmenu_item',
          'close_tab_after_adding_bookmark',
          'without_confirmation'
        )
      }
    ]
  },
  {
    id: 'search',
    key: getMessage('search_settings'),
    sections: [
      {
        key: getMessage('settings_group_search_behavior'),
        list: pickSettings(
          'search_engine',
          'search_results_display',
          'navigation_sort_by',
          'open_search_newtab',
          'search_autofocus'
        )
      },
      {
        key: getMessage('search_engines'),
        description: getMessage('search_settings_description'),
        list: pickSettings('search_engines')
      }
    ]
  },
  {
    id: 'thumbnails',
    key: getMessage('thumbnails_setting'),
    sections: [
      {
        key: getMessage('settings_group_thumbnail_generation'),
        description: getMessage('thumbnails_setting_description'),
        list: pickSettings(
          'thumbnails_update_button',
          'download_favicons_by_default',
          'favicon_size',
          'thumbnails_update_delay'
        )
      },
      {
        key: getMessage('settings_group_auto_refresh'),
        list: pickSettings('thumbnails_auto_refresh', 'thumbnails_auto_refresh_interval')
      },
      {
        key: getMessage('settings_group_thumbnail_storage'),
        list: pickSettings('clear_images')
      }
    ]
  },
  {
    id: 'controls',
    key: getMessage('settings_controls'),
    sections: [
      {
        key: getMessage('keyboard_shortcuts_setting'),
        description: getMessage('keyboard_shortcuts_description'),
        list: pickSettings('keyboard_shortcuts')
      }
    ]
  },
  {
    id: 'data',
    key: getMessage('data_privacy_setting'),
    sections: [
      {
        key: getMessage('settings_group_sync'),
        list: pickSettings('enable_sync')
      },
      {
        key: getMessage('settings_group_backup'),
        list: pickSettings('backup')
      },
      {
        key: getMessage('settings_group_storage'),
        list: pickSettings('clear_cache')
      },
      {
        key: getMessage('settings_group_permissions'),
        list: pickSettings('toggle_clipboard_access')
      },
      {
        key: getMessage('settings_group_reset'),
        description: getMessage('settings_group_reset_description'),
        danger: true,
        list: pickSettings('restore_local', 'restore_sync')
      }
    ]
  }
];
