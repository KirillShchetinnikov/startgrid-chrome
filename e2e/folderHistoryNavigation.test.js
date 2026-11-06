import { readFileSync } from 'node:fs';
import { describe, expect, it, jest } from '@jest/globals';
import { getCurrentFolderId, initFolderNavigation, navigateBack } from '../src/js/folderNavigation';

describe('folder browser history navigation', () => {
  const navigationSource = readFileSync('src/js/folderNavigation.js', 'utf8');
  const newtabSource = readFileSync('src/js/newtab.js', 'utf8');

  it('stores folder transitions in same-URL browser history entries', () => {
    expect(navigationSource).toContain("const FOLDER_HISTORY_KEY = 'startGridFolderId'");
    expect(navigationSource).toContain("const method = replace ? 'replaceState' : 'pushState'");
    expect(navigationSource).toContain("}, '', historyUrl())");
  });

  it('restores folders on browser back and forward actions', () => {
    expect(navigationSource).toContain('export function restoreFolderFromHistory(state)');
    expect(newtabSource).toContain('restoreFolderFromHistory(event.state)');
  });

  it('uses native history for the in-page back button when possible', () => {
    expect(navigationSource).toMatch(/if \(historyDepth > 0\) \{\s*window\.history\.back\(\)/);
  });

  it.each([
    ['back_forward', '42', false],
    ['navigate', '1', true],
    ['reload', '1', true]
  ])('initializes the expected folder on a %s load', (type, expectedFolder, replacesState) => {
    const history = {
      state: { startGridFolderId: '42', startGridFolderDepth: 2 },
      replaceState: jest.fn(),
      back: jest.fn()
    };
    globalThis.window = {
      history,
      location: { pathname: '/newtab.html', search: '', hash: '' },
      performance: { getEntriesByType: () => [{ type }] }
    };

    try {
      initFolderNavigation('1');
      expect(getCurrentFolderId()).toBe(expectedFolder);
      expect(history.replaceState).toHaveBeenCalledTimes(replacesState ? 1 : 0);
      if (type === 'back_forward') {
        navigateBack('1');
        expect(history.back).toHaveBeenCalledTimes(1);
      }
    } finally {
      delete globalThis.window;
    }
  });
});
