import '../css/newtab.css';
import './components/vb-select';
import './components/vb-context-menu';
import './components/vb-scrollup';
import './components/vb-bookmarks-panel';

import Gmodal from 'glory-modal';
import { settings } from './settings';
import Bookmarks from './components/bookmarks';
import Localization from './plugins/localization';
import { Validator } from './plugins/validator';
import UI from './components/ui';
import Ripple from './components/ripple';
import confirmPopup from './plugins/confirmPopup';
import { letItSnow } from './plugins/snow';
import {
  get,
  getSubTree,
  flattenArrayBookmarks,
  getFolders
} from './api/bookmark';
import {
  $createElement,
  $copyStr,
  $unescapeHtml,
  $notifications,
  checkClipboardImage
} from './utils';
import ImageDB from './api/imageDB';
import {
  getFaviconSizeOverride,
  shouldDownloadFavicon
} from './api/faviconPreferences';
import { CONTEXT_MENU, LOCAL_PROTOCOLS } from './constants';
import { bookmarksToDelete } from './state';
import Toast from './components/toast';
import { containsPermissions } from './api/permissions';
import { getCurrentFolderId, navigateToFolder } from './folderNavigation';
import initQuickDisplaySettings from './components/quickDisplaySettings';

const container = document.getElementById('bookmarks');
const modal = document.getElementById('modal');
const form = document.getElementById('formBookmark');
const modalHead = document.getElementById('modalHead');
const modalSelectFolders = document.getElementById('modalSelectFolders');
const titleField = document.getElementById('title');
const urlField = document.getElementById('url');
const urlWrap = document.getElementById('urlWrap');
const customScreen = document.getElementById('customScreen');
const thumbnailSource = document.getElementById('thumbnailSource');
const thumbnailUrl = document.getElementById('thumbnailUrl');
const faviconOptionsWrap = document.getElementById('faviconOptionsWrap');
const faviconDownloadPreference = document.getElementById('faviconDownloadPreference');
const thumbnailFaviconSize = document.getElementById('thumbnailFaviconSize');
const thumbnailUrlWrap = document.getElementById('thumbnailUrlWrap');
const thumbnailActions = document.getElementById('thumbnailActions');
const captureThumbnailButton = document.getElementById('captureThumbnail');
const uploadThumbnailButton = document.getElementById('uploadThumbnail');
const pasteThumbnailButton = document.getElementById('pasteThumbnail');
const deleteThumbnailButton = document.getElementById('deleteThumbnail');
const resetCustomImageButton = document.getElementById('resetCustomImage');
const ctxMenuEl = document.getElementById('context-menu');
const upload = document.getElementById('upload');
const asideControlsNode = document.getElementById('aside_controls');
const extensionIconNode = document.getElementById('extension_icon');
let multipleSelectedBookmarks = [];
let lastSelectedBookmark = null;
let isGenerateThumbs = false;
let modalApi;
let generateThumbsBtn = null;
let pendingThumbnailBlob = null;
let pendingThumbnailSource = null;

function updateExtensionIconVisibility(visible) {
  extensionIconNode.hidden = !visible;
  document.body.classList.toggle('has-extension-icon', visible);
}

function updateThumbnailControls(folderId) {
  const enabled = Bookmarks.isDefaultFolder(folderId);
  if (generateThumbsBtn) {
    generateThumbsBtn.hidden = !enabled;
  }
  return enabled;
}

