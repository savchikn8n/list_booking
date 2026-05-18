const assert = require('assert');
const { createBookingLocalStorage } = require('../booking-local-storage.js');

function createLegacyStorage(initialValues = {}) {
  const entries = new Map(Object.entries(initialValues));

  return {
    get length() {
      return entries.size;
    },
    key(index) {
      return Array.from(entries.keys())[index] || null;
    },
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
    removeItem(key) {
      entries.delete(key);
    },
    dump() {
      return Object.fromEntries(entries);
    }
  };
}

function createDatabase(initialValues = {}) {
  const snapshots = new Map(Object.entries(initialValues.snapshots || {}));
  let queue = initialValues.queue || null;
  let meta = initialValues.meta || null;
  const writes = [];

  return {
    async readAll() {
      return {
        snapshots: new Map(snapshots),
        queue,
        meta
      };
    },
    async writeSnapshot(date, snapshot) {
      snapshots.set(date, snapshot);
      writes.push(['snapshot', date, snapshot]);
    },
    async writeQueue(nextQueue) {
      queue = nextQueue;
      writes.push(['queue', nextQueue]);
    },
    async writeMeta(nextMeta) {
      meta = nextMeta;
      writes.push(['meta', nextMeta]);
    },
    async flush() {},
    getWrites() {
      return writes;
    }
  };
}

(async () => {
  const legacyStorage = createLegacyStorage({
    'booking_snapshot:2026-05-15': JSON.stringify({
      date: '2026-05-15',
      bookings: [{ id: 'a' }]
    }),
    booking_ops_queue: JSON.stringify([{ bookingId: 'a', status: 'pending' }]),
    booking_sync_meta: JSON.stringify({ activeDate: '2026-05-15' })
  });
  const database = createDatabase();
  const storage = createBookingLocalStorage({ database, legacyStorage });

  await storage.init();

  assert.deepStrictEqual(storage.getSnapshot('2026-05-15').bookings, [{ id: 'a' }]);
  assert.deepStrictEqual(storage.getQueue(), [{ bookingId: 'a', status: 'pending' }]);
  assert.deepStrictEqual(storage.getMeta(), { activeDate: '2026-05-15' });
  assert.ok(database.getWrites().some((write) => write[0] === 'snapshot'));
  assert.ok(database.getWrites().some((write) => write[0] === 'queue'));
  assert.ok(database.getWrites().some((write) => write[0] === 'meta'));

  storage.setQueue([{ bookingId: 'b', status: 'syncing' }]);
  storage.setSnapshot('2026-05-16', { date: '2026-05-16', bookings: [{ id: 'b' }] });
  storage.patchMeta({ lastGlobalSyncAt: 'now' });
  await storage.flush();

  assert.deepStrictEqual(storage.getQueue(), [{ bookingId: 'b', status: 'syncing' }]);
  assert.deepStrictEqual(storage.getSnapshot('2026-05-16').bookings, [{ id: 'b' }]);
  assert.deepStrictEqual(storage.getMeta(), {
    activeDate: '2026-05-15',
    lastGlobalSyncAt: 'now'
  });

  const fallbackStorage = createBookingLocalStorage({
    database: null,
    legacyStorage: createLegacyStorage()
  });
  await fallbackStorage.init();
  fallbackStorage.setQueue([{ bookingId: 'local', status: 'pending' }]);
  assert.deepStrictEqual(fallbackStorage.getQueue(), [
    { bookingId: 'local', status: 'pending' }
  ]);

  console.log('booking local storage tests passed');
})();
