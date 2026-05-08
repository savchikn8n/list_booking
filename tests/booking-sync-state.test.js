const assert = require('assert');
const { getBlockingBookingIds } = require('../booking-sync-state.js');

const blockingIds = getBlockingBookingIds([
  { bookingId: 'a', date: '2026-05-07', status: 'pending' },
  { bookingId: 'b', date: '2026-05-07', status: 'syncing' },
  { bookingId: 'c', date: '2026-05-07', status: 'failed' },
  { bookingId: 'd', date: '2026-05-08', status: 'pending' }
], '2026-05-07');

assert.deepStrictEqual(blockingIds.sort(), ['a', 'b']);

console.log('booking sync state tests passed');
