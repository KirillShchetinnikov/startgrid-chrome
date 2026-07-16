import { GOOGLE_SUGGEST_URL, buildSearchUrl } from './searchEngines';

const MAX_SUGGESTIONS = 10;

export function getSuggestionUrl(engine) {
  return engine?.suggestUrl || GOOGLE_SUGGEST_URL;
}

function getOriginPattern(template) {
  try {
    const url = new URL(template.replaceAll('{query}', 'test'));
    return `${url.protocol}//${url.host}/*`;
  } catch (error) {
    return null;
  }
}

export function getSuggestionOrigins(engine) {
  const urls = [getSuggestionUrl(engine), GOOGLE_SUGGEST_URL];
  return [...new Set(urls.map(getOriginPattern).filter(Boolean))];
}

function normalizeSuggestion(item) {
  if (typeof item === 'string') return item.trim();
  if (!item || typeof item !== 'object') return '';
  return String(item.phrase ?? item.k ?? item.value ?? item.text ?? '').trim();
}

function normalizeSuggestions(items) {
  if (!Array.isArray(items)) return [];
  return [...new Set(items.map(normalizeSuggestion).filter(Boolean))].slice(0, MAX_SUGGESTIONS);
}

function parseJsonSuggestions(payload) {
  if (Array.isArray(payload)) {
    return normalizeSuggestions(Array.isArray(payload[1]) ? payload[1] : payload);
  }
  return normalizeSuggestions(payload?.r || payload?.suggestions || payload?.results);
}

function decodeXmlAttribute(value) {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', '\'')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

export function parseSuggestionResponse(text) {
  try {
    return parseJsonSuggestions(JSON.parse(text));
  } catch (error) {
    const suggestions = [...text.matchAll(/<suggestion\s+data="([^"]*)"/gi)]
      .map(match => decodeXmlAttribute(match[1]));
    return normalizeSuggestions(suggestions);
  }
}

async function fetchSuggestions(template, query, signal, fetchImpl) {
  const url = buildSearchUrl(template, query);
  if (!url) return [];
  const response = await fetchImpl(url, { signal });
  if (!response.ok) throw new Error(`Suggestion service returned HTTP ${response.status}`);
  return parseSuggestionResponse(await response.text());
}

export async function requestSearchSuggestions(engine, query, signal, fetchImpl = fetch) {
  const primaryUrl = getSuggestionUrl(engine);
  try {
    const suggestions = await fetchSuggestions(primaryUrl, query, signal, fetchImpl);
    if (suggestions.length || primaryUrl === GOOGLE_SUGGEST_URL) return suggestions;
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    if (primaryUrl === GOOGLE_SUGGEST_URL) return [];
  }

  try {
    return await fetchSuggestions(GOOGLE_SUGGEST_URL, query, signal, fetchImpl);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return [];
  }
}
