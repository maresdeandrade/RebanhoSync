import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const connectionString = process.env.REBANHOSYNC_TEST_DB_URL;
function isDisposableMovementDatabase() {
  if (
    process.env.REBANHOSYNC_MOVEMENT_DISPOSABLE_DB !== "1" ||
    !connectionString
  )
    return false;
  try {
    const target = new URL(connectionString);
    return (
      ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
      target.pathname.startsWith("/f24_movement_")
    );
  } catch {
    return false;
  }
}
const describeDatabase = isDisposableMovementDatabase()
  ? describe.sequential
  : describe.skip;
type Command = Record<string, unknown>;
type Receipt = Record<string, unknown> & {
  status: string;
  command_digest: string;
};
const farm = crypto.randomUUID();
const otherFarm = crypto.randomUUID();
const user = crypto.randomUUID();
const outsider = crypto.randomUUID();
const lots = Array.from({ length: 4 }, () => crypto.randomUUID());
const otherLot = crypto.randomUUID();
let admin: Client;
let member: Client;

async function actorClient(actor = user, role = "authenticated") {
  // Real API session principal, not a postgres session that can SET ROLE to the executor.
  const actorUrl = new URL(connectionString!);
  actorUrl.username = "authenticator";
  const client = new Client({ connectionString: actorUrl.href });
  await client.connect();
  await client.query("select set_config('request.jwt.claim.sub',$1,false)", [
    actor,
  ]);
  await client.query("set statement_timeout='10s'");
  if (role === "authenticated") await client.query("set role authenticated");
  else await client.query("set role service_role");
  return client;
}

async function animal() {
  const id = crypto.randomUUID();
  await admin.query(
    "insert into public.animais(id,fazenda_id,identificacao,sexo,lote_id) values ($1::uuid,$2,$1::uuid::text,'F',$3)",
    [id, farm, lots[0]],
  );
  return id;
}

function command(animalId: string, overrides: Command = {}): Command {
  return {
    contract_version: 1,
    fazenda_id: farm,
    subject_type: "animal",
    subject_id: animalId,
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
    ...overrides,
  };
}

async function apply(input: Command, client = member): Promise<Receipt> {
  const result = await client.query<{ receipt: Receipt }>(
    "select public.apply_animal_lot_movement_v1($1::jsonb) as receipt",
    [JSON.stringify(input)],
  );
  return result.rows[0]!.receipt;
}

async function current(id: string) {
  return (
    await admin.query(
      "select lote_id,status,deleted_at,movement_version,movement_head_event_id,revision,nome from public.animais where id=$1",
      [id],
    )
  ).rows[0];
}

async function facts(input: Command, count: number) {
  for (const [table, key] of [
    ["eventos", "id"],
    ["eventos_movimentacao", "evento_id"],
    ["animal_lot_movement_receipts", "event_id"],
  ]) {
    expect(
      (
        await admin.query(
          `select count(*)::int as n from public.${table} where ${key}=$1`,
          [input.event_id],
        )
      ).rows[0].n,
    ).toBe(count);
  }
}

function after(parent: Command, digest: string) {
  return {
    kind: "after_movement",
    event_id: parent.event_id,
    command_digest: digest,
  };
}

