export const DEFAULT_THUMBNAIL_SOURCE = 'favicon';

const GLOBAL_THUMBNAIL_SOURCES = new Set(['favicon', 'site']);
const BOOKMARK_THUMBNAIL_SOURCES = new Set(['favicon', 'site', 'local', 'url']);

export function normalizeGlobalThumbnailSource(source) {
  return GLOBAL_THUMBNAIL_SOURCES.has(source) ? source : DEFAULT_THUMBNAIL_SOURCE;
}

export function getThumbnailSourceOverride(thumbnail) {
  if (!thumbnail || thumbnail.sourceOverride === false) return 'inherit';
  if (thumbnail.sourceOverride === true) {
    return BOOKMARK_THUMBNAIL_SOURCES.has(thumbnail.source)
      ? thumbnail.source
      : 'inherit';
  }

  if (['local', 'site', 'url'].includes(thumbnail.source)) return thumbnail.source;
  if (thumbnail.source === 'favicon' && typeof thumbnail.downloadFavicon === 'boolean') {
    return 'favicon';
  }
  return 'inherit';
}

export function resolveThumbnailSource(thumbnail, globalSource) {
  const sourceOverride = getThumbnailSourceOverride(thumbnail);
  return sourceOverride === 'inherit'
    ? normalizeGlobalThumbnailSource(globalSource)
    : sourceOverride;
}

export function canUseStoredThumbnail(thumbnail, resolvedSource) {
  return Boolean(thumbnail?.blob && thumbnail.source === resolvedSource);
}
