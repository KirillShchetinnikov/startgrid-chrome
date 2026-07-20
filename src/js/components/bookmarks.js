import { DragSortify } from '../plugins/dragSortify';
import { getMessage } from '../i18n';
import { multiswap } from '../plugins/dragSortify/multiswap';
import Toast from './toast';
import ImageDB from '../api/imageDB';
import { settings, LAST_OPENED_FOLDER_ID } from '../settings';
import { storage } from '../api/storage';
import {
  move,
  getSubTree,
  getThree,
  search as searchBookmarks,
  remove,
  removeTree,
  create,
  update,
  flattenArrayBookmarks
} from '../api/bookmark';
import {
  $debounce,
  $customTrigger,
  $shuffle,
  $createElement,
  $notifications,
  $resizeThumbnail
} from '../utils';
import {
  DEFAULT_BOOKMARKS_FOLDER,
  ROOT_FOLDERS,
  SVG_LOADER
} from '../constants';
import { bookmarksToDelete } from '../state';
import  confirmPopup from '../plugins/confirmPopup.js';
import { containsPermissions, requestPermissions } from '../api/permissions';
import { isThumbnailStale } from '../api/remoteThumbnail';
import {
  getThumbnailSizeOverride,
  shouldDownloadFavicon
} from '../api/faviconPreferences';
import './vb-bookmark';
import {
  getCurrentFolderId,
  initFolderNavigation
} from '../folderNavigation';
import { updateBookmarkSearchState } from '../mainPageScroll';
import {
  getBookmarkUsageCounts,
  sortHomeBookmarks,
  sortNestedBookmarks
} from '../bookmarkSorting';

/**
 * Bookmarks module
 */
