const assert = require('assert');
const { getIndicatorState } = require('../booking-sync-indicator.js');

assert.strictEqual(
  getIndicatorState({ hasConnectionError: true, hasQueueIssues: false, isBusy: false }),
  'error'
);

assert.strictEqual(
  getIndicatorState({ hasConnectionError: false, hasQueueIssues: true, isBusy: false }),
  'waiting'
);

assert.strictEqual(
  getIndicatorState({ hasConnectionError: false, hasQueueIssues: false, isBusy: true }),
  'waiting'
);

assert.strictEqual(
  getIndicatorState({ hasConnectionError: false, hasQueueIssues: false, isBusy: false }),
  'live'
);

console.log('booking sync indicator tests passed');
