const columns = Array.from({ length: 10 }, (_, index) => ({
  value: index + 1,
  title: index + 1
}));

const appearanceSettings = [
  {
    id: 'dial_columns',
    title: browser.i18n.getMessage('number_of_columns'),
    type: 'select',
    options: columns
  },
  {
    id: 'dial_width',
    title: browser.i18n.getMessage('dial_width'),
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
    title: browser.i18n.getMessage('dial_gap'),
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
    title: browser.i18n.getMessage('dial_radius'),
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
    title: browser.i18n.getMessage('dial_aspect_ratio'),
    type: 'select',
    options: [
      {
        value: '1 / 1',
        title: browser.i18n.getMessage('dial_aspect_ratio_square')
      },
      {
        value: '4 / 3',
        title: browser.i18n.getMessage('dial_aspect_ratio_standard')
      },
      {
        value: '3 / 2',
        title: browser.i18n.getMessage('dial_aspect_ratio_photo')
      },
      {
        value: '16 / 9',
        title: browser.i18n.getMessage('dial_aspect_ratio_wide')
      }
    ]
  },
  {
    id: 'dial_shadow',
    title: browser.i18n.getMessage('dial_shadow'),
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
    title: browser.i18n.getMessage('dial_hover_lift'),
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
    title: browser.i18n.getMessage('dial_background_color'),
    note: browser.i18n.getMessage('dial_background_color_note'),
    resetText: browser.i18n.getMessage('reset_tile_background_color'),
    type: 'color'
  },
  {
    id: 'dial_background_opacity',
    title: browser.i18n.getMessage('dial_background_opacity'),
    note: browser.i18n.getMessage('dial_background_opacity_note'),
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
    id: 'vertical_center',
    title: browser.i18n.getMessage('vertical_center'),
    type: 'switch'
  },
  {
    id: 'show_create_column',
    title: browser.i18n.getMessage('show_create_column'),
    type: 'switch'
  },
  {
    id: 'show_back_column',
    title: browser.i18n.getMessage('show_back_column'),
    type: 'switch'
  },
  {
    id: 'show_bookmark_title',
    title: browser.i18n.getMessage('show_bookmark_title'),
    type: 'switch'
  },
  {
    id: 'show_favicon',
    title: browser.i18n.getMessage('show_favicon'),
    type: 'switch'
  },
  {
    id: 'folder_preview',
    title: browser.i18n.getMessage('folder_preview'),
    note: browser.i18n.getMessage('folder_preview_description'),
    type: 'switch'
  }
];

