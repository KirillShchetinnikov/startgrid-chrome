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
  },
  {
    id: 'logo_external',
    title: browser.i18n.getMessage('logo_external'),
    note: browser.i18n.getMessage('logo_external_note'),
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
        id: 'background_effect',
        title: browser.i18n.getMessage('background_effect'),
        note: browser.i18n.getMessage('background_effect_note'),
        type: 'select',
        hidden: true,
        options: [
          { value: 'none', title: browser.i18n.getMessage('background_effect_none') },
          { value: 'distortion', title: browser.i18n.getMessage('background_effect_distortion') }
        ]
      },
      {
        group: [
          {
            id: 'show_toolbar',
            title: browser.i18n.getMessage('show_toolbar'),
            type: 'switch'
          },
          {
            id: 'search_autofocus',
            title: browser.i18n.getMessage('search_autofocus'),
            type: 'switch'
          }
        ]
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
      },
      {
        id: 'search_engine',
        title: browser.i18n.getMessage('search_engine'),
        type: 'select',
        options: []
      },
      {
        id: 'open_link_newtab',
        title: browser.i18n.getMessage('open_link_newtab'),
        type: 'switch'
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
        id: 'auto_generate_thumbnail',
        title: browser.i18n.getMessage('auto_generate_thumbnail'),
        type: 'switch'
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
        id: 'thumbnails_update_recursive',
        title: browser.i18n.getMessage('thumbnails_update_recursive'),
        note: browser.i18n.getMessage('thumbnails_update_recursive_note', [
          browser.i18n.getMessage('thumbnails_update_button')
        ]),
        type: 'switch'
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
        type: 'button',
        text: browser.i18n.getMessage('btn_apply')
      },
      {
        id: 'restore_sync',
        title: browser.i18n.getMessage('reset_sync_text'),
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
