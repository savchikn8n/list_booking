create table if not exists public.booking_sheet_events (
  event_id uuid primary key,
  booking_id uuid,
  booking_date date,
  event_type text not null check (
    event_type in (
      'booking_created',
      'booking_updated',
      'booking_deleted',
      'booking_restored',
      'arrival_toggled',
      'waitlist_created',
      'waitlist_updated',
      'waitlist_deleted'
    )
  ),
  payload jsonb not null default '{}'::jsonb,
  device_id text not null default '',
  device_role text not null default 'unknown',
  client_sequence bigint,
  client_created_at timestamptz,
  server_created_at timestamptz not null default now(),
  applied_at timestamptz,
  apply_status text not null default 'applied' check (
    apply_status in ('applied', 'duplicate', 'superseded', 'logged')
  )
);

create index if not exists booking_sheet_events_booking_date_idx
  on public.booking_sheet_events (booking_date, server_created_at);

create index if not exists booking_sheet_events_booking_id_idx
  on public.booking_sheet_events (booking_id, server_created_at);

create index if not exists booking_sheet_events_device_sequence_idx
  on public.booking_sheet_events (device_id, client_sequence)
  where client_sequence is not null;

alter table public.booking_sheet_bookings
  add column if not exists deleted_at timestamptz;

alter table public.booking_sheet_bookings
  add column if not exists deleted_by_device_id text;

alter table public.booking_sheet_bookings
  add column if not exists deleted_by_event_id uuid;

alter table public.booking_sheet_bookings
  add column if not exists source_device_id text;

alter table public.booking_sheet_bookings
  add column if not exists source_device_role text;

alter table public.booking_sheet_bookings
  add column if not exists last_event_id uuid;

alter table public.booking_sheet_bookings
  add column if not exists last_event_device_id text;

alter table public.booking_sheet_bookings
  add column if not exists last_event_client_sequence bigint;

alter table public.booking_sheet_bookings
  add column if not exists client_updated_at timestamptz;

create index if not exists booking_sheet_bookings_active_date_idx
  on public.booking_sheet_bookings (booking_date, table_index, time_index)
  where deleted_at is null;

alter table public.booking_sheet_bookings
  drop constraint if exists booking_sheet_bookings_no_overlap;

alter table public.booking_sheet_bookings
  add constraint booking_sheet_bookings_no_overlap
  exclude using gist (
    booking_date with =,
    table_index with =,
    int4range(time_index, time_index + duration_slots, '[)') with &&
  )
  where (deleted_at is null);

create table if not exists public.booking_sheet_device_state (
  device_id text primary key,
  device_role text not null default 'unknown',
  selected_date date,
  last_seen_at timestamptz not null default now(),
  local_pending_count integer not null default 0 check (local_pending_count >= 0),
  oldest_pending_at timestamptz,
  last_successful_sync_at timestamptz,
  app_version text not null default '',
  updated_at timestamptz not null default now()
);

