const assert = require('assert');
const { getExtendedDurationSlots } = require('../booking-extension.js');

const booking = {
  id: 'b1',
  tableIndex: 2,
  timeIndex: 4,
  durationSlots: 3
};

assert.strictEqual(
  getExtendedDurationSlots({
    booking,
    targetTableIndex: 2,
    targetTimeIndex: 8,
    totalInteractiveSlots: 12,
    bookings: [booking]
  }),
  5
);

assert.strictEqual(
  getExtendedDurationSlots({
    booking,
    targetTableIndex: 3,
    targetTimeIndex: 8,
    totalInteractiveSlots: 12,
    bookings: [booking]
  }),
  null
);

assert.strictEqual(
  getExtendedDurationSlots({
    booking,
    targetTableIndex: 2,
    targetTimeIndex: 8,
    totalInteractiveSlots: 12,
    bookings: [
      booking,
      {
        id: 'b2',
        tableIndex: 2,
        timeIndex: 7,
        durationSlots: 1
      }
    ]
  }),
  null
);

console.log('booking extension tests passed');
