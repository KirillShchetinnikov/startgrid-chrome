import { storage } from './storage';

export const BOOKMARK_TITLE_SIZE_MIN = 10;
export const BOOKMARK_TITLE_SIZE_MAX = 24;
const STORAGE_PREFIX = 'bookmark_text_preferences:';

function storageKey(id) {
  return `${STORAGE_PREFIX}${id}`;
}

export function getBookmarkTitleSizeOverride(value) {
  if (value === '' || value === null || value === undefined) return null;
  const size = Number.parseInt(value, 10);
  if (!Number.isFinite(size)) return null;
  return Math.min(BOOKMARK_TITLE_SIZE_MAX, Math.max(BOOKMARK_TITLE_SIZE_MIN, size));
}

export function getBookmarkTitlePositionOverride(value) {
  return ['inside', 'outside'].includes(value) ? value : null;
}

function normalizePreferences(preferences = {}) {
  const titleSize = getBookmarkTitleSizeOverride(preferences.titleSize);
  const titlePosition = getBookmarkTitlePositionOverride(preferences.titlePosition);
  return {
    ...(titleSize !== null && { titleSize }),
    ...(titlePosition !== null && { titlePosition })
  };
}

export async function getBookmarkTextPreferences(ids) {
  const uniqueIds = [...new Set(ids.map(String))];
  const keys = uniqueIds.map(storageKey);
  const records = keys.length ? await storage.local.get(keys) : {};
  return new Map(uniqueIds.map(id => [
    id,
    normalizePreferences(records[storageKey(id)])
  ]));
}

export async function setBookmarkTextPreference(id, preferences) {
  const normalized = normalizePreferences(preferences);
  const key = storageKey(id);
  if (Object.keys(normalized).length) {
    await storage.local.set({ [key]: normalized });
  } else {
    await storage.local.remove(key);
  }
  return normalized;
}

export function removeBookmarkTextPreference(id) {
  return storage.local.remove(storageKey(id));
}
