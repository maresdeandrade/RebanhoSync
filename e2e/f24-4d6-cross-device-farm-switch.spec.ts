import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

const apiUrl = process.env.REBANHOSYNC_TEST_API_URL;
const anonKey = process.env.REBANHOSYNC_TEST_ANON_KEY;
const serviceRoleKey = process.env.REBANHOSYNC_TEST_SERVICE_ROLE_KEY;
const databaseUrl = process.env.REBANHOSYNC_TEST_DB_URL;

test.use({ trace: "off", screenshot: "off" });

type Farm = { id: string; name: string; animalId: string; baseline: string };
type RemoteAnimal = {
  id: string; fazenda_id: string; revision: string; observacoes: string;
  client_op_id: string | null; client_tx_id: string | null;
};

async function stopWorker(page: Page) {
  await page.evaluate(async () => {
    const { stopSyncWorker } = await import("/src/lib/offline/syncWorker.ts");
    stopSyncWorker();
  });
}

async function inspectClient(page: Page) {
  return page.evaluate(async () => {
    const { db } = await import("/src/lib/offline/db.ts");
    const { getActiveFarmId } = await import("/src/lib/storage.ts");
    return {
      activeFarm: getActiveFarmId(),
      snapshots: (await db.state_animais.toArray()).map(({ id, fazenda_id, revision, observacoes }) => ({ id, fazenda_id, revision, observacoes })),
      ops: (await db.queue_ops.toArray()).map((op) => ({
        opId: op.client_op_id, txId: op.client_tx_id, farmId: op.record.fazenda_id,
        animalId: op.record.id, expectedRevision: op.expected_revision,
        syncState: op.sync_state, nextAttemptAt: op.next_attempt_at,
      })),
      gestures: (await db.queue_gestures.toArray()).map((gesture) => ({
        txId: gesture.client_tx_id, farmId: gesture.fazenda_id, status: gesture.status,
        syncResult: gesture.sync_result, audit: gesture.operation_results,
      })),
      rejections: (await db.queue_rejections.toArray()).map(({ fazenda_id, client_tx_id, client_op_id, reason_code }) => ({ fazenda_id, client_tx_id, client_op_id, reason_code })),
      obligations: (await db.sync_reconcile_obligations.toArray()).map(({ key, fazenda_id, scope, tables }) => ({ key, fazenda_id, scope, tables })),
    };
  });
}

// The actual selector calls useAuth.setActiveFarm (Auth, localStorage,
// user_settings and membership). No direct localStorage/IndexedDB farm switch.
async function selectFarm(page: Page, farm: Farm, current?: Farm) {
  if (current) {
    await page.getByRole("button", { name: current.name, exact: true }).click();
    await page.getByRole("menuitem", { name: "Trocar fazenda" }).click();
  }
  await page.getByRole("button", { name: new RegExp(farm.name) }).click();
  await expect(page.getByRole("button", { name: farm.name, exact: true })).toBeVisible();
  // As in D2-D5, control dispatch explicitly. Farm selection and all pulls
  // still execute product code; only the background scheduler is stopped.
  await stopWorker(page);
  expect((await inspectClient(page)).activeFarm).toBe(farm.id);
  const persisted = await page.evaluate(async () => {
    const { supabase } = await import("/src/lib/supabase.ts");
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("user_settings")
      .select("active_fazenda_id").eq("user_id", user!.id).single();
    if (error) throw new Error(`FARM_SETTING_${error.code}: ${error.message}`);
    return data.active_fazenda_id;
  });
  expect(persisted).toBe(farm.id);
}

