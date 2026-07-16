export const BOOKMARK_USAGE_STORAGE_KEY = 'bookmark_usage_counts';

function compareAlphabetically(a, b) {
  return a.title.localeCompare(b.title, undefined, {
    sensitivity: 'base',
    numeric: true
  });
}

function compareByDate(a, b) {
  return (b.dateAdded || 0) - (a.dateAdded || 0);
}

function applyFolderPlacement(items, placement) {
  if (placement === 'folders_top') {
    items.sort((a, b) => Object.hasOwn(b, 'children') - Object.hasOwn(a, 'children'));
  } else if (placement === 'folders_bottom') {
    items.sort((a, b) => Object.hasOwn(a, 'children') - Object.hasOwn(b, 'children'));
  }
  return items;
}

export function getBookmarkUsageCounts() {
  try {
    return JSON.parse(localStorage.getItem(BOOKMARK_USAGE_STORAGE_KEY)) || {};
  } catch (error) {
    return {};
  }
}

export function recordBookmarkUsage(bookmarkId) {
  const counts = getBookmarkUsageCounts();
  counts[bookmarkId] = (parseInt(counts[bookmarkId]) || 0) + 1;
  localStorage.setItem(BOOKMARK_USAGE_STORAGE_KEY, JSON.stringify(counts));
  return counts[bookmarkId];
}

export function sortHomeBookmarks(items, currentSettings, usageCounts = {}) {
  const sorted = currentSettings.show_home_folders
    ? [...items]
    : items.filter(item => !Object.hasOwn(item, 'children'));

  if (
    currentSettings.home_sort_by === 'manual'
    && !currentSettings.home_manual_sort_initialized
  ) {
    sorted.sort(compareAlphabetically);
  } else if (currentSettings.home_sort_by === 'date') {
    sorted.sort(compareByDate);
    if (currentSettings.home_sort_date_direction === 'asc') sorted.reverse();
  } else if (currentSettings.home_sort_by === 'alphabet') {
    sorted.sort(compareAlphabetically);
    if (currentSettings.home_sort_alphabet_direction === 'desc') sorted.reverse();
  } else if (currentSettings.home_sort_by === 'usage') {
    const tieBreaker = currentSettings.home_sort_usage_tiebreaker === 'date'
      ? compareByDate
      : compareAlphabetically;
    sorted.sort((a, b) => {
      const usageDifference = (parseInt(usageCounts[b.id]) || 0)
        - (parseInt(usageCounts[a.id]) || 0);
      return usageDifference || tieBreaker(a, b);
    });
  }

  return applyFolderPlacement(sorted, currentSettings.bookmarks_sorting_type);
}

export function sortNestedBookmarks(items, sortBy) {
  const sorted = [...items];
  if (sortBy === 'date') sorted.sort(compareByDate);
  else if (sortBy === 'alphabet') sorted.sort(compareAlphabetically);
  return sorted;
}
