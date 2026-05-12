(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.bookingCardLayout = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function getPrimaryArrivalToggleOffset(durationSlots) {
    return Number(durationSlots) >= 2 ? 1 : 0;
  }

  return {
    getPrimaryArrivalToggleOffset
  };
});
