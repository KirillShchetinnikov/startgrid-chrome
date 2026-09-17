import { FULL_MODE_SETTINGS, effectiveHomeSort } from './folderMode';
import { getEffectiveSettings, isSettingAllowed } from './performanceMode';

export function getSettingUnavailableReasons(settings, key) {
  const reasons = [];
  if (!isSettingAllowed(settings, key)) reasons.push(['setting_unavailable_fast']);
  const effective = getEffectiveSettings(settings);
  const limited = Boolean(settings.show_last_opened_folder);
  if (limited && (FULL_MODE_SETTINGS.includes(key) || key === 'default_folder_id')) {
    reasons.push(['setting_unavailable_last_folder']);
  }
  const sortMode = effectiveHomeSort(effective);
  const requiredSort = {
    drag_and_drop: 'manual',
    home_sort_date_direction: 'date',
    home_sort_alphabet_direction: 'alphabet',
    home_sort_usage_tiebreaker: 'usage',
    show_usage_count: 'usage'
  }[key];
  if (requiredSort && sortMode !== requiredSort) {
    reasons.push(['setting_requires', requiredSort === 'manual' ? 'manual_sorting' : `sort_by_${requiredSort}`]);
  }
  const requiredSwitch = {
    bookmarks_sorting_type: 'show_home_folders',
    page_cascade_mode: 'page_cascade_enabled',
    page_cascade_duration: 'page_cascade_enabled',
    thumbnails_auto_refresh_interval: 'thumbnails_auto_refresh'
  }[key];
  if (requiredSwitch && !effective[requiredSwitch]) reasons.push(['setting_requires', requiredSwitch]);
  if (key === 'background_entrance_duration' && effective.background_entrance_effect === 'none') {
    reasons.push(['setting_requires', 'background_entrance_effect']);
  }
  if (['toolbar_background_color', 'toolbar_background_opacity', 'toolbar_background_blur'].includes(key)
    && effective.toolbar_match_tile_background) reasons.push(['setting_unavailable_toolbar']);
  if (key === 'thumbnails_update_button' && limited && !effective.download_favicons_by_default) {
    reasons.push(['setting_requires', 'download_favicons_by_default']);
  }
  return reasons;
}
