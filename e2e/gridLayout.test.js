import { describe, expect, it } from '@jest/globals';
import { getGridLayoutLimits } from '../src/js/gridLayout';

describe('grid layout limits', () => {
  it('keeps ten small tiles within a 99% grid without changing the column count', () => {
    expect(getGridLayoutLimits({
      columns: 10,
      gridWidth: 99,
      horizontalGap: 16,
      tileSize: 50,
      viewportWidth: 1280
    })).toEqual({
      gridWidth: 99,
      minimumColumnWidth: 40,
      minimumGridWidth: 50
    });
  });

  it('raises the minimum grid width for more or larger tiles', () => {
    expect(getGridLayoutLimits({
      columns: 10,
      gridWidth: 50,
      horizontalGap: 16,
      tileSize: 100,
      viewportWidth: 1280
    })).toEqual({
      gridWidth: 74,
      minimumColumnWidth: 80,
      minimumGridWidth: 74
    });
  });
});
