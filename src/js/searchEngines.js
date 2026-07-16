export const SEARCH_QUERY_TOKEN = '{query}';
export const MAX_SEARCH_ENGINES = 20;
export const MAX_SEARCH_ENGINE_TITLE_LENGTH = 50;
export const MAX_SEARCH_ENGINE_URL_LENGTH = 160;

export const GOOGLE_SUGGEST_URL = 'https://www.google.com/complete/search?output=toolbar&q={query}';

export const BUILT_IN_SEARCH_ENGINES = Object.freeze([
  { id: 'bookmarks', kind: 'bookmarks', titleKey: 'search_bookmarks', protected: true },
  { id: 'browser', kind: 'browser', titleKey: 'search_browser_default', protected: true },
  {
    id: 'google',
    kind: 'external',
    title: 'Google',
    defaultUrl: 'https://www.google.com/search?q={query}',
    suggestUrl: GOOGLE_SUGGEST_URL
  },
  {
    id: 'bing',
    kind: 'external',
    title: 'Bing',
    defaultUrl: 'https://bing.com/search?q={query}',
    suggestUrl: 'https://api.bing.com/osjson.aspx?query={query}'
  },
  {
    id: 'yandex',
    kind: 'external',
    title: 'Yandex',
    defaultUrl: 'https://ya.ru/search/?text={query}',
    suggestUrl: 'https://suggest.yandex.com/suggest-ya.cgi?v=4&part={query}'
  },
  {
    id: 'duckduckgo',
    kind: 'external',
    title: 'DuckDuckGo',
    defaultUrl: 'https://duckduckgo.com/?q={query}',
    suggestUrl: 'https://duckduckgo.com/ac/?q={query}&type=list'
  },
  {
    id: 'youtube',
    kind: 'external',
    title: 'YouTube',
    defaultUrl: 'https://www.youtube.com/results?search_query={query}',
    suggestUrl: 'https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q={query}'
  },
  {
    id: 'baidu',
    kind: 'external',
    title: 'Baidu',
    defaultUrl: 'https://www.baidu.com/s?wd={query}',
    suggestUrl: 'https://suggestion.baidu.com/su?wd={query}&action=opensearch'
  },
  {
    id: 'yahoo',
    kind: 'external',
    title: 'Yahoo',
    defaultUrl: 'https://search.yahoo.com/search?p={query}',
    suggestUrl: 'https://search.yahoo.com/sugg/gossip/gossip-us-ura/?output=sd1&command={query}'
  }
]);

const BUILT_IN_MAP = new Map(BUILT_IN_SEARCH_ENGINES.map(engine => [engine.id, engine]));

function normalizeBuiltInEngine(engine, definition) {
  if (engine?.removed === true && !definition.protected) {
    return { id: definition.id, removed: true };
  }

  const normalized = {
    id: definition.id,
    enabled: engine?.enabled !== false
  };

  if (definition.kind === 'external') {
    const url = typeof engine?.url === 'string'
      ? engine.url.slice(0, MAX_SEARCH_ENGINE_URL_LENGTH)
      : definition.defaultUrl;
    normalized.url = isValidSearchUrlTemplate(url) ? url : definition.defaultUrl;
  }

  return normalized;
}

function normalizeCustomEngine(engine) {
  if (!engine || typeof engine.id !== 'string' || !engine.id.startsWith('custom:')) {
    return null;
  }

  const title = String(engine.title ?? '').trim().slice(0, MAX_SEARCH_ENGINE_TITLE_LENGTH);
  const url = String(engine.url ?? '').trim().slice(0, MAX_SEARCH_ENGINE_URL_LENGTH);
  const suggestUrl = String(engine.suggestUrl ?? '').trim().slice(0, MAX_SEARCH_ENGINE_URL_LENGTH);
  const normalized = {
    id: engine.id.slice(0, 80),
    enabled: engine.enabled === true && Boolean(title) && isValidSearchUrlTemplate(url),
    title,
    url
  };
  if (isValidSearchUrlTemplate(suggestUrl)) normalized.suggestUrl = suggestUrl;
  return normalized;
}

export function createDefaultSearchEngineSettings() {
  return BUILT_IN_SEARCH_ENGINES.map(engine => normalizeBuiltInEngine(null, engine));
}

export function normalizeSearchEngineSettings(value) {
  const source = Array.isArray(value) ? value : [];
  const result = [];
  const usedIds = new Set();

  source.forEach(engine => {
    if (!engine || usedIds.has(engine.id)) return;

    const definition = BUILT_IN_MAP.get(engine.id);
    if (definition) {
      result.push(normalizeBuiltInEngine(engine, definition));
      usedIds.add(engine.id);
      return;
    }

    const customEngine = normalizeCustomEngine(engine);
    if (!customEngine || usedIds.has(customEngine.id)) return;

    result.push(customEngine);
    usedIds.add(customEngine.id);
  });

  BUILT_IN_SEARCH_ENGINES.forEach(engine => {
    if (!usedIds.has(engine.id)) result.push(normalizeBuiltInEngine(null, engine));
  });

  const removed = result.filter(engine => engine.removed);
  const visible = result.filter(engine => !engine.removed);

  for (let index = visible.length - 1; visible.length > MAX_SEARCH_ENGINES && index >= 0; index -= 1) {
    const engine = visible[index];
    const definition = BUILT_IN_MAP.get(engine.id);
    if (definition?.protected) continue;

    visible.splice(index, 1);
    if (definition && !removed.some(item => item.id === engine.id)) {
      removed.push({ id: engine.id, removed: true });
    }
  }

  if (!visible.some(engine => engine.enabled)) {
    visible[0].enabled = true;
  }

  return [...visible, ...removed];
}

export function getSearchEngines(value, getMessage = key => key) {
  return normalizeSearchEngineSettings(value).filter(engine => !engine.removed).map(engine => {
    const definition = BUILT_IN_MAP.get(engine.id);
    if (!definition) {
      return {
        ...engine,
        kind: 'external',
        custom: true,
        title: engine.title
      };
    }

    return {
      ...engine,
      kind: definition.kind,
      custom: false,
      title: definition.titleKey ? getMessage(definition.titleKey) : definition.title,
      ...(definition.suggestUrl && { suggestUrl: definition.suggestUrl })
    };
  });
}

export function getEnabledSearchEngines(value, getMessage) {
  return getSearchEngines(value, getMessage).filter(engine => engine.enabled);
}

export function isValidSearchUrlTemplate(value) {
  if (typeof value !== 'string' || !value.includes(SEARCH_QUERY_TOKEN)) return false;

  try {
    const url = new URL(value.replaceAll(SEARCH_QUERY_TOKEN, 'test'));
    return ['http:', 'https:'].includes(url.protocol);
  } catch (error) {
    return false;
  }
}

export function buildSearchUrl(template, query) {
  if (!isValidSearchUrlTemplate(template)) return null;
  return template.replaceAll(SEARCH_QUERY_TOKEN, encodeURIComponent(query));
}