async function login(page: Page, email: string, password: string, farms: Farm[]) {
  await page.goto("/login");
  const frontend = await page.evaluate(async () => {
    const { env } = await import("/src/lib/env.ts");
    return { api: env.supabaseUrl, functions: env.supabaseFunctionsUrl };
  });
  expect(frontend.api).toBe(apiUrl);
  expect(new URL(frontend.functions).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  expect(new URL(frontend.functions).origin).toBe(new URL(apiUrl!).origin);
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  // A second client can inherit user_settings.active_fazenda_id. Reach the
  // real selector, without overriding that preference in storage.
  await expect(page).toHaveURL(/\/(home|select-fazenda)$/);
  if (new URL(page.url()).pathname === "/home") {
    await expect(page.getByRole("button", { name: new RegExp(farms.map((farm) => farm.name).join("|")) })).toBeVisible();
    await stopWorker(page);
    await page.getByRole("button", { name: new RegExp(farms.map((farm) => farm.name).join("|")) }).click();
    await page.getByRole("menuitem", { name: "Trocar fazenda" }).click();
  }
  for (const farm of farms) await expect(page.getByRole("button", { name: new RegExp(farm.name) })).toBeVisible();
  const memberships = await page.evaluate(async () => {
    const { supabase } = await import("/src/lib/supabase.ts");
    const { data, error } = await supabase.from("user_fazendas").select("fazenda_id, role").is("deleted_at", null);
    if (error) throw new Error(`MEMBERSHIP_${error.code}: ${error.message}`);
    return data;
  });
  expect(memberships).toHaveLength(2);
  expect(memberships).toEqual(expect.arrayContaining(farms.map((farm) => ({ fazenda_id: farm.id, role: "owner" }))));
}

async function pullFarm(page: Page, farmId: string, mode: "replace" | "merge") {
  await page.evaluate(async ({ farmId, mode }) => {
    const { pullDataForFarm } = await import("/src/lib/offline/pull.ts");
    const { drainReconciliationObligations } = await import("/src/lib/offline/syncWorker.ts");
    await drainReconciliationObligations(farmId);
    await pullDataForFarm(farmId, ["animais"], { mode });
  }, { farmId, mode });
}

function assertSegregated(local: Awaited<ReturnType<typeof inspectClient>>, farms: Farm[]) {
  for (const row of local.snapshots) {
    const farm = farms.find((candidate) => candidate.animalId === row.id);
    expect(farm, "Only fixture animals may appear in this user's stores").toBeDefined();
    expect(row.fazenda_id).toBe(farm!.id);
  }
  for (const op of local.ops) {
    const farm = farms.find((candidate) => candidate.animalId === op.animalId);
    expect(farm).toBeDefined();
    expect(op.farmId).toBe(farm!.id);
    expect(local.gestures.find((gesture) => gesture.txId === op.txId)?.farmId).toBe(farm!.id);
  }
  for (const obligation of local.obligations) {
    expect(farms.map((farm) => farm.id)).toContain(obligation.fazenda_id);
    expect(obligation.key).toBe(`${obligation.fazenda_id}:${obligation.scope}`);
  }
  expect(local.rejections).toEqual([]);
}

test("F24.4D6: farm switch real preserva pending, identidade e isolamento entre clientes/fazendas", async ({ browser }) => {
  test.setTimeout(180_000);
  expect(apiUrl && anonKey && serviceRoleKey && databaseUrl, "Local Auth, Edge and PostgreSQL environment is required").toBeTruthy();
  expect(new URL(apiUrl!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  expect(new URL(databaseUrl!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);

  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(apiUrl!, serviceRoleKey!, options);
  const outsider = createClient(apiUrl!, anonKey!, options);
  const database = new Client({ connectionString: databaseUrl });
  const userId = crypto.randomUUID();
  const outsiderId = crypto.randomUUID();
  const email = `f24-4d6-${userId}@example.test`;
  const password = `F24.4D6-${crypto.randomUUID()}-Aa1!`;
  const outsiderEmail = `f24-4d6-outsider-${outsiderId}@example.test`;
  const outsiderPassword = `F24.4D6-${crypto.randomUUID()}-Aa1!`;
  const farms: Farm[] = ["A", "B"].map((label) => ({
    id: crypto.randomUUID(), name: `F24 D6 Farm ${label}`, animalId: crypto.randomUUID(), baseline: `baseline-${label}`,
  }));
  const [farmA, farmB] = farms;
  const noteA = `offline-A-${crypto.randomUUID()}`;
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const createdUsers: string[] = [];
  let databaseConnected = false;
  let checkpoint = "environment";
  const responses: Array<{ status: number; body: unknown }> = [];
  const responseReads: Promise<void>[] = [];
  pageA.on("response", (response) => {
    if (new URL(response.url()).pathname === "/functions/v1/sync-batch") {
      responseReads.push(response.json().then((body) => { responses.push({ status: response.status(), body }); }).catch(() => {}));
    }
  });
  const readRemote = async () => (await database.query<RemoteAnimal>(
    "select id, fazenda_id, revision, observacoes, client_op_id, client_tx_id from public.animais where id = any($1::uuid[]) order by id",
    [farms.map((farm) => farm.animalId)],
  )).rows;
  const capture = async (name: string) => {
    checkpoint = name;
    const [localA, localB, remote] = await Promise.all([inspectClient(pageA), inspectClient(pageB), readRemote()]);
    console.log(JSON.stringify({ checkpoint, localA, localB, remote }));
    assertSegregated(localA, farms);
    assertSegregated(localB, farms);
    expect(remote).toHaveLength(2);
    for (const farm of farms) expect(remote.find((row) => row.id === farm.animalId)?.fazenda_id).toBe(farm.id);
    return { localA, localB, remote };
  };

  try {
    checkpoint = "fixture";
    for (const user of [
      { id: userId, email, password },
      { id: outsiderId, email: outsiderEmail, password: outsiderPassword },
    ]) {
      const { error } = await admin.auth.admin.createUser({ ...user, email_confirm: true });
      if (error) throw error;
      createdUsers.push(user.id);
    }
    await database.connect();
    databaseConnected = true;
    for (const farm of farms) {
      await database.query("insert into public.fazendas (id, nome) values ($1, $2)", [farm.id, farm.name]);
      await database.query("insert into public.user_fazendas (user_id, fazenda_id, role, is_primary, accepted_at) values ($1, $2, 'owner', $3, now())", [userId, farm.id, farm.id === farmA.id]);
      await database.query("insert into public.animais (id, fazenda_id, identificacao, sexo, observacoes) values ($1, $2, $3, 'F', $4)", [farm.animalId, farm.id, farm.name, farm.baseline]);
    }
    expect(farmA.id).not.toBe(farmB.id);
    expect(farmA.animalId).not.toBe(farmB.animalId);
    const initialRemote = await readRemote();
    const initialAnimalA = initialRemote.find((row) => row.id === farmA.animalId)!;
    const initialAnimalB = initialRemote.find((row) => row.id === farmB.animalId)!;
    const revisionA = Number(initialAnimalA.revision);
    expect(revisionA).toBeGreaterThanOrEqual(1);
    console.log(JSON.stringify({ checkpoint, userId, outsiderId, farms, initialRemote }));

    // A separate authenticated outsider checks real RLS, without altering the
    // same-user model used by the two browser clients.
    checkpoint = "rls-outsider";
    const { error: loginError } = await outsider.auth.signInWithPassword({ email: outsiderEmail, password: outsiderPassword });
    if (loginError) throw loginError;
    const hidden = await outsider.from("animais").select("id").in("id", farms.map((farm) => farm.animalId));
    expect(hidden.error).toBeNull();
    expect(hidden.data).toEqual([]);
    const denied = await outsider.from("animais").update({ observacoes: "outsider-must-not-apply" }).eq("id", farmB.animalId).select("id");
    expect(denied.error).toBeNull();
    expect(denied.data).toEqual([]);
    expect(await readRemote()).toEqual(initialRemote);
    if (hidden.data === null || denied.data === null) throw new Error("RLS_RESULT_MISSING");
    console.log(JSON.stringify({ checkpoint, selectRows: hidden.data.length, updateRows: denied.data.length }));

    checkpoint = "login-and-selection";
    await login(pageA, email, password, farms);
    await selectFarm(pageA, farmA);
    await pullFarm(pageA, farmA.id, "replace");
    await login(pageB, email, password, farms);
    await selectFarm(pageB, farmB);
    await pullFarm(pageB, farmB.id, "replace");
    const baseline = await capture("baseline-two-clients");
    expect(baseline.localA.activeFarm).toBe(farmA.id);
    expect(baseline.localB.activeFarm).toBe(farmB.id);
    expect(baseline.localA.snapshots).toContainEqual({ id: farmA.animalId, fazenda_id: farmA.id, revision: revisionA, observacoes: farmA.baseline });
    expect(baseline.localB.snapshots).toContainEqual({ id: farmB.animalId, fazenda_id: farmB.id, revision: Number(initialAnimalB.revision), observacoes: farmB.baseline });
    expect(baseline.localA.ops).toEqual([]);
    expect(baseline.localB.ops).toEqual([]);

    checkpoint = "create-offline-A";
    await contextA.setOffline(true);
    const txId = await pageA.evaluate(async ({ farmId, animalId, note }) => {
      const { createGesture } = await import("/src/lib/offline/ops.ts");
      return createGesture(farmId, [{ table: "animais", action: "UPDATE", record: { id: animalId, observacoes: note } }]);
    }, { farmId: farmA.id, animalId: farmA.animalId, note: noteA });
    const offline = await capture("offline-pending-A");
    expect(offline.localA.ops).toHaveLength(1);
    const original = offline.localA.ops[0];
    expect(original).toMatchObject({ txId, farmId: farmA.id, animalId: farmA.animalId, expectedRevision: revisionA });
    expect(offline.remote).toEqual(initialRemote);
    const assertPending = (state: Awaited<ReturnType<typeof capture>>) => {
      expect(state.localA.ops).toEqual([original]);
      expect(state.localA.gestures).toContainEqual(expect.objectContaining({ txId, farmId: farmA.id, status: "PENDING" }));
      expect(state.localA.snapshots).toContainEqual({ id: farmA.animalId, fazenda_id: farmA.id, revision: revisionA, observacoes: noteA });
      expect(state.localB.ops).toEqual([]);
      expect(state.localB.gestures).toEqual([]);
      expect(state.localB.snapshots.some((row) => row.observacoes === noteA)).toBe(false);
      expect(state.localB.activeFarm).toBe(farmB.id);
      expect(state.remote).toEqual(initialRemote);
    };
    assertPending(offline);

    // setActiveFarm uses auth.getUser and remote membership; restore transport
    // with the worker stopped, preserving the offline-created pending command.
    checkpoint = "switch-A-to-B";
    await contextA.setOffline(false);
    await selectFarm(pageA, farmB, farmA);
    assertPending(await capture("after-switch-to-B"));
    await pullFarm(pageA, farmB.id, "replace");
    const afterBPull = await capture("after-B-replace");
    assertPending(afterBPull);
    expect(afterBPull.localA.activeFarm).toBe(farmB.id);
    expect(afterBPull.localA.snapshots).toContainEqual({ id: farmB.animalId, fazenda_id: farmB.id, revision: Number(initialAnimalB.revision), observacoes: farmB.baseline });

    // Certification F24.4F: reconnect and apply A while B remains active.
    // Selection requires online membership; exercise a new offline/reconnect
    // boundary after the real selector has installed B, without changing farms.
    await contextA.setOffline(true);
    const inactivePending = await capture("offline-A-with-B-active");
    assertPending(inactivePending);
    expect(inactivePending.localA.activeFarm).toBe(farmB.id);
    await contextA.setOffline(false);

    // Lose only the immediate animal refresh after ACK. The later obligation
    // drain must recover the authoritative revision through the real pull.
    let blockedAnimalRefreshes = 0;
    await pageA.route("**/rest/v1/animais?*", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("fazenda_id") === `eq.${farmA.id}`) {
        blockedAnimalRefreshes += 1;
        await route.abort("failed");
      } else {
        await route.continue();
      }
    });
    checkpoint = "sync-original-A";
    await pageA.evaluate(async (txId) => {
      const { db } = await import("/src/lib/offline/db.ts");
      const { processGesture } = await import("/src/lib/offline/syncWorker.ts");
      const gesture = await db.queue_gestures.get(txId);
      if (!gesture) throw new Error("ORIGINAL_GESTURE_MISSING");
      await processGesture(gesture);
    }, txId);
    const applied = await capture("original-A-applied");
    expect(applied.localA.activeFarm).toBe(farmB.id);
    expect(applied.localB).toEqual(afterBPull.localB);
    const cachedB = afterBPull.localA.snapshots.find((row) => row.id === farmB.animalId)!;
    expect(applied.localA.snapshots).toContainEqual(cachedB);
    expect(applied.remote.find((row) => row.id === farmA.animalId)).toMatchObject({ fazenda_id: farmA.id, observacoes: noteA, revision: String(revisionA + 1), client_op_id: original.opId, client_tx_id: txId });
    expect(applied.remote.find((row) => row.id === farmB.animalId)).toEqual(initialAnimalB);
    expect(applied.localA.ops).toEqual([]);
    expect(applied.localA.gestures).toContainEqual(expect.objectContaining({ txId, farmId: farmA.id, status: "DONE", syncResult: "APPLIED", audit: expect.arrayContaining([expect.objectContaining({ op_id: original.opId, status: "APPLIED" })]) }));
    expect(applied.localA.obligations).toEqual([
      expect.objectContaining({ fazenda_id: farmA.id, scope: "factual", tables: expect.arrayContaining(["animais"]) }),
    ]);
    expect(blockedAnimalRefreshes).toBeGreaterThan(0);
    expect(applied.localA.snapshots).toContainEqual({ id: farmA.animalId, fazenda_id: farmA.id, revision: revisionA, observacoes: noteA });
    await pageA.unroute("**/rest/v1/animais?*");

    // Only drain the ACK-created obligation. No explicit pull/mode override:
    // the worker must select its own non-active-farm reconciliation semantics.
    checkpoint = "drain-non-active-A";
    await pageA.evaluate(async (farmId) => {
      const { drainReconciliationObligations } = await import("/src/lib/offline/syncWorker.ts");
      await drainReconciliationObligations(farmId);
    }, farmA.id);
    const reconciledInactive = await capture("non-active-A-reconciled-with-B-active");
    expect(reconciledInactive.localA.activeFarm).toBe(farmB.id);
    expect(reconciledInactive.localA.obligations).toEqual([]);
    expect(reconciledInactive.localA.ops).toEqual([]);
    expect(reconciledInactive.localA.gestures).toEqual(applied.localA.gestures);
    expect(reconciledInactive.localA.snapshots).toContainEqual({ id: farmA.animalId, fazenda_id: farmA.id, revision: revisionA + 1, observacoes: noteA });
    expect(reconciledInactive.localA.snapshots).toContainEqual(cachedB);
    expect(reconciledInactive.localB).toEqual(afterBPull.localB);
    expect(reconciledInactive.remote).toEqual(applied.remote);

    checkpoint = "return-B-to-A";
    await selectFarm(pageA, farmA, farmB);

    await pullFarm(pageA, farmA.id, "replace");
    await pullFarm(pageB, farmB.id, "replace");
    const final = await capture("final");
    expect(final.localA.activeFarm).toBe(farmA.id);
    expect(final.localB.activeFarm).toBe(farmB.id);
    expect(final.localA.snapshots).toContainEqual({ id: farmA.animalId, fazenda_id: farmA.id, revision: revisionA + 1, observacoes: noteA });
    expect(final.localB.snapshots).toContainEqual({ id: farmB.animalId, fazenda_id: farmB.id, revision: Number(initialAnimalB.revision), observacoes: farmB.baseline });
    for (const state of [final.localA, final.localB]) {
      expect(state.ops).toEqual([]);
      expect(state.obligations).toEqual([]);
      // replace may unload inactive snapshots; any retained snapshot must be
      // correct. The pending A snapshot was mandatory throughout both switches.
      const cachedB = state.snapshots.find((row) => row.id === farmB.animalId);
      if (cachedB) expect(cachedB).toMatchObject({ fazenda_id: farmB.id, revision: Number(initialAnimalB.revision), observacoes: farmB.baseline });
      const cachedA = state.snapshots.find((row) => row.id === farmA.animalId);
      if (cachedA) expect(cachedA).toMatchObject({ fazenda_id: farmA.id, revision: revisionA + 1, observacoes: noteA });
    }
    expect(final.remote).toEqual(applied.remote);
    await Promise.all(responseReads);
    console.log(JSON.stringify({ scenario: "F24.4D6/F24.4F", original, inactivePending, reconciledInactive, responses, final, nonActiveFarmReconciliation: "PROVEN" }));
  } catch (error) {
    await Promise.all(responseReads);
    const diagnostics = await Promise.allSettled([inspectClient(pageA), inspectClient(pageB), ...(databaseConnected ? [readRemote()] : [])]);
    console.log(JSON.stringify({ scenario: "F24.4D6-failure", checkpoint, responses, diagnostics: diagnostics.map((result) => result.status === "fulfilled" ? result.value : { unavailable: true }) }));
    throw error;
  } finally {
    await Promise.all([contextA.close(), contextB.close()]);
    if (databaseConnected) {
      await database.query("delete from public.animais where id = any($1::uuid[])", [farms.map((farm) => farm.animalId)]);
      await database.query("delete from public.user_settings where user_id = $1", [userId]);
      await database.query("delete from public.user_fazendas where user_id = $1", [userId]);
      await database.query("delete from public.fazendas where id = any($1::uuid[])", [farms.map((farm) => farm.id)]);
      await database.end();
    }
    for (const id of createdUsers) {
      const { error } = await admin.auth.admin.deleteUser(id);
      expect.soft(error === null, "Fixture user cleanup").toBe(true);
    }
  }
});
