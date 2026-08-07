// Historical restricted validator: preserves canonical Evento replay coverage.
// Not a default gate; its transaction is rolled back after validation.
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client } = pg;
const CLIENT_ID = "rpc-duplicidade-functional";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseSupabaseEnv(output) {
  const env = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(?:"([\s\S]*)"|'([\s\S]*)'|([^\s].*))$/);
    if (match) env[match[1]] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return env;
}

function readSupabaseStatusEnv() {
  const configured = {
    DB_URL: process.env.DB_URL?.trim(),
    API_URL: process.env.API_URL?.trim(),
    SERVICE_ROLE_KEY: process.env.SERVICE_ROLE_KEY?.trim(),
  };
  if (Object.values(configured).every(Boolean)) return configured;

  const output = execFileSync("supabase", ["status", "-o", "env"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const env = parseSupabaseEnv(output);
  for (const key of Object.keys(configured)) {
    assert(env[key], `supabase status -o env nao retornou ${key}`);
  }
  return env;
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
  assert(LOCAL_HOSTS.has(database.hostname), `Teste bloqueado fora do banco local: ${database.hostname}`);
  assert(LOCAL_HOSTS.has(api.hostname), `Teste bloqueado fora da API local: ${api.hostname}`);
}

async function createAuthUser(adminClient, runId, password) {
  const email = `rpc-duplicidade-${runId}@functional.local`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { functional_fixture: CLIENT_ID, run_id: runId },
  });
  if (error || !data.user) {
    throw new Error(`Falha ao criar usuario de teste: ${error?.message ?? "usuario ausente"}`);
  }
  return { id: data.user.id, email };
}

async function asRole(client, role, fn) {
  await client.query("reset role");
  await client.query(`set local role ${role}`);
  return fn();
}

async function asAuthenticated(client, userId, fn) {
  return asRole(client, "authenticated", async () => {
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
    return fn();
  });
}

async function completeAgenda(client, userId, args) {
  return asAuthenticated(client, userId, async () => {
    const result = await client.query(
      `select public.sanitario_complete_agenda_with_event(
        $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10
      ) as evento_id`,
      [
        args.agendaItemId,
        args.occurredAt,
        "vacinacao",
        "Vacina Teste",
        args.observacoes,
        JSON.stringify({ origem: CLIENT_ID, run_id: args.runId }),
        CLIENT_ID,
        args.clientOpId,
        args.clientTxId,
        args.recordedAt,
      ],
    );
    return result.rows[0]?.evento_id;
  });
}

