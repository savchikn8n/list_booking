(function (root, factory) {
  const api = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  root.bookingSyncIndicator = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function getIndicatorState({ hasConnectionError, hasQueueIssues, isBusy }) {
    if (hasConnectionError) return 'error';
    if (hasQueueIssues || isBusy) return 'waiting';
    return 'live';
  }

  return {
    getIndicatorState
  };
});
