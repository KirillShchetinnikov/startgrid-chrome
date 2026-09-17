import { describe, expect, it, jest } from '@jest/globals';
import { createFastBackgroundCache, downloadBackground } from '../src/js/fastBackgroundCache';

function fixture() {
  const records = new Map();
  const dependencies = {
    read: async id => records.get(id),
    write: jest.fn(async record => { records.set(record.id, record); return record.id; }),
    resolveBing: jest.fn(async() => ({ imageurl: 'https://www.bing.com/day.jpg', expiresAt: 200 })),
    download: jest.fn(async() => new Blob(['image'], { type: 'image/png' })),
    prepare: jest.fn(async blob => blob),
    lock: async(name, operation) => operation(),
    now: () => 100
  };
  return { records, dependencies, get: createFastBackgroundCache(dependencies) };
}

jest.mock('../src/js/api/bingImageDay', () => ({ getBingImage: jest.fn() }));

describe('cached Fast-mode backgrounds', () => {
  it('downloads and prepares a URL only once, including after reopening a page', async() => {
    const { get, dependencies } = fixture();
    const first = await get('url', 'https://example.com/picture');
    expect(await get('url', first.url)).toBe(first);
    const reopened = createFastBackgroundCache(dependencies);
    expect(await reopened('url', first.url)).toBe(first);
    expect(dependencies.download).toHaveBeenCalledTimes(1);
    expect(dependencies.prepare).toHaveBeenCalledTimes(1);
    await get('url', 'https://example.com/other');
    expect(dependencies.download).toHaveBeenCalledTimes(2);
  });

  it('does not replace the previous cached image when a new one fails validation', async() => {
    const { get, dependencies, records } = fixture();
    const first = await get('url', 'https://example.com/good');
    dependencies.prepare.mockRejectedValueOnce(new Error('animated'));
    await expect(get('url', 'https://example.com/bad')).rejects.toThrow();
    expect(records.get(first.id)).toBe(first);
  });

  it('refuses a URL when its prepared image cannot be stored', async() => {
    const { get, dependencies } = fixture();
    dependencies.write.mockResolvedValueOnce(undefined);
    await expect(get('url', 'https://example.com/image')).rejects.toMatchObject({ code: 'cache' });
  });

  it('keeps the last Bing image offline and delays another update attempt', async() => {
    const { get, dependencies } = fixture();
    const first = await get('bing');
    expect(await get('bing')).toBe(first);
    expect(dependencies.resolveBing).toHaveBeenCalledTimes(1);
    dependencies.now = () => 300;
    dependencies.resolveBing.mockRejectedValueOnce(new Error('offline'));
    const expired = createFastBackgroundCache(dependencies);
    const fallback = await expired('bing');
    expect(fallback.blob).toBe(first.blob);
    await expired('bing');
    expect(dependencies.resolveBing).toHaveBeenCalledTimes(2);
  });

  it.each([
    [new Response('<html/>', { headers: { 'content-type': 'text/html' } }), 'format'],
    [new Response('image', { headers: { 'content-type': 'image/png', 'cache-control': 'private, no-store' } }), 'cache'],
    [new Response('image', { headers: { 'content-type': 'image/png', 'content-length': String(21 * 1024 * 1024) } }), 'size'],
    [new Response('', { status: 403 }), 'download']
  ])('rejects an unusable download', async(response, code) => {
    await expect(downloadBackground('https://example.com/image', async() => response)).rejects.toMatchObject({ code });
  });

  it('accepts image data rather than requiring an image extension in the URL', async() => {
    const blob = await downloadBackground('https://example.com/photo?id=42', async() =>
      new Response('image bytes', { headers: { 'content-type': 'image/png' } }));
    expect(blob.type).toBe('image/png');
    expect(await blob.text()).toBe('image bytes');
  });
});
