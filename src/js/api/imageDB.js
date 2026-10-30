import { openDB, deleteDB } from 'idb';

export default class ImageDB {
  static DB_NAME = 'startgrid';
  static DB_VERSION = 1;
  static DB_STORE = 'images';
  static DB = null;

  // connect to IndexedDB database
  static async #dbConnect() {
    this.DB =
      this.DB ||
      (await openDB(this.DB_NAME, this.DB_VERSION, {
        upgrade(db, oldVersion) {
          switch (oldVersion) {
            case 0: {
              db.createObjectStore(ImageDB.DB_STORE, {
                keyPath: 'id',
                autoIncrement: true
              });
            }
          }
        },
        blocking() {
          // if another tab blocks database upgrade or deletion
          // we need to reload that tab
          location.reload();
        }
      }));
    return ImageDB.DB;
  }

  static async deleteDB() {
    if (!this.DB) return true;
    try {
      await this.DB.close();
      await deleteDB(this.DB_NAME);
      this.DB = null;
      return true;
    } catch (error) {
      console.warn(error);
      return false;
    }
  }

  static async clear() {
    try {
      const db = await this.#dbConnect();
      await db.clear(this.DB_STORE);
      return true;
    } catch (error) {
      console.warn(error);
      return false;
    }
  }

  static async clearThumbnails() {
    try {
      const db = await this.#dbConnect();
      const tx = db.transaction(this.DB_STORE, 'readwrite');
      let cursor = await tx.store.openCursor();

      while (cursor) {
        if (cursor.key !== 'background' && !String(cursor.key).startsWith('background-cache-')) {
          await cursor.delete();
        }
        cursor = await cursor.continue();
      }

      await tx.done;
      return true;
    } catch (error) {
      console.warn(error);
      return false;
    }
  }

  static async clearBackgroundCache() {
    const db = await this.#dbConnect();
    const tx = db.transaction(this.DB_STORE, 'readwrite');
    await Promise.all(['url', 'bing', 'local'].map(source => tx.store.delete(`background-cache-${source}`)));
    await tx.done;
  }

  static async count() {
    try {
      const db = await this.#dbConnect();
      return await db.count(this.DB_STORE);
    } catch (error) {
      console.warn(error);
    }
  }

  static async add(data) {
    try {
      const db = await this.#dbConnect();
      const tx = db.transaction(this.DB_STORE, 'readwrite');

      const promises = data.map((image) => {
        return tx.store.add(image).then((e) => {
          return {
            id: e,
            ...image
          };
        });
      });

      const addedImages = await Promise.all(promises);
      await tx.done;
      return addedImages;
    } catch (error) {
      console.warn(error);
    }
  }

  static async get(id) {
    try {
      const db = await this.#dbConnect();

      return await db.get(this.DB_STORE, id);
    } catch (error) {
      console.warn(error);
    }
  }

  static async update(payload) {
    const db = await this.#dbConnect();
    return db.put(this.DB_STORE, { ...payload, revision: crypto.randomUUID() });
  }

  // Reserve a persisted revision before starting slow work. Every context sees
  // this token, including tabs which save a local image while a worker fetches.
  static async beginUpdate(id, options = {}) {
    const db = await this.#dbConnect();
    const tx = db.transaction(this.DB_STORE, 'readwrite');
    try {
      const existing = await tx.store.get(id);
      if (Object.hasOwn(options, 'expectedRevision')
        && (existing?.revision ?? null) !== options.expectedRevision) {
        await tx.done;
        return null;
      }
      const snapshot = { ...existing, id, revision: crypto.randomUUID() };
      await tx.store.put(snapshot);
      await tx.done;
      return snapshot;
    } catch (error) {
      await tx.done.catch(() => undefined);
      throw error;
    }
  }

  static async updateIfUnchanged(payload, revision, { signal } = {}) {
    const db = await this.#dbConnect();
    const tx = db.transaction(this.DB_STORE, 'readwrite');
    let cancelled = false;
    const abort = () => {
      try {
        tx.abort();
        cancelled = true;
      } catch (error) {}
    };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      if (signal?.aborted) {
        abort();
        await tx.done.catch(() => undefined);
        return false;
      }
      const current = await tx.store.get(payload.id);
      if (signal?.aborted || !current || current.revision !== revision) {
        await tx.done;
        return false;
      }
      await tx.store.put({ ...payload, revision: crypto.randomUUID() });
      await tx.done;
      return true;
    } catch (error) {
      await tx.done.catch(() => undefined);
      if (cancelled) return false;
      throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
    }
  }

  static async delete(id) {
    try {
      const db = await this.#dbConnect();
      return await db.delete(this.DB_STORE, id);
    } catch (error) {
      console.warn(error);
    }
  }

  static async getAllByIds(ids) {
    if (!ids.length) return [];
    try {
      const db = await this.#dbConnect();
      const tx = db.transaction(this.DB_STORE, 'readonly');
      const [images] = await Promise.all([
        Promise.all([...new Set(ids)].map(id => tx.store.get(id))),
        tx.done
      ]);
      return images.filter(image => image !== undefined);
    } catch (err) {
      console.warn(err);
    }
  }
}