async function init() {
  // Set lang attr
  // Replacement underscore on the dash because underscore is not a valid language subtag
  document.documentElement.setAttribute(
    'lang',
    browser.i18n.getMessage('@@ui_locale').replace('_', '-')
  );

  window.addEventListener('resize', () => UI.calculateStyles());
  window.addEventListener('popstate', handlePopstate);
  window.addEventListener('beforeunload', handleBeforeUnload);
  window.addEventListener('pagehide', handlePagehide);
  window.addEventListener('storage', handleUpdateStorage);
  window.addEventListener('load', handleLoad);
  document.addEventListener('changeFolder', hideControlMultiplyBookmarks);
  document.addEventListener('changeFolder', ({ detail }) => {
    updateThumbnailControls(detail.folderId);
  });

  /**
   * Settings
   */
  await settings.init();
  updateExtensionIconVisibility(settings.$.show_extension_icon);

  /**
   * UI
   */
  UI.calculateStyles();
  UI.setBG();

  /**
   * Localization
   */
  Localization();

  /**
   * Ripple
   */
  Ripple.init('.md-ripple');

  Bookmarks.init();

  modalApi = new Gmodal(modal, {
    stickySelectors: ['.sticky'],
    closeBackdrop: false
  });
  modalApi.element.addEventListener('gmodal:open', () => {
    // UX focus when modal open
    if (form.getAttribute('data-action') === 'New') {
      form.elements.title.focus();
    } else {
      form.elements.title.select();
    }
  });
  const modalPermissionsApi = new Gmodal('#modal-host-permissions', {
    stickySelectors: ['.sticky'],
    closeBackdrop: false
  });

  const formBookmarkEl = document.getElementById('formBookmark');

  Validator(formBookmarkEl, {
    onSuccess: handleSubmitForm
  });

  upload.addEventListener('change', handleUploadScreen);
  thumbnailSource.addEventListener('change', handleThumbnailSourceChange);
  captureThumbnailButton.addEventListener('click', handleCaptureThumbnail);
  uploadThumbnailButton.addEventListener('click', handleModalUploadThumbnail);
  pasteThumbnailButton.addEventListener('click', handleModalPasteThumbnail);
  deleteThumbnailButton.addEventListener('click', handleModalDeleteThumbnail);
  container.addEventListener('click', handleDelegateClick);
  container.addEventListener('mousedown', handleOpenMousemiddle);
  ctxMenuEl.addEventListener('vb:contextmenu:select', handleMenuSelection);
  ctxMenuEl.addEventListener('vb:contextmenu:open', handleMenuOpen);
  document.getElementById('resetCustomImage').addEventListener('click', handleResetThumb);
  modal.addEventListener('gmodal:close', handleCloseModal);

  if (settings.$.show_quick_settings_icon) {
    initQuickDisplaySettings({
      container: asideControlsNode,
      onRerender: () => Bookmarks.refresh(),
      onExtensionIconVisibilityChange: updateExtensionIconVisibility
    });
  }

  if (settings.$.show_settings_icon) {
    asideControlsNode.append($createElement('a', {
      id: 'settings_icon',
      class: 'circ-btn settings-link md-ripple',
      ariaLabel: browser.i18n.getMessage('options'),
      href: 'options.html'
    }, {
      html: '<svg width="20" height="20"><use xlink:href="/img/symbol.svg#settings"/></svg>'
    }));
  }

  // scrollup button component
  document.getElementById('aside_controls').insertAdjacentElement(
    'afterend',
    $createElement('vb-scrollup', { class: 'sticky', 'scroll-selector': '.app' })
  );

  // If thumbnail generation button
  if (settings.$.thumbnails_update_button) {
    generateThumbsBtn = $createElement('button', {
      class: 'circ-btn update-thumbnails',
      'aria-label': browser.i18n.getMessage('thumbnails_update')
    }, {
      html: `<svg width="20" height="20"><use xlink:href="/img/symbol.svg#capture_fill"/></svg>`
    });
    document.getElementById('aside_controls').appendChild(generateThumbsBtn);
    updateThumbnailControls();

    // Thumbnail generation tracking events
    // Switching the flag in the local storage to prevent multiple launches
    // Reset the flag when you close the window
    if (localStorage.getItem('update_thumbnails') === 'true') {
      // if the storage has a launch flag for generating thumbnails, disable button
      generateThumbsBtn.disabled = true;
    }
    container.addEventListener('thumbnails:updating', function() {
      isGenerateThumbs = true;
      generateThumbsBtn.disabled = true;
      localStorage.setItem('update_thumbnails', true);
    });
    container.addEventListener('thumbnails:updated', function() {
      isGenerateThumbs = false;
      generateThumbsBtn.disabled = false;
      localStorage.removeItem('update_thumbnails');
    });
    generateThumbsBtn.addEventListener('click', handleGenerateThumbs);
  }

  // if tab with bookmarks is open, but hidden, we need to reload, after updating thumbnails
  browser.runtime.onMessage.addListener(function(request) {
    if (request.bookmarksUpdated && document.hidden) {
      window.location.reload();
    }
  });

  // import(/* webpackChunkName: "webcomponents/vb-actions-panel" */'./components/vb-bookmarks-panel');
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-permissions-info]')) return;
    modalPermissionsApi.open();
  });
  container.addEventListener('click', handleSelectBookmark);
  document.addEventListener('vb-bookmarks-panel:action', handleMultipleBookmarks);
  document.addEventListener('vb-bookmarks-panel:close', hideControlMultiplyBookmarks);
  document.addEventListener('vb:search', hideControlMultiplyBookmarks);
  document.addEventListener('vb:searchreset', hideControlMultiplyBookmarks);
  document.addEventListener('keydown', ({ code }) => {
    code === 'Escape' && hideControlMultiplyBookmarks();
  });
}

