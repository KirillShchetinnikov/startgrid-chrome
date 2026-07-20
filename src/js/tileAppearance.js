const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function clampOpacity(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 100;
}

export function getTileShadowOpacities(value, darkTheme = false) {
  const opacity = Math.min(30, clampOpacity(value));

  if (darkTheme) {
    return {
      resting: Math.min(55, opacity * 1.75),
      hover: Math.min(75, opacity * 2.5)
    };
  }

  return {
    resting: opacity,
    hover: Math.min(45, opacity * 1.875)
  };
}

export function parseTileColor(value) {
  if (HEX_COLOR.test(value || '')) {
    return [
      parseInt(value.slice(1, 3), 16),
      parseInt(value.slice(3, 5), 16),
      parseInt(value.slice(5, 7), 16)
    ];
  }

  const channels = String(value || '').match(/[\d.]+/g)?.slice(0, 3).map(Number);
  return channels?.length === 3 && channels.every(Number.isFinite) ? channels : null;
}

export function cssColorToHex(value, fallback = '#ffffff') {
  const channels = parseTileColor(value);
  if (!channels) return fallback;
  return `#${channels.map(channel => (
    Math.min(255, Math.max(0, Math.round(channel))).toString(16).padStart(2, '0')
  )).join('')}`;
}

export function createTileBackground(color, opacity, themeColor) {
  const channels = parseTileColor(color) || parseTileColor(themeColor) || [255, 255, 255];
  return `rgb(${channels.join(' ')} / ${clampOpacity(opacity)}%)`;
}

export function resolveToolbarOpacity({
  matchTileBackground,
  tileOpacity,
  toolbarOpacity
}) {
  return clampOpacity(matchTileBackground ? tileOpacity : toolbarOpacity);
}

export function createToolbarBackground({
  matchTileBackground,
  tileColor,
  tileOpacity,
  toolbarColor,
  toolbarOpacity,
  themeColor
}) {
  const color = matchTileBackground ? tileColor : toolbarColor;
  const opacity = resolveToolbarOpacity({
    matchTileBackground,
    tileOpacity,
    toolbarOpacity
  });

  return createTileBackground(color, opacity, themeColor);
}
