import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client } = pg;
const dbUrl =
  process.env.REBANHOSYNC_TEST_DB_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const apiUrl = process.env.REBANHOSYNC_TEST_API_URL;
const serviceRoleKey = process.env.REBANHOSYNC_TEST_SERVICE_ROLE_KEY;

if (!apiUrl || !serviceRoleKey) {
  throw new Error(
    "REBANHOSYNC_TEST_API_URL and REBANHOSYNC_TEST_SERVICE_ROLE_KEY are required",
  );
}

const runId = randomUUID();
const email = `commercial-concurrency-${runId}@ci.local`;
const password = `C1-${runId}-safe-test-password`;
const adminClient = createClient(apiUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const db = new Client({ connectionString: dbUrl });

let userId;
let farmId;

try {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { purpose: "commercial-concurrency-ci" },
  });
  if (error) throw error;
  userId = data.user?.id;
  if (!userId) throw new Error("Supabase Auth did not return a test user id");

  await db.connect();
  await db.query("set statement_timeout = '60s'");
  await db.query("set lock_timeout = '5s'");
  const farm = await db.query(
    "insert into public.fazendas (nome, created_by, client_id) values ($1, $2, $3) returning id",
    [`CI commercial concurrency ${runId}`, userId, "commercial-concurrency-ci"],
  );
  farmId = farm.rows[0]?.id;
  if (!farmId) throw new Error("Database did not return a test farm id");

  await db.query(
    "insert into public.user_profiles (user_id, display_name, client_id) values ($1, $2, $3)",
    [userId, "Commercial concurrency CI", "commercial-concurrency-ci"],
  );
  await db.query(
    "insert into public.user_settings (user_id) values ($1)",
    [userId],
  );
  await db.query(
    "insert into public.user_fazendas (user_id, fazenda_id, role, is_primary, accepted_at, client_id) values ($1, $2, 'owner', true, now(), $3)",
    [userId, farmId, "commercial-concurrency-ci"],
  );

  console.log("Prepared disposable commercial concurrency fixture");
} finally {
  await db.end().catch(() => undefined);
}

// The database is disposable and is torn down by the workflow cleanup step.
// No credentials or tokens are printed or persisted by this script.
void farmId;
void userId;
void email;
void password;
