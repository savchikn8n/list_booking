# Booking Arrival State Design

**Goal:** Add synchronized arrival-state tracking for bookings with three visual modes on the board: pending arrival, active, and overdue.

**Scope:**
- Add arrival-state fields to bookings in Supabase.
- Keep arrival-state data inside the existing local-first snapshot/queue flow.
- Render pending bookings in muted gray before activation.
- Render overdue bookings in red with a small `!` badge when 10 minutes pass after start without activation.
- Add a checkbox-style toggle on booking cards to mark a guest as active.

**Data model:**
- `arrival_status text not null default 'pending'`
- `arrival_marked_at timestamptz null`

**Behavior:**
- `active`: booking uses its theme color.
- `pending`: booking stays muted until marked active.
- `overdue`: if current board time is at least 10 minutes past `start_minutes` and `arrival_status != 'active'`, booking turns red and shows `!`.
- Overdue is computed on the client from current Kaliningrad business time and is not persisted as a DB field.

**Sync model:**
- Arrival-state changes use the same local snapshot + pending ops queue as booking edits.
- Supabase remains the shared source of truth for `arrival_status` and `arrival_marked_at`.

**UI:**
- Checkbox-style toggle appears in the top-right corner of the first booking cell.
- Toggle click must not open the booking modal.

