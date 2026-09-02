export const GRID_COLUMN_BASE_MIN_WIDTH = 80;
export const GRID_WIDTH_LIMITS = Object.freeze({ min: 50, max: 99 });

function clamp(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, number))
    : fallback;
}

export function getGridLayoutLimits({
  columns,
  gridWidth,
  horizontalGap,
  tileSize,
  viewportWidth
}) {
  const safeColumns = clamp(columns, 1, 10, 7);
  const safeTileSize = clamp(tileSize, 50, 150, 100);
  const safeHorizontalGap = clamp(horizontalGap, 0, 160, 16);
  const safeViewportWidth = Math.max(1, Number.parseInt(viewportWidth, 10) || 1);
  const minimumColumnWidth = Math.ceil(
    (GRID_COLUMN_BASE_MIN_WIDTH * safeTileSize) / 100
  );
  const minimumGridWidthPx =
    (safeColumns * minimumColumnWidth)
    + ((safeColumns - 1) * safeHorizontalGap);
  const minimumGridWidth = Math.min(
    GRID_WIDTH_LIMITS.max,
    Math.max(
      GRID_WIDTH_LIMITS.min,
      Math.ceil((minimumGridWidthPx / safeViewportWidth) * 100)
    )
  );
  const requestedGridWidth = clamp(
    gridWidth,
    GRID_WIDTH_LIMITS.min,
    GRID_WIDTH_LIMITS.max,
    70
  );

  return {
    gridWidth: Math.max(requestedGridWidth, minimumGridWidth),
    minimumColumnWidth,
    minimumGridWidth
  };
}
