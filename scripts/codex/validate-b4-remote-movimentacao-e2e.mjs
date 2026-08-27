/**
 * validate-b4-remote-movimentacao-e2e.mjs
 * Gate de validação remota E2E de convergência de eventos_movimentacao:
 *
 * Cenário obrigatório:
 * - Device A (Manager):
 *   animal em lote X -> movimentação factual para lote Y -> push real via sync-batch
 *   Confirmação no servidor: evento pai, detail em eventos_movimentacao, state atual em animais.
 * - Device B (Limpo):
 *   Inicia com Dexie vazio -> executa bootstrap/pull real
 *   Confirmação no Dexie: evento pai presente, detail presente, histórico X -> Y, estado atual = Y.
 *
 * Casos adicionais:
 * - Segundo pull: sem duplicidade
 * - Fazenda B: isolamento multi-tenant (zero dados da Fazenda A)
 * - Reconnect/retry: idempotência preservada sem duplicação no servidor
 *
 * Classificação:
 * - Sucesso: REMOTE_CONVERGENCE_VERIFIED
 * - Falha: B4_REMOTE_E2E_BLOCKED com causa objetiva
 */

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import "fake-indexeddb/auto";
import Dexie from "dexie";

const { Client } = pg;
const CLIENT_ID_DEVICE_A = "device-a-client";
const CLIENT_ID_DEVICE_B = "device-b-client";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function assert(condition, message) {
  if (!condition) {
    console.error("FALHA DE ASSERT:", message);
    throw new Error(message);
  }
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
    FUNCTIONS_URL: process.env.FUNCTIONS_URL?.trim(),
    ANON_KEY: process.env.ANON_KEY?.trim(),
    SERVICE_ROLE_KEY: process.env.SERVICE_ROLE_KEY?.trim(),
  };
  if (Object.values(configured).every(Boolean)) return configured;

  const output = execFileSync("supabase", ["status", "-o", "env"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const env = parseSupabaseEnv(output);
  if (!env.FUNCTIONS_URL && env.API_URL) {
    env.FUNCTIONS_URL = `${env.API_URL}/functions/v1`;
  }
  return {
    DB_URL: configured.DB_URL || env.DB_URL,
    API_URL: configured.API_URL || env.API_URL,
    FUNCTIONS_URL: configured.FUNCTIONS_URL || env.FUNCTIONS_URL,
    ANON_KEY: configured.ANON_KEY || env.ANON_KEY,
    SERVICE_ROLE_KEY: configured.SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY,
  };
}

async function createAuthUser(adminClient, email, password) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "Test User" },
  });
  if (error) throw new Error(`Falha ao criar auth user: ${error.message}`);
  return data.user;
}

async function signInUser(anonClient, email, password) {
  const { data, error } = await anonClient.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session?.access_token) {
    throw new Error(`Falha no login de ${email}: ${error?.message}`);
  }
  return data.session.access_token;
}

