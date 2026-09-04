import { describe, expect, it } from '@jest/globals';
import {
  createThumbnailFailure,
  inspectThumbnailUrl,
  normalizeThumbnailFailure,
  validateThumbnailRequest
} from '../src/js/api/thumbnailErrors';

describe('thumbnail URL validation and failures', () => {
  it.each([
    ['https://example.com/page', true, undefined],
    ['http://example.com/page', true, undefined],
    ['chrome://extensions/', false, 'UNSUPPORTED_SCHEME'],
    ['chrome-extension://abcdefghijklmnop/page.html', false, 'UNSUPPORTED_SCHEME'],
    ['file:///tmp/icon.png', false, 'UNSUPPORTED_SCHEME'],
    ['about:blank', false, 'UNSUPPORTED_SCHEME'],
    ['not a url', false, 'INVALID_URL'],
    ['https://chromewebstore.google.com/detail/test', false, 'PROTECTED_BROWSER_PAGE'],
    ['https://chrome.google.com/webstore/devconsole/test', false, 'PROTECTED_BROWSER_PAGE']
  ])('classifies %s', (url, allowed, code) => {
    expect(inspectThumbnailUrl(url)).toMatchObject({ allowed, ...(code && { code }) });
  });

  it('returns only the hostname as the public target for an allowed URL', () => {
    expect(validateThumbnailRequest(
      'https://user:secret@example.com/private?token=secret',
      'favicon'
    )).toEqual({
      success: true,
      url: 'https://user:secret@example.com/private?token=secret',
      target: 'example.com'
    });
  });

  it('creates a structured failure without exposing the full URL', () => {
    expect(createThumbnailFailure('HTTP_ERROR', {
      operation: 'url',
      status: 403,
      url: 'https://example.com/private?token=secret'
    })).toEqual({
      success: false,
      error: {
        code: 'HTTP_ERROR',
        operation: 'url',
        protocol: 'https:',
        status: 403,
        target: 'example.com'
      }
    });
  });

  it('normalizes legacy capture failures for the detailed UI', () => {
    expect(normalizeThumbnailFailure(
      { ok: false, code: 'TIMEOUT' },
      { operation: 'site', url: 'https://slow.example/' }
    )).toMatchObject({
      success: false,
      error: { code: 'TIMEOUT', operation: 'site', target: 'slow.example' }
    });
  });
});
