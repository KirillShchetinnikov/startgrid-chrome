import { describe, expect, it } from '@jest/globals';
import {
  updateBookmarkFolderState,
  updateBookmarkSearchState,
  updateMainPageScrollLock
} from '../src/js/mainPageScroll';

function createRoot() {
  const classes = new Set();
  return {
    classList: {
      contains: value => classes.has(value),
      toggle(value, enabled) {
        if (enabled) classes.add(value);
        else classes.delete(value);
      }
    }
  };
}

describe('main page scrolling', () => {
  it('locks the main page and resets its scroll position', () => {
    const root = createRoot();
    const scrollContainer = { scrollTop: 320 };

    updateMainPageScrollLock(true, root, scrollContainer);

    expect(root.classList.contains('disable-main-page-scroll')).toBe(true);
    expect(scrollContainer.scrollTop).toBe(0);
  });

  it('allows bookmark search to scroll and resets when returning home', () => {
    const root = createRoot();
    const scrollContainer = { scrollTop: 0 };
    updateMainPageScrollLock(true, root, scrollContainer);

    updateBookmarkSearchState(true, root, scrollContainer);
    scrollContainer.scrollTop = 480;
    expect(root.classList.contains('has-search')).toBe(true);
    expect(scrollContainer.scrollTop).toBe(480);

    updateBookmarkSearchState(false, root, scrollContainer);
    expect(root.classList.contains('has-search')).toBe(false);
    expect(scrollContainer.scrollTop).toBe(0);
  });

  it('does not reset the main page when the lock is disabled', () => {
    const root = createRoot();
    const scrollContainer = { scrollTop: 240 };

    updateBookmarkSearchState(false, root, scrollContainer);

    expect(scrollContainer.scrollTop).toBe(240);
  });

  it('allows scrolling in another folder and restores the lock at home', () => {
    const root = createRoot();
    const scrollContainer = { scrollTop: 0 };
    updateMainPageScrollLock(true, root, scrollContainer);

    updateBookmarkFolderState(true, root, scrollContainer);
    scrollContainer.scrollTop = 360;
    updateBookmarkSearchState(false, root, scrollContainer);

    expect(root.classList.contains('has-folder-navigation')).toBe(true);
    expect(scrollContainer.scrollTop).toBe(360);

    updateBookmarkFolderState(false, root, scrollContainer);

    expect(root.classList.contains('has-folder-navigation')).toBe(false);
    expect(scrollContainer.scrollTop).toBe(0);
  });

  it('keeps another folder scrollable after leaving search', () => {
    const root = createRoot();
    const scrollContainer = { scrollTop: 0 };
    updateMainPageScrollLock(true, root, scrollContainer);
    updateBookmarkFolderState(true, root, scrollContainer);
    updateBookmarkSearchState(true, root, scrollContainer);
    scrollContainer.scrollTop = 420;

    updateBookmarkSearchState(false, root, scrollContainer);

    expect(scrollContainer.scrollTop).toBe(420);
  });
});
