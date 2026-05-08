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

  return {
    getBlockingBookingIds
  };
});
