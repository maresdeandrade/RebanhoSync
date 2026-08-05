import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client } = pg;

const CLIENT_ID = "dry-cow-functional";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const AS_OF = "2026-05-10";
const EXPECTED_CALVING_DATE = "2026-07-10";

function readSupabaseStatusEnv() {
  if (
    process.env.DB_URL &&
    process.env.API_URL &&
    process.env.SERVICE_ROLE_KEY
  ) {
    return {
      DB_URL: process.env.DB_URL.trim(),
      API_URL: process.env.API_URL.trim(),
      SERVICE_ROLE_KEY: process.env.SERVICE_ROLE_KEY.trim(),
    };
  }

  const output = execFileSync("supabase", ["status", "-o", "env"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const env = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(?:"([\s\S]*)"|'([\s\S]*)'|([^\s].*))$/);
    if (match) env[match[1]] = match[2] ?? match[3] ?? match[4] ?? "";
  }

  for (const key of ["DB_URL", "API_URL", "SERVICE_ROLE_KEY"]) {
    if (!env[key]) throw new Error(`supabase status -o env nao retornou ${key}`);
  }

  return env;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertLocalTarget(env) {
  let database;
  let api;
  try {
    database = new URL(env.DB_URL);
    api = new URL(env.API_URL);
  } catch (error) {
    throw new Error(`Configuracao Supabase invalida: ${error.message}`);
  }
  assert(["postgres:", "postgresql:"].includes(database.protocol), "DB_URL deve ser PostgreSQL");
  assert(LOCAL_HOSTS.has(database.hostname), `Validacao bloqueada fora do banco local: ${database.hostname}`);
  assert(LOCAL_HOSTS.has(api.hostname), `Validacao bloqueada fora da API local: ${api.hostname}`);
}

async function createAuthUser(adminClient, runId, password) {
  const email = `dry-cow-${runId}@functional.local`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { functional_fixture: CLIENT_ID, run_id: runId },
  });

  if (error) throw new Error(`falha ao criar auth user: ${error.message}`);
  return { id: data.user.id, email };
}

async function withRole(client, role, fn) {
  await client.query("reset role");
  await client.query(`set local role ${role}`);
  return fn();
}

async function withAuthenticatedUser(client, userId, fn) {
  return withRole(client, "authenticated", async () => {
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
    return fn();
  });
}

async function withServiceRole(client, fn) {
  return withRole(client, "service_role", fn);
}

function dryCowPayload({ activated }) {
  const payload = {
    standard_id: "med-mastite-seca",
    family_code: "terapia_vaca_seca",
    item_code: "secagem-intramamario",
    protocol_id: "med-mastite-seca",
    calendario_base: {
      mode: "clinical_protocol",
      anchor: "dry_off",
    },
    dry_cow_therapy: {
      activation_status: activated
        ? "operational_agenda_enabled"
        : "clinical_support_only",
      materialization_contract_version: 1,
    },
  };

  if (activated) {
    payload.materialization_contract_version = 1;
    payload.agenda_activation = {
      mode: "dry_off_reproductive_window",
      source: "farm_protocol_explicit_activation",
      contract_version: 1,
    };
  }

  return payload;
}

function animalPayload({ dried = false } = {}) {
  return {
    taxonomy_facts: {
      em_lactacao: !dried,
      secagem_realizada: dried,
      data_prevista_parto: EXPECTED_CALVING_DATE,
    },
  };
}

async function createDryCowAnimal(client, fazendaId, loteId, runId, label, animalId) {
  await client.query(
    `
      insert into public.animais (
        id, fazenda_id, identificacao, sexo, status, lote_id, data_nascimento,
        especie, payload, client_id, client_op_id, client_recorded_at
      )
      values ($1, $2, $3, 'F', 'ativo', $4, '2022-01-01', 'bovino', $5, $6, $7, now())
    `,
    [
      animalId,
      fazendaId,
      `Vaca Seca ${label} ${runId}`,
      loteId,
      animalPayload(),
      CLIENT_ID,
      randomUUID(),
    ],
  );
  return animalId;
}

