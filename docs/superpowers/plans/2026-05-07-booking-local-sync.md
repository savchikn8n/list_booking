# Booking Local Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make booking save/update/delete resilient to reloads and weak connectivity by using local snapshot restoration plus a retryable sync queue for `booking_sheet_bookings`.

**Architecture:** Keep Supabase as the shared source of truth, but make the browser maintain a per-date snapshot and a pending operations queue in `localStorage`. The UI becomes optimistic: write locally first, render immediately, then sync in the background and reconcile with the server without wiping pending changes.

**Tech Stack:** Vanilla JS, Supabase JS client, browser `localStorage`, existing single-page HTML/CSS app

---

## File Map

- Modify: `/Users/apolo/Documents/list_booking/app.js`
  - Add snapshot persistence helpers
  - Add sync queue helpers
  - Add startup restore + reconcile flow
  - Add optimistic booking CRUD behavior
  - Add pending/failed sync status handling
- Modify: `/Users/apolo/Documents/list_booking/index.html`
  - Add sync status text container for pending/failure messaging if needed
- Modify: `/Users/apolo/Documents/list_booking/styles.css`
  - Add visual state for pending/failed bookings and sync banner

### Task 1: Add local snapshot storage primitives

**Files:**
- Modify: `/Users/apolo/Documents/list_booking/app.js`

- [ ] **Step 1: Add storage key constants**

Insert near the current Supabase/table constants:

```js
const SNAPSHOT_STORAGE_PREFIX = 'booking_snapshot:';
const OPS_QUEUE_STORAGE_KEY = 'booking_ops_queue';
const SYNC_META_STORAGE_KEY = 'booking_sync_meta';
```

- [ ] **Step 2: Add JSON-safe localStorage helpers**

Add small wrappers near the cache helpers:

```js
function readJsonStorage(key, fallbackValue) {
  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch (error) {
    console.error('Storage read error:', key, error);
    return fallbackValue;
  }
}

function writeJsonStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Storage write error:', key, error);
    return false;
  }
}

function getSnapshotStorageKey(date) {
  return `${SNAPSHOT_STORAGE_PREFIX}${date}`;
}
```

- [ ] **Step 3: Add booking snapshot serialization helpers**

Add helpers that convert the in-memory `Map` to stable storage payload:

```js
function getStoredSnapshot(date) {
  return readJsonStorage(getSnapshotStorageKey(date), null);
}

function storeSnapshot(date) {
  const bookings = Array.from(getBookingsForDate(date).values());
  return writeJsonStorage(getSnapshotStorageKey(date), {
    date,
    bookings,
    lastFetchedAt: new Date().toISOString(),
    lastMutationAt: new Date().toISOString()
  });
}

function restoreSnapshot(date) {
  const snapshot = getStoredSnapshot(date);
  if (!snapshot || !Array.isArray(snapshot.bookings)) return false;

  const restoredBookings = new Map();
  snapshot.bookings.forEach((booking) => {
    if (booking && booking.id) {
      restoredBookings.set(booking.id, booking);
    }
  });

  bookingsByDate.set(date, restoredBookings);
  return true;
}
```

- [ ] **Step 4: Run syntax check**

Run: `node --check app.js`
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add /Users/apolo/Documents/list_booking/app.js
git commit -m "Add booking snapshot storage helpers"
```

### Task 2: Add operations queue and sync state model

**Files:**
- Modify: `/Users/apolo/Documents/list_booking/app.js`
- Modify: `/Users/apolo/Documents/list_booking/styles.css`

- [ ] **Step 1: Add queue read/write helpers**

Add queue utilities after snapshot helpers:

```js
function getOpsQueue() {
  return readJsonStorage(OPS_QUEUE_STORAGE_KEY, []);
}

function setOpsQueue(queue) {
  return writeJsonStorage(OPS_QUEUE_STORAGE_KEY, queue);
}

function enqueueBookingOperation(type, booking) {
  const queue = getOpsQueue().filter((entry) => entry.bookingId !== booking.id);
  queue.push({
    opId: `${booking.id}:${type}:${Date.now()}`,
    type,
    bookingId: booking.id,
    date: booking.date,
    payload: booking,
    status: 'pending',
    retryCount: 0,
    updatedAt: new Date().toISOString()
  });
  setOpsQueue(queue);
}
```

- [ ] **Step 2: Add local sync state to bookings**

When building/updating booking payloads, attach UI-only sync status:

```js
function withSyncState(booking, syncState) {
  return {
    ...booking,
    syncState
  };
}
```

Update local create/update/delete paths to use `withSyncState(booking, 'pending')` before painting.

- [ ] **Step 3: Add pending/failed visual styles**

Append to `styles.css`:

```css
.slot-cell.booked.is-pending::after,
.slot-cell.booked.is-failed::after {
  content: '';
  position: absolute;
  top: 4px;
  right: 4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  z-index: 2;
}

