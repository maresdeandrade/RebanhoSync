import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createConfirmedTestSession, restrictContextToLoopback } from "./sanitary-disposable-support.fixture.mjs";

test("confirmed fixture identity precedes sign-in and returns the SDK objects", async () => {
  const credentials = { email: "fixture@example.invalid", password: randomUUID() };
  const user = { id: randomUUID() }, session = { user }, calls = [];
  const admin = { auth: { admin: { createUser: async input => {
    calls.push("create"); assert.deepEqual(input, { ...credentials, email_confirm: true }); return { data: { user }, error: null };
  } } } };
  const client = { auth: { signInWithPassword: async input => {
    calls.push("login"); assert.deepEqual(input, credentials); return { data: { session }, error: null };
  } } };
  const result = await createConfirmedTestSession(admin, client, credentials);
  assert.deepEqual(calls, ["create", "login"]); assert.equal(result.user, user); assert.equal(result.session, session);
});

test("failed identity creation never signs in", async () => {
  let attempted = false;
  const admin = { auth: { admin: { createUser: async () => ({ error: new Error("fixture-create-denied") }) } } };
  const client = { auth: { signInWithPassword: async () => { attempted = true; } } };
  await assert.rejects(createConfirmedTestSession(admin, client, {}), /fixture-create-denied/);
  assert.equal(attempted, false);
});

test("failed sign-in never returns a usable synthetic session", async () => {
  const admin = { auth: { admin: { createUser: async () => ({ data: { user: { id: randomUUID() } }, error: null }) } } };
  const client = { auth: { signInWithPassword: async () => ({ error: new Error("fixture-login-denied") }) } };
  await assert.rejects(createConfirmedTestSession(admin, client, {}), /fixture-login-denied/);
});

test("browser guard preserves loopback fallback and aborts every other host", async () => {
  let handler;
  await restrictContextToLoopback({ route: async (pattern, callback) => { assert.equal(pattern, "**/*"); handler = callback; } });
  for (const [url, expected] of [["http://127.0.0.1:55421/rest/v1/animais", "fallback"], ["https://example.invalid/rest/v1/animais", "abort"]]) {
    let action;
    await handler({ request: () => ({ url: () => url }), fallback: () => { action = "fallback"; }, abort: () => { action = "abort"; } });
    assert.equal(action, expected);
  }
});
