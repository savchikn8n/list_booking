(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.bookingLocalStorage = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const DB_NAME = 'booking-sheet-local';
  const DB_VERSION = 1;
  const SNAPSHOTS_STORE = 'snapshots';
  const KEY_VALUES_STORE = 'keyValues';
  const SNAPSHOT_STORAGE_PREFIX = 'booking_snapshot:';
  const OPS_QUEUE_STORAGE_KEY = 'booking_ops_queue';
  const SYNC_META_STORAGE_KEY = 'booking_sync_meta';

  function cloneValue(value) {
    if (value === null || typeof value === 'undefined') return value;
    return JSON.parse(JSON.stringify(value));
  }

  function readJsonStorage(legacyStorage, key, fallbackValue) {
    if (!legacyStorage) return fallbackValue;

    try {
      const rawValue = legacyStorage.getItem(key);
      return rawValue ? JSON.parse(rawValue) : fallbackValue;
    } catch (_) {
      return fallbackValue;
    }
  }

  function writeJsonStorage(legacyStorage, key, value) {
    if (!legacyStorage) return false;

    try {
      legacyStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function getLegacySnapshotEntries(legacyStorage) {
    if (!legacyStorage) return [];

    const entries = [];
    for (let index = 0; index < legacyStorage.length; index += 1) {
      const key = legacyStorage.key(index);
      if (!key || !key.startsWith(SNAPSHOT_STORAGE_PREFIX)) continue;

      const snapshot = readJsonStorage(legacyStorage, key, null);
      if (snapshot?.date) {
        entries.push([snapshot.date, snapshot]);
      }
    }

    return entries;
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  function openDatabase(indexedDBApi) {
    return new Promise((resolve, reject) => {
      const request = indexedDBApi.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) {
          db.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'date' });
        }
        if (!db.objectStoreNames.contains(KEY_VALUES_STORE)) {
          db.createObjectStore(KEY_VALUES_STORE, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function createIndexedDbDatabase(indexedDBApi) {
    if (!indexedDBApi) return null;

    let dbPromise = null;

    function getDatabase() {
      if (!dbPromise) {
        dbPromise = openDatabase(indexedDBApi);
      }
      return dbPromise;
    }

    async function readKeyValue(key) {
      const db = await getDatabase();
      const transaction = db.transaction(KEY_VALUES_STORE, 'readonly');
      const record = await requestToPromise(transaction.objectStore(KEY_VALUES_STORE).get(key));
      return record ? record.value : null;
    }

    async function writeKeyValue(key, value) {
      const db = await getDatabase();
      const transaction = db.transaction(KEY_VALUES_STORE, 'readwrite');
      transaction.objectStore(KEY_VALUES_STORE).put({ key, value: cloneValue(value) });
      await transactionDone(transaction);
    }

    return {
      async readAll() {
        const db = await getDatabase();
        const snapshotsTransaction = db.transaction(SNAPSHOTS_STORE, 'readonly');
        const snapshotRecords = await requestToPromise(
          snapshotsTransaction.objectStore(SNAPSHOTS_STORE).getAll()
        );

        const snapshots = new Map();
        (snapshotRecords || []).forEach((record) => {
          if (record?.date) snapshots.set(record.date, record.snapshot || record);
        });

        return {
          snapshots,
          queue: await readKeyValue(OPS_QUEUE_STORAGE_KEY),
          meta: await readKeyValue(SYNC_META_STORAGE_KEY)
        };
      },
      async writeSnapshot(date, snapshot) {
        const db = await getDatabase();
        const transaction = db.transaction(SNAPSHOTS_STORE, 'readwrite');
        transaction.objectStore(SNAPSHOTS_STORE).put({
          date,
          snapshot: cloneValue(snapshot),
          updatedAt: new Date().toISOString()
        });
        await transactionDone(transaction);
      },
      async writeQueue(queue) {
        await writeKeyValue(OPS_QUEUE_STORAGE_KEY, queue);
      },
      async writeMeta(meta) {
        await writeKeyValue(SYNC_META_STORAGE_KEY, meta);
      },
      async flush() {}
    };
  }

  function createBookingLocalStorage({ database = null, legacyStorage = null } = {}) {
    const snapshots = new Map();
    let queue = [];
    let meta = {};
    let activeDatabase = database;
    const pendingWrites = new Set();

    function persist(writePromise, fallbackWrite = null) {
      const pendingWrite = Promise.resolve(writePromise)
        .catch(() => {
          activeDatabase = null;
          if (typeof fallbackWrite === 'function') fallbackWrite();
        })
        .finally(() => {
          pendingWrites.delete(pendingWrite);
        });

      pendingWrites.add(pendingWrite);
      return pendingWrite;
    }

    async function init() {
      const databaseState = activeDatabase ? await activeDatabase.readAll().catch(() => null) : null;
      const legacySnapshots = getLegacySnapshotEntries(legacyStorage);
      const legacyQueue = readJsonStorage(legacyStorage, OPS_QUEUE_STORAGE_KEY, []);
      const legacyMeta = readJsonStorage(legacyStorage, SYNC_META_STORAGE_KEY, {});

      if (databaseState?.snapshots) {
        databaseState.snapshots.forEach((snapshot, date) => {
          snapshots.set(date, cloneValue(snapshot));
        });
      }

      legacySnapshots.forEach(([date, snapshot]) => {
        if (!snapshots.has(date)) {
          snapshots.set(date, cloneValue(snapshot));
          if (activeDatabase) {
            persist(activeDatabase.writeSnapshot(date, snapshot));
          }
        }
      });

      queue = Array.isArray(databaseState?.queue)
        ? cloneValue(databaseState.queue)
        : cloneValue(legacyQueue);

      meta =
        databaseState?.meta && typeof databaseState.meta === 'object'
          ? cloneValue(databaseState.meta)
          : cloneValue(legacyMeta);

      if (activeDatabase && !databaseState?.queue && legacyQueue.length) {
        persist(activeDatabase.writeQueue(queue));
      }
      if (activeDatabase && !databaseState?.meta && Object.keys(legacyMeta).length) {
        persist(activeDatabase.writeMeta(meta));
      }

      await Promise.all(Array.from(pendingWrites));
    }

    function setSnapshot(date, snapshot) {
      snapshots.set(date, cloneValue(snapshot));
      if (activeDatabase) {
        persist(
          activeDatabase.writeSnapshot(date, snapshot),
          () => writeJsonStorage(legacyStorage, `${SNAPSHOT_STORAGE_PREFIX}${date}`, snapshot)
        );
      } else {
        writeJsonStorage(legacyStorage, `${SNAPSHOT_STORAGE_PREFIX}${date}`, snapshot);
      }
      return true;
    }

    function setQueue(nextQueue) {
      queue = Array.isArray(nextQueue) ? cloneValue(nextQueue) : [];
      if (activeDatabase) {
        persist(
          activeDatabase.writeQueue(queue),
          () => writeJsonStorage(legacyStorage, OPS_QUEUE_STORAGE_KEY, queue)
        );
      } else {
        writeJsonStorage(legacyStorage, OPS_QUEUE_STORAGE_KEY, queue);
      }
      return true;
    }

    function setMeta(nextMeta) {
      meta = nextMeta && typeof nextMeta === 'object' ? cloneValue(nextMeta) : {};
      if (activeDatabase) {
        persist(
          activeDatabase.writeMeta(meta),
          () => writeJsonStorage(legacyStorage, SYNC_META_STORAGE_KEY, meta)
        );
      } else {
        writeJsonStorage(legacyStorage, SYNC_META_STORAGE_KEY, meta);
      }
      return true;
    }

    return {
      init,
      getSnapshot(date) {
        return snapshots.has(date) ? cloneValue(snapshots.get(date)) : null;
      },
      setSnapshot,
      getQueue() {
        return cloneValue(queue);
      },
      setQueue,
      getMeta() {
        return cloneValue(meta);
      },
      patchMeta(metaPatch) {
        return setMeta({
          ...meta,
          ...(metaPatch || {})
        });
      },
      async flush() {
        await Promise.all(Array.from(pendingWrites));
      }
    };
  }

  function createDefaultBookingLocalStorage(root) {
    return createBookingLocalStorage({
      database: createIndexedDbDatabase(root.indexedDB),
      legacyStorage: root.localStorage || null
    });
  }

  return {
    createBookingLocalStorage,
    createDefaultBookingLocalStorage,
    createIndexedDbDatabase
  };
});
