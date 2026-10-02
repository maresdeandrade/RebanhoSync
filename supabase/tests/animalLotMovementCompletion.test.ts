import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

const connectionString = process.env.REBANHOSYNC_TEST_DB_URL;
const describeDatabase = connectionString ? describe.sequential : describe.skip;
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

const occurredAt = "2026-10-01T12:00:00.000Z";
function purchaseCommand(input: {
  operationId: string;
  transactionId: string;
  animalId: string;
  identification: string;
  value: number;
}) {
  const animal = {
    id: input.animalId,
    fazenda_id: farm,
    identificacao: input.identification,
    sexo: "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: "2025-01-01",
    data_entrada: "2026-08-13",
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    especie: "bovino",
    origem: "compra",
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: null,
    payload: {},
    client_id: "concurrency-test",
    client_op_id: input.operationId,
    client_tx_id: input.transactionId,
    client_recorded_at: occurredAt,
  };
  const event = {
    id: input.operationId,
    fazenda_id: farm,
    dominio: "comercial",
    occurred_at: occurredAt,
    animal_id: input.animalId,
    lote_id: null,
    payload: { kind: "commercial_operation_v2" },
    client_id: "concurrency-test",
    client_op_id: input.operationId,
    client_tx_id: input.transactionId,
    client_recorded_at: occurredAt,
  };
  const detail = {
    evento_id: input.operationId,
    fazenda_id: farm,
    operation_type: "compra",
    scope: "animal",
    occurred_at: occurredAt,
    quantidade_animais: 1,
    peso_vivo_total: null,
    peso_medio_derivado: null,
    valor_bruto: input.value,
    frete: 0,
    comissao: 0,
    descontos: 0,
    taxas_impostos: 0,
    valor_liquido_derivado: input.value,
    contraparte_id: null,
    contraparte_nome: "Fornecedor concorrente",
    animal_ids: [input.animalId],
    lote_id: null,
    finance_transaction_id: null,
    snapshot: { contract_version: 2 },
    calculation_status: "partial",
    issues: [],
    limitations: [],
    observacoes: null,
    client_id: "concurrency-test",
    client_op_id: input.operationId,
    client_tx_id: input.transactionId,
    client_recorded_at: occurredAt,
  };
  return {
    domain: "commercial_operation_v2",
    command: "apply_commercial_operation",
    contract_version: 2,
    client_op_id: input.operationId,
    client_tx_id: input.transactionId,
    operation_id: input.operationId,
    operation_type: "compra",
    scope: "animal",
    fazenda_id: farm,
    occurred_at: occurredAt,
    animal_ids: [input.animalId],
    animals: [animal],
    event,
    detail,
  };
}

function saleCommand(input: {
  operationId: string;
  transactionId: string;
  animalId: string;
}) {
  const purchase = purchaseCommand({
    ...input,
    identification: "unused",
    value: 1000,
  });
  return {
    ...purchase,
    operation_type: "venda" as const,
    animals: [
      {
        ...purchase.animals[0],
        status: "vendido",
        origem: "compra",
        data_saida: occurredAt.slice(0, 10),
      },
    ],
    event: {
      ...purchase.event,
      payload: { kind: "commercial_operation_v2" },
    },
    detail: {
      ...purchase.detail,
      operation_type: "venda",
      contraparte_nome: "Comprador concorrente",
    },
  };
}