create or replace function public.booking_sheet_apply_event(event_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_booking_id uuid;
  v_booking_date date;
  v_event_type text;
  v_payload jsonb;
  v_device_id text;
  v_device_role text;
  v_client_sequence bigint;
  v_client_created_at timestamptz;
  v_inserted_count integer := 0;
  v_is_superseded boolean := false;
begin
  v_event_id := (event_payload->>'event_id')::uuid;
  v_payload := coalesce(event_payload->'payload', '{}'::jsonb);
  v_booking_id := coalesce((event_payload->>'booking_id')::uuid, (v_payload->>'id')::uuid);
  v_booking_date := coalesce(
    (event_payload->>'booking_date')::date,
    (v_payload->>'booking_date')::date
  );
  v_event_type := event_payload->>'event_type';
  v_device_id := coalesce(nullif(event_payload->>'device_id', ''), 'unknown');
  v_device_role := coalesce(nullif(event_payload->>'device_role', ''), 'unknown');
  v_client_sequence := nullif(event_payload->>'client_sequence', '')::bigint;
  v_client_created_at := nullif(event_payload->>'client_created_at', '')::timestamptz;

  if v_event_id is null then
    raise exception 'booking_sheet_apply_event requires event_id';
  end if;

  if v_event_type is null then
    raise exception 'booking_sheet_apply_event requires event_type';
  end if;

  insert into public.booking_sheet_events (
    event_id,
    booking_id,
    booking_date,
    event_type,
    payload,
    device_id,
    device_role,
    client_sequence,
    client_created_at,
    applied_at
  )
  values (
    v_event_id,
    v_booking_id,
    v_booking_date,
    v_event_type,
    v_payload,
    v_device_id,
    v_device_role,
    v_client_sequence,
    v_client_created_at,
    now()
  )
  on conflict (event_id) do nothing;

  get diagnostics v_inserted_count = row_count;

  if v_inserted_count = 0 then
    update public.booking_sheet_events
    set apply_status = 'duplicate'
    where event_id = v_event_id;

    return jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'event_id', v_event_id
    );
  end if;

  if v_booking_id is null and v_event_type like 'booking_%' then
    raise exception 'booking event requires booking_id';
  end if;

  if v_client_sequence is not null then
    select exists (
      select 1
      from public.booking_sheet_events newer_event
      where newer_event.booking_id = v_booking_id
        and newer_event.device_id = v_device_id
        and newer_event.client_sequence is not null
        and newer_event.client_sequence > v_client_sequence
    )
    into v_is_superseded;
  end if;

  if v_is_superseded then
    update public.booking_sheet_events
    set apply_status = 'superseded'
    where event_id = v_event_id;

    return jsonb_build_object(
      'ok', true,
      'superseded', true,
      'event_id', v_event_id
    );
  end if;

  if v_event_type in ('booking_created', 'booking_updated', 'booking_restored', 'arrival_toggled') then
    insert into public.booking_sheet_bookings (
      id,
      booking_date,
      table_index,
      time_index,
      start_minutes,
      duration_slots,
      guest_name,
      guest_phone,
      guest_comment,
      guests,
      color_theme,
      arrival_status,
      arrival_marked_at,
      deleted_at,
      deleted_by_device_id,
      deleted_by_event_id,
      source_device_id,
      source_device_role,
      last_event_id,
      last_event_device_id,
      last_event_client_sequence,
      client_updated_at
    )
    values (
      v_booking_id,
      v_booking_date,
      (v_payload->>'table_index')::smallint,
      (v_payload->>'time_index')::smallint,
      (v_payload->>'start_minutes')::smallint,
      (v_payload->>'duration_slots')::smallint,
      coalesce(v_payload->>'guest_name', ''),
      coalesce(v_payload->>'guest_phone', ''),
      coalesce(v_payload->>'guest_comment', ''),
      coalesce((v_payload->>'guests')::smallint, 1),
      coalesce(v_payload->>'color_theme', 'yellow'),
      coalesce(v_payload->>'arrival_status', 'pending'),
      nullif(v_payload->>'arrival_marked_at', '')::timestamptz,
      case when v_event_type = 'booking_restored' then null else nullif(v_payload->>'deleted_at', '')::timestamptz end,
      nullif(v_payload->>'deleted_by_device_id', ''),
      nullif(v_payload->>'deleted_by_event_id', '')::uuid,
      v_device_id,
      v_device_role,
      v_event_id,
      v_device_id,
      v_client_sequence,
      v_client_created_at
    )
    on conflict (id) do update
    set
      booking_date = excluded.booking_date,
      table_index = excluded.table_index,
      time_index = excluded.time_index,
      start_minutes = excluded.start_minutes,
      duration_slots = excluded.duration_slots,
      guest_name = excluded.guest_name,
      guest_phone = excluded.guest_phone,
      guest_comment = excluded.guest_comment,
      guests = excluded.guests,
      color_theme = excluded.color_theme,
      arrival_status = excluded.arrival_status,
      arrival_marked_at = excluded.arrival_marked_at,
      deleted_at = case when v_event_type = 'booking_restored' then null else excluded.deleted_at end,
      deleted_by_device_id = case when v_event_type = 'booking_restored' then null else excluded.deleted_by_device_id end,
      deleted_by_event_id = case when v_event_type = 'booking_restored' then null else excluded.deleted_by_event_id end,
      source_device_id = coalesce(public.booking_sheet_bookings.source_device_id, excluded.source_device_id),
      source_device_role = coalesce(public.booking_sheet_bookings.source_device_role, excluded.source_device_role),
      last_event_id = excluded.last_event_id,
      last_event_device_id = excluded.last_event_device_id,
      last_event_client_sequence = excluded.last_event_client_sequence,
      client_updated_at = excluded.client_updated_at
    where public.booking_sheet_bookings.last_event_client_sequence is null
       or excluded.last_event_client_sequence is null
       or excluded.last_event_device_id is distinct from public.booking_sheet_bookings.last_event_device_id
       or excluded.last_event_client_sequence >= public.booking_sheet_bookings.last_event_client_sequence;

    return jsonb_build_object(
      'ok', true,
      'event_id', v_event_id,
      'booking_id', v_booking_id,
      'event_type', v_event_type
    );
  end if;

  if v_event_type = 'booking_deleted' then
    update public.booking_sheet_bookings
    set
      deleted_at = coalesce(nullif(v_payload->>'deleted_at', '')::timestamptz, now()),
      deleted_by_device_id = v_device_id,
      deleted_by_event_id = v_event_id,
      last_event_id = v_event_id,
      last_event_device_id = v_device_id,
      last_event_client_sequence = v_client_sequence,
      client_updated_at = v_client_created_at
    where id = v_booking_id
      and (
        last_event_client_sequence is null
        or v_client_sequence is null
        or last_event_device_id is distinct from v_device_id
        or v_client_sequence >= last_event_client_sequence
      );

    return jsonb_build_object(
      'ok', true,
      'event_id', v_event_id,
      'booking_id', v_booking_id,
      'event_type', v_event_type
    );
  end if;

  update public.booking_sheet_events
  set apply_status = 'logged'
  where event_id = v_event_id;

  return jsonb_build_object(
    'ok', true,
    'logged', true,
    'event_id', v_event_id,
    'event_type', v_event_type
  );
