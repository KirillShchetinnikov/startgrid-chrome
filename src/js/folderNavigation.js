let currentFolderId = null;
const folderHistory = [];

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
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

export function getCurrentFolderId() {
  return currentFolderId;
}

export function navigateToFolder(folderId, force = false) {
  const nextFolderId = String(folderId);
  if (!nextFolderId || (!force && nextFolderId === currentFolderId)) return;

  if (currentFolderId !== null && nextFolderId !== currentFolderId) {
    folderHistory.push(currentFolderId);
  }
  currentFolderId = nextFolderId;
  dispatchFolderNavigation();
}

export function navigateBack(defaultFolderId) {
  const previousFolderId = folderHistory.pop() ?? String(defaultFolderId);
  if (previousFolderId === currentFolderId) return;

  currentFolderId = previousFolderId;
  dispatchFolderNavigation();
}

export function navigateHome(defaultFolderId, force = false) {
  const homeFolderId = String(defaultFolderId);
  folderHistory.length = 0;
  if (!homeFolderId || (!force && homeFolderId === currentFolderId)) return;

  currentFolderId = homeFolderId;
  dispatchFolderNavigation();
}