function handleSelectBookmark(e) {
  if (isGenerateThumbs) return;
  const bookmark = e.target.closest('.bookmark');
  if (!bookmark) return true;

  if (!e.shiftKey) return true;

  e.preventDefault();

  let rangeBookmarks = [];
  const isSelected = bookmark.hasAttribute('data-selected');

  if (e.ctrlKey || e.metaKey) {
    const bookmarkNodes = Array.from(document.querySelectorAll('.bookmark'));
    // find a range of bookmarks
    const startIndex = bookmarkNodes.findIndex(bookmarkNode => bookmarkNode === bookmark);
    const endIndex = bookmarkNodes.findIndex(bookmarkNode => bookmarkNode === (lastSelectedBookmark ?? bookmark));
    rangeBookmarks = bookmarkNodes.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1);
  } else {
    rangeBookmarks = [bookmark];
  }

  rangeBookmarks.forEach(rangeBookmark => {
    if (isSelected) {
      rangeBookmark.removeAttribute('data-selected');
      multipleSelectedBookmarks = multipleSelectedBookmarks.filter(bs => bs !== rangeBookmark);
    } else {
      rangeBookmark.setAttribute('data-selected', '');
      // add to the array a range of bookmarks that do not exist yet
      !multipleSelectedBookmarks.includes(rangeBookmark) && multipleSelectedBookmarks.push(rangeBookmark);
    }
  });

  if (multipleSelectedBookmarks.length) {
    lastSelectedBookmark = bookmark;
    showControlMultiplyBookmarks();
  } else {
    lastSelectedBookmark = null;
    hideControlMultiplyBookmarks();
  }
}

function dispatchSelectedBookmarks() {
  document.dispatchEvent(
    new CustomEvent('vb:bookmarks:select', {
      detail: multipleSelectedBookmarks
    })
  );
}

async function showControlMultiplyBookmarks() {
  dispatchSelectedBookmarks();

  if (document.getElementById('bookmarks-panel')) return;

  const vbBookmarksPanel = $createElement('vb-bookmarks-panel', {
    id: 'bookmarks-panel',
    class: 'bookmarks-panel'
  });
  vbBookmarksPanel.selectedFolder = getCurrentFolderId() || settings.defaultFolderId;
  vbBookmarksPanel.allowThumbnailUpdates = Bookmarks.isDefaultFolder();
  vbBookmarksPanel.folders = await getFolders();

  document.body.append(vbBookmarksPanel);
  vbBookmarksPanel.show();
}

async function hideControlMultiplyBookmarks() {
  const vbBookmarksPanel = document.getElementById('bookmarks-panel');
  if (!vbBookmarksPanel) return;
  // we need reset reset lastSelectedBookmark
  lastSelectedBookmark = null;

  multipleSelectedBookmarks.forEach(bookmark => delete bookmark.dataset.selected);
  multipleSelectedBookmarks.length = 0;

  dispatchSelectedBookmarks();

  await vbBookmarksPanel.hide();
  vbBookmarksPanel.remove();
}

function handleMultipleBookmarks(evt) {
  const { action, destFolder } = evt.detail;

  if (!action) return;
  if (action === 'update_thumbnails' && !Bookmarks.isDefaultFolder()) {
    return;
  }

  switch (action) {
    case 'open_all':
    case 'open_all_window':
    case 'new_window_incognito': openSelectedBookmarks(multipleSelectedBookmarks, action); break;
    case 'remove': removeSelectedBookmarks(multipleSelectedBookmarks); break;
    case 'update_thumbnails': updateSelectedThumbnails(multipleSelectedBookmarks); break;
    case 'move_bookmarks': movedSelectedBookmarks(multipleSelectedBookmarks, destFolder); break;
    default: break;
  }
}

async function movedSelectedBookmarks(multipleSelectedBookmarks, destFolder) {
  await Bookmarks.moveSelectedBookmarks(multipleSelectedBookmarks, destFolder);
  hideControlMultiplyBookmarks();
}

async function updateSelectedThumbnails(multipleSelectedBookmarks) {
  if (!(await Bookmarks.checkHostPermissions())) {
    return;
  }

  await Bookmarks.updateSelectedThumbnails(multipleSelectedBookmarks);
  hideControlMultiplyBookmarks();
}

function handleLoad() {
  letItSnow();
}

function handlePopstate() {
  // when navigating through the history
  // hide the context menu or the modal window if they are active
  ctxMenuEl.close();
  modalApi.close();
}

function handleBeforeUnload(evt) {
  // if generate thumbs exist
  // if (bookmarksToDelete.size > 0) {
  browser.runtime.sendMessage({
    bookmarksToDelete
  });
  // }

  if (localStorage.getItem('update_thumbnails') !== null && isGenerateThumbs)
    return evt.returnValue = 'Are you shure?';
}

function handlePagehide() {
  // remove flag from storage to unlock button generate
  if (isGenerateThumbs) {
    localStorage.removeItem('update_thumbnails');
  }

  // browser.runtime.sendMessage({
  //   bookmarksToDelete
  // });
}

function handleUpdateStorage(e) {
  // If several tabs are open, on the rest of them we will update the attribute at the button
  if (e.key === 'update_thumbnails' && generateThumbsBtn) {
    generateThumbsBtn.disabled = !!e.newValue;
  }
}

