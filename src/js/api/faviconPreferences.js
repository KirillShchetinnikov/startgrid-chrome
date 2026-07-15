export const FAVICON_SIZE_MIN = 16;
export const FAVICON_SIZE_MAX = 128;
export const FAVICON_SIZE_DEFAULT = 32;

export function normalizeFaviconSize(value, fallback = FAVICON_SIZE_DEFAULT) {
  const size = Number.parseInt(value, 10);
  if (!Number.isFinite(size)) return fallback;
  return Math.min(FAVICON_SIZE_MAX, Math.max(FAVICON_SIZE_MIN, size));
}

export function getFaviconDownloadOverride(value) {
  return typeof value === 'boolean' ? value : null;
}

export function shouldDownloadFavicon(thumbnail, globalDefault = false) {
  return getFaviconDownloadOverride(thumbnail?.downloadFavicon) ?? Boolean(globalDefault);
}

export function getFaviconSizeOverride(value) {
  if (value === null || value === undefined || value === '') return null;
  return normalizeFaviconSize(value, null);
}
