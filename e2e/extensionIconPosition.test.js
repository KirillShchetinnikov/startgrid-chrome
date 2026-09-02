import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

describe('extension icon position', () => {
  it('floats above the page in the lower-left corner without narrowing the grid', () => {
    const pageCss = readFileSync('src/css/pages/_newtab.css', 'utf8');
    const uiSource = readFileSync('src/js/components/ui.js', 'utf8');

    expect(pageCss).toMatch(/\.extension-icon\s*\{[^}]*z-index:\s*10001[^}]*bottom:\s*24px[^}]*left:\s*24px/s);
    expect(pageCss).not.toMatch(/\.has-extension-icon\s+\.header/);
    expect(uiSource).not.toMatch(/settings\.\$\.show_extension_icon/);
  });
});
