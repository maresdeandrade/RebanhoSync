import assert from "node:assert/strict";

export function assertDisposableDatabase(psql, database, env = process.env) {
  assert.equal(env.A05_B04_ALLOW_DISPOSABLE, "1");
  const identity = psql("select current_database();");
  assert.equal(identity.status, 0, identity.stderr);
  assert.equal(identity.stdout.trim(), database);
}

export async function finishBlockedPair({ sql, first, second, until, app }) {
  second.child.stdin.end();
  await until(() => sql(`select count(*) from pg_stat_activity where application_name='${app}' and wait_event_type='Lock'`) === "1");
  first.write("commit;");
  first.child.stdin.end();
  const pair = await Promise.all([first.done, second.done]);
  assert.equal(pair[0].code, 0, pair[0].error);
  return pair;
}
