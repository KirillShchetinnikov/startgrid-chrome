import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

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
});
