(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.bookingExtension = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function getExtendedDurationSlots({
    booking,
    targetTableIndex,
    targetTimeIndex,
    totalInteractiveSlots,
    bookings
  }) {
    if (!booking || targetTableIndex !== booking.tableIndex) return null;
    if (targetTimeIndex < booking.timeIndex + booking.durationSlots) return null;
    if (targetTimeIndex >= totalInteractiveSlots) return null;

    const nextDurationSlots = targetTimeIndex - booking.timeIndex + 1;

    const hasConflict = (bookings || []).some((entry) => {
      if (!entry || entry.id === booking.id || entry.tableIndex !== booking.tableIndex) {
        return false;
      }

      const bookingStart = booking.timeIndex;
      const bookingEnd = bookingStart + nextDurationSlots;
      const entryStart = entry.timeIndex;
      const entryEnd = entry.timeIndex + entry.durationSlots;
      return bookingStart < entryEnd && bookingEnd > entryStart;
    });

    return hasConflict ? null : nextDurationSlots;
  }

  return {
    getExtendedDurationSlots
  };
});
