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

  return {
    getBlockingBookingIds,
    getUnsyncedBookingIds,
    recoverQueueFromSnapshot
  };
});
