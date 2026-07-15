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
        if (cursor.key !== 'background') {
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
    try {
      const db = await this.#dbConnect();

      return await db.put(this.DB_STORE, payload);
    } catch (error) {
      console.warn(error);
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
    try {
      const db = await this.#dbConnect();
      let cursor = await db.transaction(this.DB_STORE).store.openCursor();

      const images = [];

      while (cursor) {
        if (ids.includes(cursor.value.id)) {
          images.push(cursor.value);
        }
        cursor = await cursor.continue();
      }
      return images;
    } catch (err) {
      console.warn(err);
    }
  }
}
