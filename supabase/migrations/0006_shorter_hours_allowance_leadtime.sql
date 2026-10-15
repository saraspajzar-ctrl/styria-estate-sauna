-- 0006: Shorten sauna hours, cut the daily allowance to 1 hour per stay, and
-- require guest bookings to be made at least 1 day in advance.
--
-- Admin-created reservations (p_is_admin = true) are exempt from the
-- lead-time requirement, so staff can still add a last-minute booking on a
-- guest's behalf (e.g. a phone request) without the self-service guard.

update resources
  set open_time = '16:00', close_time = '19:00'
  where name = 'Sauna';

-- Only 30/60 minute reservations can ever fit inside a 60-minute daily
-- allowance, so 90/120 are removed as valid durations, not just made
-- unreachable.
alter table sauna_reservations drop constraint sauna_reservations_duration_minutes_check;
alter table sauna_reservations add constraint sauna_reservations_duration_minutes_check
  check (duration_minutes in (30, 60));

create or replace function book_sauna_reservation(
  p_stay_id          uuid,
  p_resource_id      uuid,
  p_reservation_date date,
  p_start_time       time,
  p_duration_minutes int,
  p_is_admin         boolean default false,
  p_admin_user_id    uuid default null
) returns sauna_reservations
language plpgsql
as $$
declare
  v_stay      stays%rowtype;
  v_resource  resources%rowtype;
  v_end_time  time;
  v_starts_at timestamptz;
  v_ends_at   timestamptz;
  v_used      int;
  v_row       sauna_reservations%rowtype;
begin
  if p_duration_minutes not in (30, 60) then
    raise exception 'INVALID_DURATION: Duration must be 30 or 60 minutes.';
  end if;

  if extract(minute from p_start_time)::int % 30 <> 0 then
    raise exception 'INVALID_START_TIME: Start time must align to a 30-minute slot.';
  end if;

  if not p_is_admin and p_reservation_date < (now() at time zone 'Europe/Ljubljana')::date + 1 then
    raise exception 'LEAD_TIME_REQUIRED: Reservations must be made at least 1 day in advance.';
  end if;

  select * into v_stay from stays where id = p_stay_id for update;
  if not found then
    raise exception 'STAY_NOT_FOUND: Stay not found.';
  end if;
  if v_stay.status <> 'active' then
    raise exception 'STAY_INACTIVE: This stay is no longer active.';
  end if;

  if p_reservation_date < v_stay.check_in or p_reservation_date >= v_stay.check_out then
    raise exception 'OUTSIDE_STAY: You can only reserve the sauna from check-in up to (but not including) check-out.';
  end if;

  select * into v_resource from resources where id = p_resource_id and active;
  if not found then
    raise exception 'RESOURCE_NOT_FOUND: Sauna resource not found.';
  end if;

  v_end_time := p_start_time + make_interval(mins => p_duration_minutes);

  if p_start_time < v_resource.open_time or v_end_time > v_resource.close_time then
    raise exception 'OUTSIDE_HOURS: The sauna is open % to %.', v_resource.open_time, v_resource.close_time;
  end if;

  v_starts_at := (p_reservation_date + p_start_time) at time zone 'Europe/Ljubljana';
  v_ends_at   := (p_reservation_date + v_end_time)   at time zone 'Europe/Ljubljana';

  select coalesce(sum(duration_minutes), 0) into v_used
  from sauna_reservations
  where stay_id = p_stay_id
    and reservation_date = p_reservation_date
    and status = 'active';

  if v_used + p_duration_minutes > 60 then
    raise exception 'DAILY_LIMIT_EXCEEDED: Only % minute(s) remain today for this stay.', greatest(0, 60 - v_used);
  end if;

  begin
    insert into sauna_reservations (
      stay_id, resource_id, apartment_id, reservation_date, start_time, end_time,
      starts_at, ends_at, duration_minutes, status
    ) values (
      p_stay_id, p_resource_id, v_stay.apartment_id, p_reservation_date, p_start_time, v_end_time,
      v_starts_at, v_ends_at, p_duration_minutes, 'active'
    )
    returning * into v_row;
  exception when exclusion_violation then
    raise exception 'SLOT_UNAVAILABLE: The sauna is already reserved during part of that time.';
  end;

  if p_is_admin then
    insert into admin_audit_log (admin_user_id, action, affected_entity_type, affected_entity_id, metadata)
    values (p_admin_user_id, 'create_reservation', 'sauna_reservation', v_row.id, to_jsonb(v_row));
  end if;

  return v_row;
