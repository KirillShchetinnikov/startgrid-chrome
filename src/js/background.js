import ImageDB from './api/imageDB';
import { getMessage, hasLanguageSettingChanged, initializeI18n } from './i18n';
import browserContextMenu from './plugins/browserContextMenu';
import { getDefaultFolderId, settings } from './settings';
import { storage } from './api/storage';
import {
  $notifications,
  $base64ToBlob,
  $resizeThumbnail
} from './utils';
import {
  create,
  get,
  getSubTree,
  flattenArrayBookmarks,
  search,
  remove,
  removeTree
} from './api/bookmark';
import {
  NEWTAB_URLS,
  NEWTAB_EMPTY_URLS
} from './constants';
import { containsPermissions } from './api/permissions';
import { getBlobHash } from './api/remoteThumbnail';
import { shouldDownloadFavicon } from './api/faviconPreferences';
import { requestSearchSuggestions } from './searchSuggestions';
import {
  cleanupRemovedBookmark,
  createBookmarkImportGuard,
  createBookmarksChangedEnvelope,
  runOptionalSideEffectBeforeBroadcast
} from './bookmarkEvents';
import {
  getCaptureWorkerTimeout,
  normalizeCaptureDelay,
  runThumbnailCapture
} from './thumbnailCapture';

function startI18n(language) {
  return initializeI18n({ language })
    .catch(error => console.warn('Could not initialize StartGrid language', error));
}

let i18nReady = startI18n();
const bookmarkImportGuard = createBookmarkImportGuard({
  readGuard: async() => {
    const { importingBookmarks } = await storage.local.get('importingBookmarks');
    return importingBookmarks;
  },
  writeGuard: () => storage.local.set({ importingBookmarks: true }),
  clearGuard: () => storage.local.remove('importingBookmarks')
});

function getHtmlAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
}

async function fetchFavicon(pageUrl) {
  const pageResponse = await fetch(pageUrl, { cache: 'no-cache' });
  if (!pageResponse.ok) {
    throw new Error(`Page returned HTTP ${pageResponse.status}`);
  }

  const pageContentType = pageResponse.headers.get('content-type') || '';
  const candidates = [];
  if (pageContentType.toLowerCase().includes('text/html')) {
    const html = await pageResponse.text();
    const linkTags = html.match(/<link\b[^>]*>/gi) || [];

    linkTags.forEach(tag => {
      const rel = getHtmlAttribute(tag, 'rel')?.toLowerCase() || '';
      const href = getHtmlAttribute(tag, 'href');
      if (!href || !rel.split(/\s+/).some(value => value === 'icon' || value.endsWith('-icon'))) {
        return;
      }

      try {
        candidates.push(new URL(href.replaceAll('&amp;', '&'), pageResponse.url).href);
      } catch (error) {}
    });
  }

  candidates.push(new URL('/favicon.ico', pageResponse.url).href);

  for (const candidate of [...new Set(candidates)]) {
    try {
      const response = await fetch(candidate, { cache: 'no-cache' });
      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.toLowerCase().startsWith('image/')) {
        return response;
      }
    } catch (error) {}
  }

  throw new Error('The site did not provide a favicon');
}

