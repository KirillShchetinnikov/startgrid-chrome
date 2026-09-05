let currentFolderId = null;
let historyDepth = 0;
const FOLDER_HISTORY_KEY = 'startGridFolderId';
const FOLDER_HISTORY_DEPTH_KEY = 'startGridFolderDepth';

function historyUrl() {
  return window.location.pathname + window.location.search;
}

function saveFolderHistory(folderId, replace = false) {
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method]({
    ...window.history.state,
    [FOLDER_HISTORY_KEY]: String(folderId),
    [FOLDER_HISTORY_DEPTH_KEY]: historyDepth
  }, '', historyUrl());
}

function dispatchFolderNavigation() {
  document.dispatchEvent(new CustomEvent('folderNavigate', {
    detail: { folderId: currentFolderId }
  }));
}

export function initFolderNavigation(folderId) {
  currentFolderId = String(folderId);

  // Older versions stored the current folder in the URL hash. Honour that URL
  // once, then remove it so Chrome keeps the new-tab address bar empty.
  if (window.location.hash) {
    currentFolderId = window.location.hash.slice(1);
  }
  historyDepth = 0;
  saveFolderHistory(currentFolderId, true);
}

export function getCurrentFolderId() {
  return currentFolderId;
}

export function navigateToFolder(folderId, force = false) {
  const nextFolderId = String(folderId);
  if (!nextFolderId || (!force && nextFolderId === currentFolderId)) return;

  currentFolderId = nextFolderId;
  historyDepth += 1;
  saveFolderHistory(currentFolderId);
  dispatchFolderNavigation();
}

export function navigateBack(defaultFolderId) {
  if (historyDepth > 0) {
    window.history.back();
    return;
  }

  const homeFolderId = String(defaultFolderId);
  if (homeFolderId === currentFolderId) return;
  currentFolderId = homeFolderId;
  historyDepth += 1;
  saveFolderHistory(currentFolderId);
  dispatchFolderNavigation();
}

export function navigateHome(defaultFolderId, force = false) {
  const homeFolderId = String(defaultFolderId);
  if (!homeFolderId || (!force && homeFolderId === currentFolderId)) return;

  currentFolderId = homeFolderId;
  historyDepth += 1;
  saveFolderHistory(currentFolderId);
  dispatchFolderNavigation();
}

export function restoreFolderFromHistory(state) {
  const folderId = state?.[FOLDER_HISTORY_KEY];
  if (!folderId) return false;

  historyDepth = Number(state[FOLDER_HISTORY_DEPTH_KEY]) || 0;
  if (String(folderId) === currentFolderId) return false;

  currentFolderId = String(folderId);
  dispatchFolderNavigation();
  return true;
}
