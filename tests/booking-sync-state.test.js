const assert = require('assert');
const {
  getBlockingBookingIds,
  getUnsyncedBookingIds,
  recoverQueueFromSnapshot
} = require('../booking-sync-state.js');

const blockingIds = getBlockingBookingIds([
  { bookingId: 'a', date: '2026-05-07', status: 'pending' },
  { bookingId: 'b', date: '2026-05-07', status: 'syncing' },
  { bookingId: 'c', date: '2026-05-07', status: 'failed' },
  { bookingId: 'd', date: '2026-05-08', status: 'pending' }
], '2026-05-07');

assert.deepStrictEqual(blockingIds.sort(), ['a', 'b']);

const unsyncedIds = getUnsyncedBookingIds([
  { id: 'a', syncState: 'pending' },
  { id: 'b', syncState: 'failed' },
  { id: 'c', syncState: 'synced' }
]);

assert.deepStrictEqual(unsyncedIds.sort(), ['a', 'b']);

const recoveredQueue = recoverQueueFromSnapshot({
  date: '2026-05-07',
  bookings: [
    { id: 'a', date: '2026-05-07', syncState: 'pending' },
    { id: 'b', date: '2026-05-07', syncState: 'failed' },
    { id: 'c', date: '2026-05-07', syncState: 'synced' }
  ],
  queue: [{ bookingId: 'a', date: '2026-05-07', status: 'pending', payload: { id: 'a' } }]
});

assert.strictEqual(recoveredQueue.length, 2);
assert.ok(recoveredQueue.some((entry) => entry.bookingId === 'a'));
assert.ok(recoveredQueue.some((entry) => entry.bookingId === 'b'));

console.log('booking sync state tests passed');
