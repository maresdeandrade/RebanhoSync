import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

// The disposable fixture is restricted to the local Supabase stack.
const apiUrl = process.env.REBANHOSYNC_TEST_API_URL;
const anonKey = process.env.REBANHOSYNC_TEST_ANON_KEY;
const serviceRoleKey = process.env.REBANHOSYNC_TEST_SERVICE_ROLE_KEY;
const databaseUrl = process.env.REBANHOSYNC_TEST_DB_URL;

test.use({ trace: "off", screenshot: "off" });

type LocalSnapshot = {
  revision: number;
  observacoes: string;
};

async function prepareClient(page: Page, email: string, password: string, farmId: string, animalId: string) {
  await page.goto("/");
  return page.evaluate(async ({ email, password, farmId, animalId }) => {
    const { supabase } = await import("/src/lib/supabase.ts");
    const { db } = await import("/src/lib/offline/db.ts");
    const { establishLocalOwnership, evaluateLocalOwnership } = await import("/src/lib/offline/ownership.ts");
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
    return {
      userId: data.session.user.id,
      ownership: (await evaluateLocalOwnership(data.session.user.id)).status,
      clientId: localStorage.getItem("gestao_agro_client_id"),
      revision: animal.revision,
      observacoes: animal.observacoes,
    };
  }, { email, password, farmId, animalId });
}

async function createOfflineUpdate(page: Page, farmId: string, animalId: string, note: string) {
  return page.evaluate(async ({ farmId, animalId, note }) => {
    const { createGesture } = await import("/src/lib/offline/ops.ts");
    const { db } = await import("/src/lib/offline/db.ts");
    const txId = await createGesture(farmId, [{ table: "animais", action: "UPDATE", record: { id: animalId, observacoes: note } }]);
    const ops = await db.queue_ops.where("client_tx_id").equals(txId).toArray();
    if (ops.length !== 1) throw new Error(`EXPECTED_ONE_QUEUED_OP_GOT_${ops.length}`);
    return { txId, opId: ops[0].client_op_id, expectedRevision: ops[0].expected_revision, syncState: ops[0].sync_state };
  }, { farmId, animalId, note });
}

async function readClient(page: Page, txId: string, opId: string, animalId: string, otherOpId: string) {
  return page.evaluate(async ({ txId, opId, animalId, otherOpId }) => {
    const { db } = await import("/src/lib/offline/db.ts");
    const animal = await db.state_animais.get(animalId);
    const gesture = await db.queue_gestures.get(txId);
    const op = await db.queue_ops.get(opId);
    const otherOp = await db.queue_ops.get(otherOpId);
    const rejections = await db.queue_rejections.where("client_tx_id").equals(txId).toArray();
    const obligations = await db.sync_reconcile_obligations.toArray();
    return {
      animal: animal && { revision: animal.revision, observacoes: animal.observacoes } as LocalSnapshot,
      gesture: gesture && { status: gesture.status, syncResult: gesture.sync_result, nextAttemptAt: gesture.next_attempt_at, audit: gesture.operation_results },
      op: op && { syncState: op.sync_state, blockedReason: op.blocked_reason, nextAttemptAt: op.next_attempt_at, expectedRevision: op.expected_revision },
      otherOpPresent: Boolean(otherOp),
      rejections: rejections.map(({ reason_code, client_op_id }) => ({ reason_code, client_op_id })),
      obligations: obligations.map(({ key, scope }) => ({ key, scope })),
    };
  }, { txId, opId, animalId, otherOpId });
}

async function syncClient(page: Page, txId: string, farmId: string) {
  await page.evaluate(async ({ txId, farmId }) => {
    const { db } = await import("/src/lib/offline/db.ts");
    const { processGesture, drainReconciliationObligations } = await import("/src/lib/offline/syncWorker.ts");
    const gesture = await db.queue_gestures.get(txId);
    if (!gesture) throw new Error("QUEUED_GESTURE_MISSING");
    await processGesture(gesture);
    await drainReconciliationObligations(farmId);
  }, { txId, farmId });
}

