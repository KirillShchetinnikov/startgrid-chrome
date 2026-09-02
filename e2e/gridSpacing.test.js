import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

describe('grid spacing', () => {
  it('keeps tile tracks independent from horizontal and vertical spacing', () => {
    const gridCss = readFileSync('src/css/components/_grid.css', 'utf8');
    const uiSource = readFileSync('src/js/components/ui.js', 'utf8');

    expect(gridCss).toMatch(/column-gap:\s*var\(--grid-column-gap\)/);
    expect(gridCss).toMatch(/row-gap:\s*var\(--grid-row-gap\)/);
    expect(gridCss).toMatch(/var\(--grid-column-width\)/);
    expect(uiSource).toContain('const preferredColumnWidth');
    expect(uiSource).toContain('const maxColumnWidth');
  });
});