describeDatabase("F24.4E2.1A Animal→Lote real PostgreSQL foundation", () => {
  beforeAll(async () => {
    const target = new URL(connectionString!);
    if (
      process.env.REBANHOSYNC_MOVEMENT_DISPOSABLE_DB !== "1" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
      !target.pathname.startsWith("/f24_movement_")
    ) {
      throw new Error(
        "Use validate-movement-server-foundation.mjs: isolated local database required",
      );
    }
    admin = new Client({ connectionString });
    await admin.connect();
    await admin.query(
      "insert into auth.users(id,email) values ($1::uuid,$1::uuid::text||'@movement.invalid'),($2::uuid,$2::uuid::text||'@movement.invalid')",
      [user, outsider],
    );
    await admin.query(
      "insert into public.fazendas(id,nome) values ($1,'Movement A'),($2,'Movement B')",
      [farm, otherFarm],
    );
    // Operational cowboy is authorized, without the lot-manager UPDATE policy.
    await admin.query(
      "insert into public.user_fazendas(user_id,fazenda_id,role) values ($1,$2,'cowboy')",
      [user, farm],
    );
    for (const id of lots)
      await admin.query(
        "insert into public.lotes(id,fazenda_id,nome) values ($1::uuid,$2,$1::uuid::text)",
        [id, farm],
      );
    await admin.query(
      "insert into public.lotes(id,fazenda_id,nome) values ($1,$2,'Other farm')",
      [otherLot, otherFarm],
    );
    member = await actorClient();
  });

  afterAll(async () => {
    // Facts/receipts are intentionally not deleted. The runner disposes the entire named DB.
    await member?.end();
    await admin?.end();
  });

  it("factual subject guard permits lot-pasture endpoints and removal but blocks animal details", async () => {
    const pastures = [crypto.randomUUID(), crypto.randomUUID()];
    await admin.query(
      "insert into public.pastos(id,fazenda_id,nome) values($1,$2,'Boundary A'),($3,$2,'Boundary B')",
      [pastures[0], farm, pastures[1]],
    );
    for (const destination of [pastures[1], null]) {
      const event = crypto.randomUUID();
      await member.query(
        "insert into public.eventos(id,fazenda_id,dominio,occurred_at,lote_id) values($1,$2,'movimentacao',now(),$3)",
        [event, farm, lots[0]],
      );
      await member.query(
        "insert into public.eventos_movimentacao(evento_id,fazenda_id,from_lote_id,to_lote_id,from_pasto_id,to_pasto_id) values($1,$2,$3,$3,$4,$5)",
        [event, farm, lots[0], pastures[0], destination],
      );
      expect(
        (
          await member.query(
            "select from_lote_id,to_lote_id,from_pasto_id,to_pasto_id from public.eventos_movimentacao where evento_id=$1",
            [event],
          )
        ).rows[0],
      ).toEqual({
        from_lote_id: lots[0],
        to_lote_id: lots[0],
        from_pasto_id: pastures[0],
        to_pasto_id: destination,
      });
    }
    const id = await animal();
    await expect(
      member.query(
        "insert into public.eventos(id,fazenda_id,dominio,occurred_at,animal_id) values($1,$2,'movimentacao',now(),$3)",
        [crypto.randomUUID(), farm, id],
      ),
    ).rejects.toMatchObject({
      code: "42501",
      message: "GENERIC_ANIMAL_MOVEMENT_WRITER_DISABLED",
    });
    const input = command(id);
    expect((await apply(input)).status).toBe("STATE_APPLIED");
    await expect(
      member.query(
        "insert into public.eventos_movimentacao(evento_id,fazenda_id,from_lote_id,to_lote_id) values($1,$2,$3,$4)",
        [input.event_id, farm, lots[0], lots[1]],
      ),
    ).rejects.toMatchObject({
      code: "42501",
      message: "GENERIC_ANIMAL_MOVEMENT_WRITER_DISABLED",
    });
    const outside = await actorClient(outsider);
    try {
      await expect(
        outside.query(
          "insert into public.eventos(id,fazenda_id,dominio,occurred_at,lote_id) values($1,$2,'movimentacao',now(),$3)",
          [crypto.randomUUID(), farm, lots[0]],
        ),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await outside.end();
    }
    await expect(
      member.query(
        "insert into public.eventos(id,fazenda_id,dominio,occurred_at,lote_id) values($1,$2,'movimentacao',now(),$3)",
        [crypto.randomUUID(), farm, otherLot],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("P1 simple movement commits fact/detail/state/receipt and increments both tokens once", async () => {
    const id = await animal();
    const input = command(id);
    const result = await apply(input);
    expect(result).toMatchObject({
      status: "STATE_APPLIED",
      movement_version_before: "0",
      movement_version_after: "1",
      head_after: input.event_id,
    });
    expect(await current(id)).toMatchObject({
      lote_id: lots[1],
      movement_version: "1",
      movement_head_event_id: input.event_id,
      revision: "2",
    });
    await facts(input, 1);
  });

  it("P2 replay after another movement and rename returns original receipt without effect", async () => {
    const id = await animal();
    const first = command(id);
    const original = await apply(first);
    const second = command(id, {
      from_lote_id: lots[1],
      to_lote_id: lots[2],
      movement_base: after(first, original.command_digest),
    });
    expect((await apply(second)).status).toBe("STATE_APPLIED");
    await member.query("update public.animais set nome='renamed' where id=$1", [
      id,
    ]);
    const before = await current(id);
    expect(await apply(first)).toEqual({ ...original, replayed: true });
    expect(await current(id)).toEqual(before);
    await facts(first, 1);
  });

  it("P3 same factual identity with different valid payload is IDENTITY_DIVERGENCE", async () => {
    const id = await animal();
    const input = command(id);
    await apply(input);
    expect(await apply({ ...input, to_lote_id: lots[2] })).toMatchObject({
      status: "CONFLICT",
      reason_code: "IDENTITY_DIVERGENCE",
    });
    await facts(input, 1);
    expect((await current(id)).movement_version).toBe("1");
  });

  it("P4 two overlapping sessions from one snapshot preserve both facts and accept one effect", async () => {
    const id = await animal();
    const first = command(id);
    const second = command(id, { to_lote_id: lots[2] });
    const clients = await Promise.all([actorClient(), actorClient()]);
    try {
      await clients[0]!.query("begin");
      const winner = await apply(first, clients[0]);
      expect(winner.status).toBe("STATE_APPLIED");
      const pid = (await clients[1]!.query("select pg_backend_pid() as pid"))
        .rows[0].pid;
      const competing = apply(second, clients[1]);
      let observedLockWait = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const activity = (
          await admin.query(
            "select wait_event_type from pg_stat_activity where pid=$1",
            [pid],
          )
        ).rows[0];
        if (activity?.wait_event_type === "Lock") {
          observedLockWait = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await clients[0]!.query("commit");
      expect((await competing).status).toBe("PROJECTION_CONFLICT");
      expect(observedLockWait).toBe(true);
      await facts(first, 1);
      await facts(second, 1);
      expect((await current(id)).movement_version).toBe("1");
    } finally {
      await clients[0]!.query("rollback");
      await Promise.all(clients.map((client) => client.end()));
    }
  });

  it("P5 concurrent rename advances generic revision, not location validity", async () => {
    const id = await animal();
    const offline = command(id);
    const editor = await actorClient();
    try {
      await editor.query(
        "update public.animais set nome='new cadastro' where id=$1",
        [id],
      );
    } finally {
      await editor.end();
    }
    expect(await current(id)).toMatchObject({
      revision: "2",
      movement_version: "0",
    });
    expect((await apply(offline)).status).toBe("STATE_APPLIED");
    expect(await current(id)).toMatchObject({
      nome: "new cadastro",
      revision: "3",
      movement_version: "1",
    });
  });

  it.each([
    ["future first", "12:55:00", "11:05:00"],
    ["past first", "11:05:00", "12:55:00"],
    ["same time", "12:00:00", "12:00:00"],
  ])(
    "operational clock authority: %s does not override accepted CAS",
    async (_label, firstTime, secondTime) => {
      const id = await animal();
      const first = command(id, { occurred_at: `2026-10-01T${firstTime}Z` });
      const second = command(id, {
        to_lote_id: lots[2],
        occurred_at: `2026-10-01T${secondTime}Z`,
      });
      expect((await apply(first)).status).toBe("STATE_APPLIED");
      expect((await apply(second)).status).toBe("PROJECTION_CONFLICT");
      await facts(first, 1);
      await facts(second, 1);
      expect(await current(id)).toMatchObject({
        lote_id: lots[1],
        movement_version: "1",
      });
    },
  );

  it.each(["vendido", "morto", "retirado"])(
    "P6 critical status %s invalidates old movement once",
    async (status) => {
      const id = await animal();
      const offline = command(id);
      await member.query(
        "update public.animais set status=$2,lote_id=null where id=$1",
        [id, status],
      );
      expect((await current(id)).movement_version).toBe("1");
      expect((await apply(offline)).status).toBe("PROJECTION_CONFLICT");
      expect(await current(id)).toMatchObject({
        status,
        lote_id: null,
        movement_version: "1",
      });
      await facts(offline, 1);
    },
  );

  it("P7 tombstone invalidates token and blocks projection while keeping valid fact", async () => {
    const id = await animal();
    const offline = command(id);
    await member.query(
      "update public.animais set deleted_at=now() where id=$1",
      [id],
    );
    expect((await current(id)).movement_version).toBe("1");
    expect((await apply(offline)).status).toBe("PROJECTION_CONFLICT");
    expect((await current(id)).lote_id).toBe(lots[0]);
    await facts(offline, 1);
  });

  it("P8 ABA A→B→A rejects token from the first A", async () => {
    const id = await animal();
    const stale = command(id, { to_lote_id: lots[2] });
    const first = command(id);
    const r = await apply(first);
    const back = command(id, {
      from_lote_id: lots[1],
      to_lote_id: lots[0],
      movement_base: after(first, r.command_digest),
    });
    expect((await apply(back)).status).toBe("STATE_APPLIED");
    expect(await current(id)).toMatchObject({
      lote_id: lots[0],
      movement_version: "2",
    });
    expect((await apply(stale)).status).toBe("PROJECTION_CONFLICT");
    await facts(stale, 1);
  });

  it("P9 offline A→B→C→D resolves immutable parent digests without future client tokens", async () => {
    const id = await animal();
    const commands: Command[] = [];
    let previous: Command | undefined;
    for (let i = 1; i <= 3; i++) {
      let base: unknown = {
        kind: "snapshot",
        movement_version: "0",
        head_event_id: null,
      };
      if (previous) {
        const digest = (
          await member.query(
            "select public.animal_lot_movement_command_digest_v1($1::jsonb) as digest",
            [JSON.stringify(previous)],
          )
        ).rows[0].digest;
        base = after(previous, digest);
      }
      previous = command(id, {
        from_lote_id: lots[i - 1],
        to_lote_id: lots[i],
        movement_base: base,
      });
      commands.push(previous);
    }
    for (const input of commands)
      expect((await apply(input)).status).toBe("STATE_APPLIED");
    expect(await current(id)).toMatchObject({
      lote_id: lots[3],
      movement_version: "3",
      movement_head_event_id: commands[2]!.event_id,
    });
  });

  it("P10 missing parent persists dependency and original pending replay even after parent arrives", async () => {
    const id = await animal();
    const parent = command(id);
    const digest = (
      await member.query(
        "select public.animal_lot_movement_command_digest_v1($1::jsonb) as digest",
        [JSON.stringify(parent)],
      )
    ).rows[0].digest;
    const child = command(id, {
      from_lote_id: lots[1],
      to_lote_id: lots[2],
      movement_base: after(parent, digest),
    });
    const initial = await apply(child);
    expect(initial.status).toBe("PENDING_CAUSAL_DEPENDENCY");
    await facts(child, 1);
    expect(await current(id)).toMatchObject({
      lote_id: lots[0],
      movement_version: "0",
    });
    await member.end();
    member = await actorClient(); // New DB session, not in-memory dependency.
    expect(
      (
        await member.query(
          "select predecessor_event_id from public.animal_lot_movement_receipts where event_id=$1",
          [child.event_id],
        )
      ).rows[0].predecessor_event_id,
    ).toBe(parent.event_id);
    expect((await apply(parent)).status).toBe("STATE_APPLIED");
    expect(await apply(child)).toEqual({ ...initial, replayed: true });
    expect((await current(id)).lote_id).toBe(lots[2]); // Server resolves durable pending.
  });

  it("P11 cross-farm subject/destination and outsider fail before any facts", async () => {
    const id = await animal();
    const foreign = command(id, {
      fazenda_id: otherFarm,
      to_lote_id: otherLot,
    });
    expect((await apply(foreign)).status).toBe("REJECTED");
    await facts(foreign, 0);
    const crossLot = command(id, { to_lote_id: otherLot });
    expect((await apply(crossLot)).status).toBe("REJECTED");
    await facts(crossLot, 0);
    const outsiderClient = await actorClient(outsider);
    const input = command(id);
    try {
      expect((await apply(input, outsiderClient)).status).toBe("REJECTED");
    } finally {
      await outsiderClient.end();
    }
    await facts(input, 0);
  });

  it("P12 nonexistent destination, origin, animal and unsupported correction create no fact", async () => {
    const id = await animal();
    for (const overrides of [
      { to_lote_id: crypto.randomUUID() },
      { from_lote_id: crypto.randomUUID() },
      { subject_id: crypto.randomUUID() },
      { corrige_evento_id: crypto.randomUUID() },
    ]) {
      const input = command(id, overrides);
      expect((await apply(input)).status).toBe("REJECTED");
      await facts(input, 0);
    }
  });

  it("failed, wrong-digest and superseded parents never authorize a successor", async () => {
    const id = await animal();
    const first = command(id);
    const firstReceipt = await apply(first);
    const losing = command(id, { to_lote_id: lots[2] });
    const losingReceipt = await apply(losing);
    expect(losingReceipt.status).toBe("PROJECTION_CONFLICT");
    const failedChild = command(id, {
      from_lote_id: lots[2],
      to_lote_id: lots[3],
      movement_base: after(losing, losingReceipt.command_digest),
    });
    expect((await apply(failedChild)).reason_code).toBe(
      "PREDECESSOR_NOT_STATE_APPLIED",
    );
    const badDigest = command(id, {
      from_lote_id: lots[1],
      to_lote_id: lots[2],
      movement_base: after(first, "0".repeat(64)),
    });
    expect((await apply(badDigest)).status).toBe("PROJECTION_CONFLICT");
    await member.query(
      "update public.animais set status='vendido' where id=$1",
      [id],
    );
    await member.query("update public.animais set status='ativo' where id=$1", [
      id,
    ]);
    const oldChild = command(id, {
      from_lote_id: lots[1],
      to_lote_id: lots[2],
      movement_base: after(first, firstReceipt.command_digest),
    });
    expect((await apply(oldChild)).status).toBe("PROJECTION_CONFLICT");
    expect((await current(id)).movement_version).toBe("3");
  });

  it("direct SQL/API roles cannot forge metadata, spoof GUC, switch tenant or bypass movement", async () => {
    const id = await animal();
    await member.query(
      "select set_config('rebanhosync.movement_authorized','on',false)",
    );
    for (const [sql, params] of [
      ["update public.animais set lote_id=$2 where id=$1", [id, lots[1]]],
      ["update public.animais set movement_version=99 where id=$1", [id]],
      [
        "update public.animais set movement_head_event_id=$2 where id=$1",
        [id, crypto.randomUUID()],
      ],
      ["update public.animais set fazenda_id=$2 where id=$1", [id, otherFarm]],
    ] as const)
      await expect(member.query(sql, [...params])).rejects.toMatchObject({
        code: "42501",
      });
    const service = await actorClient(user, "service_role");
    try {
      await expect(
        service.query("update public.animais set lote_id=$2 where id=$1", [
          id,
          lots[1],
        ]),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        service.query("delete from public.animais where id=$1", [id]),
      ).rejects.toMatchObject({ code: "42501" });
    } finally {
      await service.end();
    }
    expect(await current(id)).toMatchObject({
      lote_id: lots[0],
      movement_version: "0",
    });
    expect(
      (
        await admin.query(
          "select pg_has_role('authenticated','rebanhosync_movement_executor','MEMBER') as member, pg_has_role('service_role','rebanhosync_movement_executor','MEMBER') as service",
        )
      ).rows[0],
    ).toEqual({ member: false, service: false });
    await expect(
      member.query("set role rebanhosync_movement_executor"),
    ).rejects.toMatchObject({ code: "42501" });
    expect(
      (
        await admin.query(
          "select rolcanlogin,rolsuper,rolbypassrls from pg_roles where rolname='rebanhosync_movement_executor'",
        )
      ).rows[0],
    ).toEqual({ rolcanlogin: false, rolsuper: false, rolbypassrls: false });
    expect(
      (
        await admin.query(
          "select bool_and(not has_parameter_privilege(role_name, 'session_replication_role', 'SET')) as guarded from unnest(array['authenticated','service_role']) role_name",
        )
      ).rows[0].guarded,
    ).toBe(true);
  });

  it("technical initialization does not fabricate historical head; supplied token rejected", async () => {
    const id = crypto.randomUUID();
    await expect(
      member.query(
        "insert into public.animais(id,fazenda_id,identificacao,sexo,movement_version) values ($1::uuid,$2,$1::uuid::text,'F',55)",
        [id, farm],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    const fresh = await animal();
    expect(await current(fresh)).toMatchObject({
      movement_version: "0",
      movement_head_event_id: null,
    });
  });

  it("history-only preserves distinct same-content facts without clock-based projection", async () => {
    const id = await animal();
    const first = command(id, {
      movement_mode: "history_only",
      movement_base: null,
      occurred_at: "2026-10-01T12:55:00Z",
    });
    const second = command(id, {
      movement_mode: "history_only",
      movement_base: null,
      occurred_at: "2026-10-01T11:05:00Z",
    });
    for (const input of [
      first,
      second,
      command(id, {
        ...first,
        event_id: crypto.randomUUID(),
        client_op_id: crypto.randomUUID(),
      }),
    ]) {
      expect((await apply(input)).status).toBe("HISTORY_ONLY");
      await facts(input, 1);
    }
    expect((await current(id)).movement_version).toBe("0");
  });

  it("canonical digest ignores JSON key order, numeric scale and equivalent timezone spelling", async () => {
    const input = command(await animal(), {
      payload: { z: [1, "á"], a: true },
    });
    const changedOrder = Object.fromEntries(Object.entries(input).reverse());
    changedOrder.occurred_at = "2026-10-01T09:00:00-03:00";
    const literal = JSON.stringify(changedOrder).replace(
      '[1,"á"]',
      '[1.00,"á"]',
    );
    const digests = await member.query(
      "select public.animal_lot_movement_command_digest_v1($1) as a,public.animal_lot_movement_command_digest_v1($2) as b",
      [JSON.stringify(input), literal],
    );
    expect(digests.rows[0].a).toBe(digests.rows[0].b);
  });

  it("receipt and command-managed facts remain immutable; outsider cannot read receipts", async () => {
    const input = command(await animal());
    await apply(input);
    await expect(
      member.query(
        "update public.animal_lot_movement_receipts set result='HISTORY_ONLY' where event_id=$1",
        [input.event_id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      admin.query(
        "update public.animal_lot_movement_receipts set result='HISTORY_ONLY' where event_id=$1",
        [input.event_id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      admin.query("update public.eventos set deleted_at=now() where id=$1", [
        input.event_id,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      admin.query(
        "delete from public.eventos_movimentacao where evento_id=$1",
        [input.event_id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    const client = await actorClient(outsider);
    try {
      expect(
        (
          await client.query(
            "select count(*)::int as n from public.animal_lot_movement_receipts",
          )
        ).rows[0].n,
      ).toBe(0);
    } finally {
      await client.end();
    }
  });

  it("failure after factual inserts rolls back base/detail/state/receipt together", async () => {
    const id = await animal();
    const input = command(id);
    // A test-only constraint fault at the LAST write proves the transactional boundary.
    await admin.query(
      "create function public.movement_test_receipt_fault() returns trigger language plpgsql as $$ begin if new.command_input->>'observacoes'='FAULT_TEST' then raise exception 'receipt fault' using errcode='23514'; end if; return new; end $$",
    );
    await admin.query(
      "create trigger movement_test_receipt_fault before insert on public.animal_lot_movement_receipts for each row execute function public.movement_test_receipt_fault()",
    );
    try {
      input.observacoes = "FAULT_TEST";
      expect((await apply(input)).status).toBe("REJECTED");
      await facts(input, 0);
      expect(await current(id)).toMatchObject({
        lote_id: lots[0],
        movement_version: "0",
        revision: "1",
      });
    } finally {
      await admin.query(
        "drop trigger movement_test_receipt_fault on public.animal_lot_movement_receipts",
      );
      await admin.query("drop function public.movement_test_receipt_fault()");
    }
  });
});
