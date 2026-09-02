const FAVICON_SIZE_LIMITS = Object.freeze({ min: 16, max: 128, step: 4 });
const TITLE_SIZE_LIMITS = Object.freeze({ min: 10, max: 24 });

function clamp(value, { min, max, step = 1 }) {
  const rounded = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, rounded));
}

export function scaleTileContentSettings({
  faviconSize,
  fromTileSize,
  titleSize,
  toTileSize
}) {
  const previousSize = Number(fromTileSize);
  const nextSize = Number(toTileSize);
  const scale = previousSize > 0 && Number.isFinite(nextSize)
    ? nextSize / previousSize
    : 1;

  return {
    bookmark_title_size: clamp(Number(titleSize) * scale, TITLE_SIZE_LIMITS),
    favicon_size: clamp(Number(faviconSize) * scale, FAVICON_SIZE_LIMITS)
  };
}
