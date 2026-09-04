function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesSettingsSearch(query, ...textParts) {
  const terms = normalizeSearchText(query).split(' ').filter(Boolean);
  if (!terms.length) return true;

  const searchableText = normalizeSearchText(textParts.join(' '));
  return terms.every(term => searchableText.includes(term));
}
