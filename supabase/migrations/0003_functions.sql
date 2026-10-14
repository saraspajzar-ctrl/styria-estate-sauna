-- 0003: Transactional business logic
--
-- All booking mutations go through these functions so there is exactly one
-- implementation of the rules, called identically by the guest flow and the
-- admin flow. Each function runs as a single Postgres transaction and takes
-- a row lock on the stay to serialize concurrent attempts against the same
-- stay's daily allowance. Overlap safety additionally comes from the
-- `sauna_reservations_no_overlap` exclusion constraint (0001), which this
-- function surfaces as a friendly error instead of a raw DB error.

create or replace function book_sauna_reservation(
  p_stay_id          uuid,
  p_resource_id      uuid,
  p_reservation_date date,
  p_start_time       time,
  p_duration_minutes int,
  p_number_of_guests int,
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
  if p_duration_minutes not in (30, 60, 90, 120) then
    raise exception 'INVALID_DURATION: Duration must be 30, 60, 90, or 120 minutes.';
  end if;

  if p_number_of_guests < 1 or p_number_of_guests > 4 then
    raise exception 'INVALID_GUESTS: Number of guests must be between 1 and 4.';
  end if;

  if extract(minute from p_start_time)::int % 30 <> 0 then
    raise exception 'INVALID_START_TIME: Start time must align to a 30-minute slot.';
  end if;

  -- Row lock: serializes concurrent booking attempts against this stay so
  -- the daily-allowance check below can never race.
  select * into v_stay from stays where id = p_stay_id for update;
  if not found then
    raise exception 'STAY_NOT_FOUND: Stay not found.';
  end if;
  if v_stay.status <> 'active' then
    raise exception 'STAY_INACTIVE: This stay is no longer active.';
  end if;

  -- Check-in day is eligible; check-out day is not.
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

  if v_used + p_duration_minutes > 120 then
    raise exception 'DAILY_LIMIT_EXCEEDED: Only % minute(s) remain today for this stay.', greatest(0, 120 - v_used);
  end if;

  begin
    insert into sauna_reservations (
      stay_id, resource_id, apartment_id, reservation_date, start_time, end_time,
      starts_at, ends_at, duration_minutes, number_of_guests, status
    ) values (
      p_stay_id, p_resource_id, v_stay.apartment_id, p_reservation_date, p_start_time, v_end_time,
      v_starts_at, v_ends_at, p_duration_minutes, p_number_of_guests, 'active'
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
  p_stay_id          uuid,              -- required unless p_is_admin
  p_reservation_date date,
  p_start_time       time,
  p_duration_minutes int,
  p_number_of_guests int,
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

  if p_duration_minutes not in (30, 60, 90, 120) then
    raise exception 'INVALID_DURATION: Duration must be 30, 60, 90, or 120 minutes.';
  end if;
  if p_number_of_guests < 1 or p_number_of_guests > 4 then
    raise exception 'INVALID_GUESTS: Number of guests must be between 1 and 4.';
  end if;
  if extract(minute from p_start_time)::int % 30 <> 0 then
    raise exception 'INVALID_START_TIME: Start time must align to a 30-minute slot.';
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

  if v_used + p_duration_minutes > 120 then
    raise exception 'DAILY_LIMIT_EXCEEDED: Only % minute(s) remain today for this stay.', greatest(0, 120 - v_used);
  end if;

  begin
    update sauna_reservations set
      reservation_date = p_reservation_date,
      start_time       = p_start_time,
      end_time         = v_end_time,
      starts_at        = v_starts_at,
      ends_at          = v_ends_at,
      duration_minutes = p_duration_minutes,
      number_of_guests = p_number_of_guests
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

create or replace function cancel_sauna_reservation(
  p_reservation_id uuid,
  p_stay_id        uuid,
  p_is_admin       boolean default false,
  p_admin_user_id  uuid default null
) returns void
language plpgsql
as $$
declare
  v_existing sauna_reservations%rowtype;
begin
  select * into v_existing from sauna_reservations where id = p_reservation_id for update;
  if not found or v_existing.status <> 'active' then
    raise exception 'RESERVATION_NOT_FOUND: Reservation not found.';
  end if;

  if not p_is_admin and v_existing.stay_id <> p_stay_id then
    raise exception 'FORBIDDEN: This reservation does not belong to your stay.';
  end if;

  update sauna_reservations set status = 'cancelled' where id = p_reservation_id;

  if p_is_admin then
    insert into admin_audit_log (admin_user_id, action, affected_entity_type, affected_entity_id, metadata)
    values (p_admin_user_id, 'cancel_reservation', 'sauna_reservation', p_reservation_id, to_jsonb(v_existing));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin stay management
-- ---------------------------------------------------------------------------

create or replace function admin_create_stay(
  p_apartment_id     uuid,
  p_guest_surname    text,
  p_check_in         date,
  p_check_out        date,
  p_access_code_hash text,
  p_admin_user_id    uuid
) returns stays
language plpgsql
as $$
declare
  v_row stays%rowtype;
begin
  if p_check_out <= p_check_in then
    raise exception 'INVALID_DATES: Check-out date must be after the check-in date.';
  end if;

  insert into stays (apartment_id, guest_surname, check_in, check_out, access_code_hash)
  values (p_apartment_id, btrim(p_guest_surname), p_check_in, p_check_out, p_access_code_hash)
  returning * into v_row;

  insert into admin_audit_log (admin_user_id, action, affected_entity_type, affected_entity_id, metadata)
  values (p_admin_user_id, 'create_stay', 'stay', v_row.id,
          jsonb_build_object('apartment_id', p_apartment_id, 'check_in', p_check_in, 'check_out', p_check_out));

  return v_row;
end;
$$;

create or replace function admin_update_stay_dates(
  p_stay_id       uuid,
  p_check_in      date,
  p_check_out     date,
  p_admin_user_id uuid
) returns stays
language plpgsql
as $$
declare
  v_row stays%rowtype;
begin
  if p_check_out <= p_check_in then
    raise exception 'INVALID_DATES: Check-out date must be after the check-in date.';
  end if;

  update stays set check_in = p_check_in, check_out = p_check_out
  where id = p_stay_id
  returning * into v_row;

  if not found then
    raise exception 'STAY_NOT_FOUND: Stay not found.';
  end if;

  insert into admin_audit_log (admin_user_id, action, affected_entity_type, affected_entity_id, metadata)
  values (p_admin_user_id, 'update_stay_dates', 'stay', v_row.id,
          jsonb_build_object('check_in', p_check_in, 'check_out', p_check_out));

  return v_row;
end;
$$;

create or replace function admin_cancel_stay(
  p_stay_id       uuid,
  p_admin_user_id uuid
) returns void
language plpgsql
as $$
begin
  update stays set status = 'cancelled' where id = p_stay_id and status <> 'cancelled';
  if not found then
    raise exception 'STAY_NOT_FOUND: Stay not found or already cancelled.';
  end if;

  update sauna_reservations
    set status = 'cancelled'
    where stay_id = p_stay_id and status = 'active';

  insert into admin_audit_log (admin_user_id, action, affected_entity_type, affected_entity_id, metadata)
  values (p_admin_user_id, 'cancel_stay', 'stay', p_stay_id, '{}'::jsonb);
end;
$$;

create or replace function admin_revoke_access_code(
  p_stay_id       uuid,
  p_admin_user_id uuid
) returns void
language plpgsql
as $$
begin
  update stays set access_code_revoked = true where id = p_stay_id;
  if not found then
    raise exception 'STAY_NOT_FOUND: Stay not found.';
  end if;

  insert into admin_audit_log (admin_user_id, action, affected_entity_type, affected_entity_id, metadata)
  values (p_admin_user_id, 'revoke_access_code', 'stay', p_stay_id, '{}'::jsonb);
end;
$$;

create or replace function admin_reissue_access_code(
  p_stay_id          uuid,
  p_access_code_hash text,
  p_admin_user_id    uuid
) returns stays
language plpgsql
as $$
declare
  v_row stays%rowtype;
begin
  update stays
    set access_code_hash = p_access_code_hash, access_code_revoked = false
    where id = p_stay_id
    returning * into v_row;

  if not found then
    raise exception 'STAY_NOT_FOUND: Stay not found.';
  end if;

  insert into admin_audit_log (admin_user_id, action, affected_entity_type, affected_entity_id, metadata)
  values (p_admin_user_id, 'reissue_access_code', 'stay', v_row.id, '{}'::jsonb);

  return v_row;
end;
$$;
