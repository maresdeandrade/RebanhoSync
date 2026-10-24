// Shared preparation for owned local test harnesses; never stores credentials.
import assert from "node:assert/strict";

export async function createConfirmedTestSession(admin, client, credentials) {
  const created = await admin.auth.admin.createUser({ ...credentials, email_confirm: true });
  assert.ifError(created.error);
  const signed = await client.auth.signInWithPassword(credentials);
  assert.ifError(signed.error);
  return { user: created.data.user, session: signed.data.session };
}

export async function restrictContextToLoopback(context) {
  await context.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1"
    ? route.fallback() : route.abort());
}
