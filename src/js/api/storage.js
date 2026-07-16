function callStorageMethod(storageArea, method, args) {
  return new Promise((resolve, reject) => {
    const callback = result => {
      const lastError = browser.runtime?.lastError;
      if (lastError) reject(new Error(lastError.message));
      else resolve(result);
    };

    try {
      const promise = storageArea[method](...args, callback);
      if (promise?.then) promise.then(resolve, reject);
    } catch (error) {
      reject(error);
    }
  });
}

export const storage = {
  local: {
    get(key) {
      return browser.storage.local.get(key);
    },
    set(payload) {
      return browser.storage.local.set(payload);
    },
    remove(key) {
      return browser.storage.local.remove(key);
    },
    clear() {
      return browser.storage.local.clear();
    }
  },
  sync: {
    get(key) {
      return browser.storage.sync.get(key);
    },
    set(payload) {
      return callStorageMethod(browser.storage.sync, 'set', [payload]);
    },
    remove(key) {
      return browser.storage.sync.remove(key);
    },
    clear() {
      return browser.storage.sync.clear();
    },
    getBytesInUse(key = null) {
      if (typeof browser.storage.sync.getBytesInUse !== 'function') {
        return Promise.resolve(0);
      }
      return callStorageMethod(browser.storage.sync, 'getBytesInUse', [key]);
    }
  }
};
