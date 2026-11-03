// Explicit task-owned, network-disabled PostgreSQL only. Never connects to an existing target.
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";
let container =
  process.env.V3_FUNCTIONAL_CONTAINER ?? "rebanhosync-v3-functional-20261102";
assert(/^rebanhosync-v3-functional-[a-z0-9-]+$/.test(container));
const database = "postgres";
if (process.env.V3_BOOTSTRAP === "1") {
  // New task-owned cluster only; never reset, migrate or stop an existing one.
  container = `rebanhosync-v3-functional-${Date.now()}`;
  execFileSync("docker", [
    "run",
    "--name",
    container,
    "--network",
    "none",
    "--label",
    "rebanhosync.task=sanitario-v3-functional",
    "--env",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "--detach",
    "public.ecr.aws/supabase/postgres:17.6.1.167",
  ]);
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      execFileSync(
        "docker",
        ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
        { stdio: "pipe" },
      );
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  assert(ready, "New task-owned PostgreSQL did not initialize");
}
const inspect = JSON.parse(
  execFileSync("docker", ["inspect", container], { encoding: "utf8" }),
)[0];
assert.equal(
  inspect.Config.Labels["rebanhosync.task"],
  "sanitario-v3-functional",
);
assert.equal(inspect.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(inspect.HostConfig.PortBindings ?? {}).length, 0);
if (process.env.V3_BOOTSTRAP === "1") {
  const apply = (input) =>
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        container,
        "psql",
        "-XqAt",
        "-U",
        "postgres",
        "-d",
        database,
        "-v",
        "ON_ERROR_STOP=1",
      ],
      { input, stdio: ["pipe", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 },
    );
  for (const file of readdirSync("supabase/migrations")
    .filter((x) => x.endsWith(".sql"))
    .sort())
    {
      const migration = readFileSync(`supabase/migrations/${file}`, "utf8");
      if (file === "20261102130006_sanitario_v3_collaboration_closure.sql") {
        const factual = "public.internal_sanitario_sync_v2_apply_factual_core(uuid,uuid,integer,uuid,uuid,bigint,public.sanitario_sync_v2_event_input,public.sanitario_sync_v2_detail_input,public.sanitario_sync_v2_event_animal_input[])";
        const anchors = [
          [factual, "if v_agenda.status <> 'programada' or v_agenda.deleted_at is not null then"],
          [factual, "and s.animal_id=any(v_animal_ids);"],
          [factual, "v_claim := public.internal_sanitario_claim_atendimento"],
          [factual, "raise exception 'SANITARIO_CLAIM_ATOMICITY_FAILED'; end if;"],
          [factual, "set planned_status='executado',execution_evento_id=event_payload.id"],
          [factual, "and aa.animal_id=any(v_animal_ids);"],
          ["public.internal_sanitario_sync_v2_close_agenda(uuid,uuid,integer,uuid,uuid,bigint,public.sanitario_sync_v2_closure_input)", "and e.deleted_at is null"],
          ["public.guard_sanitario_sync_v2_internal_writes()", "new.obrigacao_origem_agenda_id := new.id;"],
          ["public.guard_sanitario_atendimento_factual()", "and new.em_disputa and not old.em_disputa"],
        ];
        for (const [signature, anchor] of anchors) {
          const definition = JSON.parse(apply(`select to_json(pg_get_functiondef('${signature}'::regprocedure));`).toString().trim());
          for (const mode of ["missing", "repeated"]) {
            // Both mutations remain valid SQL, but no longer match the reviewed baseline.
            const changed = mode === "missing"
              ? definition.replace(anchor, anchor.replace(" ", "  "))
              : definition.slice(0, definition.lastIndexOf("$function$")) + `\n/* ${anchor} */\n` + definition.slice(definition.lastIndexOf("$function$"));
            assert.notEqual(changed, definition);
            assert.throws(() => apply(`begin;\n${changed};\n${migration}`), /SANITARIO_FUNCTION_BASELINE_MISMATCH/);
            assert.equal(apply(`select to_json(pg_get_functiondef('${signature}'::regprocedure));`).toString().trim(), JSON.stringify(definition));
          }
        }
        console.log("18 incompatible SQL-anchor controls rejected; baseline unchanged after rollback.");
      }
      apply(migration);
    }
  console.log(`Task-owned cluster: ${container}; complete migrations applied.`);
}
const sql = async (text) =>
  new Promise((resolve, reject) => {
    const child = spawn("docker", [
      "exec",
      "-i",
      container,
      "psql",
      "-XqAt",
      "-U",
      "postgres",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
    ]);
    let out = "",
      err = "";
    child.stdout.on("data", (x) => (out += x));
    child.stderr.on("data", (x) => (err += x));
    child.on("error", reject);
    child.on("exit", (code) =>
      code ? reject(Error(err)) : resolve(out.trim()),
    );
    child.stdin.end(text);
  });
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
test("Agenda V3 collaboration on isolated PostgreSQL", async (t) => {
  const farm = randomUUID(),
    other = randomUUID(),
    owner = randomUUID(),
    cowboy = randomUUID(),
    outsider = randomUUID();
  const animals = Array.from({ length: 30 }, randomUUID),
    agenda = randomUUID();
  await sql(`insert into auth.users(id) values('${owner}'),('${cowboy}'),('${outsider}');
    insert into public.fazendas(id,nome) values('${farm}','V3 task fixture'),('${other}','Other fixture');
    insert into public.user_fazendas(user_id,fazenda_id,role) values('${owner}','${farm}','owner'),('${cowboy}','${farm}','cowboy'),('${outsider}','${other}','owner');
    insert into public.animais(id,fazenda_id,identificacao,sexo) values ${animals.map((id) => `('${id}','${farm}','${id}','F')`).join(",")};
    insert into public.sanitario_sync_v2_gates(fazenda_id,enabled,minimum_contract_version,maximum_contract_version,foundation_state) values('${farm}',true,3,3,'ready');`);
  const args = (actor = owner) => ({
    actor_user_id: actor,
    fazenda_id: farm,
    contract_version: 3,
    client_op_id: randomUUID(),
    domain_op_id: randomUUID(),
    client_tx_id: randomUUID(),
    client_id: "fixture-device",
  });
  const admit = async (
    a,
    command = "manage_agenda",
    actor = a.actor_user_id,
    receipt = false,
  ) =>
    JSON.parse(
      await sql(
        `begin; set local role service_role; select public.internal_sanitario_admit_v3('${actor}','${farm}',${quote(command)},${quote(JSON.stringify(a))}::jsonb,${receipt}); commit;`,
      ),
    );
  await admit(
    {
      ...args(),
      payload: {
        id: agenda,
        dedup_key: agenda,
        janela_inicio: "2026-10-30",
        data_programada: "2026-10-30",
        acao_sanitaria: "vacinacao",
        client_id: "fixture-device",
        client_recorded_at: "2026-10-30T12:00:00Z",
      },
      animal_ids: animals,
    },
    "create_agenda",
  );
  const manage = (action, extra = {}, actor = owner) => ({
    ...args(actor),
    payload: { agenda_id: agenda, action, ...extra },
  });
  const first = randomUUID(),
    second = randomUUID();
  const group = (ids, participant, seq, actor = owner, dose = 2) => ({
    ...args(actor),
    expected_revision: 0,
    event_payload: {
      id: randomUUID(),
      natureza: "primary_execution",
      source_sanitario_agenda_v2_id: agenda,
      occurred_at: "2026-10-30T12:00:00Z",
      client_id: "fixture-device",
      client_recorded_at: "2026-10-30T12:00:00Z",
      client_tx_id: randomUUID(),
      payload: {
        sanitario_v3_progressive: true,
        participation_id: participant,
        participation_sequence: seq,
      },
    },
    detail_payload: {
      tipo: "vacinacao",
      produto_nome_snapshot: "Produto A",
      dose_quantidade: dose,
      dose_unidade: "mL",
      via_aplicacao: "SC",
    },
    event_animals: ids.map((animal_id) => ({ id: randomUUID(), animal_id })),
  });
  let one, collision, barrier, closed;
  await t.test(
    "participation is explicit and stable; other farm and cowboy management denied",
    async () => {
      assert.equal(
        await sql(
          `select count(*) from public.sanitario_participacoes where agenda_id='${agenda}'`,
        ),
        "0",
      );
      const op = manage("participate", { participation_id: first });
      assert.deepEqual(await admit(op), await admit(op));
      await admit(manage("participate", { participation_id: second }, cowboy));
      await assert.rejects(
        () => admit(manage("prepare_close", {}, cowboy)),
        /SANITARIO_ROLE_NOT_ALLOWED/,
      );
      await assert.rejects(
        () => admit(manage("prepare_close", {}, outsider)),
        /SANITARIO_MEMBERSHIP_REQUIRED/,
      );
    },
  );
  await t.test(
    "two operators, three Events and 25 attendances, replay and new connection",
    async () => {
      one = group(animals.slice(0, 15), first, 1);
      const two = group(animals.slice(15, 20), second, 1, cowboy, 5),
        three = group(animals.slice(20, 25), second, 2, cowboy);
      assert(
        (
          await Promise.all([
            admit(one, "apply_factual_core"),
            admit(two, "apply_factual_core"),
          ])
        ).every((x) => x.confirmed),
      );
      assert.equal((await admit(three, "apply_factual_core")).confirmed, true);
      assert.deepEqual(
        await admit(one, "apply_factual_core"),
        await admit(one, "apply_factual_core"),
      );
      assert.equal(
        await sql(
          `select count(*) from public.sanitario_atendimentos where fazenda_id='${farm}'`,
        ),
        "25",
      );
      assert.equal(
        await sql(
          `select count(*) from public.eventos where source_sanitario_agenda_v2_id='${agenda}'`,
        ),
        "3",
      );
    },
  );
  await t.test(
    "known unfinished participants and final sequence gaps block closure",
    async () => {
      await assert.rejects(
        () => admit(manage("prepare_close")),
        /SANITARIO_PARTICIPANTS_INCOMPLETE/,
      );
      await admit(
        manage(
          "complete",
          { participation_id: second, final_sequence: 3 },
          cowboy,
        ),
      );
      await admit(
        manage("complete", { participation_id: first, final_sequence: 1 }),
      );
      await assert.rejects(
        () => admit(manage("prepare_close")),
        /SANITARIO_PARTICIPANTS_INCOMPLETE/,
      );
      collision = group([animals[0]], second, 3, cowboy);
      assert.equal(
        (await admit(collision, "apply_factual_core")).outcome,
        "collision",
      );
      await assert.rejects(
        () => admit(manage("prepare_close")),
        /SANITARIO_UNRESOLVED_EVIDENCE/,
      );
      await admit(
        manage("resolve", {
          declaration_id: collision.client_op_id,
          decision: "duplicate",
          reason: "Mesma aplicação, evidência preservada",
        }),
      );
      assert.equal(
        await sql(
          `select count(*) from public.sanitario_atendimentos where fazenda_id='${farm}'`,
        ),
        "25",
      );
    },
  );
  const reasons = animals
    .slice(25)
    .map((animal_id) => ({ animal_id, reason: "Animal não localizado" }));
  await t.test("not_executed rejects duplicate, foreign, executed, malformed and missing targets atomically", async () => {
    const invalid = [
      [...reasons, { ...reasons[0], reason: "Outro motivo" }],
      [...reasons, { animal_id: randomUUID(), reason: "Fora da Agenda" }],
      [...reasons, { animal_id: animals[0], reason: "Já executado" }],
      reasons.slice(1),
      reasons.map((x, i) => i ? x : { ...x, reason: "  " }),
      reasons.map((x, i) => i ? x : { reason: x.reason }),
      null,
      {},
    ];
    for (const not_executed of invalid) {
      const command = manage("prepare_close", { not_executed });
      await assert.rejects(() => admit(command), /SANITARIO_NOT_EXECUTED_/);
      assert.equal(await sql(`select closing_barrier is null from public.sanitario_agenda_v2 where id='${agenda}'`), "t");
      assert.equal(await sql(`select count(*) from public.sanitario_sync_v2_operations where client_op_id='${command.client_op_id}'`), "0");
    }
  });
  await t.test(
    "barrier, immutable partial snapshot, individual completion does not close",
    async () => {
      assert.equal(
        await sql(
          `select status from public.sanitario_agenda_v2 where id='${agenda}'`,
        ),
        "programada",
      );
      barrier = await admit(manage("prepare_close", { not_executed: reasons }));
      const close = manage("confirm_close", { barrier_id: barrier.barrier_id });
      closed = await admit(close);
      assert.deepEqual(await admit(close), closed);
      assert.equal(closed.agenda_status, "fechada");
      assert.equal(
        closed.snapshot.animals.filter(
          (x) => x.planned_status === "nao_executado",
        ).length,
        5,
      );
      assert.equal(closed.snapshot.agenda.data_programada, "2026-10-30");
      assert.equal(
        closed.snapshot.events.filter((x) => x.confirmation === "confirmed")
          .length,
        3,
      );
      assert.deepEqual(
        await admit(one, "apply_factual_core"),
        await admit(one, "apply_factual_core"),
      );
    },
  );
  let late;
  await t.test(
    "late operation is durable, has no Event or consumption and does not reopen",
    async () => {
      late = group([animals[25]], randomUUID(), 1, cowboy);
      const r = await admit(late, "apply_factual_core");
      assert.equal(r.outcome, "late");
      assert.deepEqual(await admit(late, "apply_factual_core"), r);
      assert.equal(
        await sql(
          `select count(*) from public.eventos where id='${late.event_payload.id}'`,
        ),
        "0",
      );
      assert.equal(
        await sql(
          `select status from public.sanitario_agenda_v2 where id='${agenda}'`,
        ),
        "fechada",
      );
      await admit(
        manage("reconcile_late", {
          declaration_id: late.client_op_id,
          decision: "rejected",
          reason: "Evidência insuficiente",
        }),
      );
      assert.equal(
        await sql(
          `select count(*) from public.sanitario_agenda_resultados where agenda_id='${agenda}'`,
        ),
        "2",
      );
      assert.equal(
        await sql(
          `select snapshot->'animals' = ${quote(JSON.stringify(closed.snapshot.animals))}::jsonb from public.sanitario_agenda_resultados where id='${closed.result_id}'`,
        ),
        "t",
      );
    },
  );
  await t.test(
    "continuation rejects stale result; rejection creates none; approval creates at most one with original obligation",
    async () => {
      await assert.rejects(
        () =>
          admit(
            manage("request_continuation", {
              result_id: closed.result_id,
              animals: reasons,
              reason: "Reagendar",
            }),
          ),
        /SANITARIO_CONTINUATION_RESULT_STALE/,
      );
      const resultId = await sql(
        `select id from public.sanitario_agenda_resultados where agenda_id='${agenda}' order by revision desc limit 1`,
      );
      const request = await admit(
        manage(
          "request_continuation",
          {
            result_id: resultId,
            animals: reasons,
            reason: "Reagendar os cinco",
          },
          cowboy,
        ),
      );
      await admit(
        manage("decide_continuation", {
          request_id: request.request_id,
          decision: "rejected",
          reason: "Aguardar revisão",
        }),
      );
      assert.equal(
        await sql(
          `select count(*) from public.sanitario_agenda_v2 where metadata->>'source_agenda_id'='${agenda}'`,
        ),
        "0",
      );
      const request2 = await admit(
        manage("request_continuation", {
          result_id: resultId,
          animals: reasons,
          reason: "Nova solicitação",
        }),
      );
      const decision = manage("decide_continuation", {
        request_id: request2.request_id,
        decision: "approved",
        reason: "Retomar manejo",
        planned_for: "2026-11-03",
      });
      const r = await admit(decision);
      assert.deepEqual(await admit(decision), r);
      await assert.rejects(
        () =>
          admit(
            manage("decide_continuation", {
              request_id: request2.request_id,
              decision: "rejected",
              reason: "Concorrente",
            }),
          ),
        /SANITARIO_CONTINUATION_ALREADY_DECIDED/,
      );
      assert.equal(
        await sql(
          `select obrigacao_origem_agenda_id from public.sanitario_agenda_v2 where id='${r.continuation_id}'`,
        ),
        agenda,
      );
      assert.equal(
        await sql(
          `select count(*) from public.sanitario_agenda_animais_v2 where agenda_id='${r.continuation_id}'`,
        ),
        "5",
      );
      const later = group([animals[25]], randomUUID(), 1, cowboy);
      assert.equal((await admit(later, "apply_factual_core")).outcome, "late");
      const childFact = group([animals[25]], randomUUID(), 1);
      childFact.event_payload.source_sanitario_agenda_v2_id = r.continuation_id;
      assert.equal(
        (await admit(childFact, "apply_factual_core")).outcome,
        "dependency",
      );
      await assert.rejects(
        () =>
          admit(
            manage("reconcile_late", {
              declaration_id: later.client_op_id,
              decision: "accepted",
              reason: "Dependência precisa ser tratada",
            }),
          ),
        /SANITARIO_CONTINUATION_DEPENDENCY/,
      );
      await admit(
        manage("reconcile_late", {
          declaration_id: later.client_op_id,
          decision: "rejected",
          reason: "Declaração insuficiente, continuidade mantém alvos",
        }),
      );
      const childDecision = {
        ...args(),
        payload: {
          agenda_id: r.continuation_id,
          action: "resolve",
          declaration_id: childFact.client_op_id,
          decision: "accepted",
          reason: "Dependência anterior explicitamente resolvida",
        },
      };
      assert((await admit(childDecision)).evento_id);
      assert.equal(
        (await admit(childFact, "apply_factual_core")).outcome,
        "dependency",
      );
    },
  );
  await t.test(
    "RLS excludes outsider and direct authenticated writes/RPC",
    async () => {
      assert.equal(
        await sql(
          `begin; set local role authenticated; select set_config('request.jwt.claim.sub','${outsider}',true) is null; select count(*) from public.sanitario_agenda_resultados where fazenda_id='${farm}'; rollback;`,
        ).then((x) => x.split("\n").at(-1)),
        "0",
      );
      await assert.rejects(
        () =>
          sql(
            `begin; set local role authenticated; insert into public.sanitario_participacoes(id,fazenda_id,agenda_id,actor_user_id,client_id) values('${randomUUID()}','${farm}','${agenda}','${cowboy}','spoof'); commit;`,
          ),
        /permission denied/,
      );
      await assert.rejects(
        () =>
          sql(
            `begin; set local role authenticated; select public.internal_sanitario_admit_v3('${owner}','${farm}','manage_agenda','{}',false); commit;`,
          ),
        /permission denied/,
      );
    },
  );
  await t.test(
    "additional application consumes once, keeps original attendance and preserves divergent evidence",
    async () => {
      const targetAgenda = randomUUID(),
        participant = randomUUID(),
        supply = randomUUID(),
        lot = randomUUID();
      await sql(`insert into public.insumos(id,fazenda_id,nome,tipo,unidade_base) values('${supply}','${farm}','Fixture product','sanitario','ml');
      insert into public.insumo_lotes(id,fazenda_id,insumo_id,unidade_base,quantidade_inicial_base,saldo_atual_base) values('${lot}','${farm}','${supply}','ml',100,100);`);
      await admit(
        {
          ...args(),
          payload: {
            id: targetAgenda,
            dedup_key: targetAgenda,
            janela_inicio: "2026-10-30",
            data_programada: "2026-10-30",
            acao_sanitaria: "vacinacao",
            client_id: "fixture-device",
            client_recorded_at: "2026-10-30T12:00:00Z",
          },
          animal_ids: [animals[0]],
        },
        "create_agenda",
      );
      const stock = (seq) => {
        const g = group([animals[0]], participant, seq);
        g.event_payload.source_sanitario_agenda_v2_id = targetAgenda;
        g.detail_payload.insumo_id = supply;
        g.detail_payload.estoque_lote_id = lot;
        g.event_payload.payload.inventory_movement = {
          id: g.event_payload.id,
          insumo_id: supply,
          insumo_lote_id: lot,
          quantidade_base: 10,
          unidade_base: "ml",
          client_op_id: randomUUID(),
          domain_op_id: randomUUID(),
        };
        return g;
      };
      const a = stock(1),
        b = stock(2);
      Object.assign(b.detail_payload, {
        carencia_carne_dias: 7,
        carencia_carne_ate: "2026-11-06T12:00:00Z",
        custo_unitario_snapshot: 2,
        custo_total_snapshot: 20,
      });
      await admit(a, "apply_factual_core");
      assert.equal((await admit(b, "apply_factual_core")).outcome, "collision");
      const resolve = {
        ...args(),
        payload: {
          agenda_id: targetAgenda,
          action: "resolve",
          declaration_id: b.client_op_id,
          decision: "additional",
          reason: "Segunda aplicação efetivamente realizada",
        },
      };
      const r = await admit(resolve);
      assert(r.evento_id);
      assert.equal(
        await sql(
          `select carencia_carne_dias from public.eventos_sanitario where evento_id='${r.evento_id}'`,
        ),
        "7",
      );
      assert.equal(
        Number(
          await sql(
            `select custo_total_snapshot from public.eventos_sanitario where evento_id='${r.evento_id}'`,
          ),
        ),
        20,
      );
      assert.deepEqual(await admit(resolve), r);
      assert.equal(
        Number(
          await sql(
            `select saldo_atual_base from public.insumo_lotes where id='${lot}'`,
          ),
        ),
        80,
      );
      assert.equal(
        await sql(
          `select count(*) from public.insumo_movimentacoes where insumo_lote_id='${lot}'`,
        ),
        "2",
      );
      assert.equal(
        await sql(
          `select evento_id from public.sanitario_atendimentos where fazenda_id='${farm}' and obrigacao_origem_agenda_id='${targetAgenda}'`,
        ),
        a.event_payload.id,
      );
      assert.equal(
        await sql(
          `select em_disputa from public.sanitario_atendimentos where fazenda_id='${farm}' and obrigacao_origem_agenda_id='${targetAgenda}'`,
        ),
        "f",
      );
      assert.equal(
        await sql(
          `select sanitario_v3_confirmation from public.eventos where id='${b.event_payload.id}'`,
        ),
        "collision",
      );
      const unavailable = stock(3);
      unavailable.event_payload.payload.inventory_movement.quantidade_base = 200;
      await admit(unavailable, "apply_factual_core");
      const failing = {
        ...args(),
        payload: {
          agenda_id: targetAgenda,
          action: "resolve",
          declaration_id: unavailable.client_op_id,
          decision: "additional",
          reason: "Aplicação declarada requer reconciliação de estoque",
        },
      };
      await assert.rejects(
        () => admit(failing),
        /INSUFFICIENT|saldo|quantidade|inventory|negativ/i,
      );
      assert.equal(
        await sql(
          `select count(*) from public.eventos where id='${failing.domain_op_id}'`,
        ),
        "0",
      );
      assert.equal(
        await sql(
          `select resolution is null from public.sanitario_participacao_operacoes where id='${unavailable.client_op_id}'`,
        ),
        "t",
      );
      assert.equal(
        await sql(
          `select count(*) from public.insumo_movimentacoes where insumo_lote_id='${lot}'`,
        ),
        "2",
      );
    },
  );
  await t.test(
    "late recognition appends a revised result, keeps original snapshot and consumes only on explicit recognition",
    async () => {
      const targetAgenda = randomUUID(),
        participant = randomUUID();
      await admit(
        {
          ...args(),
          payload: {
            id: targetAgenda,
            dedup_key: targetAgenda,
            janela_inicio: "2026-10-30",
            data_programada: "2026-10-30",
            acao_sanitaria: "vacinacao",
            client_id: "fixture-device",
            client_recorded_at: "2026-10-30T12:00:00Z",
          },
          animal_ids: [animals[1], animals[2]],
        },
        "create_agenda",
      );
      const m = (action, fields = {}) => ({
        ...args(),
        payload: { agenda_id: targetAgenda, action, ...fields },
      });
      const a = group([animals[1]], participant, 1);
      a.event_payload.source_sanitario_agenda_v2_id = targetAgenda;
      await admit(a, "apply_factual_core");
      await admit(
        m("complete", { participation_id: participant, final_sequence: 1 }),
      );
      const b = await admit(
        m("prepare_close", {
          not_executed: [{ animal_id: animals[2], reason: "Ausente" }],
        }),
      );
      const original = await admit(
        m("confirm_close", { barrier_id: b.barrier_id }),
      );
      const late = group([animals[2]], randomUUID(), 1);
      late.event_payload.source_sanitario_agenda_v2_id = targetAgenda;
      assert.equal((await admit(late, "apply_factual_core")).outcome, "late");
      const recognition = m("reconcile_late", {
        declaration_id: late.client_op_id,
        decision: "accepted",
        reason: "Fato comprovado, executado antes do fechamento",
      });
      const recognized = await admit(recognition);
      assert(recognized.evento_id);
      assert.deepEqual(await admit(recognition), recognized);
      assert.equal(
        await sql(
          `select status from public.sanitario_agenda_v2 where id='${targetAgenda}'`,
        ),
        "fechada",
      );
      assert.equal(
        await sql(
          `select count(*) from public.sanitario_agenda_resultados where agenda_id='${targetAgenda}'`,
        ),
        "2",
      );
      assert.equal(
        await sql(
          `select count(*) from public.sanitario_atendimentos where fazenda_id='${farm}' and obrigacao_origem_agenda_id='${targetAgenda}'`,
        ),
        "2",
      );
      assert.equal(
        await sql(
          `select snapshot->'animals' = ${quote(JSON.stringify(original.snapshot.animals))}::jsonb from public.sanitario_agenda_resultados where id='${original.result_id}'`,
        ),
        "t",
      );
    },
  );
  await t.test(
    "new known participation invalidates a prepared barrier; missing final cannot be waived",
    async () => {
      const targetAgenda = randomUUID();
      await admit(
        {
          ...args(),
          payload: {
            id: targetAgenda,
            dedup_key: targetAgenda,
            janela_inicio: "2026-10-30",
            data_programada: "2026-10-30",
            acao_sanitaria: "vacinacao",
            client_id: "fixture-device",
            client_recorded_at: "2026-10-30T12:00:00Z",
          },
          animal_ids: [animals[3]],
        },
        "create_agenda",
      );
      const m = (action, fields = {}) => ({
        ...args(),
        payload: { agenda_id: targetAgenda, action, ...fields },
      });
      const b = await admit(
        m("prepare_close", {
          not_executed: [{ animal_id: animals[3], reason: "Ausente" }],
        }),
      );
      await admit(m("participate", { participation_id: randomUUID() }));
      await assert.rejects(
        () => admit(m("confirm_close", { barrier_id: b.barrier_id })),
        /SANITARIO_CLOSING_SNAPSHOT_STALE/,
      );
      await assert.rejects(
        () =>
          admit(
            m("prepare_close", {
              not_executed: [{ animal_id: animals[3], reason: "Ausente" }],
            }),
          ),
        /SANITARIO_PARTICIPANTS_INCOMPLETE/,
      );
    },
  );
  await t.test(
    "lost planning ACK is recovered before a later participation barrier",
    async () => {
      const targetAgenda = randomUUID();
      await admit(
        {
          ...args(),
          payload: {
            id: targetAgenda,
            dedup_key: targetAgenda,
            janela_inicio: "2026-10-30",
            data_programada: "2026-10-30",
            acao_sanitaria: "vacinacao",
            client_id: "fixture-device",
            client_recorded_at: "2026-10-30T12:00:00Z",
          },
          animal_ids: [animals[4]],
        },
        "create_agenda",
      );
      const schedule = {
        ...args(),
        agenda_id: targetAgenda,
        expected_revision: 0,
        planned_for: "2026-11-04",
      };
      const original = await admit(schedule, "reschedule_agenda");
      await admit({
        ...args(),
        payload: {
          agenda_id: targetAgenda,
          action: "participate",
          participation_id: randomUUID(),
        },
      });
      assert.deepEqual(await admit(schedule, "reschedule_agenda"), original);
      assert.equal(
        (await admit(schedule, "reschedule_agenda", owner, true)).outcome,
        "found",
      );
    },
  );
  await t.test(
    "a pre-upgrade immutable envelope becomes a durable segment which its original operator explicitly completes",
    async () => {
      const targetAgenda = randomUUID();
      await admit(
        {
          ...args(),
          payload: {
            id: targetAgenda,
            dedup_key: targetAgenda,
            janela_inicio: "2026-10-30",
            data_programada: "2026-10-30",
            acao_sanitaria: "vacinacao",
            client_id: "fixture-device",
            client_recorded_at: "2026-10-30T12:00:00Z",
          },
          animal_ids: [animals[5]],
        },
        "create_agenda",
      );
      const original = group([animals[5]], randomUUID(), 1, cowboy);
      original.event_payload.source_sanitario_agenda_v2_id = targetAgenda;
      delete original.event_payload.payload.participation_id;
      delete original.event_payload.payload.participation_sequence;
      await admit(original, "apply_factual_core");
      assert.equal(
        await sql(
          `select final_sequence is null from public.sanitario_participacoes where id='${original.domain_op_id}'`,
        ),
        "t",
      );
      await admit({
        ...args(cowboy),
        payload: {
          agenda_id: targetAgenda,
          action: "complete",
          participation_id: original.domain_op_id,
          final_sequence: 1,
        },
      });
      assert.equal(
        await sql(
          `select final_sequence from public.sanitario_participacoes where id='${original.domain_op_id}'`,
        ),
        "1",
      );
    },
  );
  await t.test(
    "started continuation can be administratively cancelled only after known participants complete, unlocking a true late fact",
    async () => {
      const targetAgenda = randomUUID();
      await admit(
        {
          ...args(),
          payload: {
            id: targetAgenda,
            dedup_key: targetAgenda,
            janela_inicio: "2026-10-30",
            data_programada: "2026-10-30",
            acao_sanitaria: "vacinacao",
            client_id: "fixture-device",
            client_recorded_at: "2026-10-30T12:00:00Z",
          },
          animal_ids: [animals[6]],
        },
        "create_agenda",
      );
      const m = (action, fields = {}, id = targetAgenda, actor = owner) => ({
        ...args(actor),
        payload: { agenda_id: id, action, ...fields },
      });
      const barrier = await admit(
        m("prepare_close", {
          not_executed: [{ animal_id: animals[6], reason: "Ausente" }],
        }),
      );
      const result = await admit(
        m("confirm_close", { barrier_id: barrier.barrier_id }),
      );
      const request = await admit(
        m("request_continuation", {
          result_id: result.result_id,
          reason: "Retomar",
          animals: [{ animal_id: animals[6], reason: "Ausente" }],
        }),
      );
      const child = await admit(
        m("decide_continuation", {
          request_id: request.request_id,
          decision: "approved",
          planned_for: "2026-11-05",
          reason: "Retomar",
        }),
      );
      const segment = randomUUID();
      await admit(
        m(
          "participate",
          { participation_id: segment },
          child.continuation_id,
          cowboy,
        ),
      );
      const late = group([animals[6]], randomUUID(), 1);
      late.event_payload.source_sanitario_agenda_v2_id = targetAgenda;
      await admit(late, "apply_factual_core");
      const childEvidence = group([animals[6]], segment, 1, cowboy);
      childEvidence.event_payload.source_sanitario_agenda_v2_id =
        child.continuation_id;
      assert.equal(
        (await admit(childEvidence, "apply_factual_core")).outcome,
        "dependency",
      );
      await assert.rejects(
        () =>
          admit(
            m(
              "cancel_continuation",
              { reason: "Revisão de fato tardio" },
              child.continuation_id,
            ),
          ),
        /SANITARIO_PARTICIPANTS_INCOMPLETE/,
      );
      await admit(
        m(
          "complete",
          { participation_id: segment, final_sequence: 1 },
          child.continuation_id,
          cowboy,
        ),
      );
      const cancellation = m(
        "cancel_continuation",
        { reason: "Revisão explícita da dependência" },
        child.continuation_id,
      );
      const cancelled = await admit(cancellation);
      assert.deepEqual(await admit(cancellation), cancelled);
      assert.equal(
        await sql(
          `select status from public.sanitario_agenda_v2 where id='${child.continuation_id}'`,
        ),
        "cancelada",
      );
      const reconciled = await admit(
        m("reconcile_late", {
          declaration_id: late.client_op_id,
          decision: "accepted",
          reason: "Aplicação comprovada, dependência tratada",
        }),
      );
      assert(reconciled.evento_id);
      const recognizeChild = m(
        "resolve",
        {
          declaration_id: childEvidence.client_op_id,
          decision: "additional",
          reason: "Ambas as aplicações factuais comprovadas",
        },
        child.continuation_id,
      );
      assert((await admit(recognizeChild)).evento_id);
      assert.equal(
        await sql(
          `select status from public.sanitario_agenda_v2 where id='${child.continuation_id}'`,
        ),
        "cancelada",
      );
    },
  );
  await t.test(
    "preexisting V3.2 collisions block closure; resolving one never clears another historical dispute",
    async () => {
      const targetAgenda = randomUUID();
      await admit(
        {
          ...args(),
          payload: {
            id: targetAgenda,
            dedup_key: targetAgenda,
            janela_inicio: "2026-10-30",
            data_programada: "2026-10-30",
            acao_sanitaria: "vacinacao",
            client_id: "fixture-device",
            client_recorded_at: "2026-10-30T12:00:00Z",
          },
          animal_ids: [animals[8]],
        },
        "create_agenda",
      );
      const oldAdmit = async (a) =>
        JSON.parse(
          await sql(
            `begin; set local role service_role; select public.internal_sanitario_admit_v3_implementation('${owner}','${farm}','apply_factual_core',${quote(JSON.stringify(a))},false); commit;`,
          ),
        );
      const old = () => {
        const a = group([animals[8]], randomUUID(), 1);
        a.event_payload.source_sanitario_agenda_v2_id = targetAgenda;
        return a;
      };
      const a = old(),
        b = old(),
        c = old();
      await oldAdmit(a);
      assert.equal((await oldAdmit(b)).outcome, "collision");
      assert.equal((await oldAdmit(c)).outcome, "collision");
      const m = (action, fields = {}) => ({
        ...args(),
        payload: { agenda_id: targetAgenda, action, ...fields },
      });
      await assert.rejects(
        () => admit(m("prepare_close")),
        /SANITARIO_UNRESOLVED_EVIDENCE/,
      );
      await assert.rejects(
        () =>
          admit(
            m("resolve", {
              declaration_id: b.client_op_id,
              event_id: b.event_payload.id,
              decision: "additional",
              reason: "Faltam os campos originais de efeitos",
            }),
          ),
        /SANITARIO_HISTORICAL_COMPLEMENT_REQUIRED/,
      );
      await admit(
        m("resolve", {
          declaration_id: b.client_op_id,
          event_id: b.event_payload.id,
          decision: "duplicate",
          reason: "Duplicidade documental comprovada",
        }),
      );
      assert.equal(
        await sql(
          `select em_disputa from public.sanitario_atendimentos where fazenda_id='${farm}' and obrigacao_origem_agenda_id='${targetAgenda}'`,
        ),
        "t",
      );
      await admit(
        m("resolve", {
          declaration_id: c.client_op_id,
          event_id: c.event_payload.id,
          decision: "rejected",
          reason: "Evidência insuficiente, parâmetros não inferidos",
        }),
      );
      assert.equal(
        await sql(
          `select em_disputa from public.sanitario_atendimentos where fazenda_id='${farm}' and obrigacao_origem_agenda_id='${targetAgenda}'`,
        ),
        "f",
      );
      assert.equal(
        await sql(
          `select count(*) from public.sanitario_participacoes where agenda_id='${targetAgenda}'`,
        ),
        "0",
      );
      assert((await admit(m("prepare_close"))).barrier_id);
    },
  );
});
