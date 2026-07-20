import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';
import {
  PAGE_ENTRANCE_EFFECTS,
  normalizePageEntranceEffect
} from '../src/js/pageEntrance';

describe('page entrance effects', () => {
  it('supports the current reveal, panel zoom, and soft rise effects', () => {
    expect(PAGE_ENTRANCE_EFFECTS).toEqual(['reveal', 'zoom', 'rise']);
    PAGE_ENTRANCE_EFFECTS.forEach(effect => {
      expect(normalizePageEntranceEffect(effect)).toBe(effect);
    });
    expect(normalizePageEntranceEffect('unknown')).toBe('reveal');
  });

  it('runs every effect through the shared page-entering timing', () => {
    const css = readFileSync('src/css/pages/_newtab.css', 'utf8');

    expect(css).toMatch(/@keyframes page-tile-enter/);
    expect(css).toMatch(/@keyframes page-panel-zoom-enter/);
    expect(css).toMatch(/@keyframes page-soft-rise-enter/);
    PAGE_ENTRANCE_EFFECTS.forEach(effect => {
      expect(css).toContain(`[data-page-entrance-effect="${effect}"]`);
    });
    expect(css).toMatch(
      /animation-duration:\s*var\(--page-cascade-item-duration,\s*420ms\)/
    );
    expect(css).toMatch(
      /animation-delay:\s*var\(--page-cascade-delay,\s*0ms\)/
    );
  });
});
