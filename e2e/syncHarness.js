import { jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';

const clone = value => JSON.parse(JSON.stringify(value));

export function createStorageArea(initial = {}) {
  const data = clone(initial);
  return {
    data,
    get: jest.fn(async keys => {
      if (keys === null || keys === undefined) return clone(data);
      return clone(Object.fromEntries((Array.isArray(keys) ? keys : [keys])
        .filter(key => Object.hasOwn(data, key)).map(key => [key, data[key]])));
    }),
    set: jest.fn(async values => { Object.assign(data, clone(values)); }),
    remove: jest.fn(async keys => {
      (Array.isArray(keys) ? keys : [keys]).forEach(key => delete data[key]);
    }),
    clear: jest.fn(async() => { Object.keys(data).forEach(key => delete data[key]); }),
    getBytesInUse: jest.fn(async(keys = null) => {
      const included = keys === null ? Object.keys(data) : Array.isArray(keys) ? keys : [keys];
      return included.reduce((bytes, key) => bytes + (Object.hasOwn(data, key)
        ? Buffer.byteLength(key + JSON.stringify(data[key])) : 0), 0);
    }),
    QUOTA_BYTES: 102400,
    QUOTA_BYTES_PER_ITEM: 8192
  };
}

export async function createSyncDevice(sync, local = createStorageArea({ settings: { enable_sync: true } })) {
  jest.resetModules();
  Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID } });
  global.browser = {
    i18n: { getMessage: key => key },
    runtime: { getURL: path => `chrome-extension://test/${path}` },
    bookmarks: { getTree: jest.fn(async() => []) },
    storage: { local, sync }
  };
  const { settings } = await import('../src/js/settings');
  await settings.init();
  return { settings, local };
}
