import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { initSnow, isWinterDate, shouldShowSnow } from '../src/js/plugins/snow';
import Snow from '../src/js/plugins/snow/snow';

describe('snow display mode', () => {
  afterEach(() => {
    delete global.window;
    delete global.document;
  });
  it('recognizes the configured winter period', () => {
    expect(isWinterDate(new Date(2026, 10, 30, 23, 59))).toBe(false);
    expect(isWinterDate(new Date(2026, 11, 1))).toBe(true);
    expect(isWinterDate(new Date(2027, 1, 28, 23, 59))).toBe(true);
    expect(isWinterDate(new Date(2028, 1, 29, 23, 59))).toBe(true);
    expect(isWinterDate(new Date(2028, 2, 1))).toBe(false);
    expect(isWinterDate(new Date(2026, 6, 16))).toBe(false);
  });

  it('supports always, winter and off modes', () => {
    const summer = new Date(2026, 6, 16);
    const winter = new Date(2026, 11, 20);

    expect(shouldShowSnow('always', summer)).toBe(true);
    expect(shouldShowSnow('winter', winter)).toBe(true);
    expect(shouldShowSnow('winter', summer)).toBe(false);
    expect(shouldShowSnow('off', winter)).toBe(false);
  });

  it('never shows decorative snow when reduced motion is requested', () => {
    expect(shouldShowSnow('always', new Date(2026, 6, 16), true)).toBe(false);
    expect(shouldShowSnow('winter', new Date(2026, 11, 20), true)).toBe(false);
  });

  it('starts, stops, restarts, and detaches when reduced-motion changes', async() => {
    let motionListener;
    let idleCallback;
    const media = {
      matches: false,
      addEventListener: jest.fn((event, callback) => { motionListener = callback; }),
      removeEventListener: jest.fn()
    };
    const destroy = jest.fn();
    const Snow = jest.fn(() => ({ destroy }));
    global.window = {
      snowInstance: null,
      matchMedia: jest.fn(() => media),
      requestIdleCallback: jest.fn(callback => {
        idleCallback = callback;
        return 1;
      }),
      cancelIdleCallback: jest.fn(),
      setTimeout,
      clearTimeout
    };

    const controller = initSnow('always', {
      loadSnow: async() => ({ default: Snow }),
      now: () => new Date(2026, 6, 16)
    });
    await idleCallback();
    expect(Snow).toHaveBeenCalledTimes(1);

    media.matches = true;
    motionListener();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(global.window.snowInstance).toBeNull();

    media.matches = false;
    motionListener();
    await idleCallback();
    expect(Snow).toHaveBeenCalledTimes(2);

    controller.destroy();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', motionListener);
    expect(destroy).toHaveBeenCalledTimes(2);
  });

  it('does not start RAF when the image finishes loading after destroy', async() => {
    let resolveImage;
    const imageLoader = jest.fn(() => new Promise(resolve => { resolveImage = resolve; }));
    const canvas = {
      style: {},
      getContext: jest.fn(() => ({})),
      remove: jest.fn()
    };
    global.document = {
      body: { appendChild: jest.fn() },
      createElement: jest.fn(() => canvas)
    };
    global.window = {
      innerWidth: 1200,
      innerHeight: 800,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      requestAnimationFrame: jest.fn(),
      cancelAnimationFrame: jest.fn()
    };

    const snow = new Snow({ total: 0, imageLoader });
    snow.destroy();
    resolveImage({});
    await Promise.resolve();

    expect(canvas.remove).toHaveBeenCalledTimes(1);
    expect(global.window.requestAnimationFrame).not.toHaveBeenCalled();
  });
});
