import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createStorageArea, createSyncDevice } from './syncHarness';

afterEach(() => {
  delete global.browser;
  delete global.crypto;
  delete global.localStorage;
});

describe('local cache cleanup', () => {
  it('preserves bookmark preferences and settings without clearing or rewriting the storage area', async() => {
    const local = createStorageArea({
      settings: { enable_sync: false, color_theme: 'dark' },
      'bookmark_text_preferences:7': { titleSize: 22 },
      bingImage: { expiresAt: 1 }, screen: { availWidth: 800 }
    });
    const sync = createStorageArea();
    const { settings } = await createSyncDevice(sync, local);
    const before = JSON.parse(JSON.stringify(local.data.settings));
    global.localStorage = { clear: jest.fn() };
    local.set.mockClear();
    sync.set.mockClear();
    await settings.clearLocalCache();
    expect(local.data.settings).toEqual(before);
    expect(local.data['bookmark_text_preferences:7']).toEqual({ titleSize: 22 });
    expect(local.data).not.toHaveProperty('bingImage');
    expect(local.data).not.toHaveProperty('screen');
    expect(local.clear).not.toHaveBeenCalled();
    expect(local.set).not.toHaveBeenCalled();
    expect(sync.set).not.toHaveBeenCalled();
    expect(localStorage.clear).toHaveBeenCalledTimes(1);
  });
});
