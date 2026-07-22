import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client } = pg;
const PASSWORD = "SanitarioSyncV2Sentinel1!";

function readEnv() {
  const output = execFileSync("supabase", ["status", "-o", "env"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const env = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (match) env[match[1]] = match[2];
  }
  for (const key of ["DB_URL", "API_URL", "SERVICE_ROLE_KEY"]) {
    if (!env[key]) throw new Error(`supabase status nao retornou ${key}`);
  }
  return env;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function expectError(fn, label, codes = [], messagePart = null) {
  try {
    await fn();
  } catch (error) {
    if (codes.length > 0 && !codes.includes(error.code)) {
      throw new Error(`${label}: SQLSTATE ${error.code ?? "ausente"}; ${error.message}`);
    }
    if (messagePart && !error.message.includes(messagePart)) {
      throw new Error(`${label}: mensagem inesperada: ${error.message}`);
    }
    return error;
  }
  throw new Error(`${label}: deveria falhar`);
}

async function withRole(client, role, fn) {
  await client.query("begin");
  try {
    await client.query(`set local role ${role}`);
    const result = await fn();
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function withAuthenticated(client, userId, fn) {
  return withRole(client, "authenticated", async () => {
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
    return fn();
  });
}

function agendaPayload(id, suffix) {
  return {
    id,
    dedup_key: `sanitario-sync-v2:${suffix}:${id}`,
    client_id: "sanitario-sync-v2-sentinel",
    client_tx_id: randomUUID(),
    client_recorded_at: new Date().toISOString(),
    source_demand_key: null,
    preview_group_id: null,
    protocolo_id: null,
    protocol_item_version_id: null,
    protocol_item_snapshot: {},
    janela_inicio: "2026-07-01",
    janela_fim: "2026-07-31",
    data_programada: "2026-07-21",
    lote_id: null,
    produto_snapshot: {},
    produto_classe: "sentinela",
    acao_sanitaria: "vacinacao sentinela",
    metadata: { sentinel: suffix },
  };
}

function eventPayload(id, agendaId, nature, correctedEventId = null, payload = {}) {
  return {
    id,
    source_sanitario_agenda_v2_id: agendaId,
    natureza: nature,
    occurred_at: new Date().toISOString(),
    animal_id: null,
    lote_id: null,
    corrige_evento_id: correctedEventId,
    observacoes: "sentinela sync sanitario v2",
    payload,
    client_id: "sanitario-sync-v2-sentinel",
    client_tx_id: randomUUID(),
    client_recorded_at: new Date().toISOString(),
  };
}

function detailPayload(overrides = {}) {
  return {
    tipo: "vacinacao",
    produto_sanitario_v2_id: null,
    insumo_id: null,
    estoque_lote_id: null,
    produto_nome_snapshot: "Produto sentinela",
    produto_snapshot: { nome: "Produto sentinela" },
    estoque_lote_codigo_snapshot: null,
    lote_fabricante: null,
    validade_produto: null,
    dose_quantidade: 1,
    dose_unidade: "dose",
    via_aplicacao: "subcutanea",
    responsavel_nome: "Responsavel sentinela",
    responsavel_tipo: "usuario",
    carencia_carne_dias: null,
    carencia_leite_dias: null,
    carencia_carne_ate: null,
    carencia_leite_ate: null,
    custo_unitario_snapshot: null,
    custo_total_snapshot: null,
    payload: { sentinel: true },
    ...overrides,
  };
}

async function callCreateAgenda(client, args) {
  return withRole(client, "service_role", async () => {
    const result = await client.query(
      `select public.internal_sanitario_sync_v2_create_agenda(
        $1, $2, $3, $4, $5,
        jsonb_populate_record(null::public.sanitario_sync_v2_agenda_input, $6::jsonb),
        $7::uuid[]
      ) as result`,
      [args.actorId, args.farmId, args.version ?? 2, args.clientOpId, args.domainOpId,
        JSON.stringify(args.payload), args.animalIds],
    );
    return result.rows[0].result;
  });
}

async function callReplaceAnimals(client, args) {
  return withRole(client, "service_role", async () => {
    const result = await client.query(
      `select public.internal_sanitario_sync_v2_replace_agenda_animals(
        $1, $2, $3, $4, $5, $6, $7, $8, $9::uuid[]
      ) as result`,
      [args.actorId, args.farmId, args.version ?? 2, args.clientOpId, args.domainOpId,
        args.expectedRevision, args.agendaId, "sanitario-sync-v2-sentinel", args.animalIds],
    );
    return result.rows[0].result;
  });
}

async function callFactualCore(client, args) {
  return withRole(client, "service_role", async () => {
    const result = await client.query(
      `select public.internal_sanitario_sync_v2_apply_factual_core(
        $1, $2, $3, $4, $5, $6,
        jsonb_populate_record(null::public.sanitario_sync_v2_event_input, $7::jsonb),
        jsonb_populate_record(null::public.sanitario_sync_v2_detail_input, $8::jsonb),
        array(
          select jsonb_populate_record(null::public.sanitario_sync_v2_event_animal_input, value)
          from jsonb_array_elements($9::jsonb)
        )
      ) as result`,
      [args.actorId, args.farmId, args.version ?? 2, args.clientOpId, args.domainOpId,
        args.expectedRevision, JSON.stringify(args.event), JSON.stringify(args.detail),
        JSON.stringify(args.eventAnimals)],
    );
    return result.rows[0].result;
  });
}

async function callClosure(client, args) {
  return withRole(client, "service_role", async () => {
    const result = await client.query(
      `select public.internal_sanitario_sync_v2_close_agenda(
        $1, $2, $3, $4, $5, $6,
        jsonb_populate_record(null::public.sanitario_sync_v2_closure_input, $7::jsonb)
      ) as result`,
      [args.actorId, args.farmId, args.version ?? 2, args.clientOpId, args.domainOpId,
        args.expectedRevision, JSON.stringify(args.payload)],
    );
    return result.rows[0].result;
  });
}

async function count(client, table, field, value) {
  const result = await client.query(`select count(*)::integer as count from public.${table} where ${field} = $1`, [value]);
  return result.rows[0].count;
}

async function main() {
  const env = readEnv();
  const db = new Client({ connectionString: env.DB_URL });
  const db2 = new Client({ connectionString: env.DB_URL });
  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const users = [];
  const farms = [];
  await db.connect();
  await db2.connect();
  try {
    const run = randomUUID().slice(0, 8);
    for (const label of ["owner", "outsider"]) {
      const { data, error } = await admin.auth.admin.createUser({
        email: `${label}-${run}@sanitario-v2.local`,
        password: PASSWORD,
        email_confirm: true,
      });
      if (error) throw error;
      users.push({ label, id: data.user.id });
    }
    const ownerId = users.find((user) => user.label === "owner").id;
    const outsiderId = users.find((user) => user.label === "outsider").id;

    const farmA = randomUUID();
    const farmB = randomUUID();
    farms.push(farmA, farmB);
    await db.query(
      `insert into public.fazendas(id, nome, created_by) values ($1, $2, $3), ($4, $5, $3)`,
      [farmA, `Sanitario A ${run}`, ownerId, farmB, `Sanitario B ${run}`],
    );
    await db.query(
      `insert into public.user_fazendas(user_id, fazenda_id, role, accepted_at)
       values ($1, $2, 'owner', now()), ($1, $3, 'owner', now())`,
      [ownerId, farmA, farmB],
    );
    const animalA1 = randomUUID();
    const animalA2 = randomUUID();
    const animalB = randomUUID();
    await db.query(
      `insert into public.animais(id, fazenda_id, identificacao, sexo)
       values ($1, $2, $3, 'F'), ($4, $2, $5, 'M'), ($6, $7, $8, 'F')`,
      [animalA1, farmA, `A1-${run}`, animalA2, `A2-${run}`, animalB, farmB, `B-${run}`],
    );

    console.log("1/8 contrato UUID, grants e gate fail-closed");
    const uuidColumns = await db.query(
      `select table_name, column_name, data_type
         from information_schema.columns
        where table_schema = 'public'
          and (table_name, column_name) in (
            ('eventos_animais','id'), ('eventos_animais','evento_id'),
            ('eventos_animais','animal_id'), ('eventos','source_sanitario_agenda_v2_id')
          )`,
    );
    assert(uuidColumns.rows.length === 4 && uuidColumns.rows.every((row) => row.data_type === "uuid"), "PK/FKs novas devem ser UUID");
    await expectError(() => db.query("select 'nao-e-uuid'::uuid"), "UUID invalido", ["22P02"]);

    const functionAcl = await db.query(
      `select p.proname, p.prosecdef, p.proconfig,
              has_function_privilege('service_role', p.oid, 'EXECUTE') as service_exec,
              has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec,
              has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
              has_function_privilege('public', p.oid, 'EXECUTE') as public_exec
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in (
            'internal_sanitario_sync_v2_create_agenda',
            'internal_sanitario_sync_v2_replace_agenda_animals',
            'internal_sanitario_sync_v2_apply_factual_core',
            'internal_sanitario_sync_v2_close_agenda'
          )`,
    );
    assert(functionAcl.rows.length === 4, "quatro funcoes internas esperadas");
    for (const fn of functionAcl.rows) {
      assert(fn.prosecdef === false, `${fn.proname} deve ser SECURITY INVOKER`);
      assert(fn.service_exec && !fn.auth_exec && !fn.anon_exec && !fn.public_exec, `${fn.proname} deve ser exclusiva de service_role`);
      assert(fn.proconfig?.includes("search_path=pg_catalog, public"), `${fn.proname} deve fixar search_path`);
    }

    const blockedAgenda = randomUUID();
    await expectError(
      () => callCreateAgenda(db, {
        actorId: ownerId, farmId: farmA, clientOpId: randomUUID(), domainOpId: randomUUID(),
        payload: agendaPayload(blockedAgenda, "gate-off"), animalIds: [animalA1],
      }),
      "feature flag desligada", ["42501"], "SANITARIO_SYNC_DISABLED",
    );
    assert(await count(db, "sanitario_agenda_v2", "id", blockedAgenda) === 0, "gate off nao pode escrever");

    await db.query(
      `insert into public.sanitario_sync_v2_gates(
        fazenda_id, enabled, minimum_contract_version, maximum_contract_version, updated_by
      ) values ($1, true, 2, 2, $2)`,
      [farmA, ownerId],
    );
    await expectError(
      () => callCreateAgenda(db, {
        actorId: ownerId, farmId: farmA, version: 1, clientOpId: randomUUID(), domainOpId: randomUUID(),
        payload: agendaPayload(randomUUID(), "bad-version"), animalIds: [animalA1],
      }),
      "versao incompatível", ["22023"], "SANITARIO_CLIENT_CONTRACT_OUTDATED",
    );

    console.log("2/8 agenda atomica, limites, replay e revision");
    const invalidAgenda = randomUUID();
    await expectError(
      () => callCreateAgenda(db, {
        actorId: ownerId, farmId: farmA, clientOpId: randomUUID(), domainOpId: randomUUID(),
        payload: agendaPayload(invalidAgenda, "cross-farm"), animalIds: [animalA1, animalB],
      }),
      "agenda cross-farm atomica", ["23503"], "SANITARIO_AGENDA_TARGET_CROSS_FARM_OR_MISSING",
    );
    assert(await count(db, "sanitario_agenda_v2", "id", invalidAgenda) === 0, "agenda invalida nao persiste");
    assert(await count(db, "sanitario_agenda_animais_v2", "agenda_id", invalidAgenda) === 0, "vinculo parcial nao persiste");

    const oversizedAgenda = randomUUID();
    await expectError(
      () => callCreateAgenda(db, {
        actorId: ownerId, farmId: farmA, clientOpId: randomUUID(), domainOpId: randomUUID(),
        payload: agendaPayload(oversizedAgenda, "oversized"),
        animalIds: Array.from({ length: 501 }, () => randomUUID()),
      }),
      "limite pre-write", ["54000"], "SANITARIO_AGENDA_TARGETS_LIMIT_EXCEEDED",
    );
    assert(await count(db, "sanitario_agenda_v2", "id", oversizedAgenda) === 0, "payload excessivo nao escreve");

    const agendaId = randomUUID();
    const agendaClientOp = randomUUID();
    const agendaDomainOp = randomUUID();
    const agenda = agendaPayload(agendaId, "valid");
    const created = await callCreateAgenda(db, {
      actorId: ownerId, farmId: farmA, clientOpId: agendaClientOp, domainOpId: agendaDomainOp,
      payload: agenda, animalIds: [animalA1, animalA2],
    });
    const replayed = await callCreateAgenda(db, {
      actorId: ownerId, farmId: farmA, clientOpId: agendaClientOp, domainOpId: agendaDomainOp,
      payload: agenda, animalIds: [animalA1, animalA2],
    });
    assert(created.agenda_id === agendaId && replayed.agenda_id === agendaId, "replay retorna canônico");
    assert(await count(db, "sanitario_agenda_v2", "id", agendaId) === 1, "replay nao duplica agenda");
    await expectError(
      () => callCreateAgenda(db, {
        actorId: ownerId, farmId: farmA, clientOpId: agendaClientOp, domainOpId: agendaDomainOp,
        payload: { ...agenda, metadata: { changed: true } }, animalIds: [animalA1, animalA2],
      }),
      "23505 nao idempotente", ["23505"], "SANITARIO_IDEMPOTENCY_CONFLICT",
    );
    await expectError(
      () => callReplaceAnimals(db, {
        actorId: ownerId, farmId: farmA, clientOpId: randomUUID(), domainOpId: randomUUID(),
        expectedRevision: null, agendaId, animalIds: [animalA1],
      }),
      "expected revision ausente", ["22004"], "SANITARIO_EXPECTED_REVISION_REQUIRED",
    );
    await expectError(
      () => callReplaceAnimals(db, {
        actorId: ownerId, farmId: farmA, clientOpId: randomUUID(), domainOpId: randomUUID(),
        expectedRevision: 99, agendaId, animalIds: [animalA1],
      }),
      "conflito revision", ["40001"], "SANITARIO_AGENDA_REVISION_CONFLICT",
    );
    await expectError(
      () => callReplaceAnimals(db, {
        actorId: ownerId, farmId: farmA, clientOpId: randomUUID(), domainOpId: randomUUID(),
        expectedRevision: 0, agendaId, animalIds: [animalA1, animalB],
      }),
      "replace cross-farm atomico", ["23503"], "SANITARIO_AGENDA_TARGET_CROSS_FARM_OR_MISSING",
    );
    const preservedTargets = await db.query(
      "select animal_id from public.sanitario_agenda_animais_v2 where agenda_id = $1 order by animal_id",
      [agendaId],
    );
    assert(preservedTargets.rows.length === 2, "replace falho preserva conjunto anterior");

    console.log("3/8 nucleo factual atomico e external_documented");
    const badEventId = randomUUID();
    await expectError(
      () => callFactualCore(db, {
        actorId: ownerId, farmId: farmA, clientOpId: randomUUID(), domainOpId: randomUUID(),
        expectedRevision: null,
        event: eventPayload(badEventId, agendaId, "primary_execution"),
        detail: detailPayload(), eventAnimals: [{ id: randomUUID(), animal_id: animalA1 }, { id: randomUUID(), animal_id: animalA2 }],
      }),
      "execucao sem expected revision", ["22004"], "SANITARIO_EXPECTED_REVISION_REQUIRED",
    );

    const insumoB = randomUUID();
    const loteB = randomUUID();
    await db.query(
      `insert into public.insumos(id, fazenda_id, nome, tipo, unidade_base) values ($1, $2, $3, 'sanitario', 'dose')`,
      [insumoB, farmB, `Insumo B ${run}`],
    );
    await db.query(
      `insert into public.insumo_lotes(id, fazenda_id, insumo_id, quantidade_inicial_base, saldo_atual_base, unidade_base)
       values ($1, $2, $3, 10, 10, 'dose')`,
      [loteB, farmB, insumoB],
    );
    await expectError(
      () => callFactualCore(db, {
        actorId: ownerId, farmId: farmA, clientOpId: randomUUID(), domainOpId: randomUUID(), expectedRevision: 0,
        event: eventPayload(badEventId, agendaId, "primary_execution"),
        detail: detailPayload({ insumo_id: insumoB, estoque_lote_id: loteB }),
        eventAnimals: [{ id: randomUUID(), animal_id: animalA1 }, { id: randomUUID(), animal_id: animalA2 }],
      }),
      "nucleo factual cross-farm", ["23503"], "fk_eventos_sanitario_estoque_lote_fazenda",
    );
    assert(await count(db, "eventos", "id", badEventId) === 0, "evento parcial revertido");
    assert(await count(db, "eventos_sanitario", "evento_id", badEventId) === 0, "detalhe parcial revertido");
    assert(await count(db, "eventos_animais", "evento_id", badEventId) === 0, "relacao parcial revertida");
    const agendaAfterBadCore = await db.query("select status, revision from public.sanitario_agenda_v2 where id = $1", [agendaId]);
    assert(agendaAfterBadCore.rows[0].status === "programada" && Number(agendaAfterBadCore.rows[0].revision) === 0, "agenda permanece intacta");

    const externalId = randomUUID();
    await expectError(
      () => callFactualCore(db, {
        actorId: ownerId, farmId: farmA, clientOpId: randomUUID(), domainOpId: randomUUID(), expectedRevision: null,
        event: eventPayload(externalId, null, "standalone_fact", null, { entry_history_source: "external_documented", evidence_reference: "  " }),
        detail: detailPayload(), eventAnimals: [{ id: randomUUID(), animal_id: animalA1 }],
      }),
      "external_documented sem referencia", ["23514"], "ck_eventos_external_documented_evidence",
    );
    assert(await count(db, "eventos", "id", externalId) === 0, "external invalido nao persiste");

    console.log("4/8 concorrencia first-valid-commit e correcao append-only");
    const concurrentAgendaId = randomUUID();
    await callCreateAgenda(db, {
      actorId: ownerId, farmId: farmA, clientOpId: randomUUID(), domainOpId: randomUUID(),
      payload: agendaPayload(concurrentAgendaId, "concurrent"), animalIds: [animalA1],
    });
    const executions = [0, 1].map((index) => ({
      actorId: ownerId,
      farmId: farmA,
      clientOpId: randomUUID(),
      domainOpId: randomUUID(),
      expectedRevision: 0,
      event: eventPayload(randomUUID(), concurrentAgendaId, "primary_execution"),
      detail: detailPayload(),
      eventAnimals: [{ id: randomUUID(), animal_id: animalA1 }],
      index,
    }));
    const concurrentResults = await Promise.allSettled([
      callFactualCore(db, executions[0]),
      callFactualCore(db2, executions[1]),
    ]);
    assert(concurrentResults.filter((result) => result.status === "fulfilled").length === 1, "uma execucao concorrente deve vencer");
    assert(concurrentResults.filter((result) => result.status === "rejected").length === 1, "uma execucao concorrente deve conflitar");
    const winnerIndex = concurrentResults.findIndex((result) => result.status === "fulfilled");
    const winner = executions[winnerIndex];
    assert(await count(db, "eventos", "source_sanitario_agenda_v2_id", concurrentAgendaId) === 1, "unique primaria impede segundo evento");
    const replayWinner = await callFactualCore(db, winner);
    assert(replayWinner.evento_id === winner.event.id, "replay factual retorna evento canônico");

    const correctionId = randomUUID();
    await callFactualCore(db, {
      actorId: ownerId, farmId: farmA, clientOpId: randomUUID(), domainOpId: randomUUID(), expectedRevision: null,
      event: eventPayload(correctionId, concurrentAgendaId, "correction", winner.event.id),
      detail: detailPayload(), eventAnimals: [{ id: randomUUID(), animal_id: animalA1 }],
    });
    assert(await count(db, "eventos", "source_sanitario_agenda_v2_id", concurrentAgendaId) === 2, "correcao append-only nao colide com unique primaria");
    await expectError(
      () => db.query("update public.eventos_animais set animal_id = $1 where evento_id = $2", [animalA2, correctionId]),
      "relacao factual append-only", ["23514"], "SANITARIO_EVENT_ANIMAL_APPEND_ONLY",
    );

    console.log("5/8 closure atomica e transicao protegida");
    const closureAgendaId = randomUUID();
    await callCreateAgenda(db, {
      actorId: ownerId, farmId: farmA, clientOpId: randomUUID(), domainOpId: randomUUID(),
      payload: agendaPayload(closureAgendaId, "closure"), animalIds: [animalA2],
    });
    const badClosureId = randomUUID();
    await expectError(
      () => callClosure(db, {
        actorId: ownerId, farmId: farmA, clientOpId: randomUUID(), domainOpId: randomUUID(), expectedRevision: 0,
        payload: {
          id: badClosureId, agenda_id: closureAgendaId, closure_type: "cancelled",
          dedup_key: `closure:${badClosureId}`, client_id: "sanitario-sync-v2-sentinel",
          client_tx_id: randomUUID(), client_recorded_at: new Date().toISOString(),
          closed_at: new Date().toISOString(), reason: " ", partial_payload: {}, metadata: {},
        },
      }),
      "closure deve reverter inteira", ["23514"], "ck_sanitario_agenda_closures_v2_reason_required",
    );
    assert(await count(db, "sanitario_agenda_closures_v2", "id", badClosureId) === 0, "closure invalida nao persiste");
    const closureAgendaBefore = await db.query("select status, revision from public.sanitario_agenda_v2 where id = $1", [closureAgendaId]);
    assert(closureAgendaBefore.rows[0].status === "programada" && Number(closureAgendaBefore.rows[0].revision) === 0, "closure falha nao muda agenda");
    await expectError(
      () => db.query("update public.sanitario_agenda_v2 set status = 'cancelada' where id = $1", [closureAgendaId]),
      "update separado de status", ["42501"], "SANITARIO_AGENDA_TRANSITION_REQUIRES_INTERNAL_FUNCTION",
    );
    const goodClosureId = randomUUID();
    await callClosure(db, {
      actorId: ownerId, farmId: farmA, clientOpId: randomUUID(), domainOpId: randomUUID(), expectedRevision: 0,
      payload: {
        id: goodClosureId, agenda_id: closureAgendaId, closure_type: "cancelled",
        dedup_key: `closure:${goodClosureId}`, client_id: "sanitario-sync-v2-sentinel",
        client_tx_id: randomUUID(), client_recorded_at: new Date().toISOString(),
        closed_at: new Date().toISOString(), reason: "cancelamento sentinela", partial_payload: {}, metadata: {},
      },
    });
    const closureAgendaAfter = await db.query("select status, revision from public.sanitario_agenda_v2 where id = $1", [closureAgendaId]);
    assert(closureAgendaAfter.rows[0].status === "cancelada" && Number(closureAgendaAfter.rows[0].revision) === 1, "closure muda status e revision");
    assert(await count(db, "sanitario_agenda_closures_v2", "id", goodClosureId) === 1, "closure valida persiste");

    console.log("6/8 RLS outsider e FK cross-farm");
    await withAuthenticated(db, outsiderId, async () => {
      const read = await db.query("select count(*)::integer as count from public.eventos_animais where fazenda_id = $1", [farmA]);
      assert(read.rows[0].count === 0, "outsider nao le eventos_animais");
      await expectError(
        () => db.query(
          "insert into public.eventos_animais(id, fazenda_id, evento_id, animal_id) values ($1, $2, $3, $4)",
          [randomUUID(), farmA, winner.event.id, animalA1],
        ),
        "outsider nao escreve eventos_animais", ["42501"],
      );
    });
    await expectError(
      () => withRole(db, "service_role", () => db.query(
        "insert into public.eventos_animais(id, fazenda_id, evento_id, animal_id) values ($1, $2, $3, $4)",
        [randomUUID(), farmA, winner.event.id, animalB],
      )),
      "FK evento-animal cross-farm", ["23503"], "fk_eventos_animais_animal_fazenda",
    );

    console.log("7/8 movimento idempotente sem segunda baixa");
    const insumoA = randomUUID();
    const loteA = randomUUID();
    await db.query(
      `insert into public.insumos(id, fazenda_id, nome, tipo, unidade_base) values ($1, $2, $3, 'sanitario', 'dose')`,
      [insumoA, farmA, `Insumo A ${run}`],
    );
    await db.query(
      `insert into public.insumo_lotes(id, fazenda_id, insumo_id, quantidade_inicial_base, saldo_atual_base, unidade_base)
       values ($1, $2, $3, 100, 100, 'dose')`,
      [loteA, farmA, insumoA],
    );
    const movementDomain = winner.domainOpId;
    const insertMovement = (id, clientOpId) => db.query(
      `insert into public.insumo_movimentacoes(
        id, fazenda_id, insumo_id, insumo_lote_id, tipo, quantidade_base, unidade_base,
        source_evento_id, source_evento_dominio, client_op_id, domain_op_id
      ) values ($1, $2, $3, $4, 'consumo_sanitario', 1, 'dose', $5, 'sanitario', $6, $7)`,
      [id, farmA, insumoA, loteA, winner.event.id, clientOpId, movementDomain],
    );
    await insertMovement(randomUUID(), randomUUID());
    await expectError(
      () => insertMovement(randomUUID(), randomUUID()),
      "movimento repetido", ["23505"], "ux_insumo_movimentacoes_source_lote_tipo",
    );
    const stock = await db.query("select saldo_atual_base from public.insumo_lotes where id = $1", [loteA]);
    assert(Number(stock.rows[0].saldo_atual_base) === 99, "retry nao pode baixar saldo duas vezes");

    console.log("8/8 executor observado e isolamento final");
    const executor = await db.query(
      `select count(*)::integer as count from public.sanitario_sync_v2_operations
        where fazenda_id = $1 and executor_role = 'service_role'`,
      [farmA],
    );
    const totalOps = await db.query(
      "select count(*)::integer as count from public.sanitario_sync_v2_operations where fazenda_id = $1",
      [farmA],
    );
    assert(executor.rows[0].count === totalOps.rows[0].count && totalOps.rows[0].count > 0, "ledger deve observar apenas service_role");

    console.log("OK sentinelas Sync Sanitario v2 expand validadas");
  } finally {
    await db.query("reset role").catch(() => undefined);
    // Fatos append-only podem impedir a exclusao fisica da fazenda fixture.
    // O gate deve sempre voltar ao estado fail-closed, inclusive em falhas.
    for (const farmId of farms) {
      await db.query(
        "update public.sanitario_sync_v2_gates set enabled = false where fazenda_id = $1",
        [farmId],
      ).catch(() => undefined);
    }
    for (const farmId of farms.reverse()) {
      await db.query("delete from public.fazendas where id = $1", [farmId]).catch(() => undefined);
    }
    for (const user of users) {
      await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
    }
    await db.end();
    await db2.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