async function handleGenerateThumbs() {
  if (!Bookmarks.isDefaultFolder()) return;

  if (!(await Bookmarks.checkHostPermissions())) {
    return;
  }

  // method to start generating all bookmark thumbnails
  if (this.hasAttribute('disabled') || localStorage.getItem('update_thumbnails') !== null) return;

  Bookmarks.autoUpdateThumb();
}

async function handleDelegateClick(evt) {
  const searchFolder = evt.target.closest('[data-search-folder-id]');

  if (searchFolder) {
    evt.preventDefault();
    navigateToFolder(searchFolder.dataset.searchFolderId, true);
  } else if (evt.target.closest('#bookmark-back')) {
    evt.preventDefault();
    navigateToFolder(container.dataset.parentFolder);
  } else if (evt.target.closest('#add')) {
    evt.preventDefault();
    await prepareModal();
    modalApi.open();
  } else if (evt.target.closest('.bookmark__action')) {
    evt.preventDefault();
    evt.stopPropagation();
    ctxMenuEl.trigger(evt);
  } else if (evt.target.closest('[data-folder-id]')) {
    evt.preventDefault();
    navigateToFolder(evt.target.closest('[data-folder-id]').dataset.folderId);
  } else if (evt.target.closest('.bookmark')) {
    const bookmark = evt.target.closest('.bookmark');
    const url = bookmark.href;

    if (bookmark.isFolder && !evt.shiftKey && !evt.ctrlKey && !evt.metaKey && !evt.altKey) {
      evt.preventDefault();
      navigateToFolder(bookmark.id);
      return;
    }

    if (checkLocalProtocol(url) && !evt.shiftKey) {
      evt.preventDefault();
      openLocalProtocol(url);
    }
  }
}

function handleOpenMousemiddle(evt) {
  if (evt.target.closest('.bookmark') && evt.button === 1) {
    const url = evt.target.closest('.bookmark').href;

    if (checkLocalProtocol(url)) {
      evt.preventDefault();
      openLocalProtocol(url);
    }
  }
}

function checkLocalProtocol(url) {
  return LOCAL_PROTOCOLS.some(proto => url.startsWith(proto));
}

function openLocalProtocol(url) {
  const open = settings.$.open_link_newtab ? browser.tabs.create : browser.tabs.update;

  open({
    url
  });
}

function handleMenuOpen(evt) {
  // when opening the context menu,
  // hide the quick action bar to avoid side effects
  hideControlMultiplyBookmarks();

  let items;
  if (evt.detail.isFolder) {
    items = CONTEXT_MENU.filter(item => !item.isBookmark);
  } else {
    items = CONTEXT_MENU.filter(item => !item.isFolder);
  }
  // render menu items
  ctxMenuEl.listItems = items;
}

async function handleMenuSelection(evt) {
  const target = evt.detail.trigger;
  const action = evt.detail.selection;

  switch (action) {
    case 'new_window':
    case 'new_window_incognito':
      openWindow(target.href, action);
      break;
    case 'open_all':
    case 'open_all_window':
      openAll(target.id, action);
      break;
    case 'new_tab':
      openTab(target.href);
      break;
    case 'edit':
      await prepareModal(target);
      modalApi.open();
      break;
    case 'copy_link':
      $copyStr(target.href);
      Toast.show(browser.i18n.getMessage('notice_link_copied'));
      break;
    case 'remove': {
      Bookmarks.removeBookmark(target, target.isFolder);
      break;
    }
  }
}

async function handleUploadScreen(evt) {
  evt.preventDefault();

  const input = evt.target;
  const file = input.files[0];
  const { id } = input.dataset;
  const bookmark = document.getElementById(`vb-${id}`);

  if (!file) return;

  input.value = '';
  const blob = new Blob([new Uint8Array(await file.arrayBuffer())], {
    type: file.type
  });

  if (id === 'New') {
    pendingThumbnailBlob = blob;
    pendingThumbnailSource = 'local';
    delete input.dataset.modal;
    showModalBlob(blob);
    handleThumbnailSourceChange();
    return;
  }

  if (!bookmark) return;

  await Bookmarks.uploadScreen(bookmark, blob);
  if (input.dataset.modal === 'true') {
    delete input.dataset.modal;
    thumbnailSource.value = 'local';
    handleThumbnailSourceChange();
    await showModalThumbnail(id);
  }
}

async function readClipboardImage() {
  try {
    const [clipboardItem] = await navigator.clipboard.read();
    const imageType = clipboardItem.types.find(type => type.startsWith('image/'));

    if (!imageType) {
      return null;
    }

    return await clipboardItem.getType(imageType);
  } catch (err) {
    console.error(err.name, err.message);
    return null;
  }
}

function showModalBlob(blob, id = null) {
  const imgElement = customScreen.querySelector('img');
  const image = URL.createObjectURL(blob);

  customScreen.style.display = 'block';
  imgElement.onload = () => URL.revokeObjectURL(image);
  imgElement.src = image;
  if (id) {
    resetCustomImageButton.setAttribute('data-bookmark', id);
  } else {
    resetCustomImageButton.removeAttribute('data-bookmark');
  }
  deleteThumbnailButton.disabled = false;
}

