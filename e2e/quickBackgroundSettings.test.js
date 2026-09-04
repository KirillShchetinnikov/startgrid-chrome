import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';

describe('quick background settings', () => {
  it('offers every background mode and applies it immediately', () => {
    const source = readFileSync('src/js/components/quickDisplaySettings.js', 'utf8');

    expect(source).toMatch(/id="quick_background_image"\s+data-setting="background_image"/);
    [
      'background_noimage',
      'background_color',
      'background_external',
      'background_local',
      'background_bing'
    ].forEach(value => {
      expect(source).toContain(`option value="${value}"`);
    });
    expect(source).toMatch(/key === 'background_image'[\s\S]*?await UI\.setBG\(\)/);
    expect(source).toContain('data-setting="background_color"');
    expect(source).toContain('data-setting="background_external"');
    expect(source).toContain('data-quick-background-upload');
    expect(source).toContain('data-quick-background-remove');
    expect(source).not.toContain('data-quick-background-preview');
    expect(source).toMatch(/key === 'background_color'[\s\S]*?await UI\.setBG\(\)/);
  });

  it('removes the previous background resource before applying the next one', () => {
    const source = readFileSync('src/js/components/ui.js', 'utf8');

    expect(source).toMatch(/bgEl\.replaceChildren\(\);[\s\S]*?bgEl\.classList\.remove\('is-visible'\)/);
    expect(source).toContain("document.querySelectorAll('.bing-info').forEach(node => node.remove())");
  });
});
