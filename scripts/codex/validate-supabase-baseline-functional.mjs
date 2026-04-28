import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client } = pg;

const DEFAULT_PASSWORD = "SupabaseFunctional1!";

function readSupabaseStatusEnv() {
  if (process.env.DB_URL && process.env.API_URL && process.env.ANON_KEY && process.env.SERVICE_ROLE_KEY) {
    return {
      DB_URL: process.env.DB_URL,
      API_URL: process.env.API_URL,
      FUNCTIONS_URL: process.env.FUNCTIONS_URL ?? `${process.env.API_URL}/functions/v1`,
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
    if (match) {
      env[match[1]] = match[2];
    }
  }

  for (const key of ["DB_URL", "API_URL", "FUNCTIONS_URL", "ANON_KEY", "SERVICE_ROLE_KEY"]) {
    if (!env[key]) {
      throw new Error(`supabase status -o env nao retornou ${key}`);
    }
  }

  return env;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function startFunctionsServeNoVerify() {
  if (process.env.REBANHOSYNC_SKIP_FUNCTIONS_SERVE === "1") {
    return null;
  }

  // The local gateway in older Supabase CLI builds can reject Auth-issued ES256
  // user JWTs before the function runs. The function still validates the JWT
  // with GoTrue and uses a user-scoped client, so RLS remains exercised.
  const child = spawn("supabase", ["functions", "serve", "--no-verify-jwt"], {
    cwd: process.cwd(),
    stdio: "ignore",
    windowsHide: true,
  });

  await sleep(6000);

  if (child.exitCode !== null) {
    throw new Error("supabase functions serve --no-verify-jwt encerrou antes da validacao de sync-batch");
  }

  return child;
}

function stopChild(child) {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
}

async function expectError(fn, label, expectedCodes = []) {
  try {
    await fn();
  } catch (error) {
    const code = error?.code;
    if (expectedCodes.length === 0 || expectedCodes.includes(code)) {
      return error;
    }
    throw new Error(`${label}: erro ${code ?? "sem code"} inesperado: ${error.message}`);
  }
  throw new Error(`${label}: operacao deveria falhar`);
}

async function expectCount(client, sql, params, expected, label) {
  const result = await client.query(sql, params);
  const count = Number(result.rows[0]?.count ?? 0);
  assert(count === expected, `${label}: esperado ${expected}, recebido ${count}`);
}

async function withAuthenticatedUser(client, userId, fn) {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
    const result = await fn();
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

function syncMeta(prefix) {
  const clientOpId = randomUUID();
  return {
    client_id: "baseline-functional",
    client_op_id: clientOpId,
    client_tx_id: randomUUID(),
    client_recorded_at: new Date().toISOString(),
    prefix,
  };
}

async function createAuthUser(adminClient, runId, label) {
  const email = `${label}-${runId}@baseline.local`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { baseline_functional_test: true, label },
  });

  if (error) {
    throw new Error(`falha ao criar auth user ${label}: ${error.message}`);
  }

  return {
    id: data.user.id,
    email,
    password: DEFAULT_PASSWORD,
  };
}

async function signInUser(anonClient, user) {
  const { data, error } = await anonClient.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error || !data.session?.access_token) {
    throw new Error(`falha ao obter JWT para ${user.email}: ${error?.message ?? "sem session"}`);
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

  let payload;
  const text = await response.text();
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
  };
}

