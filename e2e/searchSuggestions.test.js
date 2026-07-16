import { describe, expect, it, jest } from '@jest/globals';
import {
  getSuggestionOrigins,
  parseSuggestionResponse,
  readSuggestionResponse,
  requestSearchSuggestions
} from '../src/js/searchSuggestions';
import { createDefaultSearchEngineSettings, getSearchEngines } from '../src/js/searchEngines';

describe('search suggestions', () => {
  it('configures a dedicated provider for every built-in external engine', () => {
    const engines = getSearchEngines(createDefaultSearchEngineSettings(), key => key);
    const origins = Object.fromEntries(engines
      .filter(engine => engine.suggestUrl)
      .map(engine => [engine.id, getSuggestionOrigins(engine)[0]]));

    expect(origins).toEqual({
      google: 'https://www.google.com/*',
      bing: 'https://api.bing.com/*',
      yandex: 'https://suggest.yandex.com/*',
      duckduckgo: 'https://duckduckgo.com/*',
      youtube: 'https://suggestqueries.google.com/*',
      baidu: 'https://suggestion.baidu.com/*',
      yahoo: 'https://search.yahoo.com/*'
    });
  });

  it('parses OpenSearch arrays, object arrays, Yahoo objects, and Google XML', () => {
    expect(parseSuggestionResponse('["q",["one","two"]]')).toEqual(['one', 'two']);
    expect(parseSuggestionResponse('[{"phrase":"one"},{"phrase":"two"}]')).toEqual(['one', 'two']);
    expect(parseSuggestionResponse('{"r":[{"k":"one"},{"k":"two"}]}')).toEqual(['one', 'two']);
    expect(parseSuggestionResponse(
      '<toplevel><CompleteSuggestion><suggestion data="one &amp; two"/></CompleteSuggestion></toplevel>'
    )).toEqual(['one & two']);
  });

  it('decodes Baidu GBK responses before parsing suggestions', async() => {
    const payload = Buffer.concat([
      Buffer.from('["q",["'),
      Buffer.from([0xb2, 0xe2, 0xca, 0xd4]),
      Buffer.from('"]]')
    ]);
    const response = {
      headers: { get: () => 'text/javascript; charset=gbk' },
      arrayBuffer: async() => payload.buffer.slice(
        payload.byteOffset,
        payload.byteOffset + payload.byteLength
      )
    };

    await expect(readSuggestionResponse(response)).resolves.toBe('["q",["测试"]]');
  });

  it('requests the selected provider and includes Google as fallback permission', async() => {
    const engine = { suggestUrl: 'https://api.example.com/suggest?q={query}' };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('["q",["result"]]')
    });

    await expect(requestSearchSuggestions(engine, 'hello world', undefined, fetchMock))
      .resolves.toEqual(['result']);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/suggest?q=hello%20world',
      { signal: undefined }
    );
    expect(getSuggestionOrigins(engine)).toEqual([
      'https://api.example.com/*',
      'https://www.google.com/*'
    ]);
  });

  it('falls back to Google when a provider has no suggestions', async() => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, text: jest.fn().mockResolvedValue('["q",[]]') })
      .mockResolvedValueOnce({ ok: true, text: jest.fn().mockResolvedValue(
        '<toplevel><CompleteSuggestion><suggestion data="fallback"/></CompleteSuggestion></toplevel>'
      ) });

    await expect(requestSearchSuggestions(
      { suggestUrl: 'https://api.example.com/suggest?q={query}' },
      'query',
      undefined,
      fetchMock
    )).resolves.toEqual(['fallback']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toContain('www.google.com/complete/search');
  });
});
