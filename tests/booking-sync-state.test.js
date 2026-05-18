const assert = require('assert');
const {
  getBlockingBookingIds,
  getUnsyncedBookingIds,
  createBookingEventPayload,
  recoverQueueFromSnapshot,
  hasQueueOperation,
  removeQueueOperation,
  updateQueueOperation
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

const queueWithSupersededOperation = [
  { opId: 'booking-1:upsert:old', bookingId: 'booking-1', type: 'upsert' },
  { opId: 'booking-1:delete:new', bookingId: 'booking-1', type: 'delete' }
];

assert.deepStrictEqual(
  removeQueueOperation(queueWithSupersededOperation, 'booking-1:upsert:old'),
  [{ opId: 'booking-1:delete:new', bookingId: 'booking-1', type: 'delete' }]
);

assert.deepStrictEqual(
  updateQueueOperation(queueWithSupersededOperation, 'booking-1:upsert:old', {
    status: 'syncing'
  }),
  [
    {
      opId: 'booking-1:upsert:old',
      bookingId: 'booking-1',
      type: 'upsert',
      status: 'syncing'
    },
    { opId: 'booking-1:delete:new', bookingId: 'booking-1', type: 'delete' }
  ]
);

assert.strictEqual(hasQueueOperation(queueWithSupersededOperation, 'booking-1:delete:new'), true);
assert.strictEqual(hasQueueOperation(queueWithSupersededOperation, 'missing-op'), false);

const eventPayload = createBookingEventPayload({
  entry: {
    eventId: '11111111-1111-4111-8111-111111111111',
    type: 'delete',
    bookingId: 'booking-1',
    date: '2026-05-18',
    payload: { id: 'booking-1', date: '2026-05-18' }
  },
  deviceId: 'device-1',
  deviceRole: 'primary_tablet',
  clientSequence: 7,
  clientCreatedAt: '2026-05-18T12:00:00.000Z'
});

assert.deepStrictEqual(eventPayload, {
  event_id: '11111111-1111-4111-8111-111111111111',
  booking_id: 'booking-1',
  booking_date: '2026-05-18',
  event_type: 'booking_deleted',
  payload: {
    id: 'booking-1',
    booking_date: '2026-05-18',
    table_index: undefined,
    time_index: undefined,
    start_minutes: undefined,
    duration_slots: undefined,
    guest_name: '',
    guest_phone: '',
    guest_comment: '',
    guests: 1,
    color_theme: 'yellow',
    arrival_status: 'pending',
    arrival_marked_at: null,
    deleted_at: '2026-05-18T12:00:00.000Z'
  },
  device_id: 'device-1',
  device_role: 'primary_tablet',
  client_sequence: 7,
  client_created_at: '2026-05-18T12:00:00.000Z'
});

const restoreEventPayload = createBookingEventPayload({
  entry: {
    eventId: '22222222-2222-4222-8222-222222222222',
    type: 'restore',
    bookingId: 'booking-2',
    date: '2026-05-19',
    payload: {
      id: 'booking-2',
      date: '2026-05-19',
      tableIndex: 3,
      timeIndex: 5,
      startMinutes: 870,
      durationSlots: 4,
      name: 'Гость',
      phone: '+79990000000',
      comment: 'Окно',
      guests: 2,
      colorTheme: 'blue',
      arrivalStatus: 'pending',
      arrivalMarkedAt: null,
      deleted_at: '2026-05-19T12:00:00.000Z'
    }
  },
  deviceId: 'device-1',
  deviceRole: 'primary_tablet',
  clientSequence: 8,
  clientCreatedAt: '2026-05-18T12:01:00.000Z'
});

assert.deepStrictEqual(restoreEventPayload, {
  event_id: '22222222-2222-4222-8222-222222222222',
  booking_id: 'booking-2',
  booking_date: '2026-05-19',
  event_type: 'booking_restored',
  payload: {
    id: 'booking-2',
    booking_date: '2026-05-19',
    table_index: 3,
    time_index: 5,
    start_minutes: 870,
    duration_slots: 4,
    guest_name: 'Гость',
    guest_phone: '+79990000000',
    guest_comment: 'Окно',
    guests: 2,
    color_theme: 'blue',
    arrival_status: 'pending',
    arrival_marked_at: null
  },
  device_id: 'device-1',
  device_role: 'primary_tablet',
  client_sequence: 8,
  client_created_at: '2026-05-18T12:01:00.000Z'
});

console.log('booking sync state tests passed');
