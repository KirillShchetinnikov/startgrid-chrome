const HOURS_TO_MILLISECONDS = 60 * 60 * 1000;
const AUTO_REFRESH_SOURCES = ['site', 'url', 'favicon'];

export function isThumbnailStale(thumbnail, intervalHours, now = Date.now()) {
  if (!AUTO_REFRESH_SOURCES.includes(thumbnail?.source)) return false;
  if (thumbnail.source === 'url' && !thumbnail.sourceUrl) return false;

  const interval = Math.max(1, Number(intervalHours) || 24) * HOURS_TO_MILLISECONDS;
  return !thumbnail.checkedAt
    || now - thumbnail.checkedAt >= interval;
}

export async function getBlobHash(blob) {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}