async function countDryCowAgenda(client, fazendaId, animalId, status) {
  const result = await client.query(
    `
      select count(*)::integer as count
      from public.agenda_itens
      where fazenda_id = $1
        and animal_id = $2
        and dominio = 'sanitario'
        and payload #>> '{regime_sanitario,family_code}' = 'terapia_vaca_seca'
        and payload->>'item_code' = 'secagem-intramamario'
        and status = $3
    `,
    [fazendaId, animalId, status],
  );
  return result.rows[0].count;
}

async function getOpenDryCowAgenda(client, fazendaId, animalId) {
  const result = await client.query(
    `
      select id, data_prevista, dedup_key, payload, source_evento_id
      from public.agenda_itens
      where fazenda_id = $1
        and animal_id = $2
        and dominio = 'sanitario'
        and payload #>> '{regime_sanitario,family_code}' = 'terapia_vaca_seca'
        and payload->>'item_code' = 'secagem-intramamario'
        and status = 'agendado'
        and deleted_at is null
      order by created_at desc
      limit 1
    `,
    [fazendaId, animalId],
  );
  return result.rows[0] ?? null;
}

async function main() {
  const runId = randomUUID().slice(0, 8);
  const password = `DryCow-${randomUUID()}-Aa1!`;
  console.log(`Iniciando validacao funcional Vaca Seca (${runId})`);

  const env = readSupabaseStatusEnv();
  assertLocalTarget(env);
  const adminClient = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const dbClient = new Client({ connectionString: env.DB_URL });
  let user = null;
  let transactionOpen = false;
  await dbClient.connect();

  try {
    await dbClient.query("begin");
    transactionOpen = true;
    await dbClient.query("set local lock_timeout = '5s'");
    await dbClient.query("set local statement_timeout = '60s'");

    user = await createAuthUser(adminClient, runId, password);
    console.log(`Usuario criado: ${user.email}`);

    const fazendaId = await withAuthenticatedUser(dbClient, user.id, async () => {
      await dbClient.query(
        "insert into public.user_profiles(user_id, display_name) values ($1, $2)",
        [user.id, `Dry Cow ${runId}`],
      );
      await dbClient.query("insert into public.user_settings(user_id) values ($1)", [
        user.id,
      ]);
      const result = await dbClient.query(
        `
          select public.create_fazenda(
            $1, $2, $3, 'GO'::public.estado_uf_enum, null, 120,
            'leite'::public.tipo_producao_enum,
            'pastagem'::public.sistema_manejo_enum
          ) as id
        `,
        [`Fazenda Vaca Seca ${runId}`, `dry-cow-${runId}`, "Teste"],
      );
      return result.rows[0].id;
    });
    console.log(`Fazenda criada: ${fazendaId}`);

    const loteId = randomUUID();
    const protocolId = randomUUID();
    const itemId = randomUUID();
    const animalCompleteId = randomUUID();
    const animalCancelId = randomUUID();

    await withServiceRole(dbClient, async () => {
      await dbClient.query(
        `
          insert into public.lotes(id, fazenda_id, nome, client_id, client_op_id, client_recorded_at)
          values ($1, $2, $3, $4, $5, now())
        `,
        [loteId, fazendaId, `Lote Vaca Seca ${runId}`, CLIENT_ID, randomUUID()],
      );
      await dbClient.query(
        `
          insert into public.protocolos_sanitarios(
            id, fazenda_id, nome, ativo, payload, client_id, client_op_id, client_recorded_at
          )
          values ($1, $2, 'Terapia de Vaca Seca', true, $3, $4, $5, now())
        `,
        [
          protocolId,
          fazendaId,
          {
            origem: "biblioteca_canonica_fazenda",
            standard_id: "med-mastite-seca",
            family_code: "terapia_vaca_seca",
          },
          CLIENT_ID,
          randomUUID(),
        ],
      );
      await dbClient.query(
        `
          insert into public.protocolos_sanitarios_itens(
            id, fazenda_id, protocolo_id, logical_item_key, item_code, version, ativo, tipo, produto,
            intervalo_dias, dose_num, gera_agenda, payload, client_id, client_op_id,
            client_recorded_at
          )
          values ($1, $2, $3, $4, 'secagem-intramamario', 1, true, 'medicamento', $5, 60, 1, false, $6,
                  $7, $8, now())
        `,
        [
          itemId,
          fazendaId,
          protocolId,
          randomUUID(),
          "Antibiotico Intramamario (Vaca Seca)",
          dryCowPayload({ activated: false }),
          CLIENT_ID,
          randomUUID(),
        ],
      );
      await createDryCowAnimal(dbClient, fazendaId, loteId, runId, "conclusao", animalCompleteId);
      await createDryCowAnimal(dbClient, fazendaId, loteId, runId, "cancelamento", animalCancelId);
    });

    const inactiveInsert = await withAuthenticatedUser(dbClient, user.id, async () => {
      const result = await dbClient.query(
        "select public.sanitario_recompute_agenda_core($1, $2, $3::date) as inserted",
        [fazendaId, animalCompleteId, AS_OF],
      );
      return Number(result.rows[0].inserted);
    });
    assert(inactiveInsert === 0, "item clinico sem ativacao nao deve materializar agenda");
    console.log("OK: item clinico sem ativacao nao materializa agenda");

    await withServiceRole(dbClient, async () => {
      await dbClient.query(
        `
          update public.protocolos_sanitarios_itens
          set gera_agenda = true,
              intervalo_dias = 60,
              payload = $1,
              updated_at = now()
          where id = $2 and fazenda_id = $3
        `,
        [dryCowPayload({ activated: true }), itemId, fazendaId],
      );
    });
    console.log("OK: protocolo da fazenda ativado para agenda de Vaca Seca");

    const firstInsert = await withAuthenticatedUser(dbClient, user.id, async () => {
      const result = await dbClient.query(
        "select public.sanitario_recompute_agenda_core($1, $2, $3::date) as inserted",
        [fazendaId, animalCompleteId, AS_OF],
      );
      return Number(result.rows[0].inserted);
    });
    assert(firstInsert === 1, "primeiro recompute deve materializar 1 agenda");

    const agenda = await getOpenDryCowAgenda(dbClient, fazendaId, animalCompleteId);
    assert(agenda, "agenda materializada deve existir");
    assert(
      agenda.data_prevista.toISOString().slice(0, 10) === "2026-05-11",
      "data prevista deve ser parto previsto - 60 dias",
    );
    assert(
      agenda.dedup_key ===
        `sanitario:animal:${animalCompleteId}:terapia_vaca_seca:secagem-intramamario:v1:window:${EXPECTED_CALVING_DATE}`,
      "dedup de Vaca Seca deve ser por ciclo de parto previsto",
    );
    assert(
      agenda.payload.source === "dry_cow_therapy_sql_recompute",
      "payload deve indicar origem do recompute SQL",
    );
    console.log(`OK: agenda materializada ${agenda.id}`);

    const secondInsert = await withAuthenticatedUser(dbClient, user.id, async () => {
      const result = await dbClient.query(
        "select public.sanitario_recompute_agenda_core($1, $2, $3::date) as inserted",
        [fazendaId, animalCompleteId, AS_OF],
      );
      return Number(result.rows[0].inserted);
    });
    assert(secondInsert === 0, "segundo recompute nao deve duplicar agenda");
    assert(
      (await countDryCowAgenda(dbClient, fazendaId, animalCompleteId, "agendado")) ===
        1,
      "deve haver apenas 1 agenda aberta apos recompute repetido",
    );
    console.log("OK: recompute repetido nao duplica agenda");

    const eventoId = await withAuthenticatedUser(dbClient, user.id, async () => {
      const result = await dbClient.query(
        `
          select public.sanitario_complete_agenda_with_event(
            $1, $2::timestamptz, 'medicamento'::public.sanitario_tipo_enum,
            $3, $4, $5, $6, $7, $8, now()
          ) as evento_id
        `,
        [
          agenda.id,
          `${AS_OF}T12:00:00.000-03:00`,
          "Antibiotico Intramamario (Vaca Seca)",
          "Secagem validada por teste funcional",
          {
            dry_cow_therapy: {
              schema_version: 1,
              protocol_id: "med-mastite-seca",
              item_id: "secagem-intramamario",
              performed_at: `${AS_OF}T12:00:00.000-03:00`,
              expected_calving_date: EXPECTED_CALVING_DATE,
              days_until_expected_calving: 61,
              readiness_decision: "candidate_for_future_agenda_contract",
              agenda_materialization_allowed: false,
              dry_off_dedup_key: agenda.dedup_key,
              source: "manual_dry_off_event",
            },
          },
          CLIENT_ID,
          randomUUID(),
          randomUUID(),
        ],
      );
      return result.rows[0].evento_id;
    });

    const completion = await dbClient.query(
      `
        select
          ai.status,
          ai.source_evento_id,
          e.payload #>> '{dry_cow_therapy,dry_off_dedup_key}' as event_dedup,
          es.payload #>> '{dry_cow_therapy,dry_off_dedup_key}' as sanitario_dedup
        from public.agenda_itens ai
        join public.eventos e on e.id = ai.source_evento_id and e.fazenda_id = ai.fazenda_id
        join public.eventos_sanitario es on es.evento_id = e.id and es.fazenda_id = e.fazenda_id
        where ai.id = $1 and ai.fazenda_id = $2
      `,
      [agenda.id, fazendaId],
    );
    assert(completion.rows[0]?.status === "concluido", "agenda deve ficar concluida");
    assert(
      completion.rows[0]?.source_evento_id === eventoId,
      "agenda deve apontar para o evento criado",
    );
    assert(
      completion.rows[0]?.event_dedup === agenda.dedup_key &&
        completion.rows[0]?.sanitario_dedup === agenda.dedup_key,
      "evento e eventos_sanitario devem carregar dry_off_dedup_key",
    );
    console.log(`OK: agenda concluida por evento ${eventoId}`);

    const postCompletionInsert = await withAuthenticatedUser(
      dbClient,
      user.id,
      async () => {
        const result = await dbClient.query(
          "select public.sanitario_recompute_agenda_core($1, $2, $3::date) as inserted",
          [fazendaId, animalCompleteId, AS_OF],
        );
        return Number(result.rows[0].inserted);
      },
    );
    assert(
      postCompletionInsert === 0 &&
        (await countDryCowAgenda(dbClient, fazendaId, animalCompleteId, "agendado")) ===
          0,
      "recompute apos evento nao deve recriar agenda concluida",
    );
    console.log("OK: evento dry_cow_therapy bloqueia recriacao da agenda");

    await withAuthenticatedUser(dbClient, user.id, async () => {
      await dbClient.query(
        "select public.sanitario_recompute_agenda_core($1, $2, $3::date)",
        [fazendaId, animalCancelId, AS_OF],
      );
    });
    assert(
      (await countDryCowAgenda(dbClient, fazendaId, animalCancelId, "agendado")) === 1,
      "animal de cancelamento deve iniciar com agenda aberta",
    );

    await withServiceRole(dbClient, async () => {
      await dbClient.query(
        `
          update public.animais
          set payload = $1,
              updated_at = now()
          where id = $2 and fazenda_id = $3
        `,
        [animalPayload({ dried: true }), animalCancelId, fazendaId],
      );
    });
    await withAuthenticatedUser(dbClient, user.id, async () => {
      await dbClient.query(
        "select public.sanitario_recompute_agenda_core($1, $2, $3::date)",
        [fazendaId, animalCancelId, AS_OF],
      );
    });
    assert(
      (await countDryCowAgenda(dbClient, fazendaId, animalCancelId, "agendado")) === 0,
      "agenda aberta deve ser cancelada quando secagem_realizada=true",
    );
    assert(
      (await countDryCowAgenda(dbClient, fazendaId, animalCancelId, "cancelado")) ===
        1,
      "cancelamento anti-zumbi deve ficar registrado",
    );
    console.log("OK: anti-agenda-zumbi cancela pendencia invalida");

    console.log(JSON.stringify({
      result: "PASS",
      run_id: runId,
      agenda_concluida: agenda.id,
      evento_factual: eventoId,
      cancelamento_anti_zumbi: "validado",
      persisted_after_test: false,
    }, null, 2));
  } finally {
    if (transactionOpen) {
      await dbClient.query("reset role").catch(() => undefined);
      await dbClient.query("rollback").catch(() => undefined);
    }
    if (user) {
      const { error } = await adminClient.auth.admin.deleteUser(user.id);
      if (error) console.warn(`WARNING usuario de teste nao removido: ${error.message}`);
    }
    await dbClient.end();
  }
}

main().catch((error) => {
  console.error(`Falha na validacao funcional Vaca Seca: ${error.message}`);
  process.exit(1);
});
