async function runStorageOperation(operation) {
  const result = await operation();
  const error = browser.runtime?.lastError;
  if (error) throw new Error(error.message);
  return result;
}

function createStorageArea(area) {
  return {
    get(key) {
      return runStorageOperation(() => area.get(key));
    },
    set(payload) {
      return runStorageOperation(() => area.set(payload));
    },
    remove(key) {
      return runStorageOperation(() => area.remove(key));
    },
    clear() {
      return runStorageOperation(() => area.clear());
    }
  };
}

const sync = createStorageArea(browser.storage.sync);

export const storage = {
  local: createStorageArea(browser.storage.local),
  sync: {
    ...sync,
    getBytesInUse(key = null) {
      if (typeof browser.storage.sync.getBytesInUse !== 'function') return Promise.resolve(0);
      return runStorageOperation(() => browser.storage.sync.getBytesInUse(key));
    }
  }
};
