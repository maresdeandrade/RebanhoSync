import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client } = pg;

const DEFAULT_PASSWORD = "SupabaseFunctional1!";
const AS_OF = "2026-05-10";
const EXPECTED_CALVING_DATE = "2026-07-10";

function readSupabaseStatusEnv() {
  if (
    process.env.DB_URL &&
    process.env.API_URL &&
    process.env.ANON_KEY &&
    process.env.SERVICE_ROLE_KEY
  ) {
    return {
      DB_URL: process.env.DB_URL,
      API_URL: process.env.API_URL,
      ANON_KEY: process.env.ANON_KEY,
      SERVICE_ROLE_KEY: process.env.SERVICE_ROLE_KEY,
    };
  }

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

  for (const key of ["DB_URL", "API_URL", "ANON_KEY", "SERVICE_ROLE_KEY"]) {
    if (!env[key]) throw new Error(`supabase status -o env nao retornou ${key}`);
  }

  return env;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createAuthUser(adminClient, runId) {
  const email = `dry-cow-${runId}@functional.local`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { dry_cow_functional_test: true },
  });

  if (error) throw new Error(`falha ao criar auth user: ${error.message}`);
  return { id: data.user.id, email };
}

async function withAuthenticatedUser(client, userId, fn) {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [
      userId,
    ]);
    await client.query(
      "select set_config('request.jwt.claim.role', 'authenticated', true)",
    );
    const result = await fn();
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function withServiceRole(client, fn) {
  await client.query("begin");
  try {
    await client.query("set local role service_role");
    const result = await fn();
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
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

async function createDryCowAnimal(client, fazendaId, loteId, runId, label) {
  const animalId = randomUUID();
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
      "dry-cow-functional",
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
  console.log(`Iniciando validacao funcional Vaca Seca (${runId})`);

  const env = readSupabaseStatusEnv();
  const adminClient = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    db: { url: env.DB_URL },
  });
  const dbClient = new Client({ connectionString: env.DB_URL });
  await dbClient.connect();

  try {
    const user = await createAuthUser(adminClient, runId);
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
          values ($1, $2, $3, 'dry-cow-functional', $4, now())
        `,
        [loteId, fazendaId, `Lote Vaca Seca ${runId}`, randomUUID()],
      );
      await dbClient.query(
        `
          insert into public.protocolos_sanitarios(
            id, fazenda_id, nome, ativo, payload, client_id, client_op_id, client_recorded_at
          )
          values ($1, $2, 'Terapia de Vaca Seca', true, $3, 'dry-cow-functional', $4, now())
        `,
        [
          protocolId,
          fazendaId,
          {
            origem: "biblioteca_canonica_fazenda",
            standard_id: "med-mastite-seca",
            family_code: "terapia_vaca_seca",
          },
          randomUUID(),
        ],
      );
      await dbClient.query(
        `
          insert into public.protocolos_sanitarios_itens(
            id, fazenda_id, protocolo_id, protocol_item_id, version, tipo, produto,
            intervalo_dias, dose_num, gera_agenda, payload, client_id, client_op_id,
            client_recorded_at
          )
          values ($1, $2, $3, $4, 1, 'medicamento', $5, 60, 1, false, $6,
                  'dry-cow-functional', $7, now())
        `,
        [
          itemId,
          fazendaId,
          protocolId,
          randomUUID(),
          "Antibiotico Intramamario (Vaca Seca)",
          dryCowPayload({ activated: false }),
          randomUUID(),
        ],
      );
      await createDryCowAnimal(dbClient, fazendaId, loteId, runId, "conclusao");
      await dbClient.query(
        `
          update public.animais
          set id = $1
          where fazenda_id = $2 and identificacao = $3
        `,
        [animalCompleteId, fazendaId, `Vaca Seca conclusao ${runId}`],
      );
      await createDryCowAnimal(dbClient, fazendaId, loteId, runId, "cancelamento");
      await dbClient.query(
        `
          update public.animais
          set id = $1
          where fazenda_id = $2 and identificacao = $3
        `,
        [animalCancelId, fazendaId, `Vaca Seca cancelamento ${runId}`],
      );
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
            $3, $4, $5, 'dry-cow-functional', $6, $7, now()
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

    console.log("Validacao funcional Vaca Seca concluida com sucesso");
  } finally {
    await dbClient.end();
  }
}

main().catch((error) => {
  console.error(`Falha na validacao funcional Vaca Seca: ${error.message}`);
  process.exit(1);
});