async function updateRemoteThumbnail({ id, url, source = 'url', sourceUrl = url }) {
  const existing = await ImageDB.get(id);
  const checkedAt = Date.now();
  const headers = {};

  if (existing?.source === source && existing?.sourceUrl === sourceUrl) {
    if (existing.etag) headers['If-None-Match'] = existing.etag;
    if (existing.lastModified) headers['If-Modified-Since'] = existing.lastModified;
  }

  try {
    const response = source === 'favicon'
      ? await fetchFavicon(sourceUrl)
      : await fetch(url, {
        cache: 'no-cache',
        headers
      });

    if (response.status === 304 && existing?.blob) {
      await ImageDB.update({
        ...existing,
        source,
        sourceUrl,
        checkedAt
      });
      return { success: true, updated: false };
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      throw new Error('URL did not return an image');
    }

    const downloadedBlob = await response.blob();
    const contentHash = await getBlobHash(downloadedBlob);
    const isSameImage = existing?.source === source
      && existing?.sourceUrl === sourceUrl
      && existing?.contentHash === contentHash
      && existing?.blob;
    const blob = isSameImage
      ? existing.blob
      : contentType.toLowerCase().includes('image/svg+xml')
        ? downloadedBlob
        : await $resizeThumbnail(downloadedBlob);

    await ImageDB.update({
      id,
      ...(existing || {}),
      blob,
      custom: true,
      source,
      sourceUrl,
      contentHash,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
      checkedAt
    });

    return { success: true, updated: !isSameImage };
  } catch (error) {
    await ImageDB.update({
      ...(existing || { id }),
      source,
      sourceUrl,
      checkedAt
    });
    return { success: false, error: error.message };
  }
}

function browserActionHandler() {
  browser.tabs.query({ currentWindow: true }, function(tabs) {
    for (let tab of tabs) {
      if (NEWTAB_URLS.some(url => tab.url.startsWith(url))) {
        return browser.tabs.update(tab.id, { active: true });
      }
    }
    // Let the browser open its real new-tab URL. Opening newtab.html directly
    // makes the chrome-extension:// URL visible in the address bar.
    return browser.tabs.create({});
  });
}

async function initContextMenu() {
  await i18nReady;
  const { settings } = await storage.local.get('settings');
  return browserContextMenu.init(settings.show_contextmenu_item);
}

async function captureScreen(request) {
  const [{ screen }, { settings }] = await Promise.all([
    storage.local.get('screen'),
    storage.local.get('settings')
  ]);
  const captureDelay = normalizeCaptureDelay(
    (parseFloat(settings?.thumbnails_update_delay) || 0.5) * 1000
  );

  return runThumbnailCapture({
    browserApi: browser,
    request,
    screen,
    captureDelay,
    timeoutMs: getCaptureWorkerTimeout(captureDelay),
    cleanupCapture: String(request.id).startsWith('pending-thumbnail-')
      ? () => ImageDB.delete(request.id)
      : null,
    async storeCapture(dataUrl) {
      const fileBlob = $base64ToBlob(dataUrl, 'image/webp');
      const blob = await $resizeThumbnail(fileBlob);
      const existing = await ImageDB.get(request.id);
      return ImageDB.update({
        id: request.id,
        ...(existing || {}),
        blob,
        custom: false,
        source: 'site',
        checkedAt: Date.now()
      });
    }
  });
}

function handleCreateBookmark(data) {
  browser.tabs.query({ active: true, currentWindow: true }, async function(tabs){
    await i18nReady;
    const matches = await search(data.pageUrl);
    if (!matches) return;

    const isExist = matches.some(match => match.url === data.pageUrl);
    if (isExist) {
      // Bookmarks exist
      $notifications(getMessage('notice_bookmark_exist'));
    } else {
      const { settings } = await storage.local.get('settings');
      // ID of the item for subfolders starts with 'save-{parentId}'
      // to get a valid ID, remove the extra characters from the string
      // extra characters will be found in subfolders in the add item
      const menuItemId = data.menuItemId.replace('save-', '');

      const parentId = (menuItemId === 'current_folder')
        ? String(getDefaultFolderId(settings))
        : menuItemId;

      // Create
      const response = await create({
        parentId,
        url: data.pageUrl,
        title: tabs[0].title
      }).catch(err => {
        console.warn(err);
      });

      // do not generate a thumbnail if you could not create a bookmark or the auto-generation option is turned off
      if (!response) return;

      if (settings.close_tab_after_adding_bookmark) {
        browser.tabs.remove(tabs[0].id);
      }
      $notifications(getMessage('notice_bookmark_created'));
    }
  });
}