async function main() {
  const runId = randomUUID().slice(0, 8);
  const password = `Rpc-${randomUUID()}-Aa1!`;
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
    await dbClient.query("set local statement_timeout = '30s'");

    user = await createAuthUser(adminClient, runId, password);
    const fazendaId = await asAuthenticated(dbClient, user.id, async () => {
      await dbClient.query(
        "insert into public.user_profiles(user_id, display_name) values ($1, $2)",
        [user.id, `RPC duplicidade ${runId}`],
      );
      await dbClient.query("insert into public.user_settings(user_id) values ($1)", [user.id]);
      const result = await dbClient.query(
        `select public.create_fazenda(
          $1, $2, $3, 'GO'::public.estado_uf_enum, null, 120,
          'corte'::public.tipo_producao_enum,
          'pastagem'::public.sistema_manejo_enum
        ) as id`,
        [`Fazenda RPC ${runId}`, `rpc-${runId}`, "Teste"],
      );
      return result.rows[0].id;
    });

    const loteId = randomUUID();
    const animalId = randomUUID();
    const agendaItemId = randomUUID();
    await asRole(dbClient, "service_role", async () => {
      await dbClient.query(
        `insert into public.lotes(
          id, fazenda_id, nome, client_id, client_op_id, client_recorded_at
        ) values ($1, $2, $3, $4, $5, now())`,
        [loteId, fazendaId, `Lote RPC ${runId}`, CLIENT_ID, randomUUID()],
      );
      await dbClient.query(
        `insert into public.animais(
          id, fazenda_id, identificacao, sexo, lote_id, data_nascimento,
          client_id, client_op_id, client_recorded_at
        ) values ($1, $2, $3, 'F', $4, current_date - 120, $5, $6, now())`,
        [animalId, fazendaId, `Animal RPC ${runId}`, loteId, CLIENT_ID, randomUUID()],
      );
      await dbClient.query(
        `insert into public.agenda_itens(
          id, fazenda_id, dominio, tipo, status, data_prevista, animal_id,
          source_kind, payload, client_id, client_op_id, client_recorded_at
        ) values (
          $1, $2, 'sanitario', 'vacinacao', 'agendado', current_date, $3,
          'manual', $4::jsonb, $5, $6, now()
        )`,
        [
          agendaItemId,
          fazendaId,
          animalId,
          JSON.stringify({ produto: "Vacina Teste", fixture: CLIENT_ID, run_id: runId }),
          CLIENT_ID,
          randomUUID(),
        ],
      );
    });

    const initial = await dbClient.query(
      "select count(*)::integer as count from public.eventos where source_task_id = $1 and fazenda_id = $2",
      [agendaItemId, fazendaId],
    );
    assert(initial.rows[0].count === 0, "Estado inicial deve ter zero Eventos");

    const occurredAt = new Date().toISOString();
    const recordedAt = new Date().toISOString();
    const firstArgs = {
      agendaItemId,
      occurredAt,
      observacoes: "Primeira execucao do teste de idempotencia",
      clientOpId: randomUUID(),
      clientTxId: randomUUID(),
      recordedAt,
      runId,
    };
    const eventoId1 = await completeAgenda(dbClient, user.id, firstArgs);
    assert(eventoId1, "Primeira chamada deve retornar evento_id");

    const replaySameOperation = await completeAgenda(dbClient, user.id, firstArgs);
    assert(replaySameOperation === eventoId1, "Replay da mesma operacao deve retornar o Evento canonico");

    const eventoId2 = await completeAgenda(dbClient, user.id, {
      ...firstArgs,
      observacoes: "Retry com novo client_op_id",
      clientOpId: randomUUID(),
      clientTxId: randomUUID(),
      recordedAt: new Date().toISOString(),
    });
    assert(eventoId2 === eventoId1, "Retry da mesma Agenda com nova operacao deve retornar o Evento atual");

    const state = await dbClient.query(
      `select
        ai.status,
        ai.source_evento_id,
        count(e.id)::integer as event_count,
        count(es.evento_id)::integer as detail_count
      from public.agenda_itens ai
      left join public.eventos e
        on e.source_task_id = ai.id and e.fazenda_id = ai.fazenda_id
      left join public.eventos_sanitario es
        on es.evento_id = e.id and es.fazenda_id = e.fazenda_id
      where ai.id = $1 and ai.fazenda_id = $2
      group by ai.status, ai.source_evento_id`,
      [agendaItemId, fazendaId],
    );
    const row = state.rows[0];
    assert(row?.status === "concluido", "Agenda deve ficar concluida");
    assert(row?.source_evento_id === eventoId1, "Agenda deve apontar para o Evento canonico");
    assert(row?.event_count === 1, "Retries nao podem duplicar Evento");
    assert(row?.detail_count === 1, "Retries nao podem duplicar detalhe sanitario");

    console.log(
      JSON.stringify(
        {
          result: "PASS",
          run_id: runId,
          agenda_item_id: agendaItemId,
          evento_id: eventoId1,
          same_operation_replay: "same_event",
          new_operation_retry: "same_event",
          persisted_after_test: false,
        },
        null,
        2,
      ),
    );
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
  console.error(`Falha no contrato RPC de duplicidade: ${error.message}`);
  process.exitCode = 1;
});
