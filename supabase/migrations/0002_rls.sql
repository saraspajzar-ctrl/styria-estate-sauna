-- 0002: Row Level Security
--
-- All application reads/writes for guest and admin flows go through Next.js
-- server routes using the service_role key, which bypasses RLS by design.
-- RLS here is a hard backstop: if the anon/authenticated (browser) key were
-- ever used directly, every table below default-denies. The only exception
-- is `admins`, where a logged-in admin's own session needs to check its own
-- membership row server-side via the user's own Supabase session.

alter table apartments            enable row level security;
alter table resources             enable row level security;
alter table stays                 enable row level security;
alter table sauna_reservations    enable row level security;
alter table admins                enable row level security;
alter table admin_audit_log       enable row level security;
alter table access_code_attempts  enable row level security;

-- No policies are created for apartments, resources, stays,
-- sauna_reservations, admin_audit_log, or access_code_attempts for
-- anon/authenticated — RLS with zero policies denies all access to those
-- roles. service_role bypasses RLS entirely and is used by every server
-- route in this app.

create policy "admins can read own membership row"
  on admins
  for select
  to authenticated
  using (auth.uid() = user_id);