async function handleCreatedTab(tab) {
  const { settings } = await storage.local.get('settings');
  if (!tab.incognito && settings.search_autofocus && NEWTAB_EMPTY_URLS.includes(tab.pendingUrl)) {
    // bug in MS Edge causes runtime.getURL to return the chrome-extension namespace, while it opens through the extension namespace.
    const url = /Edg\//.test(navigator.userAgent)
      ? browser.runtime.getURL('newtab.html').replace(/^chrome-extension:/, 'extension:')
      : browser.runtime.getURL('newtab.html');

    browser.tabs.create({
      url
    });
    browser.tabs.remove(tab.id);
  }
}

function handleCreateThumbnail(id, bookmark) {
  return updateRemoteThumbnail({
    id,
    url: bookmark.url,
    source: 'favicon',
    sourceUrl: bookmark.url
  });
}

async function removeStoredThumbnails(id) {
  const subTree = await getSubTree(id).catch(() => null);
  const ids = [id];

  if (subTree?.[0]?.children) {
    ids.push(
      ...flattenArrayBookmarks(subTree[0].children, true).map(bookmark => bookmark.id)
    );
  }

  await Promise.all(ids.map(thumbnailId => ImageDB.delete(thumbnailId)));
}

async function handleBookmarks(eventType, id, bookmark) {
  if (await bookmarkImportGuard.isActive()) return;

  const isBookmarkUrl = bookmark.url || bookmark.node?.url;
  const broadcast = () => new Promise(resolve => {
    browser.runtime.sendMessage(
      createBookmarksChangedEnvelope(eventType, id),
      () => {
        browser.runtime.lastError;
        resolve();
      }
    );
  });

  if (eventType === 'removed') {
    await cleanupRemovedBookmark({
      node: bookmark.node,
      fallbackId: id,
      deleteById: thumbnailId => ImageDB.delete(thumbnailId),
      broadcast
    });
    if (!isBookmarkUrl) {
      await initContextMenu()
        .catch(error => console.warn('Could not rebuild context menu', error));
    }
    return;
  }

  const { settings } = await storage.local.get('settings');
  let currentBookmark = bookmark;
  if (['changed', 'moved'].includes(eventType)) {
    const bookmarks = await get(id).catch(() => []);
    currentBookmark = bookmarks[0] || bookmark;
  }

  const isHomeBookmark = String(currentBookmark.parentId)
    === String(getDefaultFolderId(settings));

  if (
    ['created', 'changed', 'moved'].includes(eventType)
    && !isHomeBookmark
  ) {
    await removeStoredThumbnails(id);
  }

  const thumbnail = isHomeBookmark ? await ImageDB.get(id) : null;
  const thumbnailSource = thumbnail?.source
    || (thumbnail?.blob ? (thumbnail.custom ? 'local' : 'site') : 'favicon');
  const downloadFavicon = shouldDownloadFavicon(thumbnail, settings.download_favicons_by_default);

  await runOptionalSideEffectBeforeBroadcast(async() => {
    if (
      ['created', 'changed'].includes(eventType) &&
      isHomeBookmark &&
      thumbnailSource === 'favicon' &&
      downloadFavicon &&
      currentBookmark.url
    ) {
      const allUrlsPermission = await containsPermissions({ origins: ['<all_urls>'] });
      if (allUrlsPermission) await handleCreateThumbnail(id, currentBookmark);
    }
  }, broadcast);

  if (!isBookmarkUrl || eventType === 'moved') {
    await initContextMenu()
      .catch(error => console.warn('Could not rebuild context menu', error));
  }
}

browser.storage.onChanged.addListener((changes, area) => {
  // if storage changes from local
  // watching the settings parameter
  if (
    area === 'local'
    && changes?.settings?.oldValue
    && changes?.settings?.newValue
  ) {
    const { show_contextmenu_item: newContextMenu } = changes.settings.newValue;
    const { show_contextmenu_item: oldContextMenu } = changes.settings.oldValue;

    if (hasLanguageSettingChanged(changes, area)) {
      i18nReady = startI18n(changes.settings.newValue.language);
      i18nReady.then(() => {
        const operation = newContextMenu
          ? browserContextMenu.init(true)
          : browserContextMenu.toggle(false);
        operation.catch(error => console.warn('Could not update context menu', error));
      });
      return;
    }

    // toggle the context menu only if show_contextmenu_item has changed
    if (newContextMenu !== oldContextMenu) {
      browserContextMenu.toggle(newContextMenu)
        .catch(error => console.warn('Could not update context menu', error));
    }
  }
});

