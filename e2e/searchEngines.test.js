import { describe, expect, it } from '@jest/globals';
import {
  MAX_SEARCH_ENGINES,
  buildSearchUrl,
  createDefaultSearchEngineSettings,
  getEnabledSearchEngines,
  getSearchEngines,
  isValidSearchUrlTemplate,
  normalizeSearchEngineSettings
} from '../src/js/searchEngines';

describe('search engine settings', () => {
  it('creates the built-in engines in their default order', () => {
    const engines = createDefaultSearchEngineSettings();

    expect(engines.map(engine => engine.id)).toEqual([
      'bookmarks',
      'browser',
      'google',
      'bing',
      'yandex',
      'duckduckgo',
      'youtube',
      'baidu',
      'yahoo'
    ]);
    expect(engines.every(engine => engine.enabled)).toBe(true);
  });

  it('preserves a custom order and appends missing built-in engines', () => {
    const engines = normalizeSearchEngineSettings([
      { id: 'google', enabled: true, url: 'https://google.com/search?q={query}' },
      { id: 'bookmarks', enabled: true }
    ]);

    expect(engines.slice(0, 2).map(engine => engine.id)).toEqual(['google', 'bookmarks']);
    expect(engines.map(engine => engine.id)).toContain('browser');
  });

  it('limits the entire visible list and disables invalid custom URLs', () => {
    const customEngines = Array.from({ length: MAX_SEARCH_ENGINES + 3 }, (_, index) => ({
      id: `custom:${index}`,
      enabled: true,
      title: `Custom ${index}`,
      url: index === 0 ? 'https://example.com/search' : 'https://example.com/?q={query}'
    }));
    const engines = normalizeSearchEngineSettings(customEngines);
    const normalizedCustom = engines.filter(engine => engine.id.startsWith('custom:'));

    expect(getSearchEngines(engines, key => key)).toHaveLength(MAX_SEARCH_ENGINES);
    expect(normalizedCustom).toHaveLength(MAX_SEARCH_ENGINES - 2);
    expect(normalizedCustom[0].enabled).toBe(false);
  });

  it('keeps removed built-in engines deleted but protects bookmarks and browser search', () => {
    const engines = normalizeSearchEngineSettings([
      { id: 'google', removed: true },
      { id: 'bookmarks', removed: true },
      { id: 'browser', removed: true }
    ]);
    const visibleIds = getEnabledSearchEngines(engines, key => key).map(engine => engine.id);

    expect(visibleIds).not.toContain('google');
    expect(visibleIds).toContain('bookmarks');
    expect(visibleIds).toContain('browser');
    expect(engines).toContainEqual({ id: 'google', removed: true });
  });

  it('keeps at least one engine enabled', () => {
    const disabled = createDefaultSearchEngineSettings().map(engine => ({
      ...engine,
      enabled: false
    }));
    const engines = normalizeSearchEngineSettings(disabled);

    expect(engines.filter(engine => engine.enabled)).toHaveLength(1);
  });

  it('filters disabled engines and resolves localized titles', () => {
    const settings = createDefaultSearchEngineSettings().map(engine => ({
      ...engine,
      enabled: engine.id === 'bookmarks'
    }));
    const engines = getEnabledSearchEngines(settings, key => `translated:${key}`);

    expect(engines).toEqual([
      expect.objectContaining({ id: 'bookmarks', title: 'translated:search_bookmarks' })
    ]);
  });

  it('validates templates and inserts an encoded query', () => {
    expect(isValidSearchUrlTemplate('https://example.com/?q={query}')).toBe(true);
    expect(isValidSearchUrlTemplate('https://example.com/')).toBe(false);
    expect(buildSearchUrl('https://example.com/?q={query}', 'hello world')).toBe(
      'https://example.com/?q=hello%20world'
    );
  });

  it('preserves an optional suggestion URL for custom engines', () => {
    const [engine] = normalizeSearchEngineSettings([{
      id: 'custom:test',
      enabled: true,
      title: 'Example',
      url: 'https://example.com/search?q={query}',
      suggestUrl: 'https://example.com/suggest?q={query}'
    }]);

    expect(engine.suggestUrl).toBe('https://example.com/suggest?q={query}');

    const [withoutInvalidSuggestionUrl] = normalizeSearchEngineSettings([{
      ...engine,
      suggestUrl: 'https://example.com/suggest'
    }]);
    expect(withoutInvalidSuggestionUrl).not.toHaveProperty('suggestUrl');
  });
});
