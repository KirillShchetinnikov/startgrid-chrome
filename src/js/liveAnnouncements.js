const regions = new Map();

function getRegion(priority) {
  if (regions.has(priority)) return regions.get(priority);
  const region = document.createElement('div');
  region.className = 'visually-hidden';
  region.setAttribute('aria-live', priority);
  region.setAttribute('aria-atomic', 'true');
  document.body.append(region);
  regions.set(priority, region);
  return region;
}

export function announce(message, priority = 'polite') {
  if (!message) return;
  const region = getRegion(priority);
  region.textContent = '';
  setTimeout(() => {
    region.textContent = message;
  }, 0);
}