async function main() {
  const env = readSupabaseStatusEnv();
  const runId = randomUUID().slice(0, 8);
  const client = new Client({ connectionString: env.DB_URL });
  const adminClient = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonClient = createClient(env.API_URL, env.ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const createdUsers = [];
  const createdFarmIds = [];

  await client.connect();

  try {
    const owner = await createAuthUser(adminClient, runId, "owner");
    const manager = await createAuthUser(adminClient, runId, "manager");
    const cowboy = await createAuthUser(adminClient, runId, "cowboy");
    const outsider = await createAuthUser(adminClient, runId, "outsider");
    createdUsers.push(owner, manager, cowboy, outsider);

    console.log("1/5 RLS + fluxo owner/fazenda");

    const farmId = await withAuthenticatedUser(client, owner.id, async () => {
      await client.query(
        "insert into public.user_profiles(user_id, display_name) values ($1, $2)",
        [owner.id, `Owner ${runId}`],
      );
      await client.query(
        "insert into public.user_settings(user_id) values ($1)",
        [owner.id],
      );
      const created = await client.query(
        "select public.create_fazenda($1, $2, $3, 'GO'::public.estado_uf_enum, null, 120, 'corte'::public.tipo_producao_enum, 'pastagem'::public.sistema_manejo_enum) as id",
        [`Fazenda Baseline ${runId}`, `base-${runId}`, "Goiania"],
      );
      const id = created.rows[0].id;
      await client.query(
        "update public.user_settings set active_fazenda_id = $1 where user_id = $2",
        [id, owner.id],
      );
      await expectCount(client, "select count(*) from public.fazendas where id = $1", [id], 1, "owner le fazenda criada");
      await expectCount(client, "select count(*) from public.user_fazendas where user_id = $1 and fazenda_id = $2 and role = 'owner'", [owner.id, id], 1, "owner membership");
      await expectCount(client, "select count(*) from public.user_settings where user_id = $1 and active_fazenda_id = $2", [owner.id, id], 1, "active_fazenda_id");
      return id;
    });
    createdFarmIds.push(farmId);

    await client.query(
      `
      insert into public.user_profiles(user_id, display_name)
      values ($1, $2), ($3, $4), ($5, $6)
      `,
      [manager.id, `Manager ${runId}`, cowboy.id, `Cowboy ${runId}`, outsider.id, `Outsider ${runId}`],
    );
    await client.query(
      `
      insert into public.user_fazendas(user_id, fazenda_id, role, accepted_at)
      values ($1, $2, 'manager', now()), ($3, $2, 'cowboy', now())
      `,
      [manager.id, farmId, cowboy.id],
    );

    console.log("2/5 estrutura produtiva + FKs compostas");

    const productive = await withAuthenticatedUser(client, owner.id, async () => {
      const pasto = await client.query(
        "insert into public.pastos(fazenda_id, nome, area_ha) values ($1, $2, 10) returning id",
        [farmId, `Pasto Owner ${runId}`],
      );
      const lote = await client.query(
        "insert into public.lotes(fazenda_id, nome, pasto_id) values ($1, $2, $3) returning id",
        [farmId, `Lote Owner ${runId}`, pasto.rows[0].id],
      );
      const animal = await client.query(
        "insert into public.animais(fazenda_id, identificacao, sexo, lote_id, data_nascimento) values ($1, $2, 'F', $3, current_date - 120) returning id",
        [farmId, `ANI-${runId}`, lote.rows[0].id],
      );
      const protocolo = await client.query(
        "insert into public.protocolos_sanitarios(fazenda_id, nome, descricao) values ($1, $2, $3) returning id",
        [farmId, `Protocolo ${runId}`, "fixture funcional"],
      );
      const protocoloItem = await client.query(
        `
        insert into public.protocolos_sanitarios_itens(
          fazenda_id, protocolo_id, tipo, produto, intervalo_dias, dose_num, gera_agenda, payload
        )
        values ($1, $2, 'vacinacao', 'Produto baseline', 30, 1, true, '{"family_code":"baseline","official_item_code":"baseline-dose"}'::jsonb)
        returning id
        `,
        [farmId, protocolo.rows[0].id],
      );
      return {
        pastoId: pasto.rows[0].id,
        loteId: lote.rows[0].id,
        animalId: animal.rows[0].id,
        protocoloId: protocolo.rows[0].id,
        protocoloItemId: protocoloItem.rows[0].id,
      };
    });

    const otherFarm = await client.query(
      "insert into public.fazendas(nome, created_by) values ($1, $2) returning id",
      [`Fazenda Isolada ${runId}`, owner.id],
    );
    const otherFarmId = otherFarm.rows[0].id;
    createdFarmIds.push(otherFarmId);
    const otherLote = await client.query(
      "insert into public.lotes(fazenda_id, nome) values ($1, $2) returning id",
      [otherFarmId, `Lote Cross ${runId}`],
    );
    await expectError(
      () =>
        withAuthenticatedUser(client, owner.id, async () => {
          await client.query(
            "insert into public.animais(fazenda_id, identificacao, sexo, lote_id) values ($1, $2, 'F', $3)",
            [farmId, `CROSS-${runId}`, otherLote.rows[0].id],
          );
        }),
      "FK composta animal -> lote deve bloquear cruzamento de fazendas",
      ["23503"],
    );

    console.log("3/5 RLS por papel");

    await withAuthenticatedUser(client, manager.id, async () => {
      await expectCount(client, "select count(*) from public.fazendas where id = $1", [farmId], 1, "manager le fazenda");
      await client.query(
        "insert into public.pastos(fazenda_id, nome) values ($1, $2)",
        [farmId, `Pasto Manager ${runId}`],
      );
      const update = await client.query(
        "update public.user_fazendas set role = 'owner' where user_id = $1 and fazenda_id = $2",
        [manager.id, farmId],
      );
      assert(update.rowCount === 0, "manager nao deve conseguir autoelevar role por update direto");
    });
    await expectCount(client, "select count(*) from public.user_fazendas where user_id = $1 and fazenda_id = $2 and role = 'manager'", [manager.id, farmId], 1, "manager permaneceu manager");

    await withAuthenticatedUser(client, cowboy.id, async () => {
      await expectCount(client, "select count(*) from public.fazendas where id = $1", [farmId], 1, "cowboy le fazenda");
      await client.query(
        "insert into public.animais(fazenda_id, identificacao, sexo, lote_id) values ($1, $2, 'M', $3)",
        [farmId, `COW-${runId}`, productive.loteId],
      );
      await expectError(
        () =>
          client.query(
            "insert into public.pastos(fazenda_id, nome) values ($1, $2)",
            [farmId, `Pasto Cowboy ${runId}`],
          ),
        "cowboy nao deve criar pasto pelo contrato RLS atual",
        ["42501"],
      );
    });

    await withAuthenticatedUser(client, outsider.id, async () => {
      await expectCount(client, "select count(*) from public.fazendas where id = $1", [farmId], 0, "outsider nao le fazenda");
      await expectCount(client, "select count(*) from public.agenda_itens where fazenda_id = $1", [farmId], 0, "outsider nao le agenda");
      await expectCount(client, "select count(*) from public.eventos where fazenda_id = $1", [farmId], 0, "outsider nao le eventos");
      await expectError(
        () =>
          client.query(
            "insert into public.animais(fazenda_id, identificacao, sexo, lote_id) values ($1, $2, 'F', $3)",
            [farmId, `OUT-${runId}`, productive.loteId],
          ),
        "outsider nao deve inserir animal em fazenda alheia",
        ["42501"],
      );
    });

    console.log("4/5 agenda -> evento sanitario via RPC");

    const agendaResult = await withAuthenticatedUser(client, owner.id, async () => {
      const agenda = await client.query(
        `
        insert into public.agenda_itens(
          fazenda_id, dominio, tipo, status, data_prevista, animal_id,
          source_kind, protocol_item_version_id, payload
        )
        values ($1, 'sanitario', 'vacinacao', 'agendado', current_date, $2, 'manual', $3, '{"produto":"Produto baseline"}'::jsonb)
        returning id
        `,
        [farmId, productive.animalId, productive.protocoloItemId],
      );
      const clientOpId = randomUUID();
      const clientTxId = randomUUID();
      const event = await client.query(
        `
        select public.sanitario_complete_agenda_with_event(
          $1, now(), 'vacinacao'::public.sanitario_tipo_enum, 'Produto baseline',
          'execucao funcional', '{"origem":"functional_baseline"}'::jsonb,
          'baseline-functional', $2, $3, now()
        ) as evento_id
        `,
        [agenda.rows[0].id, clientOpId, clientTxId],
      );
      return { agendaId: agenda.rows[0].id, eventId: event.rows[0].evento_id };
    });

    await expectCount(client, "select count(*) from public.agenda_itens where id = $1 and status = 'concluido' and source_evento_id = $2 and fazenda_id = $3", [agendaResult.agendaId, agendaResult.eventId, farmId], 1, "agenda concluida e vinculada");
    await expectCount(client, "select count(*) from public.eventos where id = $1 and source_task_id = $2 and dominio = 'sanitario' and fazenda_id = $3", [agendaResult.eventId, agendaResult.agendaId, farmId], 1, "evento sanitario base criado");
    await expectCount(client, "select count(*) from public.eventos_sanitario where evento_id = $1 and tipo = 'vacinacao' and produto = 'Produto baseline' and fazenda_id = $2", [agendaResult.eventId, farmId], 1, "detalhe sanitario criado");

    console.log("5/5 sync-batch real");
    const functionsServe = await startFunctionsServeNoVerify();

    try {
      const ownerToken = await signInUser(anonClient, owner);
      const outsiderToken = await signInUser(anonClient, outsider);
      const syncPastoId = randomUUID();
      const syncOpId = randomUUID();
      const syncTxId = randomUUID();
      const syncBody = {
        client_id: "baseline-functional",
        fazenda_id: farmId,
        client_tx_id: syncTxId,
        ops: [
          {
            client_op_id: syncOpId,
            table: "pastos",
            action: "INSERT",
            record: {
              id: syncPastoId,
              nome: `Pasto Sync ${runId}`,
              area_ha: 5,
            },
          },
        ],
      };

      const syncFirst = await callSyncBatch({
        functionsUrl: env.FUNCTIONS_URL,
        anonKey: env.ANON_KEY,
        token: ownerToken,
        body: syncBody,
      });
      assert(syncFirst.status === 200, `sync-batch owner deveria retornar 200, recebeu ${syncFirst.status}: ${JSON.stringify(syncFirst.payload)}`);
      assert(syncFirst.payload.results?.[0]?.status === "APPLIED", `sync-batch owner deveria aplicar: ${JSON.stringify(syncFirst.payload)}`);

      const syncSecond = await callSyncBatch({
        functionsUrl: env.FUNCTIONS_URL,
        anonKey: env.ANON_KEY,
        token: ownerToken,
        body: syncBody,
      });
      assert(syncSecond.status === 200, `sync-batch idempotente deveria retornar 200, recebeu ${syncSecond.status}: ${JSON.stringify(syncSecond.payload)}`);
      assert(syncSecond.payload.results?.[0]?.status === "APPLIED", `sync-batch idempotente deveria retornar APPLIED: ${JSON.stringify(syncSecond.payload)}`);
      await expectCount(client, "select count(*) from public.pastos where id = $1 and fazenda_id = $2", [syncPastoId, farmId], 1, "sync idempotente sem duplicar pasto");

      const invalid = await callSyncBatch({
        functionsUrl: env.FUNCTIONS_URL,
        anonKey: env.ANON_KEY,
        token: ownerToken,
        body: {
          client_id: "baseline-functional",
          fazenda_id: farmId,
          client_tx_id: randomUUID(),
          ops: [
            {
              client_op_id: randomUUID(),
              table: "user_fazendas",
              action: "INSERT",
              record: { user_id: outsider.id, fazenda_id: farmId, role: "owner" },
            },
          ],
        },
      });
      assert(invalid.status === 200, `sync-batch invalid deveria retornar 200 com REJECTED, recebeu ${invalid.status}`);
      assert(invalid.payload.results?.[0]?.status === "REJECTED", `sync-batch invalid deveria rejeitar: ${JSON.stringify(invalid.payload)}`);
      assert(invalid.payload.results?.[0]?.reason_code === "SECURITY_BLOCKED_TABLE", `reason_code inesperado: ${JSON.stringify(invalid.payload)}`);

      const forbidden = await callSyncBatch({
        functionsUrl: env.FUNCTIONS_URL,
        anonKey: env.ANON_KEY,
        token: outsiderToken,
        body: {
          client_id: "baseline-functional",
          fazenda_id: farmId,
          client_tx_id: randomUUID(),
          ops: [],
        },
      });
      assert(forbidden.status === 403, `sync-batch outsider deveria retornar 403, recebeu ${forbidden.status}`);
    } finally {
      stopChild(functionsServe);
    }

    console.log("OK baseline funcional Supabase validada");
    console.log(JSON.stringify({
      run_id: runId,
      rls: {
        owner: "passou",
        manager: "passou",
        cowboy: "passou",
        outsider: "passou",
      },
      productive_structure: "passou",
      composite_fk_cross_tenant: "passou",
      sanitary_agenda_event_rpc: "passou",
      sync_batch_real_edge_function: "passou",
    }, null, 2));
  } finally {
    await client.query("reset role").catch(() => undefined);
    for (const farmId of createdFarmIds.reverse()) {
      await client.query("delete from public.fazendas where id = $1", [farmId]).catch(() => undefined);
    }
    for (const user of createdUsers) {
      await adminClient.auth.admin.deleteUser(user.id).catch(() => undefined);
    }
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
