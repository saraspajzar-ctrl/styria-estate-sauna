// Creates a Supabase Auth user and grants it admin access by inserting a row
// into `admins`. This is the only supported way to create an administrator —
// there is no public sign-up route.
//
// Usage: npm run db:create-admin -- --email you@example.com --password "..." --name "Your Name"
import { createClient } from "@supabase/supabase-js";

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const email = arg("email");
  const password = arg("password");
  const displayName = arg("name") ?? null;

  if (!email || !password) {
    console.error(
      'Usage: npm run db:create-admin -- --email you@example.com --password "..." [--name "Your Name"]'
    );
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) {
    throw createError;
  }

  const { error: adminError } = await supabase
    .from("admins")
    .insert({ user_id: created.user.id, display_name: displayName, active: true });
  if (adminError) {
    throw adminError;
  }

  console.log(`Admin created: ${email} (user_id: ${created.user.id})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
