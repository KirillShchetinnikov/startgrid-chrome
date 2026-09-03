import { describe, expect, it, jest } from '@jest/globals';

describe('MV3 storage adapter', () => {
  it('uses promise-based storage operations and preserves runtime.lastError', async() => {
    const get = jest.fn().mockResolvedValue({ setting: true });
    global.browser = {
      runtime: { lastError: null },
      storage: {
        local: { get, set: jest.fn(), remove: jest.fn(), clear: jest.fn() },
        sync: { get, set: jest.fn(), remove: jest.fn(), clear: jest.fn() }
      }
    };
    const { storage } = await import('../src/js/api/storage');

    await expect(storage.local.get('setting')).resolves.toEqual({ setting: true });
    expect(get).toHaveBeenCalledWith('setting');

    browser.runtime.lastError = { message: 'storage unavailable' };
    await expect(storage.sync.get('setting')).rejects.toThrow('storage unavailable');
  });
});
