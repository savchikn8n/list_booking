create extension if not exists btree_gist;

create table if not exists public.booking_sheet_bookings (
  id uuid primary key,
  booking_date date not null,
  table_index smallint not null check (table_index between 0 and 14),
  time_index smallint not null check (time_index between 0 and 24),
  start_minutes smallint not null check (start_minutes between 720 and 1440),
  duration_slots smallint not null check (duration_slots >= 1),
  guest_name text not null check (char_length(trim(guest_name)) between 1 and 60),
  guest_phone text not null check (char_length(trim(guest_phone)) between 1 and 20),
  guest_comment text not null default '' check (char_length(guest_comment) <= 240),
  guests smallint not null check (guests >= 1),
  color_theme text not null default 'yellow' check (
    color_theme in ('yellow', 'blue', 'purple', 'green')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_sheet_bookings_date_idx
  on public.booking_sheet_bookings (booking_date);

create index if not exists booking_sheet_bookings_date_table_idx
  on public.booking_sheet_bookings (booking_date, table_index, time_index);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_sheet_bookings_no_overlap'
  ) then
    alter table public.booking_sheet_bookings
      add constraint booking_sheet_bookings_no_overlap
      exclude using gist (
        booking_date with =,
        table_index with =,
        int4range(time_index, time_index + duration_slots, '[)') with &&
      );
  end if;
end $$;

create or replace function public.booking_sheet_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists booking_sheet_bookings_touch_updated_at
  on public.booking_sheet_bookings;

create trigger booking_sheet_bookings_touch_updated_at
before update on public.booking_sheet_bookings
for each row
execute function public.booking_sheet_touch_updated_at();

alter table public.booking_sheet_bookings replica identity full;
alter table public.booking_sheet_bookings enable row level security;

drop policy if exists "booking sheet public select"
  on public.booking_sheet_bookings;
drop policy if exists "booking sheet public insert"
  on public.booking_sheet_bookings;
drop policy if exists "booking sheet public update"
  on public.booking_sheet_bookings;
drop policy if exists "booking sheet public delete"
  on public.booking_sheet_bookings;

create policy "booking sheet public select"
  on public.booking_sheet_bookings
  for select
  to anon
  using (true);

create policy "booking sheet public insert"
  on public.booking_sheet_bookings
  for insert
  to anon
  with check (true);

create policy "booking sheet public update"
  on public.booking_sheet_bookings
  for update
  to anon
  using (true)
  with check (true);

create policy "booking sheet public delete"
  on public.booking_sheet_bookings
  for delete
  to anon
  using (true);

grant select, insert, update, delete on public.booking_sheet_bookings to anon;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'booking_sheet_bookings'
  ) then
    alter publication supabase_realtime
      add table public.booking_sheet_bookings;
  end if;
end $$;