async function showModalThumbnail(id, showStoredImage = true) {
  const imageData = await ImageDB.get(id);
  if (!imageData?.blob || !showStoredImage) {
    customScreen.style.display = '';
    deleteThumbnailButton.disabled = true;
    return;
  }

  showModalBlob(imageData.blob, id);
}

function getModalBookmark() {
  return document.getElementById(`vb-${form.getAttribute('data-action')}`);
}

async function handleCaptureThumbnail() {
  const source = thumbnailSource.value;
  const bookmark = getModalBookmark();
  const pageUrl = urlField.value.trim();
  const remoteUrl = thumbnailUrl.value.trim();

  if (!bookmark) {
    if (!pageUrl || !urlField.checkValidity()) {
      urlField.reportValidity();
      return;
    }
    if (source === 'url' && (!remoteUrl || !thumbnailUrl.checkValidity())) {
      thumbnailUrl.reportValidity();
      return;
    }

    const permission = await Bookmarks.checkHostPermissions();
    if (!permission) return;

    const blob = source === 'site'
      ? await Bookmarks.captureThumbnailBlob(pageUrl, permission)
      : await Bookmarks.fetchThumbnailBlob(
        source === 'favicon' ? pageUrl : remoteUrl,
        permission,
        {
          source,
          sourceUrl: source === 'favicon' ? pageUrl : remoteUrl
        }
      );
    if (blob) {
      pendingThumbnailBlob = blob;
      pendingThumbnailSource = source;
      if (source === 'favicon') faviconDownloadPreference.value = 'download';
      showModalBlob(blob);
      handleThumbnailSourceChange();
    }
    return;
  }

  if (['site', 'favicon'].includes(source) && (!pageUrl || !urlField.checkValidity())) {
    urlField.reportValidity();
    return;
  }
  if (source === 'url' && (!remoteUrl || !thumbnailUrl.checkValidity())) {
    thumbnailUrl.reportValidity();
    return;
  }

  let response;
  if (source === 'site') {
    const permission = await Bookmarks.checkHostPermissions();
    if (!permission) return;
    const blob = await Bookmarks.captureThumbnailBlob(pageUrl, permission);
    if (blob) {
      await Bookmarks.uploadScreen(bookmark, blob, {
        source: 'site',
        custom: false,
        showNotice: false
      });
      response = { success: true };
    }
  } else if (source === 'url') {
    const permission = await Bookmarks.checkHostPermissions();
    if (!permission) return;
    response = await Bookmarks.setRemoteThumbnail(bookmark, remoteUrl);
  } else if (source === 'favicon') {
    const permission = await Bookmarks.checkHostPermissions();
    if (!permission) return;
    response = await Bookmarks.setFaviconThumbnailSource(bookmark, pageUrl);
  }

  if (response && !response.warning && response.success !== false) {
    if (source === 'favicon') faviconDownloadPreference.value = 'download';
    form.dataset.oldThumbnailSource = source;
    form.dataset.oldThumbnailUrl = remoteUrl;
    if (['site', 'favicon'].includes(source)) {
      form.dataset.oldUrl = pageUrl;
    }
    form.dataset.thumbnailHasImage = 'true';
    handleThumbnailSourceChange();
    await showModalThumbnail(bookmark.id);
  }
}

function handleModalUploadThumbnail() {
  upload.dataset.id = form.getAttribute('data-action');
  upload.dataset.modal = 'true';
  upload.click();
}

async function handleModalPasteThumbnail() {
  if (!(await containsPermissions({ permissions: ['clipboardRead'] }))) return;

  const blob = await readClipboardImage();
  if (!blob) return;

  const bookmark = getModalBookmark();
  if (!bookmark) {
    pendingThumbnailBlob = blob;
    pendingThumbnailSource = 'local';
    showModalBlob(blob);
    handleThumbnailSourceChange();
    return;
  }

  await Bookmarks.uploadScreen(bookmark, blob);
  thumbnailSource.value = 'local';
  handleThumbnailSourceChange();
  await showModalThumbnail(bookmark.id);
}

function handleModalDeleteThumbnail(evt) {
  handleResetThumb.call(evt.currentTarget, evt);
}

function handleCloseModal() {
  modal.classList.remove('has-edit', 'has-add');
  customScreen.style.display = '';
  delete form.dataset.oldUrl;
  delete form.dataset.oldThumbnailSource;
  delete form.dataset.oldThumbnailUrl;
  delete form.dataset.thumbnailHasImage;
  delete form.dataset.thumbnailEnabled;
  pendingThumbnailBlob = null;
  pendingThumbnailSource = null;
  deleteThumbnailButton.disabled = true;
  form.reset();
}

