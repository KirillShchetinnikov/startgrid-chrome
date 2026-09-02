import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

describe('grid spacing', () => {
  it('keeps fixed-width tile tracks independent from spacing', () => {
    const gridCss = readFileSync('src/css/components/_grid.css', 'utf8');
    const bookmarkCss = readFileSync('src/css/components/_bookmark.css', 'utf8');
    const uiSource = readFileSync('src/js/components/ui.js', 'utf8');

    expect(gridCss).toMatch(/column-gap:\s*var\(--grid-column-gap\)/);
    expect(gridCss).toMatch(/row-gap:\s*var\(--grid-row-gap\)/);
    expect(gridCss).toMatch(/var\(--grid-column-width\)/);
    expect(uiSource).toContain("doc.style.setProperty('--grid-column-width', `${displayedTileSize}px`)");
    expect(uiSource).toContain('const tileSize');
    expect(uiSource).toContain("doc.style.setProperty('--grid-columns', columns)");
    expect(bookmarkCss).toMatch(/\.bookmark\s*\{[\s\S]*?aspect-ratio:\s*var\(--bookmark-aspect-ratio\)/);
  });
});