export default [
  {
    key: browser.i18n.getMessage('bookmark_appearance_setting'),
    list: appearanceSettings
  },
  {
    key: browser.i18n.getMessage('page_appearance_setting'),
    list: [
      {
        id: 'color_theme',
        title: browser.i18n.getMessage('color_theme'),
        type: 'select',
        options: [
          { value: 'dark', title: browser.i18n.getMessage('dark_theme') },
          { value: 'light', title: browser.i18n.getMessage('light_theme') },
          { value: 'os', title: browser.i18n.getMessage('os_theme') }
        ]
      },
      {
        id: 'background_image',
        title: browser.i18n.getMessage('background'),
        type: 'select',
        options: [
          { value: 'background_noimage', title: browser.i18n.getMessage('background_noimage') },
          { value: 'background_external', title: browser.i18n.getMessage('background_external') },
          { value: 'background_local', title: browser.i18n.getMessage('background_local') },
          { value: 'background_bing', title: browser.i18n.getMessage('background_bing') }
        ]
      },
      {
        id: 'background_entrance_effect',
        title: browser.i18n.getMessage('background_entrance_effect'),
        type: 'select',
        options: [
          { value: 'none', title: browser.i18n.getMessage('background_entrance_none') },
          { value: 'zoom', title: browser.i18n.getMessage('background_entrance_zoom') },
          { value: 'blur', title: browser.i18n.getMessage('background_entrance_blur') },
          { value: 'slide', title: browser.i18n.getMessage('background_entrance_slide') }
        ]
      },
      {
        id: 'background_entrance_duration',
        title: browser.i18n.getMessage('background_entrance_duration'),
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
        title: browser.i18n.getMessage('snow_mode'),
        type: 'select',
        options: [
          { value: 'always', title: browser.i18n.getMessage('snow_mode_always') },
          { value: 'winter', title: browser.i18n.getMessage('snow_mode_winter') },
          { value: 'off', title: browser.i18n.getMessage('snow_mode_off') }
        ]
      },
      {
        id: 'page_cascade_enabled',
        title: browser.i18n.getMessage('page_cascade_enabled'),
        type: 'switch'
      },
      {
        id: 'page_cascade_mode',
        title: browser.i18n.getMessage('page_cascade_mode'),
        type: 'select',
        options: [
          { value: 'items', title: browser.i18n.getMessage('page_cascade_mode_items') },
          { value: 'rows', title: browser.i18n.getMessage('page_cascade_mode_rows') }
        ]
      },
      {
        id: 'page_cascade_duration',
        title: browser.i18n.getMessage('page_cascade_duration'),
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
        id: 'show_toolbar',
        title: browser.i18n.getMessage('show_toolbar'),
        type: 'switch'
      },
      {
        id: 'disable_main_page_scroll',
        title: browser.i18n.getMessage('disable_main_page_scroll'),
        note: browser.i18n.getMessage('disable_main_page_scroll_description'),
        type: 'switch'
      },
      {
        id: 'show_settings_icon',
        title: browser.i18n.getMessage('show_settings_icon'),
        type: 'switch'
      },
      {
        id: 'show_quick_settings_icon',
        title: browser.i18n.getMessage('show_quick_settings_icon'),
        type: 'switch'
      },
      {
        id: 'show_extension_icon',
        title: browser.i18n.getMessage('show_extension_icon'),
        type: 'switch'
      },
      {
        group: [
          {
            id: 'default_folder_id',
            title: browser.i18n.getMessage('default_folder_id'),
            note: browser.i18n.getMessage('default_folder_sync_note'),
            noteId: 'default_folder_storage_note',
            type: 'vb-select-folders',
            options: []
          },
          {
            id: 'show_last_opened_folder',
            title: browser.i18n.getMessage('show_last_opened_folder'),
            type: 'switch',
            data: {
              relationToggleId: 'default_folder_id',
              relationAction: 'disabled'
            }
          }
        ]
      }
    ]
  },
  {
    key: browser.i18n.getMessage('search_settings'),
    description: browser.i18n.getMessage('search_settings_description'),
    list: [
      {
        id: 'search_engine',
        title: browser.i18n.getMessage('search_engine'),
        type: 'select',
        options: []
      },
      {
        id: 'search_results_display',
        title: browser.i18n.getMessage('search_results_display'),
        type: 'select',
        options: [
          {
            value: 'flat',
            title: browser.i18n.getMessage('search_results_display_flat')
          },
          {
            value: 'folder_name',
            title: browser.i18n.getMessage('search_results_display_folder_name')
          },
          {
            value: 'folder_path',
            title: browser.i18n.getMessage('search_results_display_folder_path')
          },
          {
            value: 'grouped',
            title: browser.i18n.getMessage('search_results_display_grouped')
          }
        ]
      },
      {
        id: 'open_link_newtab',
        title: browser.i18n.getMessage('open_link_newtab'),
        type: 'switch'
      },
      {
        id: 'search_autofocus',
        title: browser.i18n.getMessage('search_autofocus'),
        type: 'switch'
      },
      {
        id: 'search_engines',
        title: browser.i18n.getMessage('search_engines'),
        note: browser.i18n.getMessage('search_engines_description'),
        type: 'search-engines'
      }
    ]
  },
  {
    key: browser.i18n.getMessage('bookmark_behavior_setting'),
    list: [
      {
        id: 'move_to_start',
        title: browser.i18n.getMessage('move_to_start'),
        type: 'switch'
      },
      {
        id: 'drag_and_drop',
        title: browser.i18n.getMessage('drag_and_drop'),
        type: 'switch',
        data: {
          relationToggleId: 'sort_by,bookmarks_sorting_type'
        }
      },
      {
        group: [
          {
            id: 'sort_by',
            title: browser.i18n.getMessage('sort_by'),
            note: browser.i18n.getMessage('bookmarks_sorting_warning'),
            type: 'select',
            options: [
              { value: '', title: browser.i18n.getMessage('not_sorting') },
              { value: 'date', title: browser.i18n.getMessage('sort_by_date') },
              { value: 'alphabet', title: browser.i18n.getMessage('sort_by_alphabet') }
            ],
            data: {
              relationToggleId: 'drag_and_drop',
              relationToggleValues: 'date,alphabet'
            }
          },
          {
            id: 'bookmarks_sorting_type',
            title: browser.i18n.getMessage('bookmarks_sorting_type'),
            note: browser.i18n.getMessage('bookmarks_sorting_warning'),
            type: 'select',
            data: {
              relationToggleId: 'drag_and_drop',
              relationToggleValues: 'folders_top,folders_bottom'
            },
            options: [
              { value: '', title: browser.i18n.getMessage('not_sorting') },
              { value: 'folders_top', title: browser.i18n.getMessage('folders_on_top') },
              { value: 'folders_bottom', title: browser.i18n.getMessage('folders_at_the_bottom') }
            ]
          }
        ]
      },
      {
        id: 'show_contextmenu_item',
        title: browser.i18n.getMessage('show_contextmenu_item'),
        type: 'switch'
      },
      {
        id: 'close_tab_after_adding_bookmark',
        title: browser.i18n.getMessage('close_tab_after_adding_bookmark'),
        note: browser.i18n.getMessage('close_tab_after_adding_bookmark_note'),
        type: 'switch'
      },
      {
        id: 'without_confirmation',
        title: browser.i18n.getMessage('without_confirmation'),
        type: 'switch'
      }
    ]
  },
  {
    key: browser.i18n.getMessage('thumbnails_setting'),
    description: browser.i18n.getMessage('thumbnails_setting_description'),
    list: [
      {
        id: 'thumbnails_update_button',
        title: browser.i18n.getMessage('thumbnails_update_button'),
        note: browser.i18n.getMessage('thumbnails_update_warn'),
        type: 'switch'
      },
      {
        id: 'download_favicons_by_default',
        title: browser.i18n.getMessage('download_favicons_by_default'),
        note: browser.i18n.getMessage('download_favicons_by_default_note'),
        type: 'switch'
      },
      {
        id: 'favicon_size',
        title: browser.i18n.getMessage('favicon_size'),
        note: browser.i18n.getMessage('favicon_size_note'),
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
        title: browser.i18n.getMessage('thumbnails_update_delay'),
        note: browser.i18n.getMessage('thumbnails_update_delay_note'),
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
        title: browser.i18n.getMessage('thumbnails_auto_refresh'),
        note: browser.i18n.getMessage('thumbnails_auto_refresh_note'),
        type: 'switch'
      },
      {
        id: 'thumbnails_auto_refresh_interval',
        title: browser.i18n.getMessage('thumbnails_auto_refresh_interval'),
        note: browser.i18n.getMessage('thumbnails_auto_refresh_interval_note'),
        type: 'range',
        min: 1,
        max: 168,
        step: 1,
        data: {
          selectorOutput: '#thumbnail_auto_refresh_interval_output',
          outputPostfix: browser.i18n.getMessage('hours_short')
        }
      },
      {
        id: 'clear_images',
        title: browser.i18n.getMessage('clear_background_locals'),
        type: 'button',
        text: browser.i18n.getMessage('btn_apply')
      }
    ]
  },
  {
    key: browser.i18n.getMessage('data_privacy_setting'),
    list: [
      {
        id: 'enable_sync',
        title: browser.i18n.getMessage('enable_sync'),
        type: 'switch'
      },
      {
        id: 'clear_cache',
        title: browser.i18n.getMessage('clear_local_cache'),
        type: 'button',
        text: browser.i18n.getMessage('btn_apply')
      },
      {
        id: 'backup',
        title: browser.i18n.getMessage('backup_settings'),
        note: browser.i18n.getMessage('backup_settings_description'),
        type: 'backup',
        import: { id: 'import', accept: '.backup' },
        export: { id: 'export' }
      },
      {
        id: 'restore_local',
        title: browser.i18n.getMessage('reset_local_default'),
        note: browser.i18n.getMessage('reset_local_default_description'),
        type: 'button',
        text: browser.i18n.getMessage('btn_apply')
      },
      {
        id: 'restore_sync',
        title: browser.i18n.getMessage('reset_sync_text'),
        note: browser.i18n.getMessage('reset_sync_description'),
        type: 'button',
        text: browser.i18n.getMessage('btn_apply')
      },
      {
        id: 'toggle_clipboard_access',
        title: browser.i18n.getMessage('toggle_clipboard_access'),
        note: browser.i18n.getMessage('toggle_clipboard_access_description'),
        type: 'switch'
      }
    ]
  }
];
