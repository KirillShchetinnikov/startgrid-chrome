import { describe, expect, it } from '@jest/globals';
import {
  getBookmarkUsageCounts,
  recordBookmarkUsage,
  sortHomeBookmarks,
  sortNestedBookmarks
} from '../src/js/bookmarkSorting';

const bookmarks = [
  { id: '1', title: 'Bravo', dateAdded: 200 },
  { id: '2', title: 'alpha 10', dateAdded: 100 },
  { id: '3', title: 'Alpha 2', dateAdded: 300 },
  { id: '4', title: 'Folder', dateAdded: 50, children: [] }
];

const defaults = {
  home_sort_by: 'manual',
  home_sort_date_direction: 'desc',
  home_sort_alphabet_direction: 'desc',
  home_sort_usage_tiebreaker: 'alphabet',
  home_manual_sort_initialized: false,
  show_home_folders: true,
  bookmarks_sorting_type: 'together'
};

describe('home page bookmark sorting', () => {
  it('stores usage counts locally and returns the updated value', () => {
    let storedValue = null;
    global.localStorage = {
      getItem: () => storedValue,
      setItem: (key, value) => {
        storedValue = value;
      }
    };

    expect(recordBookmarkUsage('2')).toBe(1);
    expect(recordBookmarkUsage('2')).toBe(2);
    expect(getBookmarkUsageCounts()).toEqual({ 2: 2 });
    delete global.localStorage;
  });

  it('starts uninitialized manual sorting alphabetically', () => {
    expect(sortHomeBookmarks(bookmarks, defaults).map(item => item.id))
      .toEqual(['3', '2', '1', '4']);
  });

  it('keeps the browser order after manual sorting was initialized', () => {
    const settings = { ...defaults, home_manual_sort_initialized: true };
    expect(sortHomeBookmarks(bookmarks, settings).map(item => item.id))
      .toEqual(['1', '2', '3', '4']);
  });

  it('supports date and alphabet directions', () => {
    const byDate = { ...defaults, home_sort_by: 'date' };
    const byAlphabet = { ...defaults, home_sort_by: 'alphabet' };

    expect(sortHomeBookmarks(bookmarks, byDate).map(item => item.id))
      .toEqual(['3', '1', '2', '4']);
    expect(sortHomeBookmarks(bookmarks, {
      ...byDate,
      home_sort_date_direction: 'asc'
    }).map(item => item.id)).toEqual(['4', '2', '1', '3']);
    expect(sortHomeBookmarks(bookmarks, byAlphabet).map(item => item.id))
      .toEqual(['4', '1', '2', '3']);
  });

  it('sorts by local usage and applies the selected tie breaker', () => {
    const settings = { ...defaults, home_sort_by: 'usage' };
    const counts = { 1: 7, 2: 7, 3: 4 };

    expect(sortHomeBookmarks(bookmarks, settings, counts).map(item => item.id))
      .toEqual(['2', '1', '3', '4']);
    expect(sortHomeBookmarks(bookmarks, {
      ...settings,
      home_sort_usage_tiebreaker: 'date'
    }, counts).map(item => item.id)).toEqual(['1', '2', '3', '4']);
  });

  it('can hide folders or place them above bookmarks', () => {
    expect(sortHomeBookmarks(bookmarks, {
      ...defaults,
      show_home_folders: false
    }).map(item => item.id)).toEqual(['3', '2', '1']);
    expect(sortHomeBookmarks(bookmarks, {
      ...defaults,
      bookmarks_sorting_type: 'folders_top'
    }).map(item => item.id)).toEqual(['4', '3', '2', '1']);
  });
});

describe('folder and search sorting', () => {
  it('supports browser order, alphabet and date', () => {
    expect(sortNestedBookmarks(bookmarks, '').map(item => item.id))
      .toEqual(['1', '2', '3', '4']);
    expect(sortNestedBookmarks(bookmarks, 'alphabet').map(item => item.id))
      .toEqual(['3', '2', '1', '4']);
    expect(sortNestedBookmarks(bookmarks, 'date').map(item => item.id))
      .toEqual(['3', '1', '2', '4']);
  });
});
