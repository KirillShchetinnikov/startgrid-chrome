import { getMessage } from '../i18n';

export const FAVICON_GOOGLE = 'https://www.google.com/s2/favicons?sz=32&amp;domain_url=';

export const SVG_LOADER =
`<svg class="loading" id="loading" viewBox="0 0 100 100">` +
  `<defs>` +
    `<linearGradient id="%id%">` +
      `<stop offset="5%" stop-color="#4285f4"></stop>` +
      `<stop offset="95%" stop-color="#b96bd6"></stop>` +
    `</linearGradient>` +
  `</defs>` +
  `<circle class="path" fill="none" stroke="url(#%id%)" stroke-width="8" stroke-linecap="round" cx="50" cy="50" r="40"></circle>` +
`</svg>`;

export const SERVICES_COUNT = 20;

export const REGEXP_URL_PATTERN = /^(https?|ftp|file|edge|chrome|(chrome-)?extension):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?$/i;

export const THUMBNAIL_POPUP_WIDTH = 1170;
export const THUMBNAIL_POPUP_HEIGHT = 720;

export const FILES_ALLOWED_EXTENSIONS = [
  'avif',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'png',
  'svg',
  'mp4'
];
export const MAX_FILE_SIZE_BYTES = 50 * (10 ** 6);

export const CONTEXT_MENU = [
  {
    action: 'new_tab',
    title: getMessage('contextmenu_tab')
  },
  {
    action: 'new_window',
    title: getMessage('contextmenu_window')
  },
  {
    action: 'new_window_incognito',
    title: getMessage('contextmenu_incognito'),
    isBookmark: true
  },
  {
    action: 'open_all',
    title: getMessage('contextmenu_open_all'),
    isFolder: true
  },
  {
    action: 'open_all_window',
    title: getMessage('contextmenu_open_all_window'),
    isFolder: true
  },
  {
    divider: true
  },
  {
    action: 'copy_link',
    title: getMessage('contextmenu_copy_link'),
    icon: `<svg height="24" width="24" fill="currentColor"><use xlink:href="/img/symbol.svg#copy_outline"/></svg>`,
    isBookmark: true
  },
  {
    action: 'edit',
    title: getMessage('contextmenu_edit'),
    icon: '<svg height="24" width="24" fill="currentColor"><use xlink:href="/img/symbol.svg#edit_outline"/></svg>'
  },
  {
    divider: true
  },
  {
    action: 'remove',
    title: getMessage('contextmenu_remove'),
    icon: '<svg height="24" width="24" fill="currentColor"><use xlink:href="/img/symbol.svg#delete_outline"/></svg>'
  }
];

export const NEWTAB_URLS = [
  'edge://newtab/',
  'chrome://newtab/',
  browser.runtime.getURL('newtab.html')
];

export const NEWTAB_EMPTY_URLS = [
  'edge://newtab/',
  'chrome://newtab/',
  'about:blank'
];

export const DEFAULT_FOLDER = '1';

/**
 * Browser root folders
 * @type {string[]}
 * Chrome bookmark tree root.
 */
export const ROOT_FOLDERS = ['0'];

export const LOCAL_PROTOCOLS = [
  'file:///',
  'edge://',
  'chrome://'
];

export const DEFAULT_BOOKMARKS_FOLDER = DEFAULT_FOLDER;
