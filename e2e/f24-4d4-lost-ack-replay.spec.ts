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

type SentOperation = {
  client_tx_id: string;
  ops: Array<{ client_op_id: string; expected_revision?: number }>;
};

async function readLocal(page: Page, animalId: string, txId: string, opId: string) {
  return page.evaluate(async ({ animalId, txId, opId }) => {
    const { db } = await import("/src/lib/offline/db.ts");
    const animal = await db.state_animais.get(animalId);
    const gesture = await db.queue_gestures.get(txId);
    const op = await db.queue_ops.get(opId);
    return {
      animal: animal && { revision: animal.revision, observacoes: animal.observacoes },
      gesture: gesture && {
        status: gesture.status,
        syncResult: gesture.sync_result,
        retryCount: gesture.retry_count,
        nextAttemptAt: gesture.next_attempt_at,
        lastError: gesture.last_error,
        audit: gesture.operation_results,
      },
      op: op && {
        clientOpId: op.client_op_id,
        clientTxId: op.client_tx_id,
        expectedRevision: op.expected_revision,
        syncState: op.sync_state,
      },
      obligations: (await db.sync_reconcile_obligations.toArray()).map(({ key, scope }) => ({ key, scope })),
    };
  }, { animalId, txId, opId });
}

test("F24.4D4: resposta perdida após apply remoto reenvia a mesma operação sem segundo apply", async ({ browser }) => {
  test.setTimeout(60_000);
  expect(apiUrl && anonKey && serviceRoleKey && databaseUrl, "Local Auth, Edge and PostgreSQL environment is required").toBeTruthy();
  expect(new URL(apiUrl!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  expect(new URL(databaseUrl!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);

  const admin = createClient(apiUrl!, serviceRoleKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const database = new Client({ connectionString: databaseUrl });
  const userId = crypto.randomUUID();
  const farmId = crypto.randomUUID();
  const animalId = crypto.randomUUID();
  const email = `f24-4d4-${userId}@example.test`;
  const password = `F24.4D4-${crypto.randomUUID()}-Aa1!`;
  const note = `lost-ack-${crypto.randomUUID()}`;
  const context = await browser.newContext();
  let userCreated = false;
  let databaseConnected = false;
  try {
    const { error: userError } = await admin.auth.admin.createUser({ id: userId, email, password, email_confirm: true });
    if (userError) throw userError;
    userCreated = true;
    await database.connect();
    databaseConnected = true;
    await database.query("insert into public.fazendas (id, nome) values ($1, 'F24.4D4 E2E')", [farmId]);
    await database.query("insert into public.user_fazendas (user_id, fazenda_id, role, is_primary, accepted_at) values ($1, $2, 'owner', true, now())", [userId, farmId]);
    await database.query("insert into public.animais (id, fazenda_id, identificacao, sexo, observacoes) values ($1, $2, 'F24-4D4-E2E', 'F', 'baseline')", [animalId, farmId]);
    const remoteBefore = (await database.query<RemoteAnimal>("select revision, observacoes, client_op_id, client_tx_id from public.animais where id = $1", [animalId])).rows[0];
    const initialRevision = Number(remoteBefore.revision);
    expect(initialRevision).toBeGreaterThanOrEqual(1);

    const page = await context.newPage();
    await page.goto("/");
    const snapshot = await page.evaluate(async ({ email, password, farmId, animalId }) => {
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
    expect(snapshot).toMatchObject({ userId, revision: initialRevision, observacoes: "baseline" });

    const queued = await page.evaluate(async ({ farmId, animalId, note }) => {
      const { createGesture } = await import("/src/lib/offline/ops.ts");
      const { db } = await import("/src/lib/offline/db.ts");
      const txId = await createGesture(farmId, [{ table: "animais", action: "UPDATE", record: { id: animalId, observacoes: note } }]);
      const ops = await db.queue_ops.where("client_tx_id").equals(txId).toArray();
      if (ops.length !== 1) throw new Error(`EXPECTED_ONE_QUEUED_OP_GOT_${ops.length}`);
      return { txId, opId: ops[0].client_op_id, expectedRevision: ops[0].expected_revision };
    }, { farmId, animalId, note });
    expect(queued.expectedRevision).toBe(initialRevision);

    let firstRequest: SentOperation | undefined;
    let firstServerResult: { status?: string; op_id?: string } | undefined;
    let remoteAfterFirst: RemoteAnimal | undefined;
    let interceptionError: string | undefined;
    await page.route("**/functions/v1/sync-batch", async (route) => {
      if (route.request().method() !== "POST" || firstRequest) {
        await route.continue();
        return;
      }
      firstRequest = JSON.parse(route.request().postData() ?? "{}") as SentOperation;
      try {
        const response = await route.fetch();
        const body = await response.json() as { results?: Array<{ status?: string; op_id?: string }> };
        firstServerResult = body.results?.[0];
        remoteAfterFirst = (await database.query<RemoteAnimal>("select revision, observacoes, client_op_id, client_tx_id from public.animais where id = $1", [animalId])).rows[0];
      } catch (error) {
        interceptionError = String(error);
      } finally {
        // The real Edge response is withheld only after the PostgreSQL probe.
        await route.abort("failed");
      }
    });

    await page.evaluate(async (txId) => {
      const { db } = await import("/src/lib/offline/db.ts");
      const { processGesture } = await import("/src/lib/offline/syncWorker.ts");
      const gesture = await db.queue_gestures.get(txId);
      if (!gesture) throw new Error("QUEUED_GESTURE_MISSING");
      await processGesture(gesture);
    }, queued.txId);
    await page.unroute("**/functions/v1/sync-batch");

    expect(interceptionError).toBeUndefined();
    expect(firstRequest).toMatchObject({ client_tx_id: queued.txId, ops: [{ client_op_id: queued.opId, expected_revision: initialRevision }] });
    expect(firstServerResult).toMatchObject({ status: "APPLIED", op_id: queued.opId });
    expect(remoteAfterFirst).toMatchObject({ revision: String(initialRevision + 1), observacoes: note, client_op_id: queued.opId, client_tx_id: queued.txId });
    const afterLostAck = await readLocal(page, animalId, queued.txId, queued.opId);
    expect(afterLostAck.gesture).toMatchObject({ status: "PENDING", retryCount: 1 });
    expect(afterLostAck.gesture?.nextAttemptAt).toBeTruthy();
    expect(afterLostAck.op).toMatchObject({ clientOpId: queued.opId, clientTxId: queued.txId, expectedRevision: initialRevision });
    console.log(JSON.stringify({ checkpoint: "ack-lost", queued, firstServerResult, remoteAfterFirst, local: afterLostAck }));

    let replayRequest: SentOperation | undefined;
    await page.route("**/functions/v1/sync-batch", async (route) => {
      if (route.request().method() === "POST") replayRequest = JSON.parse(route.request().postData() ?? "{}") as SentOperation;
      await route.continue();
    });
    const replayResponsePromise = page.waitForResponse((response) => response.url().endsWith("/sync-batch") && response.request().method() === "POST");
    await page.evaluate(async () => {
      const { startSyncWorker } = await import("/src/lib/offline/syncWorker.ts");
      startSyncWorker();
    });
    await context.setOffline(true);
    await context.setOffline(false);
    const replayResponse = await replayResponsePromise;
    const replayBody = await replayResponse.json() as { results?: Array<{ status?: string; op_id?: string; reason_code?: string }> };
    await expect.poll(async () => (await readLocal(page, animalId, queued.txId, queued.opId)).gesture?.status, { timeout: 20_000 }).toBe("DONE");
    await page.evaluate(async () => {
      const { stopSyncWorker } = await import("/src/lib/offline/syncWorker.ts");
      stopSyncWorker();
    });
    await page.unroute("**/functions/v1/sync-batch");

    expect(replayRequest).toMatchObject(firstRequest!);
    expect(replayBody.results?.[0]).toMatchObject({ status: "APPLIED", op_id: queued.opId });
    const remoteAfterReplay = (await database.query<RemoteAnimal>("select revision, observacoes, client_op_id, client_tx_id from public.animais where id = $1", [animalId])).rows[0];
    expect(remoteAfterReplay).toEqual(remoteAfterFirst);
    const afterReplay = await readLocal(page, animalId, queued.txId, queued.opId);
    expect(afterReplay.gesture).toMatchObject({ status: "DONE", syncResult: "APPLIED" });
    expect(afterReplay.gesture?.audit).toEqual(expect.arrayContaining([expect.objectContaining({ op_id: queued.opId, status: "APPLIED" })]));
    expect(afterReplay.op).toBeUndefined();

    await page.evaluate(async (farmId) => {
      const { drainReconciliationObligations } = await import("/src/lib/offline/syncWorker.ts");
      const { pullDataForFarm } = await import("/src/lib/offline/pull.ts");
      await drainReconciliationObligations(farmId);
      await pullDataForFarm(farmId, ["animais"], { mode: "merge" });
    }, farmId);
    const afterPull = await readLocal(page, animalId, queued.txId, queued.opId);
    expect(afterPull.animal).toMatchObject({ revision: initialRevision + 1, observacoes: note });
    expect(afterPull.obligations).toEqual([]);
    console.log(JSON.stringify({ scenario: "F24.4D4", queued, firstServerResult, replayResult: replayBody.results?.[0], remoteBefore, remoteAfterFirst, remoteAfterReplay, afterLostAck, afterReplay, afterPull }));
  } finally {
    await context.close();
    if (databaseConnected) {
      await database.query("delete from public.animais where id = $1", [animalId]);
      await database.query("delete from public.user_fazendas where user_id = $1", [userId]);
      await database.query("delete from public.fazendas where id = $1", [farmId]);
      await database.end();
    }
    if (userCreated) await admin.auth.admin.deleteUser(userId);
  }
});