end;
$$;

alter table public.booking_sheet_events replica identity full;
alter table public.booking_sheet_events enable row level security;
alter table public.booking_sheet_device_state replica identity full;
alter table public.booking_sheet_device_state enable row level security;

drop policy if exists "booking events public select"
  on public.booking_sheet_events;
drop policy if exists "booking events public insert"
  on public.booking_sheet_events;
drop policy if exists "booking device state public select"
  on public.booking_sheet_device_state;
drop policy if exists "booking device state public insert"
  on public.booking_sheet_device_state;
drop policy if exists "booking device state public update"
  on public.booking_sheet_device_state;

create policy "booking events public select"
  on public.booking_sheet_events
  for select
  to anon
  using (true);

create policy "booking events public insert"
  on public.booking_sheet_events
  for insert
  to anon
  with check (true);

create policy "booking device state public select"
  on public.booking_sheet_device_state
  for select
  to anon
  using (true);

create policy "booking device state public insert"
  on public.booking_sheet_device_state
  for insert
  to anon
  with check (true);

create policy "booking device state public update"
  on public.booking_sheet_device_state
  for update
  to anon
  using (true)
  with check (true);

grant select, insert on public.booking_sheet_events to anon;
grant select, insert, update on public.booking_sheet_device_state to anon;
grant execute on function public.booking_sheet_apply_event(jsonb) to anon;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'booking_sheet_events'
  ) then
    alter publication supabase_realtime
      add table public.booking_sheet_events;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'booking_sheet_device_state'
  ) then
    alter publication supabase_realtime
      add table public.booking_sheet_device_state;
  end if;
end $$;
