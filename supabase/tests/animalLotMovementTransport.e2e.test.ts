import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { createServer } from "node:http";
import type { MovementV1 } from "../functions/sync-batch/movement-v1";

const apiUrl = process.env.REBANHOSYNC_TEST_API_URL;
const anonKey = process.env.REBANHOSYNC_TEST_ANON_KEY;
const serviceKey = process.env.REBANHOSYNC_TEST_SERVICE_ROLE_KEY;
const dbUrl = process.env.REBANHOSYNC_TEST_DB_URL;
function isDisposableLocalEnvironment() {
  if (
    process.env.REBANHOSYNC_DISPOSABLE_LOCAL_DB !== "1" ||
    !apiUrl || !anonKey || !serviceKey || !dbUrl
  )
    return false;
  try {
    return [apiUrl, dbUrl].every((value) =>
      ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname),
    );
  } catch {
    return false;
  }
}
const describeLocal = isDisposableLocalEnvironment()
  ? describe.sequential
  : describe.skip;
const farm = crypto.randomUUID(),
  foreignFarm = crypto.randomUUID();
const lots = Array.from({ length: 3 }, () => crypto.randomUUID()),
  foreignLot = crypto.randomUUID();
const users = [crypto.randomUUID(), crypto.randomUUID()];
const credentials = users.map((id) => ({
  email: `movement-http-${id}@example.test`,
  password: `A1-${crypto.randomUUID()}!`,
}));
let admin: SupabaseClient, db: Client, token: string, outsideToken: string;
type Result = Record<string, unknown> & {
  canonical_result?: Record<string, unknown>;
};
function command(
  id: string,
  overrides: Record<string, unknown> = {},
): MovementV1 {
  return {
    domain: "movement_v1",
    command: "apply_animal_lot",
    contract_version: 1,
    fazenda_id: farm,
    subject_type: "animal",
    subject_id: id,
    event_id: crypto.randomUUID(),
    client_op_id: crypto.randomUUID(),
    client_tx_id: crypto.randomUUID(),
    movement_mode: "operational",
    from_lote_id: lots[0],
    to_lote_id: lots[1],
    occurred_at: "2026-10-01T12:00:00.000Z",
    movement_base: {
      kind: "snapshot",
      movement_version: "0",
      head_event_id: null,
    },
    payload: { source: "movement-http-test" },
    detail_payload: { note: "transport retained" },
    ...overrides,
  } as MovementV1;
}
async function animal() {
  const id = crypto.randomUUID();
  await db.query(
    "insert into public.animais(id,fazenda_id,identificacao,sexo,lote_id) values($1,$2,$1::uuid::text,'F',$3)",
    [id, farm, lots[0]],
  );
  return id;
}
async function login(index = 0) {
  const client = createClient(apiUrl!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword(
    credentials[index]!,
  );
  if (error || !data.session)
    throw new Error(
      `Local Auth session failed: ${error?.message ?? "missing"}`,
    );
  return data.session.access_token;
}
function envelope(op: MovementV1, requestFarm = farm) {
  return {
    client_id: "movement-http-e2e",
    fazenda_id: requestFarm,
    client_tx_id: op.client_tx_id,
    ops: [op],
  };
}
async function request(
  op: MovementV1,
  options: { actor?: string; requestFarm?: string; url?: string } = {},
) {
  return fetch(options.url ?? `${apiUrl}/functions/v1/sync-batch`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.actor ?? token}`,
      apikey: anonKey!,
      "content-type": "application/json",
    },
    body: JSON.stringify(envelope(op, options.requestFarm)),
    signal: AbortSignal.timeout(20000),
  });
}
async function invoke(
  op: MovementV1,
  options: { actor?: string; requestFarm?: string } = {},
): Promise<Result> {
  const response = await request(op, options);
  const body = await response.json();
  if (response.status !== 200)
    throw new Error(
      `Local Edge HTTP ${response.status}: ${JSON.stringify(body)}`,
    );
  expect(body.client_tx_id).toBe(op.client_tx_id);
  expect(body.results).toHaveLength(1);
  expect(body.results[0].op_id).toBe(op.client_op_id);
  return body.results[0];
}
async function current(id: string) {
  return (
    await db.query(
      "select lote_id,movement_version,movement_head_event_id,revision from public.animais where id=$1",
      [id],
    )
  ).rows[0];
}
async function facts(op: MovementV1, n: number) {
  for (const [table, key] of [
    ["eventos", "id"],
    ["eventos_movimentacao", "evento_id"],
    ["animal_lot_movement_receipts", "event_id"],
  ]) {
    expect(
      (
        await db.query(
          `select count(*)::int n from public.${table} where ${key}=$1`,
          [op.event_id],
        )
      ).rows[0].n,
    ).toBe(n);
  }
}

describeLocal("F24.4E2.1B real Auth→Edge→RPC→PostgreSQL", () => {
  it("R5 real rejection, replay and identity divergence pass the ACK consumer", async () => {
    await import("fake-indexeddb/auto");
    const { db: local } = await import("../../src/lib/offline/db");
    const { recordMovementResults } =
      await import("../../src/lib/offline/movementReconciliation");
    const op = command(await animal(), { to_lote_id: crypto.randomUUID() });
    const rejected = await invoke(op),
      replay = await invoke(op);
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.canonical_result?.client_op_id).toBeUndefined();
    expect(replay.canonical_result?.replayed).toBe(true);
    const different = {
      ...op,
      client_op_id: crypto.randomUUID(),
      client_tx_id: crypto.randomUUID(),
      to_lote_id: lots[2],
    };
    const conflict = await invoke(different);
    expect(conflict).toMatchObject({
      status: "CONFLICT",
      reason_code: "IDENTITY_DIVERGENCE",
    });
    await local.open();
    for (const [input, response] of [
      [op, rejected],
      [op, replay],
      [different, conflict],
    ] as const) {
      expect(response.operation_identity).toEqual({
        fazenda_id: farm,
        event_id: input.event_id,
        client_op_id: input.client_op_id,
        client_tx_id: input.client_tx_id,
      });
      const gesture = {
        client_tx_id: input.client_tx_id,
        fazenda_id: farm,
        status: "PENDING",
        created_at: new Date().toISOString(),
        client_id: "test",
      };
      const operation = {
        client_op_id: input.client_op_id,
        client_tx_id: input.client_tx_id,
        table: "movement_v1",
        action: "INSERT",
        record: input,
        command_digest: String(
          response.canonical_result?.command_digest ?? "divergence",
        ),
        sync_state: "PENDING",
        created_at: gesture.created_at,
      };
      await local.queue_gestures.put(gesture as never);
      await local.queue_ops.put(operation as never);
      await recordMovementResults(
        gesture as never,
        [operation as never],
        [response as never],
      );
      expect((await local.queue_ops.get(input.client_op_id))?.sync_state).toBe(
        "RECONCILE",
      );
      await local.queue_ops.delete(input.client_op_id);
      await local.queue_gestures.delete(input.client_tx_id);
    }
    local.close();
  });
  it("R6 generic animal movement is blocked at HTTP and direct PostgREST; controls remain valid", async () => {
    const id = await animal(),
      event = crypto.randomUUID(),
      tx = crypto.randomUUID();
    const base = {
      id: event,
      animal_id: id,
      lote_id: lots[0],
      dominio: "movimentacao",
      occurred_at: "2026-10-01T12:00:00.000Z",
      occurred_on: "2026-10-01",
      payload: {},
    };
    const detail = {
      evento_id: event,
      from_lote_id: lots[0],
      to_lote_id: lots[1],
      payload: {},
    };
    const generic = async (ops: unknown[]) => {
      const response = await fetch(`${apiUrl}/functions/v1/sync-batch`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          apikey: anonKey!,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          fazenda_id: farm,
          client_id: "closure-regression",
          client_tx_id: tx,
          ops,
        }),
      });
      expect(response.status).toBe(200);
      return (await response.json()).results;
    };
    const result = await generic([
      {
        client_op_id: crypto.randomUUID(),
        table: "eventos",
        action: "INSERT",
        record: base,
      },
      {
        client_op_id: crypto.randomUUID(),
        table: "eventos_movimentacao",
        action: "INSERT",
        record: detail,
      },
    ]);
    expect(result.map((row: Result) => row.status)).toEqual([
      "REJECTED",
      "REJECTED",
    ]);
    for (const [table, key] of [
      ["eventos", "id"],
      ["eventos_movimentacao", "evento_id"],
      ["animal_lot_movement_receipts", "event_id"],
      ["animal_lot_movement_effect_decisions", "event_id"],
    ])
      expect(
        (
          await db.query(
            `select count(*)::int n from public.${table} where ${key}=$1`,
            [event],
          )
        ).rows[0].n,
      ).toBe(0);
    const member = createClient(apiUrl!, anonKey!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    expect(
      (await member.from("eventos").insert({ ...base, fazenda_id: farm })).error
        ?.message,
    ).toContain("GENERIC_ANIMAL_MOVEMENT_WRITER_DISABLED");
    expect(
      (
        await member
          .from("eventos_movimentacao")
          .insert({ ...detail, fazenda_id: farm })
      ).error?.message,
    ).toContain("GENERIC_ANIMAL_MOVEMENT_WRITER_DISABLED");
    expect(
      (
        await db.query(
          "select has_table_privilege('authenticated','public.eventos','INSERT') fact, has_table_privilege('authenticated','public.eventos_movimentacao','INSERT') detail, pg_has_role('authenticated','rebanhosync_movement_executor','MEMBER') executor",
        )
      ).rows[0],
    ).toEqual({ fact: true, detail: true, executor: false });
    expect((await invoke(command(id))).canonical_result?.status).toBe(
      "STATE_APPLIED",
    );
    const initial = crypto.randomUUID();
    expect(
      (
        await member
          .from("animais")
          .insert({
            id: initial,
            fazenda_id: farm,
            identificacao: initial,
            sexo: "F",
            lote_id: lots[0],
          })
      ).error,
    ).toBeNull();
    const pasture = crypto.randomUUID(),
      lotEvent = crypto.randomUUID();
    await db.query(
      "insert into public.pastos(id,fazenda_id,nome) values($1,$2,'closure pasture')",
      [pasture, farm],
    );
    const controls = await generic([
      {
        client_op_id: crypto.randomUUID(),
        table: "eventos",
        action: "INSERT",
        record: { ...base, id: lotEvent, animal_id: null },
      },
      {
        client_op_id: crypto.randomUUID(),
        table: "eventos_movimentacao",
        action: "INSERT",
        record: { evento_id: lotEvent, to_pasto_id: pasture, payload: {} },
      },
      {
        client_op_id: crypto.randomUUID(),
        table: "eventos",
        action: "INSERT",
        record: { ...base, id: crypto.randomUUID(), dominio: "pesagem" },
      },
    ]);
    expect(controls.map((row: Result) => row.status)).toEqual([
      "APPLIED",
      "APPLIED",
      "APPLIED",
    ]);
  });
  async function awaitMembershipVisibility() {
    // The runner may have just reloaded PostgREST after applying local schema.
    // Await authenticated membership visibility in setup; never retry a command/ACK.
    const memberClient = createClient(apiUrl!, anonKey!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let visible = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      const { data, error } = await memberClient
        .from("user_fazendas")
        .select("role")
        .eq("user_id", users[0]!)
        .eq("fazenda_id", farm)
        .single();
      if (!error && data?.role === "owner") {
        visible = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (!visible)
      throw new Error(
        "Local authenticated membership not ready after schema reload",
      );
  }

  function assertDisposableLocalEnvironment() {
    if (
      process.env.REBANHOSYNC_DISPOSABLE_LOCAL_DB !== "1" ||
      ![apiUrl!, dbUrl!].every((value) =>
        ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname),
      )
    )
      throw new Error("Designated disposable LOCAL environment required");
  }

  beforeAll(async () => {
    assertDisposableLocalEnvironment();
    admin = createClient(apiUrl!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    db = new Client({ connectionString: dbUrl });
    await db.connect();
    for (let i = 0; i < users.length; i++) {
      const { error } = await admin.auth.admin.createUser({
        id: users[i],
        ...credentials[i]!,
        email_confirm: true,
      });
      if (error) throw new Error(error.message);
    }
    await db.query(
      "insert into public.fazendas(id,nome) values($1,'Movement HTTP A'),($2,'Movement HTTP B')",
      [farm, foreignFarm],
    );
    await db.query(
      "insert into public.user_fazendas(user_id,fazenda_id,role) values($1,$2,'owner')",
      [users[0], farm],
    );
    for (const id of lots)
      await db.query(
        "insert into public.lotes(id,fazenda_id,nome) values($1,$2,$1::uuid::text)",
        [id, farm],
      );
    await db.query(
      "insert into public.lotes(id,fazenda_id,nome) values($1,$2,'Foreign HTTP lot')",
      [foreignLot, foreignFarm],
    );
    token = await login();
    outsideToken = await login(1);
    await awaitMembershipVisibility();
  });
  afterAll(async () => {
    // Immutable facts remain in this designated local environment; never delete receipts.
    console.log(
      `MOVEMENT_HTTP_FIXTURES=${JSON.stringify({ client_id: "movement-http-e2e", farm, foreignFarm, users })}`,
    );
    await db?.end();
  });
  it("T1 simple movement crosses Auth/Edge/RPC with one fact/detail/receipt and committed state", async () => {
    const id = await animal(),
      op = command(id),
      result = await invoke(op);
    expect(result).toMatchObject({
      status: "APPLIED",
      state_effect: true,
      canonical_result: {
        status: "STATE_APPLIED",
        event_id: op.event_id,
        client_op_id: op.client_op_id,
        client_tx_id: op.client_tx_id,
        fazenda_id: farm,
        actor_id: users[0],
        replayed: false,
      },
    });
    await facts(op, 1);
    expect(await current(id)).toMatchObject({
      lote_id: lots[1],
      movement_version: "1",
      movement_head_event_id: op.event_id,
    });
    expect(
      (
        await db.query(
          "select payload from public.eventos_movimentacao where evento_id=$1",
          [op.event_id],
        )
      ).rows[0].payload,
    ).toEqual(op.detail_payload);
  });
  it("T2 overlapping HTTP operations preserve both facts and accept only one snapshot effect", async () => {
    const id = await animal(),
      a = command(id),
      b = command(id, { to_lote_id: lots[2] });
    // Hold the subject row until both actual Edge RPC backend processes are waiting.
    const blocker = new Client({ connectionString: dbUrl });
    await blocker.connect();
    await blocker.query("begin");
    await blocker.query(
      "select id from public.animais where id=$1 for update",
      [id],
    );
    const running = Promise.all([invoke(a), invoke(b)]);
    const outcome = running.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    let overlap = false;
    try {
      for (let i = 0; i < 180; i++) {
        const { rows } = await db.query(
          "select count(*)::int n from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%apply_animal_lot_movement_v1%'",
        );
        if (rows[0].n >= 2) {
          overlap = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      await blocker.query("commit");
      const settled = await outcome;
      if ("error" in settled) throw settled.error;
      expect(overlap).toBe(true);
      expect(settled.value!.map((x) => x.status).sort()).toEqual([
        "APPLIED",
        "CONFLICT",
      ]);
      expect(settled.value!.find((x) => x.status === "CONFLICT")).toMatchObject(
        {
          retryable: false,
          terminal: true,
          canonical_result: { status: "PROJECTION_CONFLICT" },
        },
      );
      await facts(a, 1);
      await facts(b, 1);
      expect((await current(id)).movement_version).toBe("1");
    } finally {
      await blocker.query("rollback");
      await blocker.end();
    }
  });
  it("T3 real HTTP response loss after committed Edge RPC replays exactly once", async () => {
    const id = await animal(),
      op = command(id);
    let committed = false;
    const proxy = createServer(async (req, res) => {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const upstream = await fetch(`${apiUrl}/functions/v1/sync-batch`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            apikey: anonKey!,
            "content-type": "application/json",
          },
          body: Buffer.concat(chunks),
        });
        await upstream.arrayBuffer(); // Never forward the ACK to the caller.
        committed =
          upstream.status === 200 &&
          (await current(id)).movement_version === "1";
        res.destroy();
      } catch {
        res.destroy();
      }
    });
    await new Promise<void>((resolve) => proxy.listen(0, "127.0.0.1", resolve));
    try {
      const address = proxy.address();
      if (!address || typeof address === "string")
        throw new Error("Proxy unavailable");
      await expect(
        request(op, { url: `http://127.0.0.1:${address.port}` }),
      ).rejects.toThrow();
      expect(committed).toBe(true);
      const before = await current(id),
        replay = await invoke(op);
      expect(replay).toMatchObject({
        status: "APPLIED",
        canonical_result: { status: "STATE_APPLIED", replayed: true },
      });
      expect(await current(id)).toEqual(before);
      await facts(op, 1);
    } finally {
      proxy.closeAllConnections();
      await new Promise<void>((resolve) => proxy.close(() => resolve()));
    }
  });
  it("T4 child HTTP request ends before parent; server autonomously resolves and replay preserves PENDING", async () => {
    const id = await animal(),
      parent = command(id);
    // PostgreSQL is the only digest authority; no TS canonicalization is introduced.
    const digest = (
      await db.query(
        "select public.animal_lot_movement_command_digest_v1($1::jsonb) digest",
        [
          JSON.stringify(
            Object.fromEntries(
              Object.entries(parent).filter(
                ([key]) => !["domain", "command"].includes(key),
              ),
            ),
          ),
        ],
      )
    ).rows[0].digest;
    const child = command(id, {
      from_lote_id: lots[1],
      to_lote_id: lots[2],
      movement_base: {
        kind: "after_movement",
        event_id: parent.event_id,
        command_digest: digest,
      },
    });
    const original = await invoke(child, { actor: await login() });
    expect(original).toMatchObject({
      status: "BLOCKED_DEPENDENCY",
      retryable: false,
      terminal: false,
      canonical_result: { status: "PENDING_CAUSAL_DEPENDENCY" },
    });
    await invoke(parent);
    expect(await current(id)).toMatchObject({
      lote_id: lots[2],
      movement_version: "2",
      movement_head_event_id: child.event_id,
    });
    const readClient = createClient(apiUrl!, anonKey!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await readClient
      .from("animal_lot_movement_effective_results")
      .select("result,effective_result")
      .eq("event_id", child.event_id)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({
      result: "PENDING_CAUSAL_DEPENDENCY",
      effective_result: "STATE_APPLIED",
    });
    expect((await invoke(child)).canonical_result).toEqual({
      ...original.canonical_result,
      replayed: true,
    });
    await facts(parent, 1);
    await facts(child, 1);
  });
  it("T5 invalid JWT, outsider, request-farm divergence and cross-farm lot create zero facts", async () => {
    const id = await animal();
    for (const actor of ["invalid-session", outsideToken]) {
      const op = command(id),
        response = await request(op, { actor });
      expect(response.status).toBe(actor === "invalid-session" ? 401 : 403);
      await facts(op, 0);
    }
    const divergent = command(id, { fazenda_id: foreignFarm });
    expect(await invoke(divergent)).toMatchObject({
      status: "REJECTED",
      reason_code: "MOVEMENT_FARM_MISMATCH",
    });
    await facts(divergent, 0);
    const foreign = command(id, { to_lote_id: foreignLot });
    expect(await invoke(foreign)).toMatchObject({
      status: "REJECTED",
      canonical_result: { status: "REJECTED" },
    });
    await facts(foreign, 0);
  });
  it("T6 fresh Auth session and new HTTP request return original receipt, even after a later movement", async () => {
    const id = await animal(),
      op = command(id),
      first = await invoke(op);
    const second = command(id, {
      from_lote_id: lots[1],
      to_lote_id: lots[2],
      movement_base: {
        kind: "snapshot",
        movement_version: "1",
        head_event_id: op.event_id,
      },
    });
    await invoke(second);
    const before = await current(id);
    expect(
      (await invoke(op, { actor: await login() })).canonical_result,
    ).toEqual({ ...first.canonical_result, replayed: true });
    expect(await current(id)).toEqual(before);
    await facts(op, 1);
  });
  it("recognized malformed movement cannot fall back to generic INSERT eventos", async () => {
    const id = await animal(),
      op = command(id, {
        command: undefined,
        table: "eventos",
        action: "INSERT",
        record: {
          id: crypto.randomUUID(),
          fazenda_id: farm,
          dominio: "movimentacao",
          animal_id: id,
          occurred_at: "2026-10-01T12:00:00Z",
        },
      });
    expect(await invoke(op)).toMatchObject({
      status: "REJECTED",
      reason_code: "MOVEMENT_ENVELOPE_INVALID",
    });
    await facts(op, 0);
    expect(
      (
        await db.query(
          "select count(*)::int n from public.eventos where id=$1",
          [(op.record as Record<string, unknown>).id],
        )
      ).rows[0].n,
    ).toBe(0);
    expect((await current(id)).movement_version).toBe("0");
  });
  it("history-only and identity divergence are domain results over HTTP 200", async () => {
    const id = await animal(),
      op = command(id, { movement_mode: "history_only", movement_base: null });
    expect(await invoke(op)).toMatchObject({
      status: "APPLIED",
      state_effect: false,
      canonical_result: { status: "HISTORY_ONLY" },
    });
    expect(await invoke({ ...op, to_lote_id: lots[2] })).toMatchObject({
      status: "CONFLICT",
      retryable: false,
      canonical_result: {
        status: "CONFLICT",
        reason_code: "IDENTITY_DIVERGENCE",
      },
    });
    expect((await current(id)).movement_version).toBe("0");
    await facts(op, 1);
  });
});
