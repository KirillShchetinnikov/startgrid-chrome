import { requestPermissions } from './api/permissions';
import { $imageLoaded } from './utils';

export function normalizeBackgroundImageURL(value) {
  try {
    const url = new URL(String(value).trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function requestBackgroundPermission(url) {
  const { protocol, hostname } = new URL(url);
  return requestPermissions({ origins: [`${protocol}//${hostname}/*`] });
}

export async function canLoadBackgroundImageURL(url) {
  return Boolean(await $imageLoaded(url).catch(() => null));
}