.slot-cell.booked.is-pending::after {
  background: #f0a61f;
}

.slot-cell.booked.is-failed::after {
  background: #dc2f2f;
}
```

- [ ] **Step 4: Make `paintBookings()` apply sync classes**

Inside `paintBookings()` add:

```js
if (booking.syncState === 'pending') {
  cell.classList.add('is-pending');
}

if (booking.syncState === 'failed') {
  cell.classList.add('is-failed');
}
```

Also extend the reset line:

```js
cell.classList.remove('booked', 'booked-top', 'booked-bottom', 'dragging', 'is-pending', 'is-failed');
```

- [ ] **Step 5: Run syntax and diff checks**

Run: `node --check app.js`
Expected: no output

Run: `git diff --check`
Expected: no output

- [ ] **Step 6: Commit**

```bash
git add /Users/apolo/Documents/list_booking/app.js /Users/apolo/Documents/list_booking/styles.css
git commit -m "Add booking sync queue and pending states"
```

### Task 3: Convert booking writes to local-first optimistic flow

**Files:**
- Modify: `/Users/apolo/Documents/list_booking/app.js`

- [ ] **Step 1: Split remote save/delete into pure server operations**

Refactor current persistence methods so they do not repaint on their own:

```js
async function upsertBookingOnServer(booking) {
  if (!bookingDatabase) {
    return { ok: false, error: new Error('Supabase unavailable') };
  }

  const { error } = await bookingDatabase
    .from(BOOKINGS_TABLE)
    .upsert(serializeBookingForDatabase(booking), { onConflict: 'id' });

  return { ok: !error, error };
}

async function deleteBookingOnServer(bookingId) {
  if (!bookingDatabase) {
    return { ok: false, error: new Error('Supabase unavailable') };
  }

  const { error } = await bookingDatabase.from(BOOKINGS_TABLE).delete().eq('id', bookingId);
  return { ok: !error, error };
}
```

- [ ] **Step 2: Add optimistic apply helpers**

Add helpers:

```js
function applyLocalBookingUpsert(booking, syncState) {
  const localBooking = withSyncState(booking, syncState);
  removeBookingFromCache(localBooking.id);
  cacheBooking(localBooking);
  storeSnapshot(localBooking.date);
  paintBookings();
}

function applyLocalBookingDelete(booking) {
  removeBookingFromCache(booking.id, booking.date);
  storeSnapshot(booking.date);
  paintBookings();
}
```

- [ ] **Step 3: Rework create/update/delete callers**

For create/update:

```js
applyLocalBookingUpsert(booking, 'pending');
enqueueBookingOperation('upsert', booking);
void flushBookingOpsQueue();
```

For delete:

```js
applyLocalBookingDelete(booking);
enqueueBookingOperation('delete', booking);
void flushBookingOpsQueue();
```

Remove direct success dependence on immediate Supabase response from the form handlers.

- [ ] **Step 4: Add queue flusher**

Add:

```js
async function flushBookingOpsQueue() {
  const queue = getOpsQueue();
  if (!queue.length) return;

  const nextQueue = [];

  for (const entry of queue) {
    if (entry.type === 'delete') {
      const result = await deleteBookingOnServer(entry.bookingId);
      if (!result.ok) {
        nextQueue.push({
          ...entry,
          status: 'failed',
          retryCount: entry.retryCount + 1,
          updatedAt: new Date().toISOString()
        });
      }
      continue;
    }

    const result = await upsertBookingOnServer(entry.payload);
    if (!result.ok) {
      applyLocalBookingUpsert(entry.payload, 'failed');
      nextQueue.push({
        ...entry,
        status: 'failed',
        retryCount: entry.retryCount + 1,
        updatedAt: new Date().toISOString()
      });
      continue;
    }

    applyLocalBookingUpsert(entry.payload, 'synced');
  }

  setOpsQueue(nextQueue);
}
```

- [ ] **Step 5: Run syntax check**

Run: `node --check app.js`
Expected: no output

- [ ] **Step 6: Commit**

```bash
git add /Users/apolo/Documents/list_booking/app.js
git commit -m "Switch bookings to local-first sync flow"
```

### Task 4: Restore snapshot first and reconcile server data safely

**Files:**
- Modify: `/Users/apolo/Documents/list_booking/app.js`

- [ ] **Step 1: Restore local snapshot before remote fetch**

At startup and on date change, restore local state first:

```js
function hydrateSelectedDateFromStorage() {
  const restored = restoreSnapshot(selectedDate);
  if (restored) {
    paintBookings();
  }
}
```

Call it before remote load in startup and date switching flows.

- [ ] **Step 2: Add reconcile logic**

Replace destructive `bookingsByDate.clear()` behavior with per-date reconcile:

```js
function reconcileBookingsForDate(date, serverBookings) {
  const localBookings = getBookingsForDate(date);
  const queue = getOpsQueue().filter((entry) => entry.date === date);
  const pendingIds = new Set(queue.map((entry) => entry.bookingId));
  const reconciled = new Map();

  serverBookings.forEach((booking) => {
    if (!pendingIds.has(booking.id)) {
      reconciled.set(booking.id, withSyncState(booking, 'synced'));
    }
  });

  localBookings.forEach((booking, bookingId) => {
    if (pendingIds.has(bookingId)) {
      reconciled.set(bookingId, booking);
    }
  });

  bookingsByDate.set(date, reconciled);
  storeSnapshot(date);
}
```

- [ ] **Step 3: Load only the selected date instead of nuking all dates**

Adjust remote fetch to:

```js
const { data, error } = await bookingDatabase
  .from(BOOKINGS_TABLE)
  .select('id, booking_date, table_index, time_index, start_minutes, duration_slots, guest_name, guest_phone, guest_comment, guests, color_theme')
  .eq('booking_date', selectedDate)
  .order('table_index', { ascending: true })
  .order('time_index', { ascending: true });
