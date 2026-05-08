(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.bookingVisualState = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function getBookingVisualState({ booking, nowTimelineMinutes, graceMinutes = 10 }) {
    if (!booking || booking.arrivalStatus === 'active') {
      return 'active';
    }

    if (!Number.isFinite(nowTimelineMinutes)) {
      return 'neutral';
    }

    if (nowTimelineMinutes >= booking.startMinutes + graceMinutes) {
      return 'overdue';
    }

    if (booking.startMinutes > nowTimelineMinutes) {
      return 'upcoming';
    }

    return 'pending';
  }

  return {
    getBookingVisualState
  };
});