browser.runtime.onInstalled.addListener(async(event) => {
  if (event.reason === 'install') {
    await settings.init();
  }
  i18nReady = startI18n();
  await initContextMenu().catch(error => console.warn('Could not initialize context menu', error));
});

const runBookmarkHandler = (eventType, id, bookmark) => {
  handleBookmarks(eventType, id, bookmark)
    .catch(error => console.warn(`Could not handle bookmark ${eventType}`, error));
};
browser.bookmarks.onCreated.addListener((id, bookmark) => runBookmarkHandler('created', id, bookmark));
browser.bookmarks.onChanged.addListener((id, bookmark) => runBookmarkHandler('changed', id, bookmark));
browser.bookmarks.onRemoved.addListener((id, bookmark) => runBookmarkHandler('removed', id, bookmark));
browser.bookmarks.onMoved.addListener((id, bookmark) => runBookmarkHandler('moved', id, bookmark));

browser.bookmarks.onImportBegan.addListener(() => {
  bookmarkImportGuard.begin()
    .catch(error => console.warn('Could not persist bookmark import guard', error));
});
browser.bookmarks.onImportEnded.addListener(() => {
  bookmarkImportGuard.complete({
    broadcast: envelope => new Promise(resolve => {
      browser.runtime.sendMessage(envelope, () => {
        browser.runtime.lastError;
        resolve();
      });
    }),
    reconcileContextMenu: initContextMenu
  })
    .catch(error => console.warn('Could not finish bookmark import', error));
});

browser.contextMenus.onClicked.addListener(handleCreateBookmark);
browser.action.onClicked.addListener(browserActionHandler);
browser.notifications.onClicked.addListener(browserActionHandler);

browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.searchSuggestions) {
    const { engine, query } = request.searchSuggestions;
    requestSearchSuggestions(engine, query)
      .then(suggestions => sendResponse({ suggestions }))
      .catch(() => sendResponse({ suggestions: [] }));
    return true;
  }

  if (request.remoteThumbnail) {
    updateRemoteThumbnail(request.remoteThumbnail)
      .then(sendResponse)
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.capture) {
    const id = String(request.capture?.id ?? '');
    let responded = false;
    const respond = response => {
      if (responded) return;
      responded = true;
      try {
        sendResponse(response);
      } catch (error) {
        console.warn('Could not send thumbnail capture response', error);
      }
    };
    captureScreen(request.capture)
      .then(respond)
      .catch(error => {
        console.warn('Thumbnail capture request failed', error);
        respond({ ok: false, id, code: 'STORE_FAILED' });
      });
    return true;
  }

  // Toggle contextmenu item
  if (request.showContextMenuItem) {
    const { checked } = request.showContextMenuItem;
    browserContextMenu.toggle(checked)
      .catch(error => console.warn('Could not toggle context menu', error));
  }

  // if there is a request to delete bookmarks, they must be deleted.
  // this is only possible in one case: if the undo timer has not yet expired, but the user has already closed or refreshed the page.
  // such a request will be handled only in the page’s beforeUnload event.
  if (request.bookmarksToDelete && Object.keys(request.bookmarksToDelete).length) {
    const { bookmarksToDelete } = request;
    Object.keys(bookmarksToDelete).forEach(bookmarkId => {
      const bookmark = bookmarksToDelete[bookmarkId];

      bookmark.isFolder
        ? removeTree(bookmarkId).catch(err => console.warn(err))
        : remove(bookmarkId).catch(err => console.warn(err));
    });
  }

  return false;
});

browser.tabs.onCreated.addListener(handleCreatedTab);
