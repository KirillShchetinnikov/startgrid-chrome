function onError(DOMError) {
  let msg = '';

  switch (DOMError.name) {
    case 'QuotaExceededError':
      msg = 'QuotaExceededError';
      break;
    case 'NotFoundError':
      msg = 'NotFoundError';
      break;
    case 'SecurityError':
      msg = 'SecurityError';
      break;
    case 'InvalidModificationError':
      msg = 'InvalidModificationError';
      break;
    case 'InvalidStateError':
      msg = 'InvalidStateError';
      break;
    default:
      msg = 'Unknown Error';
      break;
  }
  return msg;
}

function requestQuota(size = 500) {
  return new Promise((resolve, reject) => {
    navigator.webkitPersistentStorage.requestQuota(1024 * 1024 * size, function(grantedBytes) {
      resolve(grantedBytes);
    }, (err) => {
      reject(onError(err));
    });
  });
}

function queryUsageAndQuota() {
  return new Promise((resolve) => {
    navigator.webkitPersistentStorage.queryUsageAndQuota(function(used, remaining) {
      resolve(used, remaining);
    });
  });
}

function requestFileSystem(grantedBytes) {
  return new Promise((resolve, reject) => {
    window.webkitRequestFileSystem(window.PERSISTENT, grantedBytes, function(filesystem) {
      resolve(filesystem);
    }, (err) => {
      reject(onError(err));
    });
  });
}

function getDirectory(fs, path) {
  return new Promise((resolve, reject) => {
    fs.root.getDirectory(path, {}, function(dirEntry) {
      resolve(dirEntry);
    }, (err) => {
      reject(onError(err));
    });
  });
}

function createDirectory(fs, path) {
  return new Promise((resolve, reject) => {
    fs.root.getDirectory(path, { create: true }, function(dirEntry) {
      resolve(dirEntry);
    }, (err) => {
      reject(onError(err));
    });
  });
}

function removeRecursively(dirEntry) {
  return new Promise((resolve, reject) => {
    dirEntry.removeRecursively(function() {
      resolve(dirEntry);
    }, (err) => {
      reject(onError(err));
    });
  });
}

function remove(entry) {
  return new Promise((resolve, reject) => {
    entry.remove(function() {
      resolve(entry);
    }, (err) => {
      reject(onError(err));
    });
  });
}

function getFile(fs, path, hasCreate = false) {
  return new Promise((resolve, reject) => {
    fs.root.getFile(path, { create: hasCreate }, function(fileEntry) {
      resolve(fileEntry);
    }, (err) => {
      reject(onError(err));
    });
  });
}

function createFile(fileEntry, data) {
  return new Promise((resolve, reject) => {
    fileEntry.createWriter(function(fileWriter) {
      fileWriter.onwriteend = function() {
        resolve(fileEntry);
      };
      fileWriter.onerror = reject;

      let blob = new Blob([data.file], { type: data.fileType });
      fileWriter.write(blob);
    });
  });
}

function readEntries(fs) {
  return new Promise((resolve, reject) => {
    let dirReader = fs.root.createReader();
    dirReader.readEntries(function(entries) {
      resolve(entries);
    }, (err) => {
      reject(onError(err));
    });
  });
}

const FS = (() => {
  let fs = null;

  return {
    async init(size) {
      const grantedBytes = await requestQuota(size).catch(err => console.warn(err));
      if (!grantedBytes) return Promise.reject('ERROR: request quota');

      const filesystem = await requestFileSystem(grantedBytes).catch(err => console.warn(err));
      if (!filesystem) return Promise.reject('ERROR: request FileSystem');

      fs = filesystem;
      return Promise.resolve(fs);
    },
    usedAndRemaining() {
      return queryUsageAndQuota();
    },
    createDir(path) {
      return createDirectory(fs, path);
    },
    async removeDir(path, recursive = false) {
      const dirEntry = await getDirectory(fs, path).catch(err => console.warn(err));
      if (!dirEntry) return Promise.reject('ERROR: get directory');

      if (recursive) {
        return removeRecursively(dirEntry);
      } else {
        return remove(dirEntry);
      }
    },
    async createFile(path, data) {
      const fileEntry = await getFile(fs, path, true).catch(err => console.warn(err));
      if (!fileEntry) return Promise.reject('ERROR: create file');

      return createFile(fileEntry, data);
    },
    async removeFile(path) {
      const fileEntry = await getFile(fs, path).catch(err => console.warn(err));
      if (!fileEntry) return Promise.reject('ERROR: get file');

      return remove(fileEntry);
    },

    async purge() {
      const entries = readEntries(fs).catch(err => console.warn(err));
      if (!entries) return;

      for (let i = 0, entry; entry = entries[i]; ++i) { // eslint-disable-line no-cond-assign
        if (entry.isDirectory) {
          await removeRecursively(entry).catch(err => console.warn(err));
        } else {
          await remove(entry).catch(err => console.warn(err));
        }
      }
    }

  };
})();

export default FS;
