import { readFileSync } from 'node:fs';
import { describe, expect, it } from '@jest/globals';
import { calculateCascadeTiming, getCascadeGroupIndexes } from '../src/js/pageCascade';

const createItems = (...rowCounts) => rowCounts.flatMap((count, rowIndex) => (
  Array.from({ length: count }, () => ({ offsetTop: rowIndex * 180 }))
));

describe('page opening cascade', () => {
  it('places every bookmark in its own group in item mode', () => {
    const items = createItems(4, 4, 3);
    expect(getCascadeGroupIndexes(items, 'items')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('places bookmarks from the same visual row in one group', () => {
    const items = createItems(4, 4, 3);
    expect(getCascadeGroupIndexes(items, 'rows')).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2]);
  });

  it('spreads delays across the configured total duration', () => {
    const items = createItems(2, 2);
    const itemTiming = calculateCascadeTiming(items, 'items', 1000);
    const rowTiming = calculateCascadeTiming(items, 'rows', 1000);

    expect(itemTiming.itemDuration).toBe(520);
    expect(itemTiming.delays).toEqual([0, 160, 320, 480]);
    expect(itemTiming.totalDuration).toBe(1000);
    expect(rowTiming.delays).toEqual([0, 0, 480, 480]);
    expect(rowTiming.totalDuration).toBe(1000);
  });

  it('uses one smooth tile animation that enters from below the viewport', () => {
    const css = readFileSync('src/css/pages/_newtab.css', 'utf8');

    expect(css).toMatch(/@keyframes page-tile-enter/);
    expect(css).toMatch(/\.page-entering \.grid > \*/);
    expect(css).toMatch(/translate3d\(0,\s*100vh,\s*0\)/);
    expect(css).toMatch(/transform:\s*translate3d\(0,\s*0,\s*0\)/);
    expect(css).toMatch(/animation-fill-mode:\s*both/);
    expect(css).not.toMatch(/page-panel-zoom-enter|page-soft-rise-enter/);
    expect(css).not.toMatch(/data-page-entrance-effect/);
  });
});
