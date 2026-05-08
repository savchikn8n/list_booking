# Booking Arrival State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add synchronized booking arrival states with gray pending cards, active checkbox confirmation, and red overdue cards.

**Architecture:** Store only `pending/active` in Supabase and local snapshots. Compute visual overdue state on the client from current business time. Keep the implementation inside the existing `app.js` local-first sync flow, and extract pure arrival-state calculation into a small helper that can be tested with Node.

**Tech Stack:** Vanilla JS, Supabase, localStorage, Node `assert`

---

### Task 1: Add testable arrival-state helper

**Files:**
- Create: `booking-visual-state.js`
- Create: `tests/booking-visual-state.test.js`

- [ ] Write failing node tests for active, upcoming, overdue, and neutral states.
- [ ] Run `node tests/booking-visual-state.test.js` and verify failure.
- [ ] Implement minimal helper and rerun until green.

### Task 2: Persist arrival state in Supabase and local sync

**Files:**
- Modify: `supabase-schema.sql`
- Modify: `app.js`

- [ ] Add DB columns and constraints for `arrival_status` and `arrival_marked_at`.
- [ ] Load/save these fields through normalize/serialize/local snapshot/realtime paths.

### Task 3: Render arrival UI and styles

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`

- [ ] Add helper script include.
- [ ] Render checkbox toggle, overdue badge, and state-based board colors.
- [ ] Repaint board on timer so pending bookings can become overdue without reload.

### Task 4: Verify and commit

**Files:**
- Modify: `app.js`
- Modify: `styles.css`
- Modify: `index.html`
- Modify: `supabase-schema.sql`
- Create: `booking-visual-state.js`
- Create: `tests/booking-visual-state.test.js`

- [ ] Run `node tests/booking-visual-state.test.js`.
- [ ] Run `node --check app.js booking-visual-state.js tests/booking-visual-state.test.js`.
- [ ] Run `git diff --check`.
- [ ] Commit the update.
