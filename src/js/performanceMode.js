export const isFastMode = settings => settings?.performance_mode === 'fast';

// These are runtime overrides only. Never persist them over the user's settings.
export const FAST_OVERRIDES = Object.freeze({
  snow_mode: 'off',
  background_entrance_effect: 'none',
  background_entrance_duration: 0,
  page_cascade_enabled: false,
  page_cascade_mode: 'items',
  page_cascade_duration: 0,
  dial_shadow: 0,
  dial_hover_lift: 0,
  dial_background_opacity: 100,
  dial_background_blur: false,
  toolbar_background_opacity: 100,
  toolbar_background_blur: false,
  folder_preview: false,
  thumbnail_source: 'favicon',
  download_favicons_by_default: false,
  thumbnails_update_button: false,
  thumbnails_update_delay: 0,
  thumbnails_auto_refresh: false,
  thumbnails_auto_refresh_interval: 24,
  search_results_display: 'flat',
  show_usage_count: false,
  home_sort_usage_tiebreaker: 'alphabet'
});

export function getEffectiveSetting(settings, key) {
  if (!isFastMode(settings)) return settings[key];
  if (Object.hasOwn(FAST_OVERRIDES, key)) return FAST_OVERRIDES[key];
  if (key === 'home_sort_by' && settings[key] === 'usage') return 'manual';
  return settings[key];
}

export function getEffectiveSettings(settings = {}) {
  return Object.fromEntries(Object.keys(settings).map(key => [key, getEffectiveSetting(settings, key)]));
}

export function isSettingAllowed(settings, key, value) {
  if (!isFastMode(settings)) return true;
  if (Object.hasOwn(FAST_OVERRIDES, key)) return false;
  if (key === 'home_sort_by') return value !== 'usage';
  return true;
}
