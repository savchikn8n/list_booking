const assert = require('assert');
const { getPrimaryArrivalToggleOffset } = require('../booking-card-layout.js');

assert.strictEqual(getPrimaryArrivalToggleOffset(4), 1);
assert.strictEqual(getPrimaryArrivalToggleOffset(2), 1);
assert.strictEqual(getPrimaryArrivalToggleOffset(1), 0);
assert.strictEqual(getPrimaryArrivalToggleOffset(0), 0);

console.log('booking card layout tests passed');
