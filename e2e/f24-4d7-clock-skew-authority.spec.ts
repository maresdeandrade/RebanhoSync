import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

const apiUrl = process.env.REBANHOSYNC_TEST_API_URL;
const anonKey = process.env.REBANHOSYNC_TEST_ANON_KEY;
const serviceRoleKey = process.env.REBANHOSYNC_TEST_SERVICE_ROLE_KEY;
const databaseUrl = process.env.REBANHOSYNC_TEST_DB_URL;
const SKEW_MS = 55 * 60 * 1000;

test.use({ trace: "off", screenshot: "off" });

type RemoteAnimal = {
  revision: string;
  observacoes: string;
  client_op_id: string | null;
  client_tx_id: string | null;
  client_recorded_at: Date;
  server_received_at: Date;
  created_at: Date;
  updated_at: Date;
};

async function prepareClient(page: Page, email: string, password: string, farmId: string, animalId: string) {
  await page.goto("/");
  return page.evaluate(async ({ email, password, farmId, animalId, expectedApi }) => {
    const { env } = await import("/src/lib/env.ts");
    if (env.supabaseUrl !== expectedApi || new URL(env.supabaseFunctionsUrl).origin !== new URL(expectedApi).origin) {
      throw new Error("NON_LOCAL_FRONTEND_BACKEND");
    }
    const { supabase } = await import("/src/lib/supabase.ts");
    const { db } = await import("/src/lib/offline/db.ts");
    const { establishLocalOwnership } = await import("/src/lib/offline/ownership.ts");
    const { pullDataForFarm } = await import("/src/lib/offline/pull.ts");
    const { stopSyncWorker } = await import("/src/lib/offline/syncWorker.ts");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw error ?? new Error("AUTH_SESSION_MISSING");
    await db.open();
    const ownership = await establishLocalOwnership(data.session);
    if (ownership.status !== "OWNED") throw new Error(`LOCAL_OWNERSHIP_${ownership.status}`);
    stopSyncWorker();
    await pullDataForFarm(farmId, ["animais"], { mode: "replace" });
    const animal = await db.state_animais.get(animalId);
    if (!animal) throw new Error("REMOTE_ANIMAL_NOT_PULLED");
    return { userId: data.session.user.id, revision: animal.revision, observacoes: animal.observacoes };
  }, { email, password, farmId, animalId, expectedApi: apiUrl! });
}

async function inspectClient(page: Page, animalId: string, txId: string, opId: string) {
  return page.evaluate(async ({ animalId, txId, opId }) => {
    const { db } = await import("/src/lib/offline/db.ts");
    const animal = await db.state_animais.get(animalId);
    const gesture = await db.queue_gestures.get(txId);
    const op = await db.queue_ops.get(opId);
    return {
      animal: animal && { revision: animal.revision, observacoes: animal.observacoes },
      gesture: gesture && { status: gesture.status, syncResult: gesture.sync_result, createdAt: gesture.created_at, nextAttemptAt: gesture.next_attempt_at, audit: gesture.operation_results },
      op: op && {
        opId: op.client_op_id, txId: op.client_tx_id, expectedRevision: op.expected_revision,
        createdAt: op.created_at, clientRecordedAt: op.record.client_recorded_at,
        serverReceivedAt: op.record.server_received_at ?? null,
        occurredAt: op.record.occurred_at ?? null, remoteCreatedAt: op.record.created_at ?? null,
        remoteUpdatedAt: op.record.updated_at ?? null, syncState: op.sync_state,
        blockedReason: op.blocked_reason, nextAttemptAt: op.next_attempt_at,
      },
      rejections: (await db.queue_rejections.where("client_tx_id").equals(txId).toArray())
        .map(({ reason_code, client_op_id }) => ({ reason_code, client_op_id })),
      obligations: (await db.sync_reconcile_obligations.toArray()).map(({ key, scope }) => ({ key, scope })),
    };
  }, { animalId, txId, opId });
}

async function createUpdate(page: Page, farmId: string, animalId: string, note: string) {
  return page.evaluate(async ({ farmId, animalId, note }) => {
    const { createGesture } = await import("/src/lib/offline/ops.ts");
    const { db } = await import("/src/lib/offline/db.ts");
    const txId = await createGesture(farmId, [{ table: "animais", action: "UPDATE", record: { id: animalId, observacoes: note } }]);
    const ops = await db.queue_ops.where("client_tx_id").equals(txId).toArray();
    if (ops.length !== 1) throw new Error(`EXPECTED_ONE_QUEUED_OP_GOT_${ops.length}`);
    return { txId, opId: ops[0].client_op_id, expectedRevision: ops[0].expected_revision };
  }, { farmId, animalId, note });
}

