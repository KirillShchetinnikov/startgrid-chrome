import ImageDB from './api/imageDB';
import { getBlobHash } from './api/remoteThumbnail';
import { createStaticBackground } from './staticBackground';

export function createLocalBackgroundCache({ read, write, hash, prepare, lock }) {
  return async blob => {
    if (!blob || blob.type.startsWith('video/')) return null;
    // Hash the source rather than changing its record. Legacy uploads have no
    // revision field, and an old render must never overwrite a newer upload.
    const sourceHash = await hash(blob);
    return lock('startgrid-fast-background-local', async() => {
      const id = 'background-cache-local';
      const cached = await read(id);
      if (cached?.version === 1 && cached.sourceHash === sourceHash && cached.blob) return cached.blob;
      const prepared = await prepare(blob);
      if (!prepared) return null;
      await write({ id, version: 1, sourceHash, blob: prepared });
      return prepared;
    });
  };
}

export const getFastLocalBackground = createLocalBackgroundCache({
  read: id => ImageDB.get(id),
  write: record => ImageDB.update(record),
  hash: getBlobHash,
  prepare: blob => createStaticBackground(blob, { maxWidth: 1920, maxHeight: 1080, type: 'image/webp' }),
  lock: (name, operation) => navigator.locks.request(name, operation)
});
