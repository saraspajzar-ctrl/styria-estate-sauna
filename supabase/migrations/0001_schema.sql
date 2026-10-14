-- Styria Estate Sauna Reservation System
-- 0001: Core schema

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists btree_gist; -- exclusion constraints on uuid + range

-- ---------------------------------------------------------------------------
-- apartments
-- ---------------------------------------------------------------------------
create table apartments (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null unique,
  accommodation_capacity  int not null check (accommodation_capacity > 0),
  active                  boolean not null default true,
  created_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- resources (the sauna today; modeled generically for future wellness resources)
-- ---------------------------------------------------------------------------
create table resources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  capacity    int not null check (capacity > 0),
  open_time   time not null,
  close_time  time not null check (close_time > open_time),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- stays — one row per Airbnb booking, created only by an admin
-- ---------------------------------------------------------------------------
create table stays (
  id                   uuid primary key default gen_random_uuid(),
  apartment_id         uuid not null references apartments(id),
  guest_surname        text not null check (char_length(btrim(guest_surname)) > 0),
  check_in             date not null,
  check_out            date not null,
  access_code_hash     text not null unique,
  access_code_revoked  boolean not null default false,
  status               text not null default 'active'
                         check (status in ('active', 'cancelled', 'completed')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint stays_checkout_after_checkin check (check_out > check_in)
);

create index stays_apartment_id_idx on stays (apartment_id);
create index stays_status_idx on stays (status);

-- ---------------------------------------------------------------------------
-- sauna_reservations
-- ---------------------------------------------------------------------------
create table sauna_reservations (
  id                 uuid primary key default gen_random_uuid(),
  stay_id            uuid not null references stays(id),
  resource_id        uuid not null references resources(id),
  apartment_id       uuid not null references apartments(id), -- denormalized for fast admin reporting
  reservation_date   date not null,
  start_time         time not null,
  end_time           time not null,
  starts_at          timestamptz not null, -- local wall-clock converted via Europe/Ljubljana, for range/overlap logic
  ends_at            timestamptz not null,
  duration_minutes   int not null check (duration_minutes in (30, 60, 90, 120)),
  number_of_guests   int not null check (number_of_guests between 1 and 4),
  status             text not null default 'active' check (status in ('active', 'cancelled')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint sauna_reservations_end_after_start check (end_time > start_time),
  constraint sauna_reservations_ends_after_starts check (ends_at > starts_at)
);

create index sauna_reservations_stay_date_idx
  on sauna_reservations (stay_id, reservation_date) where status = 'active';
create index sauna_reservations_resource_date_idx
  on sauna_reservations (resource_id, reservation_date) where status = 'active';
create index sauna_reservations_apartment_date_idx
  on sauna_reservations (apartment_id, reservation_date) where status = 'active';

-- The database itself refuses overlapping ACTIVE reservations on the same
-- resource — this holds even if application-level validation has a bug or
-- is bypassed, and even under concurrent transactions.
alter table sauna_reservations
  add constraint sauna_reservations_no_overlap
  exclude using gist (
    resource_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'active');

-- ---------------------------------------------------------------------------
-- admins — being a Supabase Auth user is not sufficient; must have a row here
-- ---------------------------------------------------------------------------
create table admins (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- admin_audit_log
-- ---------------------------------------------------------------------------
create table admin_audit_log (
  id                   uuid primary key default gen_random_uuid(),
  admin_user_id        uuid references auth.users(id),
  action               text not null,
  affected_entity_type text not null,
  affected_entity_id   uuid,
  metadata             jsonb,
  created_at           timestamptz not null default now()
);

create index admin_audit_log_entity_idx
  on admin_audit_log (affected_entity_type, affected_entity_id);

-- ---------------------------------------------------------------------------
-- access_code_attempts — rate limiting for the guest code-verification endpoint
-- ---------------------------------------------------------------------------
create table access_code_attempts (
  id          bigint generated always as identity primary key,
  ip_hash     text not null,
  success     boolean not null,
  created_at  timestamptz not null default now()
);

create index access_code_attempts_ip_time_idx on access_code_attempts (ip_hash, created_at);

-- updated_at maintenance -------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger stays_set_updated_at
  before update on stays
  for each row execute function set_updated_at();

create trigger sauna_reservations_set_updated_at
  before update on sauna_reservations
  for each row execute function set_updated_at();
