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

    expect(itemTiming.itemDuration).toBe(640);
    expect(itemTiming.delays).toEqual([0, 120, 240, 360]);
    expect(rowTiming.delays).toEqual([0, 0, 360, 360]);
  });
});
