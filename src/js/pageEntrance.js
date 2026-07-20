export const PAGE_ENTRANCE_EFFECTS = Object.freeze([
  'reveal',
  'zoom',
  'rise'
]);

export function normalizePageEntranceEffect(effect) {
  return PAGE_ENTRANCE_EFFECTS.includes(effect) ? effect : 'reveal';
}