function handleThumbnailSourceChange() {
  const enabled = form.dataset.thumbnailEnabled === 'true';
  if (!enabled) {
    document.getElementById('thumbnailSourceWrap').hidden = true;
    thumbnailUrlWrap.hidden = true;
    thumbnailUrl.required = false;
    faviconOptionsWrap.hidden = true;
    thumbnailActions.hidden = true;
    customScreen.style.display = '';
    resetCustomImageButton.hidden = true;
    return;
  }

  resetCustomImageButton.hidden = false;
  const source = thumbnailSource.value;
  const isNew = form.getAttribute('data-action') === 'New';
  const isUrl = source === 'url';
  const isLocal = source === 'local';
  const isRefreshable = ['site', 'url', 'favicon'].includes(source);

  faviconOptionsWrap.hidden = source !== 'favicon';
  thumbnailUrlWrap.hidden = !isUrl;
  thumbnailUrl.required = isUrl;
  captureThumbnailButton.hidden = !isRefreshable;
  captureThumbnailButton.textContent = browser.i18n.getMessage(
    isNew && source === 'site' ? 'thumbnail_source_site' : 'contextmenu_capture'
  );
  uploadThumbnailButton.hidden = !isLocal;
  pasteThumbnailButton.hidden = !isLocal;
  deleteThumbnailButton.hidden = false;
  resetCustomImageButton.hidden = false;
  thumbnailActions.hidden = false;

  if (isNew) {
    const hasMatchingPreview = pendingThumbnailBlob && pendingThumbnailSource === source;
    customScreen.style.display = hasMatchingPreview ? 'block' : '';
  }
}

async function removeSelectedBookmarks(multipleSelectedBookmarks) {
  // if (!settings.$.without_confirmation) {
  //   const confirmAction = await confirmPopup(browser.i18n.getMessage('confirm_delete_selected_bookmarks'));
  //   if (!confirmAction) return;
  // }
  // await Promise.all(
  //   multipleSelectedBookmarks.map(bookmark => {
  //     return Bookmarks.removeFromBrowser(bookmark, bookmark.isFolder);
  //   })
  // );

  const selectedBookmarks = [...multipleSelectedBookmarks];
  const confirm = await Bookmarks.removeMultipleBookmarks(selectedBookmarks);
  confirm && hideControlMultiplyBookmarks();
}

function openSelectedBookmarks(multipleSelectedBookmarks, action) {
  if (['open_all_window', 'new_window_incognito'].includes(action)) {
    const isIncognitoMode = action === 'new_window_incognito';
    browser.windows.create({
      focused: true,
      state: 'maximized',
      incognito: isIncognitoMode
    })
      .then(win => {
        multipleSelectedBookmarks.forEach(bookmark => {
          openTab(bookmark.url, { windowId: win.id });
        });
      })
      .catch(() => {
        isIncognitoMode && $notifications(browser.i18n.getMessage('incognito_access_note'));
      });
  } else if (action === 'open_all') {
    multipleSelectedBookmarks.forEach(bookmark => {
      openTab(bookmark.url);
    });
  }
}

/**
 * Open all bookmarks from a folder
 * @param {string} id - folder id
 * @param {string} action - action to run
 */
function openAll(id, action) {
  getSubTree(id)
    .then(childrens => {
      if (!childrens.length) return;

      const bookmarks = flattenArrayBookmarks(childrens);

      if (action === 'open_all_window') {
        browser.windows.create({
          focused: true
        })
          .then(win => {
            bookmarks.forEach(bookmark => openTab(bookmark.url, { windowId: win.id }));
          });
      } else {
        bookmarks.forEach(bookmark => openTab(bookmark.url));
      }
    });
}

/**
 * Open a bookmark in a new window
 * @param {string} url - bookmark URL
 * @param {string} action - action to run
 */
function openWindow(url, action) {
  const isIncognitoMode = action === 'new_window_incognito';

  browser.windows.create({
    url: url,
    state: 'maximized',
    incognito: isIncognitoMode
  })
    .catch(() => {
      isIncognitoMode && $notifications(browser.i18n.getMessage('incognito_access_note'));
    });
}

/**
 * Open a bookmark in a new tab
 * @param {string} url - bookmark URL
 * @param {object} [options={}] - options for creating a tab
 * @param {boolean} [options.active]
 * @param {number} [options.index]
 * @param {number} [options.openerTabId]
 * @param {boolean} [options.pinned]
 * @param {string} [options.url]
 * @param {number} [options.windowId]
 */
function openTab(url, options = {}) {
  if (url.startsWith('#')) {
    url = `newtab.html${url}`;
  }

  const defaults = {
    url: url,
    active: false
  };
  try {
    browser.tabs.create({
      ...defaults,
      ...options
    });
  } catch (e) {}
}