end;
$$;

create or replace function update_sauna_reservation(
  p_reservation_id   uuid,
  p_stay_id          uuid,
  p_reservation_date date,
  p_start_time       time,
  p_duration_minutes int,
  p_is_admin         boolean default false,
  p_admin_user_id    uuid default null
) returns sauna_reservations
language plpgsql
as $$
declare
  v_existing  sauna_reservations%rowtype;
  v_stay      stays%rowtype;
  v_resource  resources%rowtype;
  v_end_time  time;
  v_starts_at timestamptz;
  v_ends_at   timestamptz;
  v_used      int;
  v_row       sauna_reservations%rowtype;
begin
  select * into v_existing from sauna_reservations where id = p_reservation_id for update;
  if not found or v_existing.status <> 'active' then
    raise exception 'RESERVATION_NOT_FOUND: Reservation not found.';
  end if;

  if not p_is_admin and v_existing.stay_id <> p_stay_id then
    raise exception 'FORBIDDEN: This reservation does not belong to your stay.';
  end if;

  if p_duration_minutes not in (30, 60) then
    raise exception 'INVALID_DURATION: Duration must be 30 or 60 minutes.';
  end if;
  if extract(minute from p_start_time)::int % 30 <> 0 then
    raise exception 'INVALID_START_TIME: Start time must align to a 30-minute slot.';
  end if;

  if not p_is_admin and p_reservation_date < (now() at time zone 'Europe/Ljubljana')::date + 1 then
    raise exception 'LEAD_TIME_REQUIRED: Reservations must be made at least 1 day in advance.';
  end if;

  select * into v_stay from stays where id = v_existing.stay_id for update;
  if v_stay.status <> 'active' then
    raise exception 'STAY_INACTIVE: This stay is no longer active.';
  end if;
  if p_reservation_date < v_stay.check_in or p_reservation_date >= v_stay.check_out then
    raise exception 'OUTSIDE_STAY: You can only reserve the sauna from check-in up to (but not including) check-out.';
  end if;

  select * into v_resource from resources where id = v_existing.resource_id and active;
  if not found then
    raise exception 'RESOURCE_NOT_FOUND: Sauna resource not found.';
  end if;

  v_end_time := p_start_time + make_interval(mins => p_duration_minutes);
  if p_start_time < v_resource.open_time or v_end_time > v_resource.close_time then
    raise exception 'OUTSIDE_HOURS: The sauna is open % to %.', v_resource.open_time, v_resource.close_time;
  end if;

  v_starts_at := (p_reservation_date + p_start_time) at time zone 'Europe/Ljubljana';
  v_ends_at   := (p_reservation_date + v_end_time)   at time zone 'Europe/Ljubljana';

  select coalesce(sum(duration_minutes), 0) into v_used
  from sauna_reservations
  where stay_id = v_existing.stay_id
    and reservation_date = p_reservation_date
    and status = 'active'
    and id <> p_reservation_id;

  if v_used + p_duration_minutes > 60 then
    raise exception 'DAILY_LIMIT_EXCEEDED: Only % minute(s) remain today for this stay.', greatest(0, 60 - v_used);
  end if;

  begin
    update sauna_reservations set
      reservation_date = p_reservation_date,
      start_time       = p_start_time,
      end_time         = v_end_time,
      starts_at        = v_starts_at,
      ends_at          = v_ends_at,
      duration_minutes = p_duration_minutes
    where id = p_reservation_id
    returning * into v_row;
  exception when exclusion_violation then
    raise exception 'SLOT_UNAVAILABLE: The sauna is already reserved during part of that time.';
  end;

  if p_is_admin then
    insert into admin_audit_log (admin_user_id, action, affected_entity_type, affected_entity_id, metadata)
    values (p_admin_user_id, 'update_reservation', 'sauna_reservation', v_row.id, to_jsonb(v_row));
  end if;

  return v_row;
end;
$$;
