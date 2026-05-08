const assert = require('assert');
const { getBookingVisualState } = require('../booking-visual-state.js');

function createBooking(overrides) {
  return {
    startMinutes: 14 * 60,
    arrivalStatus: 'pending',
    ...overrides
  };
}

assert.strictEqual(
  getBookingVisualState({
    booking: createBooking({ arrivalStatus: 'active' }),
    nowTimelineMinutes: 15 * 60
  }),
  'active'
);

assert.strictEqual(
  getBookingVisualState({
    booking: createBooking({ startMinutes: 16 * 60 }),
    nowTimelineMinutes: 15 * 60
  }),
  'upcoming'
);

assert.strictEqual(
  getBookingVisualState({
    booking: createBooking({ startMinutes: 14 * 60 }),
    nowTimelineMinutes: 14 * 60 + 11
  }),
  'overdue'
);

assert.strictEqual(
  getBookingVisualState({
    booking: createBooking({ startMinutes: 14 * 60 }),
    nowTimelineMinutes: null
  }),
  'neutral'
);

console.log('booking visual state tests passed');
