// Applies supabase/migrations/*.sql in order against POSTGRES_URL_NON_POOLING.
// Run with: npm run db:migrate
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { Client } from "pg";

async function main() {
  const connectionString =
    process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("POSTGRES_URL_NON_POOLING (or POSTGRES_URL) is not set.");
  }

  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query(`
      create table if not exists _migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    for (const file of files) {
      const { rows } = await client.query("select 1 from _migrations where name = $1", [
        file,
      ]);
      if (rows.length > 0) {
        console.log(`skip  ${file} (already applied)`);
        continue;
      }
      const sql = readFileSync(path.join(dir, file), "utf8");
      console.log(`apply ${file}`);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into _migrations (name) values ($1)", [file]);
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw err;
      }
    }
    console.log("done.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