async function syncGesture(page: Page, txId: string) {
  await page.evaluate(async (txId) => {
    const { db } = await import("/src/lib/offline/db.ts");
    const { processGesture } = await import("/src/lib/offline/syncWorker.ts");
    const gesture = await db.queue_gestures.get(txId);
    if (!gesture) throw new Error("QUEUED_GESTURE_MISSING");
    await processGesture(gesture);
  }, txId);
}

async function pullClient(page: Page, farmId: string) {
  await page.evaluate(async (farmId) => {
    const { drainReconciliationObligations } = await import("/src/lib/offline/syncWorker.ts");
    const { pullDataForFarm } = await import("/src/lib/offline/pull.ts");
    await drainReconciliationObligations(farmId);
    await pullDataForFarm(farmId, ["animais"], { mode: "merge" });
  }, farmId);
}

test("F24.4D7: clocks divergentes não decidem o vencedor do CAS em nenhuma ordem", async ({ browser }) => {
  test.setTimeout(180_000);
  expect(apiUrl && anonKey && serviceRoleKey && databaseUrl, "Local Auth, Edge and PostgreSQL environment is required").toBeTruthy();
  expect(new URL(apiUrl!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  expect(new URL(databaseUrl!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);

  const admin = createClient(apiUrl!, serviceRoleKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const database = new Client({ connectionString: databaseUrl });
  const userId = crypto.randomUUID();
  const farmId = crypto.randomUUID();
  const animalId = crypto.randomUUID();
  const email = `f24-4d7-${userId}@example.test`;
  const password = `F24.4D7-${crypto.randomUUID()}-Aa1!`;
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const reads: Promise<void>[] = [];
  const syncResponses: Array<{ status: number; results: unknown }> = [];
  for (const page of [pageA, pageB]) page.on("response", (response) => {
    if (new URL(response.url()).pathname !== "/functions/v1/sync-batch") return;
    reads.push(response.json().then((body) => {
      syncResponses.push({ status: response.status(), results: body.results });
    }).catch(() => {}));
  });
  let userCreated = false;
  let databaseConnected = false;
  let checkpoint = "fixture";
  const readRemote = async () => {
    const result = await database.query<RemoteAnimal>(
      "select revision, observacoes, client_op_id, client_tx_id, client_recorded_at, server_received_at, created_at, updated_at from public.animais where id = $1 and fazenda_id = $2",
      [animalId, farmId],
    );
    expect(result.rows).toHaveLength(1);
    return result.rows[0];
  };

  try {
    const { error: userError } = await admin.auth.admin.createUser({ id: userId, email, password, email_confirm: true });
    if (userError) throw userError;
    userCreated = true;
    await database.connect();
    databaseConnected = true;
    await database.query("insert into public.fazendas (id, nome) values ($1, 'F24.4D7 E2E')", [farmId]);
    await database.query("insert into public.user_fazendas (user_id, fazenda_id, role, is_primary, accepted_at) values ($1, $2, 'owner', true, now())", [userId, farmId]);
    await database.query("insert into public.animais (id, fazenda_id, identificacao, sexo, observacoes) values ($1, $2, 'F24-4D7-E2E', 'F', 'baseline')", [animalId, farmId]);
    const initialRemote = await readRemote();
    const [initialA, initialB] = await Promise.all([
      prepareClient(pageA, email, password, farmId, animalId),
      prepareClient(pageB, email, password, farmId, animalId),
    ]);
    let revision = Number(initialRemote.revision);
    expect(initialA).toMatchObject({ userId, revision, observacoes: "baseline" });
    expect(initialB).toMatchObject({ userId, revision, observacoes: "baseline" });
    expect(revision).toBeGreaterThanOrEqual(1);

    // Playwright changes Date.now and new Date in each BrowserContext page.
    // Timers, PostgreSQL and Edge keep their real clocks.
    const serverBase = new Date((await database.query("select clock_timestamp() as now")).rows[0].now).getTime();
    const futureA = new Date(serverBase + SKEW_MS).toISOString();
    const pastB = new Date(serverBase - SKEW_MS).toISOString();
    await Promise.all([pageA.clock.setFixedTime(futureA), pageB.clock.setFixedTime(pastB)]);
    const [clockA, clockB] = await Promise.all([
      pageA.evaluate(() => ({ now: Date.now(), date: new Date().toISOString() })),
      pageB.evaluate(() => ({ now: Date.now(), date: new Date().toISOString() })),
    ]);
    expect(clockA).toEqual({ now: Date.parse(futureA), date: futureA });
    expect(clockB).toEqual({ now: Date.parse(pastB), date: pastB });
    expect(clockA.now - clockB.now).toBe(2 * SKEW_MS);
    console.log(JSON.stringify({ checkpoint: "clocks", serverBase: new Date(serverBase).toISOString(), A: clockA, B: clockB, skewMinutes: { A: 55, B: -55 } }));

    for (const first of ["B", "A"] as const) {
      checkpoint = `round-${first}-first`;
      await Promise.all([contextA.setOffline(true), contextB.setOffline(true)]);
      const noteA = `future-A-${crypto.randomUUID()}`;
      const noteB = `past-B-${crypto.randomUUID()}`;
      const [queuedA, queuedB] = await Promise.all([
        createUpdate(pageA, farmId, animalId, noteA),
        createUpdate(pageB, farmId, animalId, noteB),
      ]);
      expect(queuedA.expectedRevision).toBe(revision);
      expect(queuedB.expectedRevision).toBe(revision);
      const [offlineA, offlineB] = await Promise.all([
        inspectClient(pageA, animalId, queuedA.txId, queuedA.opId),
        inspectClient(pageB, animalId, queuedB.txId, queuedB.opId),
      ]);
      expect(offlineA.op).toMatchObject({ clientRecordedAt: futureA, createdAt: futureA, expectedRevision: revision, serverReceivedAt: null, occurredAt: null, remoteCreatedAt: null, remoteUpdatedAt: null });
      expect(offlineB.op).toMatchObject({ clientRecordedAt: pastB, createdAt: pastB, expectedRevision: revision, serverReceivedAt: null, occurredAt: null, remoteCreatedAt: null, remoteUpdatedAt: null });
      expect(offlineA.gesture?.createdAt).toBe(futureA);
      expect(offlineB.gesture?.createdAt).toBe(pastB);
      expect(offlineA.animal).toMatchObject({ revision, observacoes: noteA });
      expect(offlineB.animal).toMatchObject({ revision, observacoes: noteB });
      console.log(JSON.stringify({ checkpoint, stage: "offline", revision, queuedA, queuedB, offlineA, offlineB, remote: await readRemote() }));

      const firstContext = first === "A" ? contextA : contextB;
      const firstPage = first === "A" ? pageA : pageB;
      const firstQueued = first === "A" ? queuedA : queuedB;
      const firstNote = first === "A" ? noteA : noteB;
      const secondContext = first === "A" ? contextB : contextA;
      const secondPage = first === "A" ? pageB : pageA;
      const secondQueued = first === "A" ? queuedB : queuedA;
      await firstContext.setOffline(false);
      await syncGesture(firstPage, firstQueued.txId);
      const afterFirst = await readRemote();
      const firstLocal = await inspectClient(firstPage, animalId, firstQueued.txId, firstQueued.opId);
      expect(afterFirst).toMatchObject({ revision: String(revision + 1), observacoes: firstNote, client_op_id: firstQueued.opId, client_tx_id: firstQueued.txId });
      expect(firstLocal.gesture).toMatchObject({ status: "DONE", syncResult: "APPLIED", audit: expect.arrayContaining([expect.objectContaining({ op_id: firstQueued.opId, status: "APPLIED" })]) });
      expect(firstLocal.op).toBeUndefined();
      expect(new Date(afterFirst.updated_at).getTime()).toBeLessThan(Date.parse(futureA));
      expect(new Date(afterFirst.updated_at).getTime()).toBeGreaterThan(Date.parse(pastB));
      expect(new Date(afterFirst.client_recorded_at).toISOString()).toBe(first === "A" ? futureA : pastB);
      expect(new Date(afterFirst.server_received_at).toISOString()).toBe(new Date(initialRemote.server_received_at).toISOString());
      console.log(JSON.stringify({ checkpoint, stage: "first-applied", first, remote: afterFirst, local: firstLocal }));

      await firstContext.setOffline(true);
      await secondContext.setOffline(false);
      await syncGesture(secondPage, secondQueued.txId);
      const afterStale = await readRemote();
      const staleLocal = await inspectClient(secondPage, animalId, secondQueued.txId, secondQueued.opId);
      expect(afterStale).toEqual(afterFirst);
      expect(staleLocal.gesture).toMatchObject({ status: "REJECTED", syncResult: "REJECTED", nextAttemptAt: undefined, audit: expect.arrayContaining([expect.objectContaining({ op_id: secondQueued.opId, status: "CONFLICT", reason_code: "STATE_REVISION_CONFLICT", retryable: false })]) });
      expect(staleLocal.op).toMatchObject({ expectedRevision: revision, syncState: "REJECTED", blockedReason: "STATE_REVISION_CONFLICT", nextAttemptAt: undefined });
      expect(staleLocal.rejections).toEqual(expect.arrayContaining([expect.objectContaining({ client_op_id: secondQueued.opId, reason_code: "STATE_REVISION_CONFLICT" })]));
      console.log(JSON.stringify({ checkpoint, stage: "stale-rejected", first, remote: afterStale, local: staleLocal }));

      await firstContext.setOffline(false);
      await Promise.all([pullClient(pageA, farmId), pullClient(pageB, farmId)]);
      const [finalA, finalB] = await Promise.all([
        inspectClient(pageA, animalId, queuedA.txId, queuedA.opId),
        inspectClient(pageB, animalId, queuedB.txId, queuedB.opId),
      ]);
      expect(finalA.animal).toMatchObject({ revision: revision + 1, observacoes: firstNote });
      expect(finalB.animal).toMatchObject({ revision: revision + 1, observacoes: firstNote });
      expect(finalA.obligations).toEqual([]);
      expect(finalB.obligations).toEqual([]);
      console.log(JSON.stringify({ checkpoint, stage: "after-pull", first, revisionBefore: revision, queuedA, queuedB, remote: afterStale, finalA, finalB }));
      revision += 1;
    }
    await Promise.all(reads);
    console.log(JSON.stringify({ scenario: "F24.4D7", initialRemote, finalRemote: await readRemote(), syncResponses }));
  } catch (error) {
    await Promise.all(reads);
    const diagnostics = await Promise.allSettled([
      inspectClient(pageA, animalId, "", ""),
      inspectClient(pageB, animalId, "", ""),
      ...(databaseConnected ? [readRemote()] : []),
    ]);
    console.log(JSON.stringify({ scenario: "F24.4D7-failure", checkpoint, syncResponses, diagnostics: diagnostics.map((entry) => entry.status === "fulfilled" ? entry.value : { unavailable: true }) }));
    throw error;
  } finally {
    await Promise.all([contextA.close(), contextB.close()]);
    if (databaseConnected) {
      await database.query("delete from public.animais where id = $1", [animalId]);
      await database.query("delete from public.user_fazendas where user_id = $1", [userId]);
      await database.query("delete from public.fazendas where id = $1", [farmId]);
      await database.end();
    }
    if (userCreated) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      expect.soft(error === null, "Fixture user cleanup").toBe(true);
    }
  }
});

test("F24.4D7: projeção reprodutiva usa tempo factual, não ordem de chegada", async ({ page }) => {
  await page.goto("/");
  const projection = await page.evaluate(async () => {
    const { rebuildReproductiveProjection } = await import("/src/lib/reproduction/status.ts");
    const older = {
      id: "older", fazenda_id: "farm", animal_id: "animal",
      occurred_at: "2026-01-01T00:00:00.000Z", deleted_at: null,
      details: { tipo: "IA" as const, payload: {}, deleted_at: null },
    };
    const future = {
      id: "future", fazenda_id: "farm", animal_id: "animal",
      occurred_at: "2027-01-01T00:00:00.000Z", deleted_at: null,
      details: { tipo: "cobertura" as const, payload: {}, deleted_at: null },
    };
    return {
      futureArrivesFirst: rebuildReproductiveProjection([future, older]),
      backdatedArrivesFirst: rebuildReproductiveProjection([older, future]),
    };
  });
  expect(projection.futureArrivesFirst).toMatchObject({ status: "SERVIDA", definingEventId: "future", definingEventDate: "2027-01-01T00:00:00.000Z" });
  expect(projection.backdatedArrivesFirst).toEqual(projection.futureArrivesFirst);
  console.log(JSON.stringify({ checkpoint: "reproductive-event-order", projection }));
});
