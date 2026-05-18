# Booking Sync Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make booking sync durable and auditable without changing the normal operator UI.

**Architecture:** Add non-destructive Supabase foundations first: append-only events, soft-delete metadata, device state, and an idempotent apply-event RPC. Then switch the client queue from direct upsert/delete toward event-based writes while keeping IndexedDB and existing bookings intact.

**Tech Stack:** Static JavaScript app, Supabase/Postgres, IndexedDB, Node assertion tests, Supabase CLI migrations.

---

### Task 1: Add Non-Destructive Supabase Foundation

**Files:**
- Create: `supabase/migrations/20260518100000_booking_sync_hardening_foundation.sql`

- [ ] **Step 1: Create migration**

Create only additive objects:
- `booking_sheet_events`
- `booking_sheet_device_state`
- soft-delete/device columns on `booking_sheet_bookings`
- `booking_sheet_apply_event(jsonb)` RPC
- RLS policies needed for current static app compatibility

- [ ] **Step 2: Dry-run migration**

Run: `supabase db push --dry-run`

Expected: migration is listed; no destructive `drop table`, `delete from`, or table rebuild.

- [ ] **Step 3: Apply migration**

Run: `supabase db push`

Expected: migration applies successfully and existing `booking_sheet_bookings` rows remain present.

### Task 2: Add Client Event Helpers

**Files:**
- Modify: `booking-sync-state.js`
- Test: `tests/booking-sync-state.test.js`

- [ ] **Step 1: Add tests for event queue conversion**

Existing upsert/delete queue entries must be convertible to event payloads without losing booking IDs, dates, or payloads.

- [ ] **Step 2: Implement helpers**

Add pure helpers for event creation, idempotent queue matching, and legacy operation conversion.

- [ ] **Step 3: Run tests**

Run: `node tests/booking-sync-state.test.js`

Expected: all sync-state tests pass.

### Task 3: Route Booking Writes Through RPC

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Keep local-first behavior**

Create/update/delete still updates the local UI and IndexedDB immediately.

- [ ] **Step 2: Send event to Supabase RPC**

Flush queue entries through `booking_sheet_apply_event`, not direct table delete.

- [ ] **Step 3: Keep fallback guarded**

If RPC is unavailable, keep queue entries pending/failed instead of physically deleting local truth.

### Task 4: Make Deletes Soft

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Convert delete operation**

User delete removes booking from visible local board immediately, but server-side applies `booking_deleted` event and sets `deleted_at`.

- [ ] **Step 2: Filter deleted rows**

Regular Supabase loads select only rows where `deleted_at is null`, while event history remains available.

### Task 5: Hidden Device State

**Files:**
- Modify: `app.js`
- Modify: `booking-local-storage.js`

- [ ] **Step 1: Generate durable device id**

Store a stable device id in IndexedDB/local fallback.

- [ ] **Step 2: Write heartbeat**

Send `device_id`, role, pending counts and timestamps to `booking_sheet_device_state`.

- [ ] **Step 3: Keep operator UI quiet**

Do not show sync failure banners or alerts to normal users.

### Task 6: Verification

**Files:**
- Existing app and tests.

- [ ] **Step 1: Run JS syntax checks**

Run: `node --check app.js && node --check booking-local-storage.js && node --check booking-sync-state.js`

Expected: exit 0.

- [ ] **Step 2: Run all tests**

Run: `node tests/booking-card-layout.test.js && node tests/booking-extension.test.js && node tests/booking-sync-state.test.js && node tests/booking-sync-indicator.test.js && node tests/booking-visual-state.test.js && node tests/booking-local-storage.test.js`

Expected: all tests pass.

- [ ] **Step 3: Browser smoke test**

Open local app, verify board loads, Realtime subscribes, no console errors.