function getModalFaviconPreferences() {
  const downloadPreference = faviconDownloadPreference.value;
  let downloadFavicon = null;
  if (downloadPreference === 'download') downloadFavicon = true;
  if (downloadPreference === 'chrome') downloadFavicon = false;

  return {
    downloadFavicon,
    faviconSize: getFaviconSizeOverride(thumbnailFaviconSize.value)
  };
}

function usesDownloadedFavicon(preferences = getModalFaviconPreferences()) {
  return shouldDownloadFavicon(preferences, settings.$.download_favicons_by_default);
}

async function handleSubmitForm(evt) {
  const form = evt.target;
  evt.preventDefault();
  const id = form.getAttribute('data-action');
  const title = form.title.value.trim();
  const url = form.url.value.trim();
  const destinationFolderId = id === 'New'
    ? container.dataset.folder
    : modalSelectFolders.value;
  const thumbnailEnabled = Bookmarks.isDefaultFolder(destinationFolderId);
  const thumbnailSourceValue = form.thumbnailSource.value;
  const thumbnailUrlValue = form.thumbnailUrl.value.trim();
  const faviconPreferences = getModalFaviconPreferences();
  const downloadFavicon = usesDownloadedFavicon(faviconPreferences);
  const shouldCaptureSite = thumbnailEnabled && thumbnailSourceValue === 'site' && (
    id === 'New'
      ? pendingThumbnailSource !== 'site'
      : form.dataset.oldThumbnailSource !== 'site'
        || form.dataset.oldUrl !== url
        || form.dataset.thumbnailHasImage !== 'true'
  );
  const shouldFetchUrl = thumbnailEnabled && thumbnailSourceValue === 'url' && (
    id === 'New'
      ? pendingThumbnailSource !== 'url'
      : form.dataset.oldThumbnailSource !== 'url'
        || form.dataset.oldThumbnailUrl !== thumbnailUrlValue
        || form.dataset.thumbnailHasImage !== 'true'
  );
  const shouldFetchFavicon = thumbnailEnabled && thumbnailSourceValue === 'favicon' && downloadFavicon && (
    id === 'New'
      ? pendingThumbnailSource !== 'favicon'
      : form.dataset.oldThumbnailSource !== 'favicon'
        || form.dataset.oldUrl !== url
        || form.dataset.thumbnailHasImage !== 'true'
  );

  let bookmark = false;
  let thumbnailPermission = false;

  if (
    url
    && (shouldFetchUrl || shouldCaptureSite || shouldFetchFavicon)
  ) {
    thumbnailPermission = await Bookmarks.checkHostPermissions();
    if (!thumbnailPermission) return;
  }

  if (id !== 'New') {
    const newLocation = modalSelectFolders.value;
    bookmark = await Bookmarks.updateBookmark(id, title, url, newLocation);
  } else {
    bookmark = await Bookmarks.createBookmark(title, url);
  }

  if (bookmark) {
    if (!thumbnailEnabled) {
      await Bookmarks.removeThumbnail(bookmark.id, bookmark.isFolder);
    } else if (thumbnailSourceValue === 'local') {
      if (pendingThumbnailBlob && pendingThumbnailSource === 'local') {
        await Bookmarks.uploadScreen(bookmark, pendingThumbnailBlob);
      } else {
        await Bookmarks.setLocalThumbnailSource(bookmark.id);
      }
    } else if (url && thumbnailSourceValue === 'site' && thumbnailPermission) {
      if (shouldCaptureSite) {
        Bookmarks.createScreen(bookmark, thumbnailPermission);
      }
    } else if (
      url
      && thumbnailSourceValue === 'site'
      && pendingThumbnailBlob
      && pendingThumbnailSource === 'site'
    ) {
      await Bookmarks.uploadScreen(bookmark, pendingThumbnailBlob, {
        source: 'site',
        custom: false,
        showNotice: false
      });
    } else if (url && thumbnailSourceValue === 'url') {
      if (pendingThumbnailBlob && pendingThumbnailSource === 'url') {
        await Bookmarks.uploadScreen(bookmark, pendingThumbnailBlob, {
          source: 'url',
          sourceUrl: thumbnailUrlValue,
          showNotice: false
        });
      } else if (shouldFetchUrl && thumbnailPermission) {
        Bookmarks.setRemoteThumbnail(bookmark, thumbnailUrlValue);
      }
    } else if (url && thumbnailSourceValue === 'favicon') {
      const shouldResetFavicon = id !== 'New' && (
        form.dataset.oldThumbnailSource !== 'favicon'
        || form.dataset.oldUrl !== url
      );
      if (shouldResetFavicon) await Bookmarks.clearCachedThumbnail(bookmark, 'favicon');
      await Bookmarks.setFaviconPreferences(bookmark, faviconPreferences);

      if (pendingThumbnailBlob && pendingThumbnailSource === 'favicon') {
        await Bookmarks.uploadScreen(bookmark, pendingThumbnailBlob, {
          source: 'favicon',
          sourceUrl: url,
          showNotice: false
        });
      } else if (shouldFetchFavicon && thumbnailPermission) {
        Bookmarks.setFaviconThumbnailSource(bookmark);
      }
    }
  }

  bookmark && modalApi.close();
}

