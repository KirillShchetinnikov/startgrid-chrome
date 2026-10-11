import { describe, expect, it } from '@jest/globals';
import {
  getGridLayoutLimits,
  getGridControlLimits,
  getHorizontalGapLimits,
  getResponsiveTileLayout,
  getTileSizeLimits
} from '../src/js/gridLayout';

describe('grid layout limits', () => {
  it('stops manual growth before tiles or gaps need responsive shrinking', () => {
    for (const viewportWidth of [640, 800, 1280, 1920]) {
      for (const columns of [1, 3, 7, 10]) {
        const inlinePadding = viewportWidth <= 768 ? 50 : 62;
        const availableWidth = Math.min(viewportWidth * 0.99, viewportWidth - 2 * inlinePadding);
        const limits = getGridControlLimits({
          columns, tileSize: 50, horizontalGap: 0, viewportWidth, inlinePadding
        });
        const tileSize = limits.dial_tile_size.max;
        expect(tileSize * columns).toBeLessThanOrEqual(availableWidth);
        const gapLimits = getGridControlLimits({
          columns, tileSize, horizontalGap: 0, viewportWidth, inlinePadding
        });
        expect(tileSize * columns + (columns - 1) * gapLimits.dial_horizontal_gap.max)
          .toBeLessThanOrEqual(availableWidth);
      }
    }
  });

  it('preserves oversized preferences but prevents increasing them on a small screen', () => {
    const preferences = { columns: 7, tileSize: 200, horizontalGap: 20, inlinePadding: 62 };
    expect(getGridControlLimits({ ...preferences, viewportWidth: 800 }).dial_tile_size.max).toBe(200);
    expect(getGridControlLimits({ ...preferences, viewportWidth: 2400 }).dial_tile_size.max).toBe(300);
    expect(preferences.tileSize).toBe(200);
  });

  it('reserves corner-control padding when computing the maximum', () => {
    const limits = getGridControlLimits({
      columns: 7, tileSize: 100, horizontalGap: 20, viewportWidth: 1280, inlinePadding: 62
    });
    expect(limits.dial_tile_size.max).toBe(148);
    expect(limits.dial_horizontal_gap.max).toBe(76);
  });

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
