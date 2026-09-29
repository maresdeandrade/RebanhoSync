import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

const apiUrl = process.env.REBANHOSYNC_TEST_API_URL;
const anonKey = process.env.REBANHOSYNC_TEST_ANON_KEY;
const serviceRoleKey = process.env.REBANHOSYNC_TEST_SERVICE_ROLE_KEY;
const databaseUrl = process.env.REBANHOSYNC_TEST_DB_URL;

test.use({ trace: "off", screenshot: "off" });

type RemoteAnimal = {
  revision: string;
  observacoes: string;
  client_op_id: string | null;
  client_tx_id: string | null;
};

async function prepareClient(page: Page, email: string, password: string, farmId: string, animalId: string) {
  await page.goto("/");
  return page.evaluate(async ({ email, password, farmId, animalId }) => {
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
  }, { email, password, farmId, animalId });
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

async function inspectClient(page: Page, animalId: string, txIds: string[], opIds: string[]) {
  return page.evaluate(async ({ animalId, txIds, opIds }) => {
    const { db } = await import("/src/lib/offline/db.ts");
    const animal = await db.state_animais.get(animalId);
    const gestures = await Promise.all(txIds.map(async (txId) => {
      const gesture = await db.queue_gestures.get(txId);
      return gesture && {
        txId, status: gesture.status, syncResult: gesture.sync_result,
        nextAttemptAt: gesture.next_attempt_at, audit: gesture.operation_results,
      };
    }));
    const ops = await Promise.all(opIds.map(async (opId) => {
      const op = await db.queue_ops.get(opId);
      return op && {
        opId, txId: op.client_tx_id, expectedRevision: op.expected_revision,
        syncState: op.sync_state, blockedReason: op.blocked_reason,
        nextAttemptAt: op.next_attempt_at,
      };
    }));
    const rejections = (await db.queue_rejections.toArray())
      .filter((rejection) => txIds.includes(rejection.client_tx_id))
      .map(({ client_tx_id, client_op_id, reason_code }) => ({ client_tx_id, client_op_id, reason_code }));
    const obligations = (await db.sync_reconcile_obligations.toArray()).map(({ key, scope }) => ({ key, scope }));
    return {
      animal: animal && { revision: animal.revision, observacoes: animal.observacoes },
      gestures, ops, rejections, obligations,
    };
  }, { animalId, txIds, opIds });
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

test("F24.4D5: conflito terminal, nova intenção e convergência após reconnect alternado", async ({ browser }) => {
  test.setTimeout(90_000);
  expect(apiUrl && anonKey && serviceRoleKey && databaseUrl, "Local Auth, Edge and PostgreSQL environment is required").toBeTruthy();
  expect(new URL(apiUrl!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  expect(new URL(databaseUrl!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);

  const admin = createClient(apiUrl!, serviceRoleKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const database = new Client({ connectionString: databaseUrl });
  const userId = crypto.randomUUID();
  const farmId = crypto.randomUUID();
  const animalId = crypto.randomUUID();
  const email = `f24-4d5-${userId}@example.test`;
  const password = `F24.4D5-${crypto.randomUUID()}-Aa1!`;
  const noteA = `state-a-${crypto.randomUUID()}`;
  const noteBStale = `state-b-stale-${crypto.randomUUID()}`;
  const noteB2 = `state-b2-${crypto.randomUUID()}`;
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  let userCreated = false;
  let databaseConnected = false;
  const readRemote = async () => {
    const result = await database.query<RemoteAnimal>(
      "select revision, observacoes, client_op_id, client_tx_id from public.animais where id = $1 and fazenda_id = $2",
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
    await database.query("insert into public.fazendas (id, nome) values ($1, 'F24.4D5 E2E')", [farmId]);
    await database.query("insert into public.user_fazendas (user_id, fazenda_id, role, is_primary, accepted_at) values ($1, $2, 'owner', true, now())", [userId, farmId]);
    await database.query("insert into public.animais (id, fazenda_id, identificacao, sexo, observacoes) values ($1, $2, 'F24-4D5-E2E', 'F', 'baseline')", [animalId, farmId]);
    const initialRemote = await readRemote();
    const revisionN = Number(initialRemote.revision);
    expect(revisionN).toBeGreaterThanOrEqual(1);

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const [initialA, initialB] = await Promise.all([
      prepareClient(pageA, email, password, farmId, animalId),
      prepareClient(pageB, email, password, farmId, animalId),
    ]);
    expect(initialA).toMatchObject({ userId, revision: revisionN, observacoes: "baseline" });
    expect(initialB).toMatchObject({ userId, revision: revisionN, observacoes: "baseline" });
    console.log(JSON.stringify({ checkpoint: "initial", animalId, farmId, remote: initialRemote, initialA, initialB }));

    await Promise.all([contextA.setOffline(true), contextB.setOffline(true)]);
    const [queuedA, staleB] = await Promise.all([
      createUpdate(pageA, farmId, animalId, noteA),
      createUpdate(pageB, farmId, animalId, noteBStale),
    ]);
    expect(queuedA.expectedRevision).toBe(revisionN);
    expect(staleB.expectedRevision).toBe(revisionN);
    expect(queuedA.opId).not.toBe(staleB.opId);
    expect(queuedA.txId).not.toBe(staleB.txId);
    const [offlineA, offlineB] = await Promise.all([
      inspectClient(pageA, animalId, [queuedA.txId], [queuedA.opId, staleB.opId]),
      inspectClient(pageB, animalId, [staleB.txId], [staleB.opId, queuedA.opId]),
    ]);
    expect(offlineA.ops[0]).toMatchObject({ opId: queuedA.opId, expectedRevision: revisionN });
    expect(offlineA.ops[1]).toBeUndefined();
    expect(offlineB.ops[0]).toMatchObject({ opId: staleB.opId, expectedRevision: revisionN });
    expect(offlineB.ops[1]).toBeUndefined();
    expect(offlineA.animal).toMatchObject({ observacoes: noteA });
    expect(offlineB.animal).toMatchObject({ observacoes: noteBStale });
    console.log(JSON.stringify({ checkpoint: "both-offline", queuedA, staleB, offlineA, offlineB }));

    await contextA.setOffline(false);
    await syncGesture(pageA, queuedA.txId);
    const remoteAfterA = await readRemote();
    const afterAAck = await inspectClient(pageA, animalId, [queuedA.txId], [queuedA.opId]);
    expect(remoteAfterA).toMatchObject({ revision: String(revisionN + 1), observacoes: noteA, client_op_id: queuedA.opId, client_tx_id: queuedA.txId });
    expect(afterAAck.gestures[0]).toMatchObject({ status: "DONE", syncResult: "APPLIED" });
    expect(afterAAck.gestures[0]?.audit).toEqual(expect.arrayContaining([expect.objectContaining({ op_id: queuedA.opId, status: "APPLIED" })]));
    expect(afterAAck.ops[0]).toBeUndefined();
    console.log(JSON.stringify({ checkpoint: "a-after-ack", remote: remoteAfterA, local: afterAAck }));
    await contextA.setOffline(true);

    await contextB.setOffline(false);
    await syncGesture(pageB, staleB.txId);
    const remoteAfterStale = await readRemote();
    const afterBConflict = await inspectClient(pageB, animalId, [staleB.txId], [staleB.opId]);
    expect(remoteAfterStale).toEqual(remoteAfterA);
    expect(afterBConflict.gestures[0]).toMatchObject({ status: "REJECTED", syncResult: "REJECTED" });
    expect(afterBConflict.gestures[0]?.nextAttemptAt).toBeUndefined();
    expect(afterBConflict.gestures[0]?.audit).toEqual(expect.arrayContaining([
      expect.objectContaining({ op_id: staleB.opId, status: "CONFLICT", reason_code: "STATE_REVISION_CONFLICT", retryable: false }),
    ]));
    expect(afterBConflict.ops[0]).toMatchObject({ opId: staleB.opId, txId: staleB.txId, expectedRevision: revisionN, syncState: "REJECTED", blockedReason: "STATE_REVISION_CONFLICT" });
    expect(afterBConflict.ops[0]?.nextAttemptAt).toBeUndefined();
    expect(afterBConflict.rejections).toEqual(expect.arrayContaining([
      expect.objectContaining({ client_tx_id: staleB.txId, client_op_id: staleB.opId, reason_code: "STATE_REVISION_CONFLICT" }),
    ]));
    console.log(JSON.stringify({ checkpoint: "b-after-conflict", remote: remoteAfterStale, local: afterBConflict }));

    await pullClient(pageB, farmId);
    const afterBPull = await inspectClient(pageB, animalId, [staleB.txId], [staleB.opId]);
    expect(afterBPull.animal).toMatchObject({ revision: revisionN + 1, observacoes: noteA });
    expect(afterBPull.gestures[0]?.status).toBe("REJECTED");
    expect(afterBPull.ops[0]).toMatchObject({ opId: staleB.opId, expectedRevision: revisionN, syncState: "REJECTED" });
    console.log(JSON.stringify({ checkpoint: "b-after-pull", local: afterBPull }));

    const newB = await createUpdate(pageB, farmId, animalId, noteB2);
    expect(newB.opId).not.toBe(staleB.opId);
    expect(newB.txId).not.toBe(staleB.txId);
    expect(newB.expectedRevision).toBe(revisionN + 1);
    const beforeNewBSync = await inspectClient(pageB, animalId, [staleB.txId, newB.txId], [staleB.opId, newB.opId]);
    expect(beforeNewBSync.ops[0]).toMatchObject({ opId: staleB.opId, syncState: "REJECTED", expectedRevision: revisionN });
    expect(beforeNewBSync.ops[1]).toMatchObject({ opId: newB.opId, txId: newB.txId, expectedRevision: revisionN + 1 });
    console.log(JSON.stringify({ checkpoint: "b-new-intention", newB, local: beforeNewBSync }));

    await syncGesture(pageB, newB.txId);
    const remoteAfterNewB = await readRemote();
    const afterBNewAck = await inspectClient(pageB, animalId, [staleB.txId, newB.txId], [staleB.opId, newB.opId]);
    expect(remoteAfterNewB).toMatchObject({ revision: String(revisionN + 2), observacoes: noteB2, client_op_id: newB.opId, client_tx_id: newB.txId });
    expect(afterBNewAck.gestures[1]).toMatchObject({ status: "DONE", syncResult: "APPLIED" });
    expect(afterBNewAck.gestures[1]?.audit).toEqual(expect.arrayContaining([expect.objectContaining({ op_id: newB.opId, status: "APPLIED" })]));
    expect(afterBNewAck.ops[1]).toBeUndefined();
    expect(afterBNewAck.ops[0]).toMatchObject({ opId: staleB.opId, syncState: "REJECTED" });
    console.log(JSON.stringify({ checkpoint: "b-new-after-ack", remote: remoteAfterNewB, local: afterBNewAck }));

    await pullClient(pageB, farmId);
    const finalB = await inspectClient(pageB, animalId, [staleB.txId, newB.txId], [staleB.opId, newB.opId]);
    await contextB.setOffline(true);
    await contextA.setOffline(false);
    await pullClient(pageA, farmId);
    const finalA = await inspectClient(pageA, animalId, [queuedA.txId], [queuedA.opId]);
    const finalRemote = await readRemote();
    const expectedFinal = { revision: revisionN + 2, observacoes: noteB2 };
    expect(finalRemote).toMatchObject({ revision: String(expectedFinal.revision), observacoes: expectedFinal.observacoes });
    expect(finalA.animal).toMatchObject(expectedFinal);
    expect(finalB.animal).toMatchObject(expectedFinal);
    expect(finalA.obligations).toEqual([]);
    expect(finalB.obligations).toEqual([]);
    console.log(JSON.stringify({ scenario: "F24.4D5", initialRevision: revisionN, queuedA, staleB, newB, remoteAfterA, remoteAfterStale, remoteAfterNewB, finalRemote, finalA, finalB }));
  } finally {
    await Promise.all([contextA.close(), contextB.close()]);
    if (databaseConnected) {
      await database.query("delete from public.animais where id = $1", [animalId]);
      await database.query("delete from public.user_fazendas where user_id = $1", [userId]);
      await database.query("delete from public.fazendas where id = $1", [farmId]);
      await database.end();
    }
    if (userCreated) await admin.auth.admin.deleteUser(userId);
  }
});