async function handleResetThumb(evt) {
  if (!settings.$.without_confirmation) {
    const confirmAction = await confirmPopup(browser.i18n.getMessage('confirm_delete_image'));
    if (!confirmAction) return;
  }

  evt.preventDefault();
  const id = this.getAttribute('data-bookmark') || form.getAttribute('data-action');

  if (id === 'New') {
    pendingThumbnailBlob = null;
    pendingThumbnailSource = null;
    customScreen.style.display = '';
    deleteThumbnailButton.disabled = true;
    return;
  }

  const bookmark = document.getElementById(`vb-${id}`);
  if (!bookmark) return;

  await Bookmarks.clearCachedThumbnail(bookmark, thumbnailSource.value);
  form.dataset.thumbnailHasImage = 'false';
  customScreen.style.display = '';
  deleteThumbnailButton.disabled = true;
  handleThumbnailSourceChange();
}

async function prepareModal(target) {
  // Reset stale values and validation state before filling the edit form.
  // Resetting in gmodal:beforeopen cleared values populated by this async function.
  form.reset();

  if (target) {
    modal.classList.add('has-edit');

    const bookmarkNode = await get(target.id).catch(err => console.warn(err));
    if (!bookmarkNode) return;

    const { id, url, parentId } = bookmarkNode[0];
    const title = $unescapeHtml(bookmarkNode[0].title);
    const thumbnailEnabled = Bookmarks.isDefaultFolder(parentId);
    const imageData = thumbnailEnabled ? await ImageDB.get(id) : null;
    form.setAttribute('data-action', id);
    form.dataset.thumbnailEnabled = String(thumbnailEnabled);

    // generate bookmark folder list
    modalSelectFolders.setAttribute('parent-folder-id', parentId);
    modalSelectFolders.setAttribute('bookmark-id', id);
    modalSelectFolders.folders = await getFolders();

    const pastePermission = await containsPermissions({ permissions: ['clipboardRead'] });
    pasteThumbnailButton.disabled = pastePermission
      ? !(await checkClipboardImage())
      : true;

    modalHead.textContent = browser.i18n.getMessage('edit_bookmark');
    titleField.value = title;

    if (url) {
      urlWrap.style.display = '';
      urlField.value = url;
      form.dataset.oldUrl = url;
      thumbnailSource.value = imageData?.source
        || (imageData?.blob ? (imageData.custom ? 'local' : 'site') : 'favicon');
      form.dataset.oldThumbnailSource = thumbnailSource.value;
      form.dataset.oldThumbnailUrl = imageData?.source === 'url' ? imageData.sourceUrl : '';
      form.dataset.thumbnailHasImage = String(Boolean(imageData?.blob));
      thumbnailUrl.value = imageData?.source === 'url' ? imageData.sourceUrl : '';
      faviconDownloadPreference.value = imageData?.downloadFavicon === true
        ? 'download'
        : imageData?.downloadFavicon === false ? 'chrome' : 'inherit';
      thumbnailFaviconSize.value = getFaviconSizeOverride(imageData?.faviconSize) || '';
      thumbnailFaviconSize.placeholder = String(settings.$.favicon_size);
      document.getElementById('thumbnailSourceWrap').hidden = false;
      handleThumbnailSourceChange();
      if (thumbnailEnabled) {
        const showStoredImage = thumbnailSource.value !== 'favicon' || usesDownloadedFavicon();
        await showModalThumbnail(id, showStoredImage);
      }
    } else {
      urlWrap.style.display = 'none';
      thumbnailSource.value = 'local';
      document.getElementById('thumbnailSourceWrap').hidden = true;
      thumbnailUrlWrap.hidden = true;
      handleThumbnailSourceChange();
    }
  } else {
    modal.classList.add('has-add');
    modalHead.textContent = browser.i18n.getMessage('add_bookmark');
    urlWrap.style.display = '';
    titleField.value = '';
    urlField.value = '';
    form.setAttribute('data-action', 'New');
    form.dataset.thumbnailEnabled = String(Bookmarks.isDefaultFolder(container.dataset.folder));
    thumbnailSource.value = 'favicon';
    thumbnailUrl.value = '';
    deleteThumbnailButton.disabled = true;
    document.getElementById('thumbnailSourceWrap').hidden = false;
    faviconDownloadPreference.value = 'inherit';
    thumbnailFaviconSize.value = '';
    thumbnailFaviconSize.placeholder = String(settings.$.favicon_size);
    const pastePermission = await containsPermissions({ permissions: ['clipboardRead'] });
    pasteThumbnailButton.disabled = pastePermission
      ? !(await checkClipboardImage())
      : true;
    handleThumbnailSourceChange();
  }
}

init();
