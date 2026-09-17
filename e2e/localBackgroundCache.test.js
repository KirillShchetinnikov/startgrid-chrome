import { describe, expect, it, jest } from '@jest/globals';
import { createLocalBackgroundCache } from '../src/js/localBackgroundCache';

describe('local Fast mode background cache', () => {
  function fixture() {
    const records = new Map();
    const prepare = jest.fn(async blob => ({ type: 'image/webp', content: blob.content }));
    const write = jest.fn(async record => records.set(record.id, record));
    const get = createLocalBackgroundCache({
      read: async id => records.get(id), write, prepare,
      hash: async blob => blob.content,
      lock: async(name, operation) => operation()
    });
    return { get, records, prepare, write };
  }

  it('reuses a prepared image until the source changes without modifying the original', async() => {
    const { get, records, prepare, write } = fixture();
    const source = { type: 'image/svg+xml', content: 'animated-source' };
    records.set('background', source);
    const prepared = await get(source);
    expect(await get({ ...source })).toBe(prepared);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(await get({ ...source, content: 'replacement' })).not.toBe(prepared);
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(records.get('background')).toBe(source);
    expect(write.mock.calls.every(([record]) => record.id === 'background-cache-local')).toBe(true);
  });

  it('does not decode video or absent uploads', async() => {
    const { get, prepare, write } = fixture();
    expect(await get(null)).toBeNull();
    expect(await get({ type: 'video/mp4' })).toBeNull();
    expect(prepare).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
});
