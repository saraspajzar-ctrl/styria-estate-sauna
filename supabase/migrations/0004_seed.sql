-- 0004: Seed data — the two apartments and the sauna resource.
-- Apartments are data, not hardcoded strings, so a third unit can be added
-- later with an INSERT instead of a code change.

insert into apartments (name, accommodation_capacity) values
  ('Styria Estate 1', 6),
  ('Styria Estate 2', 6)
on conflict (name) do nothing;

insert into resources (name, capacity, open_time, close_time) values
  ('Sauna', 4, '06:00', '22:00')
on conflict (name) do nothing;
