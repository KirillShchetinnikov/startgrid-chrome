import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

describe('folder marker styles', () => {
  const component = readFileSync('src/js/components/vb-bookmark/index.js', 'utf8');
  const styles = readFileSync('src/css/components/_bookmark.css', 'utf8');
  const bookmarks = readFileSync('src/js/components/bookmarks.js', 'utf8');

  it('passes the global style to every generated folder', () => {
    expect(bookmarks).toContain('folderMarkerStyle: settings.effective.folder_marker_style');
    expect(component).toContain(`'folder-marker-style'`);
  });

  it('renders icon markers and styles the structural variants', () => {
    expect(component).toContain(`this.folderMarkerStyle === 'badge'`);
    expect(component).toContain(`this.folderMarkerStyle === 'title'`);
    expect(styles).toContain('[folder-marker-style="tab"]');
    expect(styles).toContain('[folder-marker-style="border"]');
  });
});
