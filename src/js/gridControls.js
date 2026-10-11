import { getGridControlLimits } from './gridLayout';

// Both settings pages use the new-tab viewport budget, not the settings panel width.
export function getGridSettingsLimits(preferences) {
  const viewportWidth = window.innerWidth;
  const reserveControls = preferences.show_settings_icon
    || preferences.show_quick_settings_icon || preferences.thumbnails_update_button;
  const style = getComputedStyle(document.documentElement);
  const controlSize = parseFloat(style.getPropertyValue('--circ-btn-size')) || 42;
  const scrollbarWidth = parseFloat(style.getPropertyValue('--scrollbar-width')) || 10;
  // New-tab reserves scrollbar gutters on both edges even without overflow.
  const contentWidth = document.querySelector('.app')?.clientWidth
    ?? viewportWidth - 2 * scrollbarWidth;
  return getGridControlLimits({
    columns: preferences.dial_columns,
    tileSize: preferences.dial_tile_size,
    horizontalGap: preferences.dial_horizontal_gap,
    viewportWidth,
    contentWidth,
    inlinePadding: viewportWidth <= 768 ? 50 : reserveControls ? controlSize + 20 : 0
  });
}