test("F24.4D2: dois clientes offline com a mesma revision, A aplicado e B em conflito terminal", async ({ browser }) => {
  expect(apiUrl && anonKey && serviceRoleKey && databaseUrl, "Local Auth, Edge and PostgreSQL environment is required").toBeTruthy();
  expect(new URL(apiUrl!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  expect(new URL(databaseUrl!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);

  const admin = createClient(apiUrl!, serviceRoleKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const database = new Client({ connectionString: databaseUrl });
  const userId = crypto.randomUUID();
  const farmId = crypto.randomUUID();
  const animalId = crypto.randomUUID();
  const email = `f24-4d2-${userId}@example.test`;
  const password = `F24.4D2-${crypto.randomUUID()}-Aa1!`;
  const noteA = `device-a-${crypto.randomUUID()}`;
  const noteB = `device-b-${crypto.randomUUID()}`;
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  let userCreated = false;
  let databaseConnected = false;
  try {
    const { error: userError } = await admin.auth.admin.createUser({ id: userId, email, password, email_confirm: true });
    if (userError) throw userError;
    userCreated = true;
    await database.connect();
    databaseConnected = true;
    await database.query("insert into public.fazendas (id, nome) values ($1, 'F24.4D2 E2E')", [farmId]);
    await database.query("insert into public.user_fazendas (user_id, fazenda_id, role, is_primary, accepted_at) values ($1, $2, 'owner', true, now())", [userId, farmId]);
    await database.query("insert into public.animais (id, fazenda_id, identificacao, sexo, observacoes) values ($1, $2, 'F24-4D2-E2E', 'F', 'baseline')", [animalId, farmId]);

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const [initialA, initialB] = await Promise.all([
      prepareClient(pageA, email, password, farmId, animalId),
      prepareClient(pageB, email, password, farmId, animalId),
    ]);
    expect(initialA.userId).toBe(userId);
    expect(initialB.userId).toBe(userId);
    expect(initialA.ownership).toBe("OWNED");
    expect(initialB.ownership).toBe("OWNED");
    expect(initialA.revision).toBe(initialB.revision);
    expect(initialA.revision).toBeGreaterThanOrEqual(1);
    expect(initialA.observacoes).toBe("baseline");
    expect(initialB.observacoes).toBe("baseline");

    await Promise.all([contextA.setOffline(true), contextB.setOffline(true)]);
    const [queuedA, queuedB] = await Promise.all([
      createOfflineUpdate(pageA, farmId, animalId, noteA),
      createOfflineUpdate(pageB, farmId, animalId, noteB),
    ]);
    expect(queuedA.expectedRevision).toBe(initialA.revision);
    expect(queuedB.expectedRevision).toBe(initialB.revision);
    expect(queuedA.opId).not.toBe(queuedB.opId);
    const [beforeA, beforeB] = await Promise.all([
      readClient(pageA, queuedA.txId, queuedA.opId, animalId, queuedB.opId),
      readClient(pageB, queuedB.txId, queuedB.opId, animalId, queuedA.opId),
    ]);
    expect(beforeA.otherOpPresent).toBe(false);
    expect(beforeB.otherOpPresent).toBe(false);
    expect(beforeA.animal?.observacoes).toBe(noteA);
    expect(beforeB.animal?.observacoes).toBe(noteB);
    console.log(JSON.stringify({ checkpoint: "both-offline", initialRevision: initialA.revision, queuedA, queuedB }));

    await contextA.setOffline(false);
    await syncClient(pageA, queuedA.txId, farmId);
    const afterA = await database.query<{ revision: string; observacoes: string }>("select revision, observacoes from public.animais where id = $1", [animalId]);
    const localA = await readClient(pageA, queuedA.txId, queuedA.opId, animalId, queuedB.opId);
    console.log(JSON.stringify({ checkpoint: "after-A", initialRevision: initialA.revision, remote: afterA.rows[0], local: localA }));
    expect(Number(afterA.rows[0].revision)).toBe(initialA.revision + 1);
    expect(afterA.rows[0].observacoes).toBe(noteA);
    expect(localA.gesture?.syncResult).toBe("APPLIED");
    expect(localA.op).toBeUndefined();

    await contextB.setOffline(false);
    await syncClient(pageB, queuedB.txId, farmId);
    const afterB = await database.query<{ revision: string; observacoes: string }>("select revision, observacoes from public.animais where id = $1", [animalId]);
    expect(afterB.rows).toEqual(afterA.rows);
    const localB = await readClient(pageB, queuedB.txId, queuedB.opId, animalId, queuedA.opId);
    expect(localB.gesture?.status).toBe("REJECTED");
    expect(localB.gesture?.syncResult).toBe("REJECTED");
    expect(localB.gesture?.nextAttemptAt).toBeUndefined();
    expect(localB.op).toMatchObject({ syncState: "REJECTED", blockedReason: "STATE_REVISION_CONFLICT", expectedRevision: initialB.revision });
    expect(localB.op?.nextAttemptAt).toBeUndefined();
    expect(localB.gesture?.audit).toEqual(expect.arrayContaining([expect.objectContaining({ op_id: queuedB.opId, status: "CONFLICT", reason_code: "STATE_REVISION_CONFLICT", retryable: false })]));
    expect(localB.rejections).toEqual(expect.arrayContaining([expect.objectContaining({ client_op_id: queuedB.opId, reason_code: "STATE_REVISION_CONFLICT" })]));

    // Existing reconciliation runs in syncClient. Refresh A through the product pull path.
    await pageA.evaluate(async (farmId) => {
      const { pullDataForFarm } = await import("/src/lib/offline/pull.ts");
      await pullDataForFarm(farmId, ["animais"], { mode: "merge" });
    }, farmId);
    const finalA = await readClient(pageA, queuedA.txId, queuedA.opId, animalId, queuedB.opId);
    const finalB = await readClient(pageB, queuedB.txId, queuedB.opId, animalId, queuedA.opId);
    expect(finalA.animal).toMatchObject({ revision: initialA.revision + 1, observacoes: noteA });
    expect(finalB.animal).toMatchObject({ revision: initialA.revision + 1, observacoes: noteA });
    console.log(JSON.stringify({ scenario: "F24.4D2", initialRevision: initialA.revision, expectedRevisionA: queuedA.expectedRevision, expectedRevisionB: queuedB.expectedRevision, opIdA: queuedA.opId, opIdB: queuedB.opId, remoteAfterA: afterA.rows[0], remoteAfterB: afterB.rows[0], localA: finalA, localB: finalB }));
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