const Bookmarks = (() => {
  const THUMBNAILS_MAP = new Map();
  const THUMBNAILS_CREATION_QUEUE = [];
  const DROPZONE_SELECTOR = '.dropzone-bookmark';
  const container = document.getElementById('bookmarks');
  const dialLoading = document.getElementById('dial_loading');
  let isGeneratedThumbs = false;
  let activeSearchRequest = 0;
  let hasSearch = false;
  let vbHeader = null;

  function resetBookmarkSearch() {
    hasSearch = false;
    activeSearchRequest += 1;
    createSpeedDial(startFolder());
    updateBookmarkSearchState(false);
  }

  function setToolbarVisibility(visible) {
    if (!vbHeader) return;

    if (!visible && hasSearch) {
      vbHeader.clearBookmarkSearch();
      resetBookmarkSearch();
    }
    vbHeader.hidden = !visible;
  }

  async function init() {
    // screen sizes needed for the service worker
    storage.local.set({
      screen: {
        availWidth: window.screen.availWidth,
        availHeight: window.screen.availHeight
      }
    });

    // Vertical center
    if (settings.$.vertical_center) {
      container.classList.add('grid--vcenter');
      container.parentElement.classList.add('content--vcenter');
    }

    // Dragging option
    if (settings.$.drag_and_drop) {
      initDrag(container);
    }

    // Create marker for the last active folder in advance to ensure the correct behavior when this option is used for the first time
    if (
      !localStorage.getItem(LAST_OPENED_FOLDER_ID) ||
      !settings.$.show_last_opened_folder
    ) {
      localStorage.setItem(LAST_OPENED_FOLDER_ID, settings.defaultFolderId);
    }

    initFolderNavigation(configuredStartFolder());

    // Keep the toolbar available so quick settings can show it without reloading the page.
    await import(/* webpackChunkName: "webcomponents/vb-header" */'./vb-header');
    vbHeader = document.createElement('vb-header');
    vbHeader.setAttribute('placeholder', getMessage('placeholder_input_search'));
    vbHeader.setAttribute('initial-folder-id', settings.defaultFolderId);
    vbHeader.setAttribute('folder-id', startFolder());
    vbHeader.hidden = !settings.$.show_toolbar;
    document.querySelector('header').append(vbHeader);
    await vbHeader.ready;

    const searchHandler = $debounce(({ detail }) => {
      if (!detail.isBookmarksEngine) {
        if (hasSearch) {
          hasSearch = false;
          activeSearchRequest += 1;
          createSpeedDial(startFolder());
          updateBookmarkSearchState(false);
        }
        return;
      }

      const query = detail.search.trim();
      if (!query.length) {
        hasSearch = false;
        activeSearchRequest += 1;
        createSpeedDial(startFolder());
      } else {
        hasSearch = true;
        search(query);
      }
      updateBookmarkSearchState(hasSearch);
    }, 500);

    vbHeader.addEventListener('vb:search', searchHandler);
    vbHeader.addEventListener('vb:searchreset', resetBookmarkSearch);

    // Change the current dial without changing the new-tab URL.
    document.addEventListener('folderNavigate', async function({ detail }) {
      const folderId = detail.folderId;
      activeSearchRequest += 1;
      if (hasSearch) {
        hasSearch = false;
        updateBookmarkSearchState(false);
      }
      vbHeader?.clearBookmarkSearch();

      await createSpeedDial(folderId);

      // Save the ID of the last opened folder
      localStorage.setItem(LAST_OPENED_FOLDER_ID, folderId);

      $customTrigger('changeFolder', container, {
        detail: { folderId },
        bubbles: true
      });
    }, false);

    document.addEventListener('bookmark-removed', ({ detail }) => {
      // on any action, folder change or bookmark removal (from DOM)
      // remove the previously created url of the blob object from memory
      if (!document.getElementById(`vb-${detail.id}`)) {
        URL.revokeObjectURL(detail.image);

        const thumbnail = THUMBNAILS_MAP.get(detail.id);
        if (thumbnail) {
          if (thumbnail.children) {
            // if there are thumbnails in the children, clear them from memory too
            thumbnail.children.forEach(item => {
              if (item.blobUrl) {
                URL.revokeObjectURL(item.blobUrl);
              }
            });
          }
          // delete an inaccessible item from Map
          THUMBNAILS_MAP.delete(detail.id);
        }
      }
    });

    // Create speeddial
    return createSpeedDial(startFolder());
  }

  // helper to turn on the dropzone lighting
  function showDropzone(target) {
    [...container.querySelectorAll(DROPZONE_SELECTOR)]
      .forEach(el => {
        const bookmark = el.closest('.bookmark') || el.closest('.bookmark-btn--back');
        if (bookmark.dataset.id !== target.dataset.id) {
          el.classList.add('is-activate');
        }
      });
  }

  // helper to turn off the dropzone backlight
  function hideDropzone() {
    [...container.querySelectorAll('.is-activate')]
      .forEach(el => el.classList.remove('is-activate'));
  }

  function initDrag(el) {
    let ghost = null;
    el.sortInstance = new DragSortify(el, {
      draggableSelector: '.bookmark',
      ignoreSelectors: ['.bookmark__action'],
      plugin: multiswap,
      onDragStart({ event, draggedElement, draggingItems }) {
        container.classList.add('has-dragging');
        showDropzone(draggedElement);

        if (!draggingItems.includes(draggedElement)) {
          // if the item is not selected, hide action panel
          document.dispatchEvent(new CustomEvent('vb-bookmarks-panel:close'));
        }

        const classes = ['drag-ghost'];
        ghost = draggedElement.cloneNode(true);
        if (ghost.isFolder && settings.$.folder_preview) {
          ghost.folderChidlren = renderFolderChildren(ghost);
        }
        document.body.appendChild(ghost);

        if (draggingItems.length > 1) {
          classes.push('multiply-ghost');
          ghost.innerHTML += `<div class="multiply-drop-count">${draggingItems.length}</div>`;
        }
        ghost.classList.add(...classes);

        const wh = draggedElement.offsetHeight / draggedElement.offsetWidth;
        let width = 150;
        let height = 150 * wh;

        // In browsers, there is a limit on the size of the ghost, restrict it 180
        if (draggedElement.offsetWidth < 180) {
        // reduce the ghost(25px) for UX
          width = draggedElement.offsetWidth - 25;
          height = width * wh;
        }

        ghost.style.width = `${width}px`;
        ghost.style.height = `${height}px`;

        const rect = draggedElement.getBoundingClientRect();

        event.dataTransfer.setDragImage(
          ghost,
          (event.clientX - rect.left) - (rect.width / 2) + (width / 2),
          (event.clientY - rect.top) - (rect.height / 2) + ((height) / 2)
        );
      },
      onDragEnd() {
        container.classList.remove('has-dragging');
        hideDropzone();
        if (ghost) {
          ghost.remove();
          ghost = null;
        }
      },
      async onUpdate() {
        const bookmarks = Array.from(container.querySelectorAll('.bookmark'));
        for (const [index, item] of bookmarks.entries()) {
          await move(item.getAttribute('data-id'), {
            'parentId': container.dataset.folder,
            'index': index
          }).catch(console.warn);
        }
        if (isDefaultFolder() && !settings.$.home_manual_sort_initialized) {
          await settings.updateKey('home_manual_sort_initialized', true);
        }
      },
      onAdd({ item, target }) {
        const id = item.dataset.id;
        const destination = {
          parentId: target.dataset.id,
          ...(settings.$.move_to_start && { index: 0 })
        };
        const dropZoneRect = target.getBoundingClientRect();
        const cardRect = item.getBoundingClientRect();
        const translateX = dropZoneRect.left + dropZoneRect.width / 2 - cardRect.left - cardRect.width / 2;
        const translateY = dropZoneRect.top + dropZoneRect.height / 2 - cardRect.top - cardRect.height / 2;
        const animation = item.animate(
          [
            {
              offset: 0,
              transform: 'none',
              opacity: 1
            },
            {
              offset: 0.85,
              transform: `translate(${translateX}px, ${translateY}px) scale(0.75)`,
              opacity: 0.5
            },
            {
              offset: 1,
              transform: `translate(${translateX}px, ${translateY}px) scale(0.3)`,
              opacity: 0
            }
          ],
          {
            duration: 500,
            easing: 'cubic-bezier(0, 0.55, 0.45, 1)',
            fill: 'forwards'
          }
        );
        animation.onfinish = () => {
          item.remove();
          move(id, destination)
            .then(() => {
              $customTrigger('updateFolderList', document);
              $customTrigger('vb-bookmarks-panel:close', document);
            });
        };
      }
    });
    document.addEventListener('vb:bookmarks:select', (e) => {
      el.sortInstance.setSelectedItems(e.detail);
    });
  }

  function configuredStartFolder() {
    let folderId = String(settings.defaultFolderId);

    // If the "Last Opened Folder" option is enabled, get the ID of the last opened folder
    if (settings.$.show_last_opened_folder) {
      folderId = localStorage.getItem(LAST_OPENED_FOLDER_ID) ?? DEFAULT_BOOKMARKS_FOLDER;
    }

    return folderId;
  }

  function startFolder() {
    return getCurrentFolderId() ?? configuredStartFolder();
  }

  function isDefaultFolder(folderId = startFolder()) {
    return String(folderId) === String(settings.defaultFolderId);
  }

  function canUseThumbnail(bookmark) {
    return Boolean(bookmark) && isDefaultFolder(bookmark.parentId);
  }

  function getStoredThumbnailSize(thumbnail) {
    return getThumbnailSizeOverride(thumbnail?.thumbnailSize ?? thumbnail?.faviconSize);
  }

  function genBookmark(bookmark, usageCount = null) {
    const thumbnail = THUMBNAILS_MAP.get(bookmark.id);
    const thumbnailSource = thumbnail?.source
      || (thumbnail?.blob ? (thumbnail.custom ? 'local' : 'site') : 'favicon');
    const useStoredImage = thumbnailSource !== 'favicon'
      || shouldDownloadFavicon(thumbnail, settings.$.download_favicons_by_default);
    const image = useStoredImage ? thumbnail?.blobUrl : null;
    const custom = thumbnail?.custom || false;
    const thumbnailSize = getStoredThumbnailSize(thumbnail);

    const vbBookmark = document.createElement('a', { is: 'vb-bookmark' });
    Object.assign(vbBookmark, {
      id: bookmark.id,
      url: bookmark.url,
      title: bookmark.title,
      parentId: bookmark.parentId,
      image,
      isCustomImage: custom,
      openNewTab: settings.$.open_bookmarks_newtab,
      thumbnailSource,
      thumbnailSize,
      usageCount,
      hasTitle: settings.$.show_bookmark_title,
      hasFavicon: settings.$.show_favicon
    });
    return vbBookmark;
  }

  function genFolder(bookmark) {
    const folderPreview = settings.$.folder_preview;
    const thumbnail = THUMBNAILS_MAP.get(bookmark.id);
    const image = thumbnail?.blobUrl;

    const vbBookmark = document.createElement('a', { is: 'vb-bookmark' });
    Object.assign(vbBookmark, {
      id: bookmark.id,
      url: `#${bookmark.id}`,
      parentId: bookmark.parentId,
      title: bookmark.title,
      isFolder: true,
      hasFolderPreview: folderPreview,
      folderChidlren: folderPreview ? renderFolderChildren(bookmark) : [],
      image,
      openNewTab: settings.$.open_bookmarks_newtab,
      hasTitle: settings.$.show_bookmark_title,
      hasFavicon: settings.$.show_favicon,
      isDND: settings.$.drag_and_drop
    });
    return vbBookmark;
  }

  /**
   * Thumbnails or logos for folder render
   * @param {Object<BookmarkTreeNode>} bookmark
   * @returns {Array<Object>} thumbnail object
   */
  function renderFolderChildren(bookmark) {
    const thumbnail = THUMBNAILS_MAP.get(bookmark.id);

    if (!thumbnail?.children) return [];

    return thumbnail.children.map(thumbnailChild => ({
      ...thumbnailChild,
      image: thumbnailChild.blobUrl
    }));
  }

  function clearContainer() {
    if (!container.firstChild) return;

    while (container.firstChild) {
      container.firstChild.remove();
    }
  }

  /**
   * Create an array of strings from bookmarks inside a folder
   * @param {Array<BookmarkTreeNode>} bookmarks
   * @returns {Array<String>} array id
   */
  function getChildrenBookmarks(bookmarks) {
    return bookmarks.reduce((acc, bookmark) => {
      if (bookmark.children) {
        const children = $shuffle(bookmark.children);
        acc.push(
          ...children
            .reduce((acc, child) => {
              if (!child.children) {
                acc.push(child);
              }
              return acc;
            }, [])
            .slice(0, 4)
        );
      }
      return acc;
    }, []);
  }

  /**
   * Set thumbnails map for folders
   * @param {Array<Object>} existingChildrenThumbnails
   * @param {Array<BookmarkTreeNode>} childrenBookmarks
   */
  function setChildrenThumbnails(existingChildrenThumbnails, childrenBookmarks) {
    // prepare an array of thumbnails
    const thumbnails = childrenBookmarks.reduce((acc, bookmark) => {
      // search for a thumbnail among existing thumbnails
      let thumbnail = existingChildrenThumbnails.find(thumbnail => thumbnail.id === bookmark.id);

      if (thumbnail?.blob) {
        // if there is a thumbnail, we create a key that stores the url
        thumbnail.blobUrl = URL.createObjectURL(thumbnail.blob);
      } else {
        // if there is no thumbnail, create an object with id to display the logo later
        thumbnail = { id: bookmark.id, url: bookmark.url };
      }

      // each folder must contain an array of thumbnails
      if (!Array.isArray(acc?.[bookmark.parentId])) {
        // if the folder is not filled yet, create an object and an array inside it
        acc[bookmark.parentId] = [];
      }
      // add folder thumbnail
      acc[bookmark.parentId].push(thumbnail);
      return acc;
    }, {});

    // iterate through the array of thumbnail keys
    // add thumbnails to thumbnail map
    Object.keys(thumbnails).forEach(key => {
      const parentFolderThumb = THUMBNAILS_MAP.get(key) ?? {};

      THUMBNAILS_MAP.set(key, {
        id: key,
        ...parentFolderThumb,
        children: thumbnails[key]
      });
    });
  }

  function createFolderPathMap(nodes) {
    const paths = new Map();

    function walk(node, parentPath) {
      if (node.url) return;

      const path = node.title ? [...parentPath, node.title] : parentPath;
      paths.set(String(node.id), path);
      node.children?.forEach(child => walk(child, path));
    }

    nodes.forEach(node => walk(node, []));
    return paths;
  }

  function createSearchResult(bookmark, folderLabel = '', usageCount = null) {
    const result = bookmark.url ? genBookmark(bookmark, usageCount) : genFolder(bookmark);
    result.searchFolderLabel = folderLabel;
    return result;
  }

  function getSearchFolderLabel(bookmark, folderPaths, displayMode) {
    const path = folderPaths.get(String(bookmark.parentId)) ?? [];
    if (!path.length) {
      return getMessage('search_results_root_folder');
    }

    return displayMode === 'folder_name'
      ? path[path.length - 1]
      : path.join(' › ');
  }

  function appendGroupedSearchResults(fragment, bookmarks, folderPaths) {
    const groups = new Map();

    bookmarks.forEach(bookmark => {
      const key = String(bookmark.parentId ?? '');
      if (!groups.has(key)) {
        groups.set(key, {
          label: getSearchFolderLabel(bookmark, folderPaths, 'folder_path'),
          bookmarks: []
        });
      }
      groups.get(key).bookmarks.push(bookmark);
    });

    [...groups.values()]
      .sort((a, b) => a.label.localeCompare(b.label, undefined, {
        sensitivity: 'base',
        numeric: true
      }))
      .forEach(group => {
        const heading = $createElement('button', {
          class: 'search-results__folder',
          type: 'button',
          'data-search-folder-id': group.bookmarks[0].parentId
        });
        heading.append(
          $createElement('span', {
            class: 'search-results__folder-title'
          }, group.label),
          $createElement('span', {
            class: 'search-results__folder-count'
          }, String(group.bookmarks.length))
        );
        fragment.appendChild(heading);
        group.bookmarks.forEach(bookmark => {
          fragment.appendChild(createSearchResult(bookmark));
        });
      });
  }

  /**
   * Render bookmarks
   * @param {Array<BookmarkTreeNode>} arr - array of bookmarks
   * @param {boolean} [hasCreate=false] - show add bookmark button
   * @param {Object} [options] - search result display options
   */
  async function render(arr, hasCreate = false, options = {}) {
    dialLoading.hidden = false;
    clearContainer();

    const isHomeFolder = isDefaultFolder();
    const usageCounts = getBookmarkUsageCounts();
    const showUsageCount = isHomeFolder
      && !options.isSearch
      && settings.$.home_sort_by === 'usage'
      && settings.$.show_usage_count;
    const bookmarksArr = isHomeFolder && !options.isSearch
      ? sortHomeBookmarks(arr, settings.$, usageCounts)
      : sortNestedBookmarks(arr, settings.$.navigation_sort_by);

    // Only direct children of the configured home folder may have thumbnails.
    const bookmarksIds = bookmarksArr
      .filter(canUseThumbnail)
      .map(child => child.id);
    let childrenBookmarks;

    const thumbnails = await ImageDB.getAllByIds(bookmarksIds);

    // Folder previews on the home page use bookmark icons, never nested thumbnails.
    if (isHomeFolder && settings.$.folder_preview) {
      // get children bookmarks for folders
      childrenBookmarks = getChildrenBookmarks(bookmarksArr);
    }

    // clear local thumbnail map
    THUMBNAILS_MAP.clear();

    // convert blob to thumbnail url for main bookmarks
    thumbnails.forEach(thumbnail => {
      if (thumbnail.blob) {
        thumbnail.blobUrl = URL.createObjectURL(thumbnail.blob);
      }
      THUMBNAILS_MAP.set(thumbnail.id, thumbnail);
    });

    if (childrenBookmarks) {
      setChildrenThumbnails([], childrenBookmarks);
    }

    const fragment = document.createDocumentFragment();

    if (options.searchDisplay === 'grouped') {
      appendGroupedSearchResults(fragment, bookmarksArr, options.folderPaths);
    } else {
      for (let bookmark of bookmarksArr) {
        const folderLabel = ['folder_name', 'folder_path'].includes(options.searchDisplay)
          ? getSearchFolderLabel(bookmark, options.folderPaths, options.searchDisplay)
          : '';
        const usageCount = showUsageCount && bookmark.url
          ? parseInt(usageCounts[bookmark.id]) || 0
          : null;
        fragment.appendChild(createSearchResult(bookmark, folderLabel, usageCount));
      }
    }

    container.appendChild(fragment);
    if (isHomeFolder) {
      downloadMissingFavicons(bookmarksArr).catch(error => console.warn(error));
    }

    if (isHomeFolder && settings.$.thumbnails_auto_refresh) {
      const staleThumbnails = thumbnails.filter(thumbnail => (
        (thumbnail.source !== 'favicon'
          || shouldDownloadFavicon(thumbnail, settings.$.download_favicons_by_default))
        && isThumbnailStale(thumbnail, settings.$.thumbnails_auto_refresh_interval)
      ));
      refreshStaleThumbnails(staleThumbnails);
    }

    const hasBack = container.dataset?.parentFolder
      && startFolder() !== String(settings.defaultFolderId)
      && settings.$.show_back_column;

    if (hasBack) {
      container.prepend(
        $createElement('button', {
          id: 'bookmark-back',
          class: 'bookmark-btn bookmark-btn--back md-ripple',
          'aria-label': getMessage('parent_folder')
        }, $createElement('span', {
          class: DROPZONE_SELECTOR.replace('.', ''),
          'data-id': container.dataset?.parentFolder
        }))
      );
    }

    if (hasCreate) {
      container.append(
        $createElement('button', {
          id: 'add',
          class: 'bookmark-btn bookmark-btn--create md-ripple',
          'data-create': 'New',
          'aria-label': getMessage('new_bookmark')
        })
      );
    }
    dialLoading.hidden = true;
  }

  /**
   * Create speed dial
   * @param {String} id current folder id
   * @returns {Promise}
   */
  function createSpeedDial(id) {
    const canDrag = settings.$.drag_and_drop && (
      isDefaultFolder(id)
        ? settings.$.home_sort_by === 'manual'
        : settings.$.navigation_sort_by === ''
    );
    container.sortInstance?.toggleDisable(!canDrag);

    return getSubTree(id)
      .then(item => {
        if (!item[0].children) {
          throw new Error('not_folder');
        }

        // folder by id exists
        container.setAttribute('data-folder', id);
        if (item[0].parentId && !ROOT_FOLDERS.includes(item[0].parentId)) {
          container.setAttribute('data-parent-folder', item[0].parentId);
        } else {
          container.removeAttribute('data-parent-folder');
        }

        return render(item[0].children, settings.$.show_create_column);
      })
      .catch(() => {
        Toast.show(getMessage('notice_cant_find_id'));
        container.innerHTML = /* html */
            `<div class="not-found">
              <div class="not-found__wrap">
                <div class="not-found__icon"></div>
                <div class="not-found__text">
                  ${getMessage('not_found_text')}
                </div>
                <button class="btn md-ripple" data-folder-id="1">${getMessage('not_found_link_text')}</button>
              </div>
            </div>`;
      });
  }

  /**
   * Create progress toast
   * @param {Number} number of bookmarks
   * @returns {HTMLElement} progress element
   */
  function renderProgressToast(sum) {
    const i18n = getMessage(
      'thumbnails_creation',
      [
        '<strong id="progress-text">0</strong>',
        sum
      ]
    );
    const progressToast = $createElement(
      'div', {
        class: 'progress-toast'
      },
      {
        html:
          `<div class="progress-toast__icon">${SVG_LOADER}</div>` +
          `<div class="progress-toast__text">${i18n}</div>`
      }
    );
    return progressToast;
  }

  /**
   * Checks if the user has permission to access all URLs.
   * @return {Promise<boolean>} A promise that resolves to a boolean indicating whether the user has permission to access all URLs.
   */
  async function checkHostPermissions() {
    const allUrlsPermission = await requestPermissions({ origins: ['<all_urls>'] });
    if (!allUrlsPermission) {
      const message = getMessage('notice_host_permissions')
        + `<br><br><button class="btn btn--primary md-ripple" data-permissions-info>${getMessage('learn_more')}</button>`;

      Toast.show({
        message,
        delay: 7000
      });
    }
    return allUrlsPermission;
  }

  async function captureMultipleBookmarks(selectedBookmarks, showNotice) {
    const bookmarksLength = selectedBookmarks.filter(b => !b.isFolder).length;
    // create notification toast
    const progressToast = renderProgressToast(bookmarksLength);
    document.body.append(progressToast);
    const progressToastTween = progressToast.animate([
      { transform: 'translate3D(-100%, 0, 0)' },
      { transform: 'translate3D(0, 0, 0)' }
    ], {
      duration: 200,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      fill: 'forwards'
    });
    const progressText = document.getElementById('progress-text');

    isGeneratedThumbs = true;
    $customTrigger('thumbnails:updating', container);

    for (const [index, b] of selectedBookmarks.entries()) {
      // updating toast progress
      progressText.textContent = index + 1;
      const currentThumbnail = await ImageDB.get(b.id);

      // A local image has no external source that can be refreshed.
      if (currentThumbnail?.source === 'local') continue;

      let response;
      if (!currentThumbnail || ['url', 'favicon'].includes(currentThumbnail.source)) {
        const source = currentThumbnail?.source || 'favicon';
        const sourceUrl = currentThumbnail?.sourceUrl || b.url;
        if (!sourceUrl) continue;

        response = await requestRemoteThumbnail(b.id, sourceUrl, {
          source,
          sourceUrl
        });
      } else {
        // Bookmarks without a saved source use the default website screenshot type.
        response = await captureScreen(b.url, b.id);
      }

      if (response?.warning || response?.success === false) continue;

      const image = await ImageDB.get(b.id);
      if (!image?.blob) continue;

      const blobUrl = URL.createObjectURL(image.blob);
      const thumbnail = THUMBNAILS_MAP.get(b.id);

      if (thumbnail) {
        URL.revokeObjectURL(thumbnail.blobUrl);
      }
      THUMBNAILS_MAP.set(b.id, {
        ...image,
        blobUrl
      });

      try {
        // if we can, then update the bookmark in the DOM
        const bookmark = document.getElementById(`vb-${b.id}`);
        bookmark.isCustomImage = image.custom;
        bookmark.image = blobUrl;
      } catch (err) {}
    }

    isGeneratedThumbs = false;

    if (showNotice) {
      $notifications(getMessage('notice_thumbnails_update_complete'));
    }

    $customTrigger('thumbnails:updated', container);
    progressToastTween.reverse();
    progressToastTween.onfinish = () => {
      progressToast.remove();
    };
  }

  function autoUpdateThumb() {
    if (isGeneratedThumbs || !isDefaultFolder()) return;
    const id = String(settings.defaultFolderId);
    getSubTree(id)
      .then((items) => {
        const children = items[0].children.filter(item => item.url);

        captureMultipleBookmarks(children);
      });
  }

  function updateSelectedThumbnails(selectedBookmarks) {
    if (!isDefaultFolder()) return;

    const bookmarks = selectedBookmarks.filter(bookmark => (
      !bookmark.isFolder && canUseThumbnail(bookmark)
    ));
    return captureMultipleBookmarks(bookmarks);
  }

  async function moveSelectedBookmarks(selectedBookmarks, destinationId) {
    // checking if the destination is contained within the selected folder
    const isDestinationChild = (bookmarks) => {
      return bookmarks.some(bookmark => {
        if (bookmark.children) {
          return bookmark.id === destinationId ? true : isDestinationChild(bookmark.children);
        }
        return false;
      });
    };

    // if the destination is contained within the selected folder
    // we must not move the selected folder
    // parent folder cannot be placed in child folder
    // remove this folder from the array selected bookmarks
    // but first we make a shallow copy of the array so as not to mutate the original
    const cloneSelectedBookmarks = [...selectedBookmarks];

    for (let i = 0; i < cloneSelectedBookmarks.length; i++) {
      const bookmark = cloneSelectedBookmarks[i];
      if (bookmark.isFolder) {
        const subTree = await getSubTree(bookmark.id);
        if (isDestinationChild(subTree)) {
          cloneSelectedBookmarks.splice(i, 1);
          break;
        }
      }
    }

    const promises = cloneSelectedBookmarks.map(bookmark => {
      return move(bookmark.id, {
        parentId: destinationId,
        ...(settings.$.move_to_start && { index: 0 })
      })
        .then(async() => {
          if (!isDefaultFolder(destinationId)) {
            await removeThumbnail(bookmark.id, bookmark.isFolder);
          }
          $customTrigger('updateFolderList', document);
          bookmark.remove();
        });
    });
    return Promise.all(promises);
  }

  /**
   * Upload user image for thumbnail
   * @param {Object} data
   * @param {HTMLInputElement} data.target - input file
   * @param {string} data.id
   * @param {(string|undefined)} data.site - domain
   */
  async function uploadScreen(bookmark, fileBlob, options = {}) {
    if (!canUseThumbnail(bookmark)) return false;

    const {
      source = 'local',
      custom = true,
      showNotice = true,
      sourceUrl = null
    } = options;
    const checkedAt = source === 'site' ? Date.now() : null;
    bookmark.hasOverlay = true;

    const { id } = bookmark;
    const existing = await ImageDB.get(id);
    const blob = await $resizeThumbnail(fileBlob);
    const blobUrl = URL.createObjectURL(blob);
    const thumbnail = THUMBNAILS_MAP.get(id);

    await ImageDB.update({
      ...existing,
      id,
      blob,
      custom,
      source,
      ...(checkedAt && { checkedAt }),
      ...(sourceUrl && { sourceUrl })
    });

    if (thumbnail) {
      URL.revokeObjectURL(thumbnail.blobUrl);
    }

    THUMBNAILS_MAP.set(id, {
      ...existing,
      id,
      blob,
      blobUrl,
      custom,
      source,
      ...(checkedAt && { checkedAt }),
      ...(sourceUrl && { sourceUrl }),
      ...(thumbnail?.children && { children: thumbnail.children })
    });

    bookmark.thumbnailSource = source;
    bookmark.thumbnailSize = getStoredThumbnailSize(existing);
    bookmark.isCustomImage = custom;
    const useStoredImage = source !== 'favicon'
      || shouldDownloadFavicon(existing, settings.$.download_favicons_by_default);
    bookmark.image = useStoredImage ? blobUrl : null;
    bookmark.hasOverlay = false;

    if (showNotice) {
      Toast.show(getMessage('notice_thumb_image_updated'));
    }
  }

  function requestRemoteThumbnail(id, url, options = {}) {
    return new Promise((resolve) => {
      browser.runtime.sendMessage({
        remoteThumbnail: { id, url, ...options }
      }, response => resolve(response));
    });
  }
  function applyStoredThumbnail(bookmark, image) {
    const thumbnail = THUMBNAILS_MAP.get(bookmark.id);
    if (thumbnail?.blobUrl) {
      URL.revokeObjectURL(thumbnail.blobUrl);
    }

    const blobUrl = URL.createObjectURL(image.blob);
    const storedThumbnail = { ...image, blobUrl };
    THUMBNAILS_MAP.set(bookmark.id, storedThumbnail);

    const source = image.source || 'favicon';
    const useStoredImage = source !== 'favicon'
      || shouldDownloadFavicon(image, settings.$.download_favicons_by_default);
    bookmark.thumbnailSource = source;
    bookmark.thumbnailSize = getStoredThumbnailSize(image);
    bookmark.isCustomImage = image.custom;
    bookmark.image = useStoredImage ? blobUrl : null;

    return storedThumbnail;
  }

  async function applyRemoteThumbnail(bookmark, url, showNotice = false, options = {}) {
    if (!canUseThumbnail(bookmark)) return { success: false };
    bookmark && (bookmark.hasOverlay = true);
    const response = await requestRemoteThumbnail(bookmark.id, url, options);
    const image = await ImageDB.get(bookmark.id);

    if (response?.success && image?.blob) {
      applyStoredThumbnail(bookmark, image);
      if (showNotice) {
        Toast.show(getMessage('notice_thumb_image_updated'));
      }
    } else if (showNotice) {
      Toast.show(getMessage('notice_thumbnail_url_failed'));
    }

    bookmark && (bookmark.hasOverlay = false);
    return response;
  }

  function setRemoteThumbnail(bookmark, url) {
    return applyRemoteThumbnail(bookmark, url, true);
  }

  async function setLocalThumbnailSource(id) {
    const bookmark = document.getElementById(`vb-${id}`);
    if (!canUseThumbnail(bookmark)) {
      return false;
    }

    const image = await ImageDB.get(id);
    if (!image) return;

    await ImageDB.update({
      id,
      ...image,
      blob: image.blob,
      custom: image.custom,
      source: 'local'
    });
    const thumbnail = THUMBNAILS_MAP.get(id);
    if (thumbnail) {
      THUMBNAILS_MAP.set(id, { ...thumbnail, source: 'local' });
    }
    bookmark.thumbnailSource = 'local';
  }

  function setFaviconThumbnailSource(bookmark, pageUrl = bookmark.url) {
    return applyRemoteThumbnail(
      bookmark,
      pageUrl,
      true,
      { source: 'favicon', sourceUrl: pageUrl }
    );
  }

  async function setThumbnailSize(bookmark, value) {
    if (!canUseThumbnail(bookmark)) return false;

    const existing = await ImageDB.get(bookmark.id);
    const thumbnailSize = getThumbnailSizeOverride(value);
    const payload = {
      ...(existing || {}),
      id: bookmark.id
    };

    if (thumbnailSize) payload.thumbnailSize = thumbnailSize;
    else delete payload.thumbnailSize;
    delete payload.faviconSize;

    await ImageDB.update(payload);
    const currentThumbnail = THUMBNAILS_MAP.get(bookmark.id) || {};
    const storedThumbnail = { ...currentThumbnail, ...payload };
    delete storedThumbnail.faviconSize;
    THUMBNAILS_MAP.set(bookmark.id, storedThumbnail);
    bookmark.thumbnailSize = thumbnailSize;
    return payload;
  }

  async function setFaviconPreferences(bookmark, preferences = {}) {
    if (!canUseThumbnail(bookmark)) return false;

    const existing = await ImageDB.get(bookmark.id);
    const payload = {
      ...(existing || {}),
      id: bookmark.id,
      source: 'favicon',
      sourceUrl: bookmark.url
    };

    if (typeof preferences.downloadFavicon === 'boolean') {
      payload.downloadFavicon = preferences.downloadFavicon;
    } else {
      delete payload.downloadFavicon;
    }

    await ImageDB.update(payload);
    const thumbnail = THUMBNAILS_MAP.get(bookmark.id) || {};
    THUMBNAILS_MAP.set(bookmark.id, { ...thumbnail, ...payload });
    bookmark.thumbnailSource = 'favicon';
    bookmark.image = shouldDownloadFavicon(payload, settings.$.download_favicons_by_default)
      ? thumbnail.blobUrl || null
      : null;
    return payload;
  }

  async function clearCachedThumbnail(bookmark, source) {
    if (!canUseThumbnail(bookmark)) return false;

    const existing = await ImageDB.get(bookmark.id);
    const thumbnail = THUMBNAILS_MAP.get(bookmark.id);
    if (thumbnail?.blobUrl) {
      URL.revokeObjectURL(thumbnail.blobUrl);
    }

    const sourceUrl = source === 'url'
      ? existing?.sourceUrl
      : source === 'favicon' ? bookmark.url : null;
    const thumbnailSize = getStoredThumbnailSize(existing);
    const payload = {
      id: bookmark.id,
      source,
      ...(typeof existing?.downloadFavicon === 'boolean' && { downloadFavicon: existing.downloadFavicon }),
      ...(thumbnailSize && { thumbnailSize }),
      ...(sourceUrl && { sourceUrl })
    };
    await ImageDB.update(payload);
    THUMBNAILS_MAP.set(bookmark.id, payload);
    bookmark.thumbnailSource = source;
    bookmark.thumbnailSize = thumbnailSize;
    bookmark.isCustomImage = false;
    bookmark.image = null;
  }

  async function downloadMissingFavicons(bookmarks) {
    const missingFavicons = bookmarks.filter(bookmark => {
      if (!bookmark.url) return false;
      const thumbnail = THUMBNAILS_MAP.get(bookmark.id);
      const source = thumbnail?.source || 'favicon';
      return source === 'favicon'
        && !thumbnail?.blob
        && shouldDownloadFavicon(thumbnail, settings.$.download_favicons_by_default);
    });
    if (!missingFavicons.length) return;

    const hasAccess = await containsPermissions({ origins: ['<all_urls>'] });
    if (!hasAccess) return;

    for (const bookmarkData of missingFavicons) {
      const response = await requestRemoteThumbnail(bookmarkData.id, bookmarkData.url, {
        source: 'favicon',
        sourceUrl: bookmarkData.url
      });
      if (!response?.success) continue;

      const image = await ImageDB.get(bookmarkData.id);
      const bookmark = document.getElementById(`vb-${bookmarkData.id}`);
      if (
        image?.blob
        && bookmark
        && bookmark.thumbnailSource === 'favicon'
        && bookmark.url === bookmarkData.url
      ) applyStoredThumbnail(bookmark, image);
    }
  }

  async function refreshStaleThumbnails(thumbnails) {
    if (!thumbnails.length) return;

    const hasAccess = await containsPermissions({ origins: ['<all_urls>'] });
    if (!hasAccess) return;

    thumbnails.forEach(thumbnail => {
      const bookmark = document.getElementById(`vb-${thumbnail.id}`);
      if (!bookmark) return;

      if (thumbnail.source === 'site') {
        createScreen(bookmark, true);
        return;
      }

      const sourceUrl = thumbnail.sourceUrl || bookmark.url;
      applyRemoteThumbnail(bookmark, sourceUrl, false, {
        source: thumbnail.source,
        sourceUrl
      });
    });
  }

  function captureScreen(captureUrl, id) {
    return new Promise((resolve) => {
      browser.runtime.sendMessage({
        capture: {
          id,
          captureUrl
        }
      }, (response) => {
        if (response.warning) {
          console.warn(response.warning);
        }
        resolve(response);
      });
    });
  }

  async function captureByTurn() {
    const { bookmark, resolve } = THUMBNAILS_CREATION_QUEUE[0];
    const response = await captureScreen(bookmark.url, bookmark.id, bookmark.parentId);

    if (!response.warning) {
      const image = await ImageDB.get(bookmark.id);
      const thumbnail = THUMBNAILS_MAP.get(bookmark.id);

      if (thumbnail) {
        // если миниатюра объекта существует удалить его из памяти
        URL.revokeObjectURL(thumbnail.blobUrl);
      }

      bookmark.isCustomImage = false;
      bookmark.image = URL.createObjectURL(image.blob);

      // write to the thumbnails map on the page a new blobUrl
      THUMBNAILS_MAP.set(bookmark.id, {
        ...image,
        blobUrl: bookmark.image
      });
    }

    bookmark.hasOverlay = false;
    THUMBNAILS_CREATION_QUEUE.shift();
    resolve(response);

    if (THUMBNAILS_CREATION_QUEUE.length) {
      await captureByTurn();
    }
  }

  async function createScreen(bookmark, access = false) {
    let hostPermissions = access;
    try {
      hostPermissions = await checkHostPermissions();
    } catch (err) {}

    if (!hostPermissions) return;

    if (!canUseThumbnail(bookmark)) return;

    bookmark.hasOverlay = true;
    return new Promise(resolve => {
      THUMBNAILS_CREATION_QUEUE.push({ bookmark, resolve });

      if (THUMBNAILS_CREATION_QUEUE.length === 1) {
        captureByTurn();
      }
    });
  }

  async function captureThumbnailBlob(url, access = false) {
    let hostPermissions = access;
    try {
      hostPermissions = await checkHostPermissions();
    } catch (err) {}
    if (!hostPermissions) return null;

    const id = `pending-thumbnail-${Date.now()}`;
    const response = await captureScreen(url, id);
    if (!response || response.warning) return null;

    const image = await ImageDB.get(id);
    await ImageDB.delete(id);
    return image?.blob || null;
  }

  async function fetchThumbnailBlob(url, access = false, options = {}) {
    let hostPermissions = access;
    try {
      hostPermissions = await checkHostPermissions();
    } catch (err) {}
    if (!hostPermissions) return null;

    const id = `pending-thumbnail-${Date.now()}`;
    const response = await requestRemoteThumbnail(id, url, options);
    const image = await ImageDB.get(id);
    await ImageDB.delete(id);
    if (!response?.success) return null;
    return image?.blob || null;
  }

  /**
   * Search bookmarks
   * @param {String} query
   */
  async function search(query) {
    const requestId = ++activeSearchRequest;
    try {
      const searchDisplay = settings.$.search_results_display;
      const folderTree = searchDisplay === 'flat'
        ? Promise.resolve([])
        : getThree().catch(() => []);
      const [match, tree] = await Promise.all([
        searchBookmarks(query),
        folderTree
      ]);

      if (requestId !== activeSearchRequest) return;

      if (match.length > 0) {
        if (settings.$.drag_and_drop) {
          // if dnd we turn off sorting and destroy nested instances
          container.sortInstance?.toggleDisable(true);
        }
        await render(match, false, {
          isSearch: true,
          searchDisplay,
          folderPaths: createFolderPathMap(tree)
        });
      } else {
        container.innerHTML = `<div class="empty-search">🙁 ${getMessage('empty_search')}</div>`;
      }
    } catch (error) {
      if (requestId !== activeSearchRequest) return;
      console.error('Bookmark search failed', error);
      container.innerHTML = `<div class="empty-search">🙁 ${getMessage('search_failed')}</div>`;
    } finally {
      if (requestId === activeSearchRequest) dialLoading.hidden = true;
    }
  }

  async function removeFromBrowser(bookmark, isFolder) {
    const id = isFolder
      ? bookmark.id
      : bookmark.dataset.id;

    removeThumbnail(id, isFolder);

    await (isFolder ? removeTree(id) : remove(id));

    bookmark.remove();

    $customTrigger('updateFolderList', document);
  }

  function showRemoveBookmarkToast({
    message,
    onShow,
    onUndo,
    onClose
  }) {
    Toast.show({
      message,
      delay: 8000,
      progress: true,
      hideByClick: false,
      action: {
        html: getMessage('undo'),
        class: ['btn', 'btn--clear', 'md-ripple'],
        callback(e, hideToast) {
          onUndo();
          hideToast();
        }
      },
      onShow,
      onClose
    });
  }

  async function removeMultipleBookmarks(selectedBookmarks) {
    if (!settings.$.without_confirmation) {
      const confirmAction = await confirmPopup(getMessage('confirm_delete_selected_bookmarks'));
      if (!confirmAction) return false;
    }

    const toggleViewBookmarks = (hidden = false) => {
      selectedBookmarks.forEach(bookmark => {
        bookmark.hidden = hidden;
      });
    };
    const clearBoorkmarksToDelete = () => {
      selectedBookmarks.forEach(bookmark => {
        delete bookmarksToDelete[bookmark.id];
      });
    };

    selectedBookmarks.forEach(bookmark => {
      bookmarksToDelete[bookmark.id] = {
        id: bookmark.id,
        image: bookmark.image,
        isFolder: bookmark.isFolder
      };
    });

    let isHidden = true;
    toggleViewBookmarks(isHidden);

    return new Promise(resolve => {
      showRemoveBookmarkToast({
        message: getMessage('notice_selected_bookmarks_removed'),
        onShow() {
        // When showing the toast, we need to notify that the toast has appeared so the initiator can clean up after itself.
        // This isn't a very reliable method because there’s no guarantee everything will be properly removed.
        // However, it’s important for us to hide the action panel;
        // otherwise, while the toast with the timer is visible, the user can still interact with the action panel, which could lead to unwanted issues.
          resolve(true);
        },
        onUndo() {
          isHidden = false;
          toggleViewBookmarks(false);
          clearBoorkmarksToDelete();
        },
        async onClose() {
          if (isHidden) {
            clearBoorkmarksToDelete();

            await Promise.all(selectedBookmarks.map(async(bookmark) => {
              const { id, isFolder } = bookmark;
              removeThumbnail(id, isFolder);
              await (isFolder ? removeTree(id) : remove(id));
              bookmark.remove();
            }));

            $customTrigger('updateFolderList', document);
          }
        }
      });
    });
  }

  async function removeBookmark(bookmark, isFolder = false) {
    if (!settings.$.without_confirmation) {
      const confirmMessage = isFolder
        ? getMessage('confirm_delete_folder')
        : getMessage('confirm_delete_bookmark');

      const confirmAction = await confirmPopup(confirmMessage);
      if (!confirmAction) return;
    }

    const id = bookmark.dataset.id;
    const message = isFolder
      ? getMessage('notice_folder_removed', bookmark.title)
      : getMessage('notice_bookmark_removed', bookmark.title);

    bookmark.hidden = true;
    bookmarksToDelete[bookmark.id] = {
      id: bookmark.id,
      image: bookmark.image,
      isFolder: bookmark.isFolder
    };

    showRemoveBookmarkToast({
      message,
      onUndo() {
        delete bookmarksToDelete[id];
        bookmark.hidden = false;
      },
      onClose() {
        if (bookmark.hidden) {
          delete bookmarksToDelete[id];
          removeThumbnail(bookmark.id, isFolder);
          (isFolder ? removeTree : remove)(id)
            .then(() => {
              bookmark.remove();
              $customTrigger('updateFolderList', document);
            });
        }
      }
    });
  }

  async function removeThumbnail(id, isFolder = false) {
    const ids = [id];

    if (isFolder) {
      const subTree = await getSubTree(id);
      const nestedBookmarksIds = flattenArrayBookmarks(subTree[0].children, true).map(({ id }) => id);
      ids.push(...nestedBookmarksIds);
    }

    const thumbnail = THUMBNAILS_MAP.get(id);
    if (thumbnail) {
      URL.revokeObjectURL(thumbnail.blobUrl);
    }
    THUMBNAILS_MAP.delete(id);

    return Promise.all(
      ids.map(id => ImageDB.delete(id))
    );
  }

  function createBookmark(title, url) {
    const parentId = container.getAttribute('data-folder');

    return create({ title, ...(url && { url }), parentId })
      .then(result => {
        let bookmark;
        if (result.url) {
          bookmark = genBookmark(result);
        } else {
          bookmark = genFolder(result);
        }
        container.querySelector('.bookmark-btn--create').insertAdjacentElement('beforeBegin', bookmark);

        $customTrigger('updateFolderList', document);
        // if (!result.url) {
        //   $customTrigger('updateFolderList', document, {
        //     detail: {
        //       isFolder: true
        //     }
        //   });
        // }

        return bookmark;
      });
  }

  async function updateBookmark(id, title, url, moveId) {
    const bookmark = document.getElementById(`vb-${id}`);

    const result = await update(id, { title, ...(url && { url }) });

    // if the bookmark is moved to another folder
    if (moveId !== id && moveId !== result.parentId) {
      const destination = {
        parentId: moveId,
        ...(settings.$.move_to_start && { index: 0 })
      };
      await move(id, destination);
      if (!isDefaultFolder(moveId)) {
        await removeThumbnail(id, !result.url);
      }
      $customTrigger('updateFolderList', document);
      bookmark.remove();
    } else {
      // else update bookmark view
      bookmark.parentId = result.parentId;
      bookmark.title = result.title;
      bookmark.url = result.url ? result.url : `#${result.id}`;
      $customTrigger('updateFolderList', document);
    }
    Toast.show(getMessage('notice_bookmark_updated'));
    return bookmark;
  }

  return {
    init,
    refresh: () => createSpeedDial(startFolder()),
    setToolbarVisibility,
    createBookmark,
    updateBookmark,
    removeFromBrowser,
    removeBookmark,
    removeMultipleBookmarks,
    createScreen,
    captureThumbnailBlob,
    fetchThumbnailBlob,
    uploadScreen,
    setRemoteThumbnail,
    setLocalThumbnailSource,
    setFaviconThumbnailSource,
    setThumbnailSize,
    clearCachedThumbnail,
    setFaviconPreferences,
    removeThumbnail,
    autoUpdateThumb,
    updateSelectedThumbnails,
    moveSelectedBookmarks,
    checkHostPermissions,
    isDefaultFolder
  };
})();

export default Bookmarks;
