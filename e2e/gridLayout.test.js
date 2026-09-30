import { describe, expect, it } from '@jest/globals';
import {
  getGridLayoutLimits,
  getHorizontalGapLimits,
  getResponsiveTileLayout,
  getTileSizeLimits
} from '../src/js/gridLayout';

describe('grid layout limits', () => {
  it('keeps ten 50px tiles within a 99% grid without changing the column count', () => {
    expect(getGridLayoutLimits({
      columns: 10,
      gridWidth: 99,
      horizontalGap: 16,
      tileSize: 50,
      viewportWidth: 1280
    })).toEqual({
      gridWidth: 99,
      minimumColumnWidth: 50,
      minimumGridWidth: 51
    });
  });

  it('raises the minimum grid width for more or wider tiles', () => {
    expect(getGridLayoutLimits({
      columns: 10,
      gridWidth: 50,
      horizontalGap: 16,
      tileSize: 100,
      viewportWidth: 1280
    })).toEqual({
      gridWidth: 90,
      minimumColumnWidth: 100,
      minimumGridWidth: 90
    });
  });

  it('limits the tile size to the available grid width and static bounds', () => {
    expect(getTileSizeLimits({
      columns: 10,
      gridWidth: 99,
      horizontalGap: 16,
      viewportWidth: 1280
    })).toEqual({ minimumTileSize: 50, maximumTileSize: 112 });

    expect(getTileSizeLimits({
      columns: 3,
      gridWidth: 99,
      horizontalGap: 0,
      viewportWidth: 1280
    })).toEqual({ minimumTileSize: 50, maximumTileSize: 300 });
  });

  it('limits the horizontal gap to the available grid width and static bounds', () => {
    expect(getHorizontalGapLimits({
      columns: 10,
      gridWidth: 99,
      tileSize: 100,
      viewportWidth: 1280
    })).toEqual({ minimumHorizontalGap: 0, maximumHorizontalGap: 29 });

    expect(getHorizontalGapLimits({
      columns: 1,
      gridWidth: 50,
      tileSize: 150,
      viewportWidth: 1280
    })).toEqual({ minimumHorizontalGap: 0, maximumHorizontalGap: 160 });

    expect(getHorizontalGapLimits({
      columns: 10,
      gridWidth: 99,
      tileSize: 100,
      viewportWidth: 1280,
      availableWidth: 1152
    })).toEqual({ minimumHorizontalGap: 0, maximumHorizontalGap: 16 });
  });
});

describe('responsive tile layout', () => {
  const preferences = { columns: 7, tileSize: 200, horizontalGap: 20 };

  it('fits a smaller device and restores the preferred size on a larger device', () => {
    const layout = getResponsiveTileLayout({ ...preferences, availableWidth: 760 });
    expect(layout).toEqual({ tileSize: 100, horizontalGap: 10, scale: 0.5 });
    expect(layout.tileSize * 7 + layout.horizontalGap * 6).toBeLessThanOrEqual(760);
    expect(preferences).toEqual({ columns: 7, tileSize: 200, horizontalGap: 20 });
    expect(getResponsiveTileLayout({ ...preferences, availableWidth: 2000 }))
      .toEqual({ tileSize: 200, horizontalGap: 20, scale: 1 });
  });

  it('keeps the minimum tile size and reduces gaps for a very narrow grid', () => {
    expect(getResponsiveTileLayout({ ...preferences, availableWidth: 350 }))
      .toEqual({ tileSize: 50, horizontalGap: 0, scale: 0.25 });
  });

  it('fits fractional widths and handles a single column without enlarging tiles', () => {
    const layout = getResponsiveTileLayout({ ...preferences, availableWidth: 1053.3 });
    expect(layout.tileSize * 7 + layout.horizontalGap * 6).toBeLessThanOrEqual(1053.3);
    expect(getResponsiveTileLayout({ columns: 1, tileSize: 200, horizontalGap: 20, availableWidth: 100 }))
      .toEqual({ tileSize: 100, horizontalGap: 10, scale: 0.5 });
  });
});
