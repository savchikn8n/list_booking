(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.bookingSyncState = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function getBlockingBookingIds(queue, date) {
    return (queue || [])
      .filter((entry) => entry.date === date && (entry.status === 'pending' || entry.status === 'syncing'))
      .map((entry) => entry.bookingId);
  }

  function getUnsyncedBookingIds(bookings) {
    return (bookings || [])
      .filter((booking) => booking && booking.id && booking.syncState && booking.syncState !== 'synced')
      .map((booking) => booking.id);
  }

  function recoverQueueFromSnapshot({ date, bookings, queue }) {
    const nextQueue = Array.isArray(queue) ? [...queue] : [];
    const existingIds = new Set(nextQueue.map((entry) => entry.bookingId));

    (bookings || []).forEach((booking) => {
      if (!booking || booking.date !== date || !booking.id) return;
      if (!booking.syncState || booking.syncState === 'synced') return;
      if (existingIds.has(booking.id)) return;

      nextQueue.push({
        opId: `${booking.id}:recovered`,
        type: 'upsert',
        bookingId: booking.id,
        date,
        payload: booking,
        status: booking.syncState === 'syncing' ? 'syncing' : 'pending',
        retryCount: 0,
        updatedAt: new Date().toISOString()
      });
      existingIds.add(booking.id);
    });

    return nextQueue;
  }

  function removeQueueOperation(queue, opId) {
    return (queue || []).filter((entry) => entry?.opId !== opId);
  }

  function updateQueueOperation(queue, opId, operationPatch) {
    return (queue || []).map((entry) => {
      if (entry?.opId !== opId) return entry;
      return {
        ...entry,
        ...operationPatch
      };
    });
  }

  function hasQueueOperation(queue, opId) {
    return (queue || []).some((entry) => entry?.opId === opId);
  }

  function normalizeQueueOperation(entry, index = 0) {
    const bookingId = entry?.bookingId || entry?.payload?.id || entry?.payload?.booking_id || 'unknown';
    const operationType = entry?.type || 'upsert';
    const updatedAt = entry?.updatedAt || new Date().toISOString();

    return {
      ...entry,
      opId: entry?.opId || `${bookingId}:${operationType}:legacy:${index}:${updatedAt}`,
      type: operationType,
      bookingId,
      date: entry?.date || entry?.payload?.date || entry?.payload?.booking_date || '',
      status: entry?.status === 'syncing' ? 'pending' : entry?.status || 'pending',
      retryCount: Number(entry?.retryCount) || 0,
      updatedAt
    };
  }

  function normalizeQueueOperations(queue) {
    return (queue || []).map(normalizeQueueOperation);
  }

  function toDatabaseBookingPayload(booking) {
    if (!booking) return {};

    return {
      id: booking.id,
      booking_date: booking.booking_date || booking.date,
      table_index: booking.table_index ?? booking.tableIndex,
      time_index: booking.time_index ?? booking.timeIndex,
      start_minutes: booking.start_minutes ?? booking.startMinutes,
      duration_slots: booking.duration_slots ?? booking.durationSlots,
      guest_name: booking.guest_name ?? booking.name ?? '',
      guest_phone: booking.guest_phone ?? booking.phone ?? '',
      guest_comment: booking.guest_comment ?? booking.comment ?? '',
      guests: booking.guests ?? 1,
      color_theme: booking.color_theme ?? booking.colorTheme ?? 'yellow',
      arrival_status: booking.arrival_status ?? booking.arrivalStatus ?? 'pending',
      arrival_marked_at: booking.arrival_marked_at ?? booking.arrivalMarkedAt ?? null
    };
  }

  function getBookingEventType(entry) {
    if (entry?.type === 'delete') return 'booking_deleted';
    if (entry?.type === 'restore') return 'booking_restored';
    if (entry?.type === 'arrival') return 'arrival_toggled';
    if (entry?.type === 'create') return 'booking_created';
    return 'booking_updated';
  }

  function createBookingEventPayload({
    entry,
    deviceId,
    deviceRole,
    clientSequence,
    clientCreatedAt
  }) {
    const eventType = getBookingEventType(entry);
    const bookingPayload = toDatabaseBookingPayload(entry?.payload || {});

    if (!bookingPayload.id && entry?.bookingId) {
      bookingPayload.id = entry.bookingId;
    }

    if (!bookingPayload.booking_date && entry?.date) {
      bookingPayload.booking_date = entry.date;
    }

    if (eventType === 'booking_deleted') {
      bookingPayload.deleted_at = clientCreatedAt;
    }

    return {
      event_id: entry.eventId,
      booking_id: entry.bookingId || bookingPayload.id,
      booking_date: entry.date || bookingPayload.booking_date,
      event_type: eventType,
      payload: bookingPayload,
      device_id: deviceId,
      device_role: deviceRole,
      client_sequence: clientSequence,
      client_created_at: clientCreatedAt
    };
  }

  return {
    getBlockingBookingIds,
    getUnsyncedBookingIds,
    createBookingEventPayload,
    recoverQueueFromSnapshot,
    normalizeQueueOperations,
    removeQueueOperation,
    updateQueueOperation,
    hasQueueOperation
  };
});
