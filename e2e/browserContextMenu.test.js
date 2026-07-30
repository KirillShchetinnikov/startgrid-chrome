import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { getFolders } from '../src/js/api/bookmark';
import browserContextMenu from '../src/js/plugins/browserContextMenu';

jest.mock('../src/js/api/bookmark', () => ({
  getFolders: jest.fn()
}));

describe('browser context menu rebuild', () => {
  afterEach(() => {
    delete global.browser;
    jest.clearAllMocks();
  });

  it('clears in-flight state after rejection and retries a full rebuild', async() => {
    getFolders.mockResolvedValue([]);
    let failRemove = true;
    global.browser = {
      i18n: { getMessage: key => key },
      runtime: { lastError: null },
      contextMenus: {
        removeAll: jest.fn(callback => {
          global.browser.runtime.lastError = failRemove ? { message: 'remove failed' } : null;
          failRemove = false;
          callback();
          global.browser.runtime.lastError = null;
        }),
        create: jest.fn((item, callback) => callback())
      }
    };

    await expect(browserContextMenu.init(true)).rejects.toThrow('remove failed');
    await expect(browserContextMenu.init(true)).resolves.toBe(true);

    expect(global.browser.contextMenus.removeAll).toHaveBeenCalledTimes(2);
    expect(global.browser.contextMenus.create).toHaveBeenCalledTimes(3);
  });

  it('removes a partial tree before retrying after create rejection', async() => {
    getFolders.mockResolvedValue([]);
    let failCreate = true;
    global.browser = {
      i18n: { getMessage: key => key },
      runtime: { lastError: null },
      contextMenus: {
        removeAll: jest.fn(callback => callback()),
        create: jest.fn((item, callback) => {
          global.browser.runtime.lastError = failCreate ? { message: 'create failed' } : null;
          failCreate = false;
          callback();
          global.browser.runtime.lastError = null;
        })
      }
    };

    await expect(browserContextMenu.create()).rejects.toThrow('create failed');
    await expect(browserContextMenu.create()).resolves.toBe(true);
    expect(global.browser.contextMenus.removeAll).toHaveBeenCalledTimes(2);
    expect(global.browser.contextMenus.create).toHaveBeenCalledTimes(4);
  });

  it('serializes true-false-true and applies only one tree for the final state', async() => {
    getFolders.mockResolvedValue([]);
    let releaseFirstRemove;
    let removeCalls = 0;
    const installed = new Set();
    global.browser = {
      i18n: { getMessage: key => key },
      runtime: { lastError: null },
      contextMenus: {
        removeAll: jest.fn(callback => {
          removeCalls += 1;
          const finish = () => {
            installed.clear();
            callback();
          };
          if (removeCalls === 1) releaseFirstRemove = finish;
          else finish();
        }),
        create: jest.fn((item, callback) => {
          installed.add(item.id);
          callback();
        })
      }
    };

    const first = browserContextMenu.toggle(true);
    const second = browserContextMenu.toggle(false);
    const third = browserContextMenu.toggle(true);
    releaseFirstRemove();
    await Promise.all([first, second, third]);

    expect(global.browser.contextMenus.removeAll).toHaveBeenCalledTimes(2);
    expect(global.browser.contextMenus.create).toHaveBeenCalledTimes(6);
    expect(installed).toEqual(new Set(['startgrid', 'current_folder', 'separator']));
  });

  it('serializes false-true without leaving the menu disabled', async() => {
    getFolders.mockResolvedValue([]);
    let releaseFirstRemove;
    let removeCalls = 0;
    const installed = new Set();
    global.browser = {
      i18n: { getMessage: key => key },
      runtime: { lastError: null },
      contextMenus: {
        removeAll: jest.fn(callback => {
          removeCalls += 1;
          const finish = () => {
            installed.clear();
            callback();
          };
          if (removeCalls === 1) releaseFirstRemove = finish;
          else finish();
        }),
        create: jest.fn((item, callback) => {
          installed.add(item.id);
          callback();
        })
      }
    };

    const disabled = browserContextMenu.toggle(false);
    const enabled = browserContextMenu.toggle(true);
    releaseFirstRemove();
    await Promise.all([disabled, enabled]);

    expect(global.browser.contextMenus.removeAll).toHaveBeenCalledTimes(2);
    expect(installed.has('startgrid')).toBe(true);
  });

  it('does not lose a toggle queued after the drain resolves but before finally', async() => {
    getFolders.mockResolvedValue([]);
    const installed = new Set();
    let boundaryToggle;
    let releaseSecondRemove;
    let removeCalls = 0;
    global.browser = {
      i18n: { getMessage: key => key },
      runtime: { lastError: null },
      contextMenus: {
        removeAll: jest.fn(callback => {
          removeCalls += 1;
          if (removeCalls === 2) {
            releaseSecondRemove = () => {
              installed.clear();
              callback();
            };
            return;
          }
          installed.clear();
          callback();
        }),
        create: jest.fn((item, callback) => {
          installed.add(item.id);
          callback();
          if (item.id === 'separator') {
            queueMicrotask(() => {
              boundaryToggle = browserContextMenu.toggle(false);
            });
          }
        })
      }
    };

    let firstSettled = false;
    const first = browserContextMenu.toggle(true).then(value => {
      firstSettled = true;
      return value;
    });
    while (!releaseSecondRemove) await Promise.resolve();
    await Promise.resolve();

    expect(firstSettled).toBe(false);
    expect(installed.has('startgrid')).toBe(true);
    releaseSecondRemove();
    await expect(Promise.all([first, boundaryToggle])).resolves.toEqual([false, false]);
    expect(installed).toEqual(new Set());
    expect(global.browser.contextMenus.removeAll).toHaveBeenCalledTimes(2);
  });
});
