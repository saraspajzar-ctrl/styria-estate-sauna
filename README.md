# Styria Estate — Sauna Reservation System

A real, working reservation system for the shared sauna at Styria Estate (two
apartments, one sauna). Guests redeem a per-stay access code to book; admins
manage stays and the full schedule from an authenticated dashboard.

## Stack

- **Next.js (App Router) + TypeScript** — UI, API routes, `proxy.ts`
- **Supabase Postgres** — schema, RLS, and all booking business logic (SQL functions + an exclusion constraint)
- **Supabase Auth** — admin sign-in only (guests never get an account)
- **Tailwind CSS** — styling
- **Vercel** — hosting

## Architecture

```
app/sauna/page.tsx          guest portal: access code → dashboard → booking
app/admin/                  admin portal (Supabase Auth protected)
app/api/guest/*             guest-facing API routes (service-role DB access)
app/api/admin/*             admin-facing API routes (requires admins row)
lib/db/*                    typed query/RPC wrappers — the only code that talks to Supabase
lib/guest/session.ts        signed, HttpOnly JWT cookie carrying only { stayId }
lib/admin/dal.ts            requireAdminPage()/requireAdminApi() — the real auth gate
lib/access-code.ts          code generation + keyed-hash lookup
lib/rate-limit.ts           IP-based rate limiting for the verify endpoint
supabase/migrations/*.sql   schema, RLS policies, and transactional booking functions
scripts/migrate.ts          applies migrations to POSTGRES_URL_NON_POOLING
scripts/create-admin.ts     the only way to create an administrator
scripts/run-tests.ts        acceptance tests against the real database
```

**Why business logic lives in SQL functions, not application code:** every
booking rule (overlap, the 120-minute daily cap per stay, operating hours)
is enforced inside `book_sauna_reservation` /
`update_sauna_reservation` / `cancel_sauna_reservation` in
`supabase/migrations/0003_functions.sql`, each running as one Postgres
transaction that row-locks the stay before checking its daily total. A
separate `EXCLUDE USING gist` constraint makes overlapping active
reservations physically impossible to store, independent of any application
code path. The Next.js API routes are thin: validate the request shape, call
the function, translate its error into an HTTP response. This is what makes
the concurrency and conflict-prevention guarantees real rather than
best-effort — see `scripts/run-tests.ts` for the acceptance tests that
exercise this directly against Postgres, including concurrent requests.

## Guest access model

There are no guest accounts. The admin creates a **stay** per Airbnb booking
and the server generates a random access code (e.g. `7KPM-Q2XD`), shown once
in the admin UI. The database stores only `HMAC-SHA256(code, pepper)` — a
keyed hash, not the plaintext — so a leaked database alone doesn't reveal
working codes. Submitting the code at `/sauna` issues a signed, HttpOnly
cookie containing only the stay's id; every guest API call is authorized from
that cookie, never from a client-supplied id, so a guest cannot view another
stay by editing a request. All guests on one booking share one code, one
stay, and one 120-minute daily allowance.

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create/link a Supabase project via the Vercel Marketplace (recommended)

```bash
npm i -g vercel
vercel login
vercel link                      # creates/links a Vercel project
vercel integration add supabase  # provisions a Supabase project, wires env vars
vercel env pull .env.local       # writes .env.local with the Supabase vars
```

If you'd rather use an existing Supabase project outside the Marketplace,
copy `.env.example` to `.env.local` and fill in the Supabase and Postgres
values from your project's dashboard (Settings → API, Settings → Database).

### 3. Add the app-level secrets

```bash
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env.local
echo "ACCESS_CODE_PEPPER=$(openssl rand -hex 32)" >> .env.local
```

If deploying to Vercel, also set these two for Production/Preview:

```bash
vercel env add SESSION_SECRET production
vercel env add ACCESS_CODE_PEPPER production
# repeat for preview
```

### 4. Run the database migrations

Applies `supabase/migrations/*.sql` (schema, RLS, functions, seed data) to
`POSTGRES_URL_NON_POOLING`, tracked in a `_migrations` table so it's safe to
re-run:

```bash
npm run db:migrate
```

### 5. Create an administrator

There is no sign-up route — this is the only way to create one:

```bash
npm run db:create-admin -- --email you@example.com --password "a-strong-password" --name "Your Name"
```

### 6. Run the app

```bash
npm run dev
```

- Guests: http://localhost:3000/sauna
- Admin: http://localhost:3000/admin/login

## Entering an Airbnb booking (admin procedure)

1. Sign in at `/admin/login`.
2. On the **Stays** tab, fill in apartment, guest surname, check-in, and
   check-out, then submit.
3. The access code is shown **once**, directly under the form. Copy it into
   your Airbnb message to the guest immediately — it is not retrievable
   later (only re-issuable, which invalidates the old code).
4. If a booking is cancelled, use **Cancel stay** on that row — this also
   cancels any sauna reservations already made under it. If you only need to
   disable the current code without cancelling the stay, use **Revoke
   code**, then **Reissue code** to issue a new one.

## Running the tests

```bash
npm test
```

These are integration tests that run against your **real** configured
Supabase database (same rules as production — nothing is mocked), using
far-future dates as fixtures and cleaning up after themselves. Covers: the
shared 120-minute stay allowance, overlap prevention across apartments,
concurrent-request safety (both for overlap and for the daily cap),
cancellation releasing allowance, stay-window and operating-hours
boundaries, access-code isolation between stays, code revocation, rate
limiting, and Ljubljana-timezone date handling.

Set `TEST_BASE_URL=http://localhost:3000` (with `npm run dev` running in
another terminal) to additionally check that admin API routes reject
unauthenticated requests.

## Deploying to Vercel

```bash
vercel --prod
```

The project is already linked and has `SESSION_SECRET`, `ACCESS_CODE_PEPPER`,
and the Supabase/Postgres variables set for Production, Preview, and
Development (from the Marketplace provisioning step above) — all
environments point at the same Supabase project and therefore the same
migrated schema.

## Changing business rules

Everything in `lib/config.ts` is mirrored client-side for UX only; the
authoritative values live in `supabase/migrations/0003_functions.sql`
(duration limits, operating hours) and the `resources` /
`apartments` tables (capacity, open/close time — edit via SQL or add an
admin UI for it later). To add a third apartment, insert a row into
`apartments`; nothing in the codebase hardcodes apartment names or count. To
add a second wellness resource (e.g. a hot tub), insert a row into
`resources` — the schedule, booking functions, and exclusion constraint are
all already resource-scoped.

The check-out day is excluded from bookable dates by default
(`INCLUDE_CHECKOUT_DAY` in `lib/config.ts` and the same check in
`book_sauna_reservation`/`update_sauna_reservation`) — flip both if the
property wants to allow day-of-checkout sauna use.
