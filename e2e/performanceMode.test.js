import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { getEffectiveSettings, isSettingAllowed } from '../src/js/performanceMode';
import { getSettingUnavailableReasons } from '../src/js/settingAvailability';
import { createOptionalWorkGate } from '../src/js/optionalWork';
import { validateBackgroundFile } from '../src/js/backgroundFileValidation';

describe('performance mode', () => {
  afterEach(() => { delete global.browser; jest.resetModules(); });

  it('temporarily overrides expensive settings without overwriting shared values or ranges', () => {
    const raw = { performance_mode: 'fast', snow_mode: 'always', dial_shadow: 15,
      dial_columns: 9, dial_horizontal_gap: 160, folder_preview: true, background_image: 'background_bing',
      background_external: 'https://example.com/image.png', home_sort_by: 'usage' };
    expect(getEffectiveSettings(raw)).toMatchObject({ snow_mode: 'off', dial_shadow: 0,
      dial_columns: 9, dial_horizontal_gap: 160, folder_preview: false, background_image: 'background_bing',
      background_external: 'https://example.com/image.png', home_sort_by: 'manual' });
    raw.dial_columns = 5;
    raw.performance_mode = 'full';
    expect(getEffectiveSettings(raw)).toMatchObject({ snow_mode: 'always', dial_shadow: 15,
      dial_columns: 5, folder_preview: true, background_image: 'background_bing', home_sort_by: 'usage' });
  });

  it('allows local and remote backgrounds and normal sorting but disallows usage sorting', () => {
    const settings = { performance_mode: 'fast' };
    expect(isSettingAllowed(settings, 'background_image', 'background_local')).toBe(true);
    expect(isSettingAllowed(settings, 'background_image', 'background_external')).toBe(true);
    expect(isSettingAllowed(settings, 'home_sort_by', 'alphabet')).toBe(true);
    expect(isSettingAllowed(settings, 'home_sort_by', 'usage')).toBe(false);
    expect(validateBackgroundFile({ name: 'movie.mp4', type: 'video/mp4' }, true)).toEqual({ ok: false, reason: 'video' });
    expect(validateBackgroundFile({ name: 'picture.png', type: 'image/png' }, true).ok).toBe(true);
  });

  it('keeps dependency restrictions when Full mode is restored and reports multiple reasons', () => {
    const settings = { performance_mode: 'fast', toolbar_match_tile_background: true, thumbnails_auto_refresh: false };
    expect(getSettingUnavailableReasons(settings, 'toolbar_background_blur')).toEqual([
      ['setting_unavailable_fast'], ['setting_unavailable_toolbar']
    ]);
    settings.performance_mode = 'full';
    expect(getSettingUnavailableReasons(settings, 'toolbar_background_blur')).toEqual([['setting_unavailable_toolbar']]);
    expect(getSettingUnavailableReasons(settings, 'thumbnails_auto_refresh_interval')).toEqual([
      ['setting_requires', 'thumbnails_auto_refresh']
    ]);
  });

  it('persists raw settings across restart and keeps the mode out of Sync', async() => {
    let local = { settings: { enable_sync: true, performance_mode: 'fast', dial_shadow: 19 } };
    let synced = {};
    global.browser = {
      i18n: { getMessage: key => key },
      runtime: { getURL: path => `chrome-extension://test/${path}` },
      storage: {
        local: { get: jest.fn(async() => local), set: jest.fn(async value => { local = { ...local, ...value }; }),
          remove: jest.fn(), clear: jest.fn() },
        sync: { get: jest.fn(async() => synced), set: jest.fn(async value => { synced = { ...synced, ...value }; }),
          clear: jest.fn(), getBytesInUse: jest.fn(async() => 0), QUOTA_BYTES: 102400, QUOTA_BYTES_PER_ITEM: 8192 }
      }
    };
    const { settings } = await import('../src/js/settings');
    await settings.init();
    expect(settings.$.performance_mode).toBe('fast');
    expect(settings.effective.dial_shadow).toBe(0);
    await settings.updateKey('dial_shadow', 19);
    await settings.updateKey('dial_radius', 23);
    expect(local.settings.dial_shadow).toBe(19);
    expect(JSON.stringify(synced)).not.toContain('performance_mode');
    jest.resetModules();
    const { settings: restarted } = await import('../src/js/settings');
    await restarted.init();
    expect(restarted.$.performance_mode).toBe('fast');
    await restarted.updateKey('performance_mode', 'full');
    expect(restarted.effective.dial_shadow).toBe(19);
    expect(restarted.effective.dial_radius).toBe(23);
  });
});

describe('optional background work', () => {
  it('does not start work in Fast mode, including after a worker restart', async() => {
    const gate = createOptionalWorkGate(async() => ({ performance_mode: 'fast' }));
    const work = jest.fn();
    expect(await gate.run(work, [])).toEqual([]);
    expect(work).not.toHaveBeenCalled();
  });

  it('cancels active work and discards late results even after returning to Full mode', async() => {
    const gate = createOptionalWorkGate(async() => ({ performance_mode: 'full' }));
    let resolve, signal;
    const pending = gate.run(value => {
      signal = value;
      return new Promise(done => { resolve = done; });
    }, 'denied');
    await Promise.resolve();
    gate.cancel();
    expect(signal.aborted).toBe(true);
    resolve('stale');
    expect(await pending).toBe('denied');
    expect(await gate.run(async() => 'fresh', 'denied')).toBe('fresh');
  });

  it('cancels requests that are still reading settings', async() => {
    let resolve;
    const gate = createOptionalWorkGate(() => new Promise(done => { resolve = done; }));
    const work = jest.fn();
    const pending = gate.run(work, 'denied');
    gate.cancel();
    resolve({ performance_mode: 'full' });
    expect(await pending).toBe('denied');
    expect(work).not.toHaveBeenCalled();
  });
});
