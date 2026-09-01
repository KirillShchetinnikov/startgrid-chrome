import { afterEach, describe, expect, it, jest } from '@jest/globals';

function mockStorage(storedSettings) {
  global.browser = {
    i18n: { getMessage: key => key },
    runtime: { getURL: path => `chrome-extension://test/${path}` },
    storage: {
      local: {
        get: jest.fn().mockResolvedValue({ settings: storedSettings }),
        set: jest.fn().mockResolvedValue(),
        remove: jest.fn().mockResolvedValue(),
        clear: jest.fn().mockResolvedValue()
      },
      sync: {
        get: jest.fn().mockResolvedValue({}),
        set: jest.fn().mockResolvedValue(),
        clear: jest.fn().mockResolvedValue(),
        getBytesInUse: jest.fn().mockResolvedValue(0),
        QUOTA_BYTES: 102400,
        QUOTA_BYTES_PER_ITEM: 8192
      }
    }
  };
}

describe('numeric settings validation', () => {
  afterEach(() => {
    delete global.browser;
    jest.resetModules();
  });

  it('keeps the limits registry aligned with every numeric setting control', async() => {
    mockStorage({ enable_sync: false });
    const [{ NUMERIC_SETTING_LIMITS }, { default: settingsList }] = await Promise.all([
      import('../src/js/settings'),
      import('../src/js/constants/settingsList')
    ]);
    const numericControls = settingsList
      .flatMap(section => section.sections)
      .flatMap(section => section.list)
      .filter(setting => setting.type === 'range');

    numericControls.forEach(setting => {
      expect(NUMERIC_SETTING_LIMITS[setting.id]).toEqual({
        min: setting.min,
        max: setting.max
      });
    });
    expect(Object.keys(NUMERIC_SETTING_LIMITS).sort()).toEqual([
      'dial_columns',
      ...numericControls.map(setting => setting.id)
    ].sort());
  });

  it('clamps every numeric setting during loading and individual updates', async() => {
    mockStorage({ enable_sync: false });
    const { NUMERIC_SETTING_LIMITS, settings } = await import('../src/js/settings');
    const aboveMaximum = Object.fromEntries(
      Object.entries(NUMERIC_SETTING_LIMITS).map(([key, limits]) => [
        key,
        limits.max + 1000
      ])
    );

    browser.storage.local.get.mockResolvedValue({
      settings: {
        enable_sync: false,
        ...aboveMaximum
      }
    });
    await settings.init();

    Object.entries(NUMERIC_SETTING_LIMITS).forEach(([key, limits]) => {
      expect(settings.$[key]).toBe(limits.max);
    });

    for (const [key, limits] of Object.entries(NUMERIC_SETTING_LIMITS)) {
      await settings.updateKey(key, limits.min - 1000);
      expect(settings.$[key]).toBe(limits.min);
    }
  });
});