describeDatabase(
  "F24.4E2.1A.1 dependency resolver and cross-writer PostgreSQL",
  () => {
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
      // Exercise real commercial RPC as a farm owner.
      await admin.query(
        "insert into public.user_fazendas(user_id,fazenda_id,role) values ($1,$2,'owner')",
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

    async function digest(input: Command) {
      return (
        await member.query(
          "select public.animal_lot_movement_command_digest_v1($1::jsonb) digest",
          [JSON.stringify(input)],
        )
      ).rows[0].digest;
    }
    async function child(parent: Command, to = lots[2]) {
      return command(parent.subject_id as string, {
        from_lote_id: parent.to_lote_id,
        to_lote_id: to,
        movement_base: after(parent, await digest(parent)),
      });
    }
    async function effective(input: Command) {
      return (
        await member.query(
          "select result,effective_result,effective_reason_code,effective_movement_version_after,effective_head_after from public.animal_lot_movement_effective_results where event_id=$1",
          [input.event_id],
        )
      ).rows[0];
    }
    async function lockWait(pid: number) {
      for (let i = 0; i < 150; i++) {
        if (
          (
            await admin.query(
              "select wait_event_type from pg_stat_activity where pid=$1",
              [pid],
            )
          ).rows[0]?.wait_event_type === "Lock"
        )
          return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(
        "Expected an observed PostgreSQL lock wait in overlapping sessions",
      );
    }
    async function decisionCount(input: Command) {
      return (
        await admin.query(
          "select count(*)::int n from public.animal_lot_movement_effect_decisions where event_id=$1",
          [input.event_id],
        )
      ).rows[0].n;
    }

    it("D1 durable child-before-parent resolves without replay or an open child session", async () => {
      const id = await animal(),
        p = command(id),
        c = await child(p);
      const session = await actorClient();
      let original: Receipt;
      try {
        original = await apply(c, session);
      } finally {
        await session.end();
      }
      expect(original!.status).toBe("PENDING_CAUSAL_DEPENDENCY");
      expect((await apply(p)).status).toBe("STATE_APPLIED");
      expect(await effective(c)).toMatchObject({
        result: "PENDING_CAUSAL_DEPENDENCY",
        effective_result: "STATE_APPLIED",
        effective_movement_version_after: "2",
        effective_head_after: c.event_id,
      });
      expect(await current(id)).toMatchObject({
        lote_id: lots[2],
        movement_version: "2",
        movement_head_event_id: c.event_id,
      });
      expect(await decisionCount(c)).toBe(1);
      await facts(c, 1);
    });

    it("D2 reverse A→B→C→D converges and a subsequent command uses the effective parent", async () => {
      const id = await animal(),
        p = command(id),
        c = await child(p),
        g = await child(c, lots[3]);
      expect((await apply(g)).status).toBe("PENDING_CAUSAL_DEPENDENCY");
      expect((await apply(c)).status).toBe("PENDING_CAUSAL_DEPENDENCY");
      await apply(p);
      expect(await current(id)).toMatchObject({
        lote_id: lots[3],
        movement_version: "3",
        movement_head_event_id: g.event_id,
      });
      expect((await effective(c)).effective_result).toBe("STATE_APPLIED");
      expect((await effective(g)).effective_result).toBe("STATE_APPLIED");
      expect((await apply(await child(g, lots[0]))).status).toBe(
        "STATE_APPLIED",
      );
      expect((await current(id)).movement_version).toBe("4");
    });

    it("D3 two durable branches preserve facts and exactly one wins the predecessor head", async () => {
      const id = await animal(),
        p = command(id),
        a = await child(p),
        b = await child(p, lots[3]);
      await apply(a);
      await apply(b);
      await apply(p);
      const results = [
        (await effective(a)).effective_result,
        (await effective(b)).effective_result,
      ];
      expect(results.sort()).toEqual(["PROJECTION_CONFLICT", "STATE_APPLIED"]);
      expect((await current(id)).movement_version).toBe("2");
      await facts(a, 1);
      await facts(b, 1);
      expect(await decisionCount(a)).toBe(1);
      expect(await decisionCount(b)).toBe(1);
    });

    it("D4 overlapping internal resolver and parent execution promote exactly once", async () => {
      const id = await animal(),
        p = command(id),
        c = await child(p);
      await apply(c);
      const parentSession = await actorClient();
      const resolver = new Client({ connectionString });
      await resolver.connect();
      try {
        // Only trusted migration administrator can assume the private executor; never API roles.
        await resolver.query(
          "select set_config('request.jwt.claim.sub',$1,false)",
          [user],
        );
        await resolver.query("set role rebanhosync_movement_executor");
        await resolver.query("set statement_timeout='10s'");
        await parentSession.query("begin");
        await apply(p, parentSession);
        const pid = (await resolver.query("select pg_backend_pid() pid"))
          .rows[0].pid;
        const pending = resolver.query(
          "select public.resolve_animal_lot_movement_pending_v1($1,$2)",
          [farm, id],
        );
        const outcome = pending.then(
          () => ({ ok: true }),
          (error) => ({ ok: false, error }),
        );
        await lockWait(pid);
        await parentSession.query("commit");
        expect(await outcome).toEqual({ ok: true });
        expect(await decisionCount(c)).toBe(1);
        expect((await current(id)).movement_version).toBe("2");
        await expect(
          member.query(
            "select public.resolve_animal_lot_movement_pending_v1($1,$2)",
            [farm, id],
          ),
        ).rejects.toMatchObject({ code: "42501" });
      } finally {
        await parentSession.query("rollback");
        await parentSession.end();
        await resolver.end();
      }
    });

    it("D5 failure after decision insert rolls back parent facts, child state and both token increments", async () => {
      const id = await animal(),
        p = command(id),
        c = await child(p);
      await apply(c);
      const before = await current(id);
      await admin.query(
        `create function public.test_fail_movement_decision() returns trigger language plpgsql as $$ begin if new.event_id='${c.event_id}'::uuid then raise exception 'TEST_PENDING_PROMOTION_CRASH'; end if; return new; end; $$; create trigger test_pending_crash after insert on public.animal_lot_movement_effect_decisions for each row execute function public.test_fail_movement_decision()`,
      );
      try {
        await expect(apply(p)).rejects.toMatchObject({ code: "P0001" });
        expect(await current(id)).toEqual(before);
        expect(await decisionCount(c)).toBe(0);
        await facts(p, 0);
        await facts(c, 1);
      } finally {
        await admin.query(
          "drop trigger test_pending_crash on public.animal_lot_movement_effect_decisions; drop function public.test_fail_movement_decision()",
        );
      }
      await apply(p);
      expect((await current(id)).movement_version).toBe("2");
    });

    it("D6 replay after linked decision returns original receipt, even after another movement", async () => {
      const id = await animal(),
        p = command(id),
        c = await child(p);
      const original = await apply(c);
      await apply(p);
      await apply(await child(c, lots[3]));
      const before = await current(id);
      expect(await apply(c)).toEqual({ ...original, replayed: true });
      expect(await current(id)).toEqual(before);
      expect(await decisionCount(c)).toBe(1);
      await expect(
        admin.query(
          "update public.animal_lot_movement_effect_decisions set result='PROJECTION_CONFLICT' where event_id=$1",
          [c.event_id],
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        member.query(
          "insert into public.animal_lot_movement_effect_decisions(fazenda_id,event_id,result,movement_version_before,movement_version_after,resolver_actor_id) values ($1,$2,'PROJECTION_CONFLICT',0,0,$3)",
          [farm, c.event_id, user],
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });

    it.each(["PROJECTION_CONFLICT", "HISTORY_ONLY"])(
      "D7 predecessor %s terminates child and grandchild effects",
      async (result) => {
        const id = await animal();
        const p = command(
          id,
          result === "HISTORY_ONLY"
            ? { movement_mode: "history_only", movement_base: null }
            : {},
        );
        const c = await child(p),
          g = await child(c, lots[3]);
        await apply(g);
        await apply(c);
        if (result === "PROJECTION_CONFLICT")
          await member.query(
            "update public.animais set status='morto',lote_id=null where id=$1",
            [id],
          );
        expect((await apply(p)).status).toBe(result);
        for (const input of [c, g]) {
          expect(await effective(input)).toMatchObject({
            effective_result: "PROJECTION_CONFLICT",
            effective_reason_code: "PREDECESSOR_NOT_STATE_APPLIED",
          });
          await facts(input, 1);
        }
        expect((await current(id)).movement_version).toBe(
          result === "HISTORY_ONLY" ? "0" : "1",
        );
      },
    );

    it("D8 known cross-farm predecessor is rejected without a child fact or effect", async () => {
      const id = await animal(),
        p = command(id);
      await apply(p);
      await admin.query(
        "insert into public.user_fazendas(user_id,fazenda_id,role) values ($1,$2,'owner')",
        [user, otherFarm],
      );
      const secondLot = crypto.randomUUID(),
        otherAnimal = crypto.randomUUID();
      await admin.query(
        "insert into public.lotes(id,fazenda_id,nome) values ($1,$2,'Other target')",
        [secondLot, otherFarm],
      );
      await admin.query(
        "insert into public.animais(id,fazenda_id,identificacao,sexo,lote_id) values ($1,$2,'Other subject','F',$3)",
        [otherAnimal, otherFarm, otherLot],
      );
      const c = command(otherAnimal, {
        fazenda_id: otherFarm,
        from_lote_id: otherLot,
        to_lote_id: secondLot,
        movement_base: after(p, await digest(p)),
      });
      expect(await apply(c)).toMatchObject({
        status: "REJECTED",
        reason_code: "MOVEMENT_PREDECESSOR_CROSS_FARM",
      });
      await facts(c, 0);
      expect((await current(otherAnimal)).movement_version).toBe("0");
    });

    async function sale(id: string, lot: string | null, client: Client) {
      const input = saleCommand({
        operationId: crypto.randomUUID(),
        transactionId: crypto.randomUUID(),
        animalId: id,
      });
      input.event.lote_id = lot as never;
      input.detail.lote_id = lot as never;
      return (
        await client.query(
          "select public.apply_commercial_operation_v2($1,$2,$3,$4::jsonb) result",
          [farm, input.client_op_id, input.client_tx_id, JSON.stringify(input)],
        )
      ).rows[0].result;
    }
    it.each(["sale", "death", "tombstone", "rename"])(
      "W1-W4 %s commits first while movement waits",
      async (writer) => {
        const id = await animal(),
          p = command(id),
          session = await actorClient(),
          mover = await actorClient();
        try {
          await session.query("begin");
          if (writer === "sale")
            expect((await sale(id, lots[0], session)).status).toBe("APPLIED");
          else if (writer === "death")
            await session.query(
              "update public.animais set status='morto',lote_id=null where id=$1",
              [id],
            );
          else if (writer === "tombstone")
            await session.query(
              "update public.animais set deleted_at=now() where id=$1",
              [id],
            );
          else
            await session.query(
              "update public.animais set nome='Concurrent rename' where id=$1",
              [id],
            );
          const pid = (await mover.query("select pg_backend_pid() pid")).rows[0]
            .pid;
          const competing = apply(p, mover);
          const outcome = competing.then(
            (value) => ({ value }),
            (error) => ({ error }),
          );
          await lockWait(pid);
          await session.query("commit");
          expect(await outcome).toMatchObject({
            value: {
              status:
                writer === "rename" ? "STATE_APPLIED" : "PROJECTION_CONFLICT",
            },
          });
          expect((await current(id)).movement_version).toBe("1");
          await facts(p, 1);
        } finally {
          await session.query("rollback");
          await session.end();
          await mover.end();
        }
      },
    );
    it.each(["sale", "death", "tombstone"])(
      "W2-W4/W6 movement commits first while %s waits, exit invalidates token without fake head",
      async (writer) => {
        const id = await animal(),
          p = command(id),
          mover = await actorClient(),
          session = await actorClient();
        try {
          await mover.query("begin");
          await apply(p, mover);
          const pid = (await session.query("select pg_backend_pid() pid"))
            .rows[0].pid;
          // Individual sale avoids obsolete lot snapshot; lot-scoped stale sale is tested separately.
          const pending =
            writer === "sale"
              ? sale(id, null, session)
              : session.query(
                  writer === "death"
                    ? "update public.animais set status='morto',lote_id=null where id=$1"
                    : "update public.animais set deleted_at=now() where id=$1",
                  [id],
                );
          const outcome = pending.then(
            (value) => ({ value }),
            (error) => ({ error }),
          );
          await lockWait(pid);
          await mover.query("commit");
          const result = await outcome;
          expect(result).not.toHaveProperty("error");
          if (writer === "sale")
            expect(result).toMatchObject({ value: { status: "APPLIED" } });
          expect(await current(id)).toMatchObject({
            movement_version: "2",
            movement_head_event_id: p.event_id,
          });
          const stale = await child(p);
          expect((await apply(stale)).status).toBe("PROJECTION_CONFLICT");
          expect((await current(id)).movement_version).toBe("2");
        } finally {
          await mover.query("rollback");
          await session.end();
          await mover.end();
        }
      },
    );

    it("W5 reverse-chain resolver overlaps a lot sale: lock order prevents animal→new-lot inversion", async () => {
      const id = await animal(),
        p = command(id),
        c = await child(p),
        g = await child(c, lots[3]);
      await apply(g);
      await apply(c);
      const seller = await actorClient(),
        mover = await actorClient();
      try {
        await seller.query("begin");
        await seller.query(
          "select id from public.lotes where id=$1 for update",
          [lots[3]],
        );
        const pid = (await mover.query("select pg_backend_pid() pid")).rows[0]
          .pid;
        const pending = apply(p, mover);
        const outcome = pending.then(
          (value) => ({ value }),
          (error) => ({ error }),
        );
        await lockWait(pid);
        // If resolver had already locked animal before discovering D, this would deadlock.
        // Individual sale locks its own declared lot D, then the animal. It does
        // not subsequently lock A: that would manufacture a different lock order.
        expect((await sale(id, lots[3], seller)).status).toBe("APPLIED");
        await seller.query("commit");
        expect(await outcome).toMatchObject({
          value: { status: "PROJECTION_CONFLICT" },
        });
        expect((await effective(c)).effective_result).toBe(
          "PROJECTION_CONFLICT",
        );
        expect((await effective(g)).effective_result).toBe(
          "PROJECTION_CONFLICT",
        );
      } finally {
        await seller.query("rollback");
        await seller.end();
        await mover.end();
      }
    });
    it("D7 normalized rejected predecessor terminalizes durable child; rejection replay is immutable", async () => {
      const id = await animal();
      const p = command(id, { source_task_id: crypto.randomUUID() });
      const c = await child(p);
      await apply(c);
      const rejection = await apply(p);
      expect(rejection).toMatchObject({
        status: "REJECTED",
        reason_code: "MOVEMENT_TASK_INVALID",
      });
      expect(await effective(c)).toMatchObject({
        effective_result: "PROJECTION_CONFLICT",
        effective_reason_code: "PREDECESSOR_NOT_STATE_APPLIED",
      });
      await facts(p, 0);
      await facts(c, 1);
      expect(await apply(p)).toEqual({ ...rejection, replayed: true });
      expect((await current(id)).movement_version).toBe("0");
      await expect(
        admin.query(
          "delete from public.animal_lot_movement_command_rejections where event_id=$1",
          [p.event_id],
        ),
      ).rejects.toMatchObject({ code: "42501" });
    });

    it("D7 causal cycle produces HISTORY_CONFLICT and terminalizes the pending predecessor", async () => {
      const id = await animal();
      const p = command(id);
      const c = await child(p);
      // Digests for an actual cycle cannot recursively match; cycle detection still terminalizes facts.
      p.movement_base = after(c, "0".repeat(64));
      await apply(c);
      expect((await apply(p)).status).toBe("HISTORY_CONFLICT");
      expect((await effective(c)).effective_result).toBe("PROJECTION_CONFLICT");
      expect((await current(id)).movement_version).toBe("0");
      await facts(p, 1);
      await facts(c, 1);
    });

    it("D2 chain longer than three uses original selectors and no client clock ordering", async () => {
      const id = await animal();
      const chain = [command(id)];
      for (let i = 1; i < 8; i++) {
        const next = await child(chain[i - 1]!, lots[(i + 1) % lots.length]);
        next.occurred_at = `2026-10-01T${String(20 - i).padStart(2, "0")}:00:00.000Z`;
        chain.push(next);
      }
      for (const input of [...chain].reverse()) await apply(input);
      expect(await current(id)).toMatchObject({
        movement_version: "8",
        movement_head_event_id: chain[7]!.event_id,
        lote_id: lots[0],
      });
      expect((await effective(chain[7]!)).effective_reason_code).toBeNull();
    });

    it("D1 persisted selector mismatch stays terminal instead of being refreshed from current state", async () => {
      const id = await animal(),
        p = command(id);
      const c = await child(p);
      c.movement_base = after(p, "0".repeat(64));
      await apply(c);
      await apply(p);
      expect(await effective(c)).toMatchObject({
        effective_result: "PROJECTION_CONFLICT",
        effective_reason_code: "PREDECESSOR_IDENTITY_OR_ORIGIN_DIVERGENCE",
      });
      expect((await current(id)).movement_version).toBe("1");
      await facts(c, 1);
    });

    it("effective result RLS and private helpers expose no outsider or service-role write path", async () => {
      const id = await animal(),
        p = command(id),
        c = await child(p);
      await apply(c);
      await apply(p);
      const outside = await actorClient(outsider),
        service = await actorClient(user, "service_role");
      try {
        expect(
          (
            await outside.query(
              "select * from public.animal_lot_movement_effective_results where event_id=$1",
              [c.event_id],
            )
          ).rows,
        ).toEqual([]);
        for (const client of [member, service]) {
          await expect(
            client.query(
              "select public.lock_animal_lot_movement_work_v1($1,$2,array[]::uuid[])",
              [farm, id],
            ),
          ).rejects.toMatchObject({ code: "42501" });
          await expect(
            client.query(
              "select public.reject_animal_lot_movement_v1($1::jsonb,'FAKE')",
              [JSON.stringify(p)],
            ),
          ).rejects.toMatchObject({ code: "42501" });
        }
      } finally {
        await outside.end();
        await service.end();
      }
    });
    it("D8 late cross-farm predecessor terminalizes child subtree without foreign actor authorization", async () => {
      const id = await animal(),
        foreignId = crypto.randomUUID(),
        destination = crypto.randomUUID();
      await admin.query(
        "insert into public.user_fazendas(user_id,fazenda_id,role) values ($1,$2,'owner')",
        [outsider, otherFarm],
      );
      await admin.query(
        "insert into public.lotes(id,fazenda_id,nome) values ($1,$2,'Foreign terminal target')",
        [destination, otherFarm],
      );
      await admin.query(
        "insert into public.animais(id,fazenda_id,identificacao,sexo,lote_id) values ($1,$2,$1::uuid::text,'F',$3)",
        [foreignId, otherFarm, otherLot],
      );
      const p = command(foreignId, {
        fazenda_id: otherFarm,
        from_lote_id: otherLot,
        to_lote_id: destination,
      });
      const c = command(id, { movement_base: after(p, await digest(p)) }),
        g = await child(c);
      await apply(g);
      await apply(c);
      const foreignActor = await actorClient(outsider);
      try {
        expect((await apply(p, foreignActor)).status).toBe("STATE_APPLIED");
        expect(
          (
            await foreignActor.query(
              "select * from public.animal_lot_movement_effective_results where event_id=$1",
              [c.event_id],
            )
          ).rows,
        ).toEqual([]);
      } finally {
        await foreignActor.end();
      }
      for (const input of [c, g])
        expect(await effective(input)).toMatchObject({
          result: "PENDING_CAUSAL_DEPENDENCY",
          effective_result: "PROJECTION_CONFLICT",
          effective_reason_code: "PREDECESSOR_TENANT_OR_SUBJECT_INVALID",
        });
      expect((await current(id)).movement_version).toBe("0");
      await facts(c, 1);
      await facts(g, 1);
    });

    it("D7 late predecessor for another subject terminalizes the invalid durable child", async () => {
      const firstId = await animal(),
        secondId = await animal(),
        p = command(firstId);
      const c = command(secondId, { movement_base: after(p, await digest(p)) });
      await apply(c);
      await apply(p);
      expect((await effective(c)).effective_result).toBe("PROJECTION_CONFLICT");
      expect((await current(secondId)).movement_version).toBe("0");
      await facts(c, 1);
    });
  },
);