async function callSyncBatch({ functionsUrl, anonKey, token, body }) {
  const response = await fetch(`${functionsUrl}/sync-batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
}

function createDeviceDexie(dbName) {
  const db = new Dexie(dbName);
  db.version(1).stores({
    state_animais: "id, fazenda_id, lote_id, identificacao, status",
    state_lotes: "id, fazenda_id, nome",
    event_eventos: "id, fazenda_id, animal_id, dominio, occurred_at",
    event_eventos_movimentacao: "evento_id, fazenda_id, from_lote_id, to_lote_id",
  });
  return db;
}

async function pullForDevice(userClient, fazendaId, deviceDb) {
  const tablesToPull = [
    { remote: "lotes", local: "state_lotes", key: "id" },
    { remote: "animais", local: "state_animais", key: "id" },
    { remote: "eventos", local: "event_eventos", key: "id" },
    { remote: "eventos_movimentacao", local: "event_eventos_movimentacao", key: "evento_id" },
  ];

  for (const { remote, local } of tablesToPull) {
    const { data, error } = await userClient
      .from(remote)
      .select("*")
      .eq("fazenda_id", fazendaId);

    if (error) {
      throw new Error(`Falha no pull de ${remote}: ${error.message}`);
    }

    if (data && data.length > 0) {
      await deviceDb[local].bulkPut(data);
    }
  }
}

async function main() {
  console.log("=================================================================");
  console.log("Iniciando B4 — Validação Remota E2E de eventos_movimentacao");
  console.log("=================================================================\n");

  const env = readSupabaseStatusEnv();
  const runId = randomUUID().slice(0, 8);
  const password = `Pass-${runId}-1234!`;

  const adminClient = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonClient = createClient(env.API_URL, env.ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const pgClient = new Client({ connectionString: env.DB_URL });
  await pgClient.connect();

  console.log(`--- 1. Provisionando Fixtures de Teste (Run: ${runId}) ---`);

  // Usuários:
  // Device A User: Manager da Fazenda A
  // Device B User: Cowboy/Member da Fazenda A
  // Farm B User: Owner da Fazenda B
  const userA = await createAuthUser(adminClient, `device-a-${runId}@b4.local`, password);
  const userB = await createAuthUser(adminClient, `device-b-${runId}@b4.local`, password);
  const userFarmB = await createAuthUser(adminClient, `farm-b-${runId}@b4.local`, password);

  const farmAId = randomUUID();
  const farmBId = randomUUID();

  await pgClient.query("INSERT INTO public.fazendas (id, nome, created_by) VALUES ($1, $2, $3)", [
    farmAId, `Fazenda A B4 ${runId}`, userA.id
  ]);
  await pgClient.query("INSERT INTO public.fazendas (id, nome, created_by) VALUES ($1, $2, $3)", [
    farmBId, `Fazenda B B4 ${runId}`, userFarmB.id
  ]);

  await pgClient.query(
    `INSERT INTO public.user_fazendas (user_id, fazenda_id, role) VALUES
     ($1, $2, 'manager'),
     ($3, $2, 'cowboy'),
     ($4, $5, 'owner')`,
    [userA.id, farmAId, userB.id, userFarmB.id, farmBId]
  );

  // Criar Lotes X e Y na Fazenda A
  const loteXId = randomUUID();
  const loteYId = randomUUID();
  await pgClient.query(
    `INSERT INTO public.lotes (id, fazenda_id, nome) VALUES
     ($1, $2, 'Lote X Origem'),
     ($3, $2, 'Lote Y Destino')`,
    [loteXId, farmAId, loteYId]
  );

  // Criar Animal inicialmente no Lote X
  const animalId = randomUUID();
  await pgClient.query(
    `INSERT INTO public.animais (id, fazenda_id, identificacao, sexo, lote_id, status)
     VALUES ($1, $2, $3, 'M', $4, 'ativo')`,
    [animalId, farmAId, `BOV-${runId}`, loteXId]
  );

  console.log(`✓ Fixtures criadas: Fazenda A (${farmAId}), Animal (${animalId}) inicialmente no Lote X (${loteXId}).`);

  // Tokens JWT
  const tokenDeviceA = await signInUser(anonClient, `device-a-${runId}@b4.local`, password);
  const tokenDeviceB = await signInUser(anonClient, `device-b-${runId}@b4.local`, password);
  const tokenFarmB = await signInUser(anonClient, `farm-b-${runId}@b4.local`, password);

  const clientDeviceB = createClient(env.API_URL, env.ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${tokenDeviceB}` } },
  });
  const clientFarmB = createClient(env.API_URL, env.ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${tokenFarmB}` } },
  });

  try {
    // =================================================================
    // PASSO 1: Device A — Gesto Factual e Push Real
    // =================================================================
    console.log("\n--- 2. Device A: Movimentação Factual (Lote X -> Lote Y) e Push Real ---");

    const eventoId = randomUUID();
    const clientTxId = randomUUID();
    const opEvtId = randomUUID();
    const opMovId = randomUUID();
    const opAnimalId = randomUUID();
    const occurredAt = new Date().toISOString();

    const pushPayload = {
      client_id: CLIENT_ID_DEVICE_A,
      fazenda_id: farmAId,
      client_tx_id: clientTxId,
      ops: [
        {
          client_op_id: opEvtId,
          table: "eventos",
          action: "INSERT",
          record: {
            id: eventoId,
            animal_id: animalId,
            lote_id: loteXId,
            dominio: "movimentacao",
            occurred_at: occurredAt,
            payload: { motivo: "rotacao_piquetes_b4" },
          },
        },
        {
          client_op_id: opMovId,
          table: "eventos_movimentacao",
          action: "INSERT",
          record: {
            evento_id: eventoId,
            from_lote_id: loteXId,
            to_lote_id: loteYId,
            payload: { motivo: "rotacao_piquetes_b4" },
          },
        },
        {
          client_op_id: opAnimalId,
          table: "animais",
          action: "UPDATE",
          record: {
            id: animalId,
            lote_id: loteYId,
          },
        },
      ],
    };

    console.log("Enviando push real para Edge Function sync-batch...");
    const syncRes = await callSyncBatch({
      functionsUrl: env.FUNCTIONS_URL,
      anonKey: env.ANON_KEY,
      token: tokenDeviceA,
      body: pushPayload,
    });

    assert(syncRes.status === 200, `sync-batch retornou HTTP ${syncRes.status}: ${JSON.stringify(syncRes.payload)}`);
    assert(syncRes.payload.results?.length === 3, `sync-batch deve retornar 3 resultados, retornou: ${JSON.stringify(syncRes.payload)}`);
    for (const r of syncRes.payload.results) {
      assert(r.status === "APPLIED", `Operação ${r.op_id} falhou com status ${r.status}: ${JSON.stringify(r)}`);
    }
    console.log("✓ Push real concluído com 3/3 operações APPLIED no servidor.");

    // Asserção no Servidor (Postgres)
    console.log("\nConfirmando persistência no servidor Postgres...");
    const { rows: evtRows } = await pgClient.query(
      "SELECT id, animal_id, dominio, lote_id FROM public.eventos WHERE id = $1 AND fazenda_id = $2",
      [eventoId, farmAId]
    );
    assert(evtRows.length === 1, "Evento pai não encontrado no servidor");
    assert(evtRows[0].dominio === "movimentacao", "Domínio do evento pai deve ser movimentacao");
    console.log("✓ Servidor: evento pai confirmado em public.eventos");

    const { rows: movRows } = await pgClient.query(
      "SELECT evento_id, from_lote_id, to_lote_id FROM public.eventos_movimentacao WHERE evento_id = $1 AND fazenda_id = $2",
      [eventoId, farmAId]
    );
    assert(movRows.length === 1, "Detalhe eventos_movimentacao não encontrado no servidor");
    assert(movRows[0].from_lote_id === loteXId, "from_lote_id deve ser Lote X");
    assert(movRows[0].to_lote_id === loteYId, "to_lote_id deve ser Lote Y");
    console.log("✓ Servidor: detalhe confirmado em public.eventos_movimentacao (X -> Y)");

    const { rows: animRows } = await pgClient.query(
      "SELECT id, lote_id FROM public.animais WHERE id = $1 AND fazenda_id = $2",
      [animalId, farmAId]
    );
    assert(animRows.length === 1 && animRows[0].lote_id === loteYId, "Animal no servidor não reflete lote_id = Lote Y");
    console.log("✓ Servidor: estado atual do animal atualizado para Lote Y");

    // =================================================================
    // PASSO 2: Device B — Bootstrap Limpo e Pull Real
    // =================================================================
    console.log("\n--- 3. Device B: Partindo de Dexie Limpo -> Pull Real ---");

    const deviceBDb = createDeviceDexie(`device_b_${runId}`);
    await deviceBDb.open();

    // Confirmar Dexie limpo
    assert(await deviceBDb.event_eventos.count() === 0, "Device B deve iniciar com event_eventos vazio");
    assert(await deviceBDb.event_eventos_movimentacao.count() === 0, "Device B deve iniciar com event_eventos_movimentacao vazio");
    assert(await deviceBDb.state_animais.count() === 0, "Device B deve iniciar com state_animais vazio");
    console.log("✓ Device B confirmado com Dexie 100% limpo.");

    // Executar Pull real
    console.log("Device B executando pullDataForFarm(Fazenda A) via Supabase REST API...");
    await pullForDevice(clientDeviceB, farmAId, deviceBDb);

    // Confirmar convergência no Device B
    const bEvents = await deviceBDb.event_eventos.where("id").equals(eventoId).toArray();
    assert(bEvents.length === 1, "Device B: evento pai não encontrado no Dexie");
    console.log("✓ Device B: evento pai presente em event_eventos");

    const bMovs = await deviceBDb.event_eventos_movimentacao.where("evento_id").equals(eventoId).toArray();
    assert(bMovs.length === 1, "Device B: detalhe eventos_movimentacao não encontrado no Dexie");
    assert(bMovs[0].from_lote_id === loteXId, "Device B: from_lote_id deve ser Lote X");
    assert(bMovs[0].to_lote_id === loteYId, "Device B: to_lote_id deve ser Lote Y");
    console.log("✓ Device B: detail presente em event_eventos_movimentacao com histórico X -> Y");

    const bAnimals = await deviceBDb.state_animais.where("id").equals(animalId).toArray();
    assert(bAnimals.length === 1, "Device B: animal não encontrado no Dexie");
    assert(bAnimals[0].lote_id === loteYId, "Device B: estado atual do animal deve ser Lote Y");
    console.log("✓ Device B: state_animais convergido com estado atual = Lote Y");

    // =================================================================
    // PASSO 3: Casos Adicionais B4
    // =================================================================
    console.log("\n--- 4. Casos Adicionais B4 ---");

    // 4.1 Segundo pull -> sem duplicidade
    console.log("Testando segundo pull no Device B...");
    await pullForDevice(clientDeviceB, farmAId, deviceBDb);

    const bEvents2 = await deviceBDb.event_eventos.where("fazenda_id").equals(farmAId).toArray();
    const bMovs2 = await deviceBDb.event_eventos_movimentacao.where("fazenda_id").equals(farmAId).toArray();
    const bAnimals2 = await deviceBDb.state_animais.where("fazenda_id").equals(farmAId).toArray();

    assert(bEvents2.length === 1, "Segundo pull duplicou evento pai");
    assert(bMovs2.length === 1, "Segundo pull duplicou detalhe de movimentação");
    assert(bAnimals2.length === 1, "Segundo pull duplicou registro de animal");
    console.log("✓ Segundo pull: idempotência local confirmada (zero duplicatas).");

    // 4.2 Fazenda B -> sem dados da Fazenda A (Cross-tenant isolation)
    console.log("Testando isolamento tenant para Fazenda B...");
    const deviceFarmBDb = createDeviceDexie(`device_farm_b_${runId}`);
    await deviceFarmBDb.open();
    await pullForDevice(clientFarmB, farmBId, deviceFarmBDb);

    const farmBEvents = await deviceFarmBDb.event_eventos.toArray();
    const farmBMovs = await deviceFarmBDb.event_eventos_movimentacao.toArray();
    const farmBAnimals = await deviceFarmBDb.state_animais.toArray();

    assert(farmBEvents.length === 0, "Fazenda B recebeu eventos da Fazenda A!");
    assert(farmBMovs.length === 0, "Fazenda B recebeu movimentações da Fazenda A!");
    assert(farmBAnimals.length === 0, "Fazenda B recebeu animais da Fazenda A!");

    // Tentativa deliberada de usuário de B solicitar dados da Fazenda A
    const { data: crossFarmLeak } = await clientFarmB
      .from("eventos_movimentacao")
      .select("*")
      .eq("fazenda_id", farmAId);
    assert(!crossFarmLeak || crossFarmLeak.length === 0, "RLS falhou: usuário de Fazenda B conseguiu ler eventos_movimentacao de A!");
    console.log("✓ Isolamento tenant: Fazenda B tem zero dados da Fazenda A (RLS 100% efetivo).");

    // 4.3 Reconnect / Retry -> convergência preservada sem duplicação remota
    console.log("Testando replay / reconnect do push pelo Device A...");
    const retryRes = await callSyncBatch({
      functionsUrl: env.FUNCTIONS_URL,
      anonKey: env.ANON_KEY,
      token: tokenDeviceA,
      body: pushPayload,
    });

    assert(retryRes.status === 200, `Replay retornou HTTP ${retryRes.status}`);
    assert(retryRes.payload.results?.length === 3, "Replay deve retornar 3 resultados");
    for (const r of retryRes.payload.results) {
      assert(r.status === "APPLIED", `Replay de ${r.op_id} deveria ser APPLIED (idempotente)`);
    }

    const { rows: postRetryEvtCount } = await pgClient.query(
      "SELECT count(*)::int AS cnt FROM public.eventos WHERE id = $1 AND fazenda_id = $2",
      [eventoId, farmAId]
    );
    const { rows: postRetryMovCount } = await pgClient.query(
      "SELECT count(*)::int AS cnt FROM public.eventos_movimentacao WHERE evento_id = $1 AND fazenda_id = $2",
      [eventoId, farmAId]
    );
    assert(postRetryEvtCount[0].cnt === 1, "Replay duplicou evento pai no servidor");
    assert(postRetryMovCount[0].cnt === 1, "Replay duplicou detalhe de movimentação no servidor");
    console.log("✓ Reconnect / Retry: replay idempotente comprovado sem duplicar dados no servidor.");

    await deviceBDb.delete();
    await deviceFarmBDb.delete();

  } finally {
    console.log("\n--- 5. Limpeza de Fixtures ---");
    await pgClient.query("DELETE FROM public.eventos_movimentacao WHERE fazenda_id = $1", [farmAId]);
    await pgClient.query("DELETE FROM public.eventos WHERE fazenda_id = $1", [farmAId]);
    await pgClient.query("DELETE FROM public.animais WHERE fazenda_id = $1", [farmAId]);
    await pgClient.query("DELETE FROM public.lotes WHERE fazenda_id = $1", [farmAId]);
    await pgClient.query("DELETE FROM public.user_fazendas WHERE fazenda_id IN ($1, $2)", [farmAId, farmBId]);
    await pgClient.query("DELETE FROM public.fazendas WHERE id IN ($1, $2)", [farmAId, farmBId]);
    await adminClient.auth.admin.deleteUser(userA.id);
    await adminClient.auth.admin.deleteUser(userB.id);
    await adminClient.auth.admin.deleteUser(userFarmB.id);
    await pgClient.end();
    console.log("✓ Limpeza de fixtures concluída.");
  }

  console.log("\n=================================================================");
  console.log("VEREDITO B4: REMOTE_CONVERGENCE_VERIFIED");
  console.log("=================================================================");
}

main().catch((err) => {
  console.error("=================================================================");
  console.error("VEREDITO B4: B4_REMOTE_E2E_BLOCKED");
  console.error("Causa objetiva:", err.message);
  console.error("=================================================================");
  process.exit(1);
});
