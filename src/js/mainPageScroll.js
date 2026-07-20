const LOCK_CLASS = 'disable-main-page-scroll';
const SEARCH_CLASS = 'has-search';
const FOLDER_CLASS = 'has-folder-navigation';

function resetScroll(root, scrollContainer) {
  if (
    root.classList.contains(LOCK_CLASS)
    && !root.classList.contains(SEARCH_CLASS)
    && !root.classList.contains(FOLDER_CLASS)
  ) {
    scrollContainer.scrollTop = 0;
  }
}

export function updateMainPageScrollLock(
  enabled,
  root = document.body,
  scrollContainer = document.querySelector('.app')
) {
  root.classList.toggle(LOCK_CLASS, Boolean(enabled));
  if (scrollContainer) resetScroll(root, scrollContainer);
}

export function updateBookmarkSearchState(
  active,
  root = document.body,
  scrollContainer = document.querySelector('.app')
) {
  root.classList.toggle(SEARCH_CLASS, Boolean(active));
  if (scrollContainer) resetScroll(root, scrollContainer);
}

export function updateBookmarkFolderState(
  active,
  root = document.body,
  scrollContainer = document.querySelector('.app')
) {
  root.classList.toggle(FOLDER_CLASS, Boolean(active));
  if (scrollContainer) resetScroll(root, scrollContainer);
}
