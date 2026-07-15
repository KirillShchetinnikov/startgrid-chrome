export const THUMBNAIL_SIZE_MIN = 16;
export const THUMBNAIL_SIZE_MAX = 128;
export const THUMBNAIL_SIZE_DEFAULT = 32;

export function normalizeThumbnailSize(value, fallback = THUMBNAIL_SIZE_DEFAULT) {
  const size = Number.parseInt(value, 10);
  if (!Number.isFinite(size)) return fallback;
  return Math.min(THUMBNAIL_SIZE_MAX, Math.max(THUMBNAIL_SIZE_MIN, size));
}

export function getFaviconDownloadOverride(value) {
  return typeof value === 'boolean' ? value : null;
}

export function shouldDownloadFavicon(thumbnail, globalDefault = false) {
  return getFaviconDownloadOverride(thumbnail?.downloadFavicon) ?? Boolean(globalDefault);
}

export function getThumbnailSizeOverride(value) {
  if (value === null || value === undefined || value === '') return null;
  return normalizeThumbnailSize(value, null);
}
