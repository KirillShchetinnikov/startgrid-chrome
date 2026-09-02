export const GRID_WIDTH_LIMITS = Object.freeze({ min: 50, max: 99 });
export const TILE_SIZE_LIMITS = Object.freeze({ min: 50, max: 300 });
export const HORIZONTAL_GAP_LIMITS = Object.freeze({ min: 0, max: 160 });

function clamp(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, number))
    : fallback;
}

function getAvailableGridWidth({ gridWidth, viewportWidth, availableWidth }) {
  const measuredWidth = Number(availableWidth);
  if (Number.isFinite(measuredWidth) && measuredWidth >= 0) {
    return measuredWidth;
  }

  const safeGridWidth = clamp(
    gridWidth,
    GRID_WIDTH_LIMITS.min,
    GRID_WIDTH_LIMITS.max,
    70
  );
  const safeViewportWidth = Math.max(1, Number.parseInt(viewportWidth, 10) || 1);
  return (safeViewportWidth * safeGridWidth) / 100;
}

export function getGridLayoutLimits({
  columns,
  gridWidth,
  horizontalGap,
  tileSize,
  viewportWidth
}) {
  const safeColumns = clamp(columns, 1, 10, 7);
  const safeTileSize = clamp(
    tileSize,
    TILE_SIZE_LIMITS.min,
    TILE_SIZE_LIMITS.max,
    100
  );
  const safeHorizontalGap = clamp(
    horizontalGap,
    HORIZONTAL_GAP_LIMITS.min,
    HORIZONTAL_GAP_LIMITS.max,
    16
  );
  const safeViewportWidth = Math.max(1, Number.parseInt(viewportWidth, 10) || 1);
  const minimumColumnWidth = safeTileSize;
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

export function getTileSizeLimits({
  columns,
  gridWidth,
  horizontalGap,
  viewportWidth,
  availableWidth
}) {
  const safeColumns = clamp(columns, 1, 10, 7);
  const safeHorizontalGap = clamp(
    horizontalGap,
    HORIZONTAL_GAP_LIMITS.min,
    HORIZONTAL_GAP_LIMITS.max,
    16
  );
  const gridWidthPx = getAvailableGridWidth({ gridWidth, viewportWidth, availableWidth });
  const availableTileSize = Math.floor(
    (gridWidthPx - ((safeColumns - 1) * safeHorizontalGap)) / safeColumns
  );

  return {
    minimumTileSize: TILE_SIZE_LIMITS.min,
    maximumTileSize: Math.min(
      TILE_SIZE_LIMITS.max,
      Math.max(TILE_SIZE_LIMITS.min, availableTileSize)
    )
  };
}

export function getHorizontalGapLimits({
  columns,
  gridWidth,
  tileSize,
  viewportWidth,
  availableWidth
}) {
  const safeColumns = clamp(columns, 1, 10, 7);
  const safeTileSize = clamp(
    tileSize,
    TILE_SIZE_LIMITS.min,
    TILE_SIZE_LIMITS.max,
    100
  );
  const gridWidthPx = getAvailableGridWidth({ gridWidth, viewportWidth, availableWidth });
  const availableGap = safeColumns === 1
    ? HORIZONTAL_GAP_LIMITS.max
    : Math.floor((gridWidthPx - (safeColumns * safeTileSize)) / (safeColumns - 1));

  return {
    minimumHorizontalGap: HORIZONTAL_GAP_LIMITS.min,
    maximumHorizontalGap: Math.min(
      HORIZONTAL_GAP_LIMITS.max,
      Math.max(HORIZONTAL_GAP_LIMITS.min, availableGap)
    )
  };
}