```

Then normalize and pass into `reconcileBookingsForDate(selectedDate, normalizedBookings)`.

- [ ] **Step 4: Retry queue on startup and network recovery**

Add:

```js
window.addEventListener('online', () => {
  void flushBookingOpsQueue();
});
```

Also call `void flushBookingOpsQueue();` from bootstrap after snapshot hydration.

- [ ] **Step 5: Verify behavior manually**

Run: `node --check app.js`
Expected: no output

Manual check:
- create booking, reload immediately, booking still visible
- disable network, create booking, booking stays visible as pending/failed
- restore network, booking eventually becomes synced

- [ ] **Step 6: Commit**

```bash
git add /Users/apolo/Documents/list_booking/app.js
git commit -m "Restore local booking snapshots before server sync"
```

### Task 5: Add global sync indicator text for pending failures

**Files:**
- Modify: `/Users/apolo/Documents/list_booking/app.js`
- Modify: `/Users/apolo/Documents/list_booking/index.html`
- Modify: `/Users/apolo/Documents/list_booking/styles.css`

- [ ] **Step 1: Add sync text element**

In `index.html`, directly after the LED indicator add:

```html
<div id="sync-banner" class="sync-banner hidden" aria-live="polite"></div>
```

- [ ] **Step 2: Add banner styling**

Append to `styles.css`:

```css
.sync-banner {
  position: absolute;
  top: 22px;
  right: 0;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(34, 29, 24, 0.88);
  color: #fff;
  font-size: 0.78rem;
  line-height: 1.2;
}
```

- [ ] **Step 3: Add queue status renderer**

In `app.js`:

```js
const syncBanner = document.getElementById('sync-banner');

function updateSyncBanner() {
  const queue = getOpsQueue();
  if (!queue.length) {
    syncBanner.classList.add('hidden');
    syncBanner.textContent = '';
    return;
  }

  const failedCount = queue.filter((entry) => entry.status === 'failed').length;
  syncBanner.classList.remove('hidden');
  syncBanner.textContent = failedCount
    ? `Не синхронизировано: ${failedCount}`
    : `Синхронизация: ${queue.length}`;
}
```

Call `updateSyncBanner()` after queue mutations and after `flushBookingOpsQueue()`.

- [ ] **Step 4: Run final verification**

Run: `node --check app.js`
Expected: no output

Run: `git diff --check`
Expected: no output

- [ ] **Step 5: Commit**

```bash
git add /Users/apolo/Documents/list_booking/app.js /Users/apolo/Documents/list_booking/index.html /Users/apolo/Documents/list_booking/styles.css
git commit -m "Add booking sync status indicator"
```

## Self-Review

- Spec coverage:
  - optimistic local-first behavior: Task 3
  - local snapshot restore on reload: Task 1 + Task 4
  - queue with retry states: Task 2 + Task 3 + Task 4
  - reconcile that preserves pending items: Task 4
  - UI indicator for unsynced state: Task 5
  - waitlist excluded from scope: no tasks modify waitlist behavior
- Placeholder scan:
  - no TODO/TBD markers
  - each code-changing step includes concrete code
- Type consistency:
  - queue entry uses `type`, `bookingId`, `date`, `payload`, `status`, `retryCount`, `updatedAt`
  - sync state uses only `synced | pending | failed`
