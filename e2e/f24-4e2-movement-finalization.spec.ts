import { chromium, expect, test, type Page } from "@playwright/test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
const api = process.env.REBANHOSYNC_TEST_API_URL!;
const anon = process.env.REBANHOSYNC_TEST_ANON_KEY!;
const service = process.env.REBANHOSYNC_TEST_SERVICE_ROLE_KEY!;
const url = process.env.REBANHOSYNC_TEST_DB_URL!;
let sql: Client;
let owner: string;
let farm: string,
  otherFarm: string,
  animal: string,
  lots: string[],
  email: string,
  password: string;

test.beforeEach(async () => {
  if (process.env.REBANHOSYNC_DISPOSABLE_LOCAL_DB !== "1")
    throw new Error("LOCAL_DISPOSABLE_REQUIRED");
  for (const value of [api, url])
    expect(new URL(value).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  const user = crypto.randomUUID();
  owner = user;
  farm = crypto.randomUUID();
  otherFarm = crypto.randomUUID();
  animal = crypto.randomUUID();
  lots = Array.from({ length: 4 }, () => crypto.randomUUID());
  email = `movement-final-${user}@example.test`;
  password = `Aa1!-${crypto.randomUUID()}`;
  const admin = createClient(api, service, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.createUser({
    id: user,
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  sql = new Client({ connectionString: url });
  await sql.connect();
  await sql.query(
    "insert into public.fazendas(id,nome) values($1,'movement-final'),($2,'movement-final-other')",
    [farm, otherFarm],
  );
  for (const id of [farm, otherFarm])
    await sql.query(
      "insert into public.user_fazendas(user_id,fazenda_id,role,accepted_at) values($1,$2,'owner',now())",
      [user, id],
    );
  for (const id of lots)
    await sql.query(
      "insert into public.lotes(id,fazenda_id,nome) values($1,$2,$1::uuid::text)",
      [id, farm],
    );
  await sql.query(
    "insert into public.animais(id,fazenda_id,identificacao,sexo,lote_id) values($1,$2,$1::uuid::text,'F',$3)",
    [animal, farm, lots[0]],
  );
});
test.afterEach(async () => {
  console.log(JSON.stringify({ retained_local_fixture: farm, animal }));
  await sql?.end();
});

async function prepare(page: Page) {
  await page.goto("/");
  await page.evaluate(
    async ({ email, password, farm }) => {
      const { supabase } = await import("/src/lib/supabase.ts");
      const { db } = await import("/src/lib/offline/db.ts");
      const { establishLocalOwnership } =
        await import("/src/lib/offline/ownership.ts");
      const { stopSyncWorker } = await import("/src/lib/offline/syncWorker.ts");
      const { pullDataForFarm } = await import("/src/lib/offline/pull.ts");
      await import("/src/lib/events/buildEventGesture.ts");
      await import("/src/lib/offline/ops.ts");
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.session)
        throw new Error(
          `AUTH_PREPARATION_FAILED:${error?.code ?? "AUTH_MISSING"}:${error?.status ?? 0}`,
        );
      stopSyncWorker();
      await db.open();
      await establishLocalOwnership(data.session);
      await pullDataForFarm(farm, ["animais", "lotes"], { mode: "merge" });
    },
    { email, password, farm },
  );
}
async function move(page: Page, destination: string) {
  return page.evaluate(
    async ({ farm, animal, destination }) => {
      const { buildEventGesture } =
        await import("/src/lib/events/buildEventGesture.ts");
      const { createGesture } = await import("/src/lib/offline/ops.ts");
      const { db } = await import("/src/lib/offline/db.ts");
      const built = buildEventGesture({
        dominio: "movimentacao",
        fazendaId: farm,
        animalId: animal,
        toLoteId: destination,
        fromLoteId: (await db.state_animais.get(animal))!.lote_id,
        occurredAt: "2026-10-01T12:00:00.000Z",
      });
      const tx = await createGesture(farm, built.ops);
      const ops = await db.queue_ops.where("client_tx_id").equals(tx).toArray();
      if (ops.length !== 1 || ops[0].table !== "movement_v1")
        throw new Error("GENERIC_MOVEMENT_QUEUE");
      return { tx, event: built.eventId, op: ops[0] };
    },
    { farm, animal, destination },
  );
}
async function sync(page: Page, tx: string) {
  await page.evaluate(
    async ({ tx, farm }) => {
      const { db } = await import("/src/lib/offline/db.ts");
      const { processGesture, drainReconciliationObligations } =
        await import("/src/lib/offline/syncWorker.ts");
      const gesture = await db.queue_gestures.get(tx);
      if (!gesture) throw new Error("MISSING_GESTURE");
      await processGesture(gesture);
      await drainReconciliationObligations(farm);
    },
    { tx, farm },
  );
}
async function read(page: Page, tx: string) {
  return page.evaluate(
    async ({ tx, animal }) => {
      const { db } = await import("/src/lib/offline/db.ts");
      return {
        animal: await db.state_animais.get(animal),
        gesture: await db.queue_gestures.get(tx),
        ops: await db.queue_ops.where("client_tx_id").equals(tx).toArray(),
      };
    },
    { tx, animal },
  );
}
async function remote(
  count: number,
  destination: string,
  head: string,
  version = count,
) {
  const row = (
    await sql.query(
      `select a.lote_id,a.movement_version::text,a.movement_head_event_id,
    (select count(*)::int from public.eventos where animal_id=a.id and dominio='movimentacao') facts,
    (select count(*)::int from public.eventos_movimentacao d join public.eventos e on e.id=d.evento_id where e.animal_id=a.id) details
    from public.animais a where a.id=$1`,
      [animal],
    )
  ).rows[0];
  expect(row).toMatchObject({
    lote_id: destination,
    movement_version: String(version),
    movement_head_event_id: head,
    facts: count,
    details: count,
  });
}
async function done(page: Page, tx: string, destination: string) {
  const row = await read(page, tx);
  expect(row.ops).toHaveLength(0);
  expect(row.gesture?.status).toBe("DONE");
  expect(row.animal?.lote_id).toBe(destination);
}
test("E1 online service → queue → worker → Edge → RPC → pull", async ({
  page,
}) => {
  await prepare(page);
  const queued = await move(page, lots[1]);
  await sync(page, queued.tx);
  await remote(1, lots[1], queued.event);
  await done(page, queued.tx, lots[1]);
});
test("E2 offline simple", async ({ page, context }) => {
  await prepare(page);
  await context.setOffline(true);
  const queued = await move(page, lots[1]);
  await context.setOffline(false);
  await sync(page, queued.tx);
  await remote(1, lots[1], queued.event);
  await done(page, queued.tx, lots[1]);
});
test("E3 offline A→B→C→D causal chain", async ({ page, context }) => {
  await prepare(page);
  await context.setOffline(true);
  const chain = [];
  for (const lot of lots.slice(1)) chain.push(await move(page, lot));
  expect(chain[1].op.record.movement_base).toMatchObject({
    kind: "after_movement",
    event_id: chain[0].event,
    command_digest: chain[0].op.command_digest,
  });
  await context.setOffline(false);
  for (const queued of chain) await sync(page, queued.tx);
  await remote(3, lots[3], chain[2].event);
  for (const queued of chain) await done(page, queued.tx, lots[3]);
});
test("E4 reverse arrival resolves original pending without resending children", async ({
  page,
  context,
}) => {
  await prepare(page);
  await context.setOffline(true);
  const chain = [];
  for (const lot of lots.slice(1)) chain.push(await move(page, lot));
  await context.setOffline(false);
  await sync(page, chain[2].tx);
  await sync(page, chain[1].tx);
  expect((await read(page, chain[2].tx)).ops[0].sync_state).toBe(
    "BLOCKED_DEPENDENCY",
  );
  await sync(page, chain[0].tx);
  await remote(3, lots[3], chain[2].event);
  for (const queued of chain) await done(page, queued.tx, lots[3]);
  const row = await read(page, chain[2].tx);
  expect(row.gesture?.operation_results?.[0]).toMatchObject({
    status: "BLOCKED_DEPENDENCY",
    movement_effective_result: "STATE_APPLIED",
    movement_effective_decision: {
      event_id: chain[2].event,
      fazenda_id: farm,
      result: "STATE_APPLIED",
    },
  });
});
test("E5 independent BrowserContexts competing snapshots converge", async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  try {
    const pa = await a.newPage(),
      pb = await b.newPage();
    await prepare(pa);
    await prepare(pb);
    await a.setOffline(true);
    await b.setOffline(true);
    const qa = await move(pa, lots[1]),
      qb = await move(pb, lots[2]);
    await a.setOffline(false);
    await b.setOffline(false);
    await Promise.all([sync(pa, qa.tx), sync(pb, qb.tx)]);
    const ra = await read(pa, qa.tx),
      rb = await read(pb, qb.tx);
    expect([ra.gesture?.status, rb.gesture?.status].sort()).toEqual([
      "DONE",
      "REJECTED",
    ]);
    const winner = ra.gesture?.status === "DONE" ? qa : qb;
    await remote(2, winner.op.record.to_lote_id, winner.event, 1);
    // Explicit pull after both requests, including the winner's later competitor history.
    for (const p of [pa, pb])
      await p.evaluate(async (farm) => {
        const { pullDataForFarm } = await import("/src/lib/offline/pull.ts");
        await pullDataForFarm(
          farm,
          ["animais", "eventos", "eventos_movimentacao"],
          { mode: "merge" },
        );
      }, farm);
    expect((await read(pa, qa.tx)).animal?.lote_id).toBe(
      (await read(pb, qb.tx)).animal?.lote_id,
    );
  } finally {
    await a.close();
    await b.close();
  }
});
test("E6 lost ACK after commit and restart replays same command", async ({
  page,
}) => {
  await prepare(page);
  const queued = await move(page, lots[1]);
  let applied = false;
  await page.route("**/functions/v1/sync-batch", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    expect(body.results[0].status).toBe("APPLIED");
    await remote(1, lots[1], queued.event);
    applied = true;
    await route.abort("failed");
  });
  await sync(page, queued.tx);
  expect(applied).toBe(true);
  await page.unroute("**/functions/v1/sync-batch");
  await page.reload();
  await prepare(page);
  await page.evaluate(async (tx) => {
    const { db } = await import("/src/lib/offline/db.ts");
    await db.queue_gestures.update(tx, {
      status: "PENDING",
      next_attempt_at: undefined,
    });
  }, queued.tx);
  expect((await read(page, queued.tx)).ops[0].record).toEqual(queued.op.record);
  await sync(page, queued.tx);
  await remote(1, lots[1], queued.event);
  await done(page, queued.tx, lots[1]);
});
test("E7 native persistent BrowserContext restart preserves selector and digest", async () => {
  const root = resolve("test-results");
  mkdirSync(root, { recursive: true });
  const profile = mkdtempSync(root + sep + "movement-profile-");
  if (!resolve(profile).startsWith(root + sep))
    throw new Error("PROFILE_PATH_INVALID");
  let context = await chromium.launchPersistentContext(profile, {
    headless: true,
    baseURL: "http://127.0.0.1:4184",
  });
  try {
    let page = await context.newPage();
    await prepare(page);
    await context.setOffline(true);
    const queued = await move(page, lots[1]);
    await context.close();
    context = await chromium.launchPersistentContext(profile, {
      headless: true,
      baseURL: "http://127.0.0.1:4184",
    });
    await context.route("**/functions/v1/sync-batch", (route) =>
      route.abort("failed"),
    );
    page = await context.newPage();
    await prepare(page);
    const reopened = (await read(page, queued.tx)).ops[0];
    expect(reopened.record).toEqual(queued.op.record);
    expect(reopened.command_digest).toBe(queued.op.command_digest);
    await context.unroute("**/functions/v1/sync-batch");
    await page.evaluate(async (tx) => {
      const { db } = await import("/src/lib/offline/db.ts");
      await db.queue_gestures.update(tx, {
        status: "PENDING",
        next_attempt_at: undefined,
      });
      const ops = await db.queue_ops.where("client_tx_id").equals(tx).toArray();
      for (const op of ops)
        await db.queue_ops.update(op.client_op_id, {
          next_attempt_at: undefined,
        });
    }, queued.tx);
    await sync(page, queued.tx);
    await remote(1, lots[1], queued.event);
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
test("E8 farm switch preserves pending A without contaminating B", async ({
  page,
  context,
}) => {
  await prepare(page);
  await context.setOffline(true);
  const queued = await move(page, lots[1]);
  await context.setOffline(false);
  await page.evaluate(async (other) => {
    const { setActiveFarmId } = await import("/src/lib/storage.ts");
    const { pullDataForFarm } = await import("/src/lib/offline/pull.ts");
    setActiveFarmId(other);
    await pullDataForFarm(other, ["animais"], { mode: "replace" });
  }, otherFarm);
  expect((await read(page, queued.tx)).ops[0].record).toEqual(queued.op.record);
  await page.evaluate(async (farm) => {
    const { setActiveFarmId } = await import("/src/lib/storage.ts");
    setActiveFarmId(farm);
  }, farm);
  await sync(page, queued.tx);
  await remote(1, lots[1], queued.event);
});
test("R2 ACK then pull failure, restart and farm switch preserves the reconciliation obligation", async ({
  page,
}) => {
  await prepare(page);
  const queued = await move(page, lots[1]);
  await page.route("**/rest/v1/animais*", (route) =>
    route.request().url().includes(farm)
      ? route.abort("failed")
      : route.continue(),
  );
  await sync(page, queued.tx);
  expect((await read(page, queued.tx)).ops[0].sync_state).toBe("RECONCILE");
  await page.evaluate(async () => {
    const { db } = await import("/src/lib/offline/db.ts");
    db.close();
  });
  await page.reload();
  await page.evaluate(async (other) => {
    const { stopSyncWorker } = await import("/src/lib/offline/syncWorker.ts");
    const { db } = await import("/src/lib/offline/db.ts");
    const { setActiveFarmId } = await import("/src/lib/storage.ts");
    const { pullDataForFarm } = await import("/src/lib/offline/pull.ts");
    stopSyncWorker();
    await db.open();
    setActiveFarmId(other);
    await pullDataForFarm(
      other,
      ["animais", "eventos", "eventos_movimentacao"],
      { mode: "replace" },
    );
  }, otherFarm);
  const retained = await read(page, queued.tx);
  expect(retained.animal?.lote_id).toBe(lots[1]);
  expect(retained.ops[0].record).toEqual(queued.op.record);
  expect(
    await page.evaluate(
      async ({ farm, event }) => {
        const { db } = await import("/src/lib/offline/db.ts");
        return {
          obligation: !!(await db.sync_reconcile_obligations.get(
            `${farm}:movement-v1`,
          )),
          detail: !!(await db.event_eventos_movimentacao.get(event)),
        };
      },
      { farm, event: queued.event },
    ),
  ).toEqual({ obligation: true, detail: true });
  await page.unroute("**/rest/v1/animais*");
  await page.evaluate(async (farm) => {
    const { setActiveFarmId } = await import("/src/lib/storage.ts");
    const { drainReconciliationObligations } =
      await import("/src/lib/offline/syncWorker.ts");
    setActiveFarmId(farm);
    await drainReconciliationObligations(farm);
  }, farm);
  await done(page, queued.tx, lots[1]);
});
for (const kind of ["venda", "obito", "tombstone"] as const)
  test(`${kind === "venda" ? "E9" : "E10"} concurrent ${kind} wins server eligibility boundary`, async ({
    page,
    context,
  }) => {
    await prepare(page);
    await context.setOffline(true);
    const queued = await move(page, lots[1]);
    // Independent writer on the same row while this device remains offline.
    await sql.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    await sql.query(
      kind === "tombstone"
        ? "update public.animais set deleted_at=clock_timestamp() where id=$1"
        : "update public.animais set status=$2 where id=$1",
      kind === "tombstone"
        ? [animal]
        : [animal, kind === "venda" ? "vendido" : "morto"],
    );
    await context.setOffline(false);
    await sync(page, queued.tx);
    const row = await read(page, queued.tx);
    expect(row.ops).toHaveLength(0);
    expect(row.gesture?.status).toBe("REJECTED");
    expect(row.animal?.lote_id).toBe(lots[0]);
    expect(String(row.animal?.movement_version)).toBe("1");
    if (kind === "tombstone") expect(row.animal?.deleted_at).toBeTruthy();
    else
      expect(row.animal?.status).toBe(kind === "venda" ? "vendido" : "morto");
    expect(row.gesture?.operation_results?.[0].canonical_result?.status).toBe(
      "PROJECTION_CONFLICT",
    );
    await remote(1, lots[0], null!, 1);
  });
