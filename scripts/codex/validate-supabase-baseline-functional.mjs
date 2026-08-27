import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client } = pg;

const CLIENT_ID = "baseline-functional";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const AUTHENTICATED_TABLE_PRIVILEGE_MATRIX = {
  agenda_itens: ["SELECT", "INSERT", "UPDATE"],
  animais: ["SELECT", "INSERT", "UPDATE"],
  catalogo_doencas_notificaveis: ["SELECT"],
  catalogo_protocolos_oficiais: ["SELECT"],
  catalogo_protocolos_oficiais_itens: ["SELECT"],
  contrapartes: ["SELECT", "INSERT", "UPDATE"],
  eventos: ["SELECT", "INSERT"],
  eventos_animais: ["SELECT"],
  eventos_comercial: ["SELECT", "INSERT"],
  eventos_ecc: ["SELECT", "INSERT"],
  eventos_financeiro: ["SELECT", "INSERT"],
  eventos_movimentacao: ["SELECT", "INSERT"],
  eventos_nutricao: ["SELECT", "INSERT"],
  eventos_pasto_avaliacao: ["SELECT", "INSERT"],
  eventos_pesagem: ["SELECT", "INSERT"],
  eventos_reproducao: ["SELECT", "INSERT"],
  eventos_sanitario: ["SELECT", "INSERT"],
  farm_invites: ["SELECT"],
  fazenda_sanidade_config: ["SELECT", "INSERT", "UPDATE"],
  fazendas: ["SELECT", "UPDATE"],
  finance_categories: ["SELECT", "INSERT"],
  finance_transactions: ["SELECT", "INSERT"],
  insumo_apresentacoes: ["SELECT", "INSERT", "UPDATE"],
  insumo_lotes: ["SELECT", "INSERT", "UPDATE"],
  insumo_movimentacoes: ["SELECT", "INSERT"],
  insumos: ["SELECT", "INSERT", "UPDATE"],
  lotes: ["SELECT", "INSERT", "UPDATE"],
  metrics_events: ["SELECT", "INSERT"],
  pasto_ocupacoes: ["SELECT", "INSERT", "UPDATE"],
  pastos: ["SELECT", "INSERT", "UPDATE"],
  produtos_veterinarios: ["SELECT"],
  protocolos_sanitarios: ["SELECT", "INSERT", "UPDATE"],
  protocolos_sanitarios_itens: ["SELECT", "INSERT", "UPDATE"],
  sanitario_agenda_animais_v2: ["SELECT"],
  sanitario_agenda_closures_v2: ["SELECT"],
  sanitario_agenda_v2: ["SELECT"],
  sanitario_casos: ["SELECT", "INSERT", "UPDATE"],
  sanitario_fonte_cobertura_campos_v2: ["SELECT"],
  sanitario_fontes_tecnicas_v2: ["SELECT"],
  sanitario_product_class_default_rules_v2: ["SELECT"],
  sanitario_product_class_group_members_v2: ["SELECT"],
  sanitario_product_class_groups_v2: ["SELECT"],
  sanitario_product_classes_v2: ["SELECT"],
  sanitario_produto_carencia_rules_v2: ["SELECT"],
  sanitario_produto_dose_rules_v2: ["SELECT"],
  sanitario_produto_especie_autorizacao_v2: ["SELECT"],
  sanitario_produto_fontes_v2: ["SELECT"],
  sanitario_produtos_v2: ["SELECT"],
  sanitario_protocolo_itens_versions_v2: ["SELECT"],
  sanitario_protocolos_v2: ["SELECT"],
  sociedade_animais: ["SELECT", "INSERT", "UPDATE"],
  sociedades_pecuarias: ["SELECT", "INSERT", "UPDATE"],
  user_fazendas: ["SELECT"],
  user_profiles: ["SELECT", "INSERT", "UPDATE"],
  user_settings: ["SELECT", "INSERT", "UPDATE"],
};

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
    const match = line.match(/^([A-Z0-9_]+)=(?:"([\s\S]*)"|'([\s\S]*)'|([^\s].*))$/);
    if (match) env[match[1]] = match[2] ?? match[3] ?? match[4] ?? "";
  }

  if (!env.FUNCTIONS_URL && env.API_URL) {
    env.FUNCTIONS_URL = `${env.API_URL}/functions/v1`;
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

function assertLocalTarget(env) {
  let database;
  let api;
  let functions;
  try {
    database = new URL(env.DB_URL);
    api = new URL(env.API_URL);
    functions = new URL(env.FUNCTIONS_URL);
  } catch (error) {
    throw new Error(`Configuracao Supabase invalida: ${error.message}`);
  }
  assert(["postgres:", "postgresql:"].includes(database.protocol), "DB_URL deve ser PostgreSQL");
  for (const [label, url] of [["banco", database], ["API", api], ["Functions", functions]]) {
    assert(LOCAL_HOSTS.has(url.hostname), `Baseline bloqueada fora do ${label} local: ${url.hostname}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function functionEndpointAvailable(functionsUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1000);
  try {
    const response = await fetch(`${functionsUrl}/sync-batch`, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
    });
    return ![404, 502, 503, 504].includes(response.status);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function startFunctionsServeNoVerify(functionsUrl) {
  if (process.env.REBANHOSYNC_SKIP_FUNCTIONS_SERVE === "1") {
    return null;
  }

  if (await functionEndpointAvailable(functionsUrl)) {
    console.log("INFO Supabase local ja esta respondendo; servidor existente sera reutilizado.");
    return null;
  }

  // Supabase CLI 2.72.7 / edge-runtime 1.70.0 rejects local Auth ES256 user
  // JWTs in the gateway before the function runs:
  // "Key for the ES256 algorithm must be of type CryptoKey. Received Uint8Array".
  // Newer CLI/runtime builds validate the same JWTs correctly. Keep this local
  // fallback scoped to the baseline validator; the handler still validates the
  // JWT with GoTrue and uses a user-scoped client, so RLS remains exercised.
  const child = spawn("supabase", ["functions", "serve", "--no-verify-jwt"], {
    cwd: process.cwd(),
    stdio: "ignore",
    windowsHide: true,
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    if (child.exitCode !== null) {
      throw new Error("supabase functions serve --no-verify-jwt encerrou antes da validacao de sync-batch");
    }
    if (await functionEndpointAvailable(functionsUrl)) return child;
    await sleep(250);
  }
  stopChild(child);
  throw new Error("Timeout aguardando Supabase Functions local");
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

async function validateAuthenticatedTablePrivilegeMatrix(client) {
  const expected = Object.entries(AUTHENTICATED_TABLE_PRIVILEGE_MATRIX).flatMap(
    ([tableName, privileges]) =>
      privileges.map((privilege) => ({
        table_name: tableName,
        privilege,
      })),
  );
  const result = await client.query(
    `
      with expected as (
        select table_name, privilege
        from jsonb_to_recordset($1::jsonb)
          as item(table_name text, privilege text)
      )
      select
        expected.table_name,
        expected.privilege,
        has_table_privilege(
          'authenticated',
          format('public.%I', expected.table_name),
          expected.privilege
        ) as has_grant,
        exists (
          select 1
          from pg_policies policy
          where policy.schemaname = 'public'
            and policy.tablename = expected.table_name
            and policy.cmd in ('ALL', expected.privilege)
            and (
              policy.roles @> array['public']::name[]
              or policy.roles @> array['authenticated']::name[]
            )
        ) as has_policy
      from expected
      order by expected.table_name, expected.privilege
    `,
    [JSON.stringify(expected)],
  );

  for (const row of result.rows) {
    assert(
      row.has_grant,
      `grant ausente: authenticated ${row.privilege} public.${row.table_name}`,
    );
    assert(
      row.has_policy,
      `policy ausente: authenticated ${row.privilege} public.${row.table_name}`,
    );
  }

  for (const tableName of Object.keys(AUTHENTICATED_TABLE_PRIVILEGE_MATRIX)) {
    assert(
      !(await client.query(
        "select has_table_privilege('authenticated', format('public.%I', $1::text), 'DELETE') as allowed",
        [tableName],
      )).rows[0].allowed,
      `DELETE nao esperado para authenticated em public.${tableName}`,
    );
    assert(
      !(await client.query(
        "select has_table_privilege('anon', format('public.%I', $1::text), 'SELECT,INSERT,UPDATE,DELETE') as allowed",
        [tableName],
      )).rows[0].allowed,
      `anon nao deve ter acesso operacional a public.${tableName}`,
    );
  }
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

async function withAnonRole(client, fn) {
  await client.query("begin");
  try {
    await client.query("set local role anon");
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
    client_id: CLIENT_ID,
    client_op_id: clientOpId,
    client_tx_id: randomUUID(),
    client_recorded_at: new Date().toISOString(),
    prefix,
  };
}

async function createAuthUser(adminClient, runId, label, password) {
  const email = `${label}-${runId}@baseline.local`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { functional_fixture: CLIENT_ID, run_id: runId, label },
  });

  if (error) {
    throw new Error(`falha ao criar auth user ${label}: ${error.message}`);
  }

  return {
    id: data.user.id,
    email,
    password,
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
  assertLocalTarget(env);
  assert(
    process.env.REBANHOSYNC_DISPOSABLE_LOCAL_DB === "1",
    "Este baseline persiste fatos. Execute somente em banco local explicitamente descartável com REBANHOSYNC_DISPOSABLE_LOCAL_DB=1.",
  );
  const runId = randomUUID().slice(0, 8);
  const password = `Baseline-${randomUUID()}-Aa1!`;
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
    await client.query("set statement_timeout = '60s'");
    await client.query("set lock_timeout = '5s'");

    console.log("authenticated privileges: grants + policies");
    await validateAuthenticatedTablePrivilegeMatrix(client);

    const owner = await createAuthUser(adminClient, runId, "owner", password);
    const manager = await createAuthUser(adminClient, runId, "manager", password);
    const cowboy = await createAuthUser(adminClient, runId, "cowboy", password);
    const outsider = await createAuthUser(adminClient, runId, "outsider", password);
    createdUsers.push(owner, manager, cowboy, outsider);

    console.log("user_profiles: privilegio de tabela + RLS");

    await withAuthenticatedUser(client, owner.id, async () => {
      await client.query(
        "insert into public.user_profiles(user_id, display_name) values ($1, $2)",
        [owner.id, `Owner ${runId}`],
      );
    });
    await expectError(
      () =>
        withAuthenticatedUser(client, owner.id, async () => {
          await client.query(
            "insert into public.user_profiles(user_id, display_name) values ($1, $2)",
            [manager.id, `Spoof ${runId}`],
          );
        }),
      "usuario autenticado nao deve criar perfil alheio",
      ["42501"],
    );
    await expectError(
      () =>
        withAnonRole(client, async () => {
          await client.query(
            "insert into public.user_profiles(user_id, display_name) values ($1, $2)",
            [manager.id, `Anon ${runId}`],
          );
        }),
      "anon nao deve criar perfil",
      ["42501"],
    );
    await expectError(
      () =>
        withAuthenticatedUser(client, owner.id, async () => {
          await client.query(
            "insert into public.user_profiles(user_id, display_name) values ($1, $2)",
            [owner.id, `Owner duplicado ${runId}`],
          );
        }),
      "perfil duplicado deve preservar a chave primaria atual",
      ["23505"],
    );

    console.log("user_settings: privilegio de tabela + RLS");

    await withAuthenticatedUser(client, owner.id, async () => {
      await client.query(
        "insert into public.user_settings(user_id) values ($1)",
        [owner.id],
      );
    });
    await expectError(
      () =>
        withAuthenticatedUser(client, owner.id, async () => {
          await client.query(
            "insert into public.user_settings(user_id) values ($1)",
            [manager.id],
          );
        }),
      "usuario autenticado nao deve criar settings alheios",
      ["42501"],
    );
    await expectError(
      () =>
        withAnonRole(client, async () => {
          await client.query(
            "insert into public.user_settings(user_id) values ($1)",
            [manager.id],
          );
        }),
      "anon nao deve criar settings",
      ["42501"],
    );
    await expectError(
      () =>
        withAuthenticatedUser(client, owner.id, async () => {
          await client.query(
            "insert into public.user_settings(user_id) values ($1)",
            [owner.id],
          );
        }),
      "settings duplicados devem preservar a chave primaria atual",
      ["23505"],
    );

    await client.query(
      "insert into public.user_settings(user_id) values ($1)",
      [manager.id],
    );

    await withAuthenticatedUser(client, owner.id, async () => {
      await expectCount(
        client,
        "select count(*) from public.user_settings where user_id = $1",
        [owner.id],
        1,
        "usuario autenticado le os proprios settings",
      );
      await expectCount(
        client,
        "select count(*) from public.user_settings where user_id = $1",
        [manager.id],
        0,
        "settings alheios permanecem invisiveis",
      );

      const ownUpdate = await client.query(
        "update public.user_settings set theme = 'dark' where user_id = $1",
        [owner.id],
      );
      assert(ownUpdate.rowCount === 1, "usuario autenticado deve atualizar os proprios settings");

      const foreignUpdate = await client.query(
        "update public.user_settings set theme = 'light' where user_id = $1",
        [manager.id],
      );
      assert(foreignUpdate.rowCount === 0, "usuario autenticado nao deve atualizar settings alheios");
    });

    await expectError(
      () =>
        withAnonRole(client, async () => {
          await client.query("select * from public.user_settings");
        }),
      "anon nao deve ler settings",
      ["42501"],
    );
    await expectError(
      () =>
        withAnonRole(client, async () => {
          await client.query(
            "update public.user_settings set theme = 'light' where user_id = $1",
            [owner.id],
          );
        }),
      "anon nao deve atualizar settings",
      ["42501"],
    );

    console.log("1/5 RLS + fluxo owner/fazenda");

    const farmId = await withAuthenticatedUser(client, owner.id, async () => {
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
      const contraparte = await client.query(
        "insert into public.contrapartes(fazenda_id, tipo, nome) values ($1, 'pessoa', $2) returning id",
        [farmId, `Parceiro ${runId}`],
      );
      const protocolo = await client.query(
        "insert into public.protocolos_sanitarios(fazenda_id, nome, descricao) values ($1, $2, $3) returning id",
        [farmId, `Protocolo ${runId}`, "fixture funcional"],
      );
      const logicalItemKey = randomUUID();
      const protocoloItem = await client.query(
        `
        insert into public.protocolos_sanitarios_itens(
          fazenda_id, protocolo_id, logical_item_key, item_code, version, ativo,
          tipo, produto, intervalo_dias, dose_num, gera_agenda, dedup_template, payload
        )
        values (
          $1, $2, $3, 'baseline-dose', 1, true,
          'vacinacao', 'Produto baseline', 30, 1, true,
          'sanitario:baseline:{animal_id}:baseline-dose',
          '{"family_code":"baseline","official_item_code":"baseline-dose","item_code":"baseline-dose"}'::jsonb
        )
        returning id
        `,
        [farmId, protocolo.rows[0].id, logicalItemKey],
      );
      return {
        pastoId: pasto.rows[0].id,
        loteId: lote.rows[0].id,
        animalId: animal.rows[0].id,
        contraparteId: contraparte.rows[0].id,
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
      await expectError(
        () =>
          client.query(
            "update public.user_fazendas set role = 'owner' where user_id = $1 and fazenda_id = $2",
            [manager.id, farmId],
          ),
        "manager nao deve conseguir autoelevar role por update direto",
        ["42501"],
      );
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

    console.log("4/5 evento sanitario direto sem agenda legada");

    const agendaResult = await withAuthenticatedUser(client, owner.id, async () => {
      const eventMeta = syncMeta("sanitary-event-direct");
      const event = await client.query(
        `
        insert into public.eventos(
          fazenda_id, dominio, occurred_at, animal_id, lote_id, observacoes, payload,
          client_id, client_op_id, client_tx_id, client_recorded_at
        )
        values (
          $1, 'sanitario', now(), $2, $3, 'execucao funcional baseline sem agenda legada',
          '{"origem":"functional_baseline","phase":"12E2","legacy_agenda_itens_sanitario":"disabled"}'::jsonb,
          $4, $5, $6, $7
        )
        returning id
        `,
        [
          farmId,
          productive.animalId,
          productive.loteId,
          eventMeta.client_id,
          eventMeta.client_op_id,
          eventMeta.client_tx_id,
          eventMeta.client_recorded_at,
        ],
      );
      const detailMeta = syncMeta("sanitary-detail-direct");
      await client.query(
        `
        insert into public.eventos_sanitario(
          evento_id, fazenda_id, tipo, produto, payload, protocol_item_version_id,
          client_id, client_op_id, client_tx_id, client_recorded_at
        )
        values (
          $1, $2, 'vacinacao', 'Produto baseline',
          '{"origem":"functional_baseline","phase":"12E2","legacy_agenda_itens_sanitario":"disabled"}'::jsonb,
          $3, $4, $5, $6, $7
        )
        `,
        [
          event.rows[0].id,
          farmId,
          productive.protocoloItemId,
          detailMeta.client_id,
          detailMeta.client_op_id,
          detailMeta.client_tx_id,
          detailMeta.client_recorded_at,
        ],
      );
      return { agendaId: null, eventId: event.rows[0].id };
    });

    await expectCount(client, "select count(*) from public.eventos where id = $1 and source_task_id is null and dominio = 'sanitario' and fazenda_id = $2", [agendaResult.eventId, farmId], 1, "evento sanitario base criado sem agenda legada");
    await expectCount(client, "select count(*) from public.eventos_sanitario where evento_id = $1 and tipo = 'vacinacao' and produto = 'Produto baseline' and fazenda_id = $2", [agendaResult.eventId, farmId], 1, "detalhe sanitario criado");

    const stagingFixtures = await withAuthenticatedUser(client, owner.id, async () => {
      const insumo = await client.query(
        "insert into public.insumos(fazenda_id, nome, tipo, unidade_base) values ($1, $2, 'sanitario', 'ml') returning id",
        [farmId, `Insumo Sanitário ${runId}`],
      );
      const insumoLote = await client.query(
        `
        insert into public.insumo_lotes(
          fazenda_id, insumo_id, identificacao_lote,
          quantidade_inicial_base, saldo_atual_base, unidade_base
        )
        values ($1, $2, $3, 100, 100, 'ml')
        returning id
        `,
        [farmId, insumo.rows[0].id, `LOT-${runId}`],
      );
      const movement = await client.query(
        `
        insert into public.insumo_movimentacoes(
          fazenda_id, insumo_id, insumo_lote_id, tipo,
          quantidade_base, unidade_base, source_evento_id, source_evento_dominio,
          animal_id, rebanho_lote_id, payload
        )
        values ($1, $2, $3, 'consumo_sanitario', 1, 'ml', $4, 'sanitario', $5, $6, '{"origem":"baseline_fase_6"}'::jsonb)
        returning id
        `,
        [
          farmId,
          insumo.rows[0].id,
          insumoLote.rows[0].id,
          agendaResult.eventId,
          productive.animalId,
          productive.loteId,
        ],
      );
      const sociedade = await client.query(
        `
        insert into public.sociedades_pecuarias(
          fazenda_id, contraparte_id, nome, status, data_inicio,
          percentual_fazenda, percentual_parceiro
        )
        values ($1, $2, $3, 'ativa', current_date, 60, 40)
        returning id
        `,
        [farmId, productive.contraparteId, `Sociedade ${runId}`],
      );
      const sociedadeAnimal = await client.query(
        `
        insert into public.sociedade_animais(
          fazenda_id, sociedade_id, animal_id, data_entrada, status, payload
        )
        values ($1, $2, $3, current_date, 'ativo', '{"origem":"baseline_fase_6"}'::jsonb)
        returning id
        `,
        [farmId, sociedade.rows[0].id, productive.animalId],
      );
      return {
        insumoId: insumo.rows[0].id,
        insumoLoteId: insumoLote.rows[0].id,
        movementId: movement.rows[0].id,
        sociedadeId: sociedade.rows[0].id,
        sociedadeAnimalId: sociedadeAnimal.rows[0].id,
      };
    });

    await expectCount(client, "select count(*) from public.insumo_movimentacoes where id = $1 and fazenda_id = $2 and source_evento_id = $3", [stagingFixtures.movementId, farmId, agendaResult.eventId], 1, "movimentacao sanitaria vinculada respeita tenant");
    await expectCount(client, "select count(*) from public.sociedades_pecuarias where id = $1 and fazenda_id = $2", [stagingFixtures.sociedadeId, farmId], 1, "sociedade tenant-scoped criada");
    await expectCount(client, "select count(*) from public.sociedade_animais where id = $1 and fazenda_id = $2 and animal_id = $3", [stagingFixtures.sociedadeAnimalId, farmId, productive.animalId], 1, "vinculo sociedade-animal tenant-scoped criado");

    await withAuthenticatedUser(client, manager.id, async () => {
      await expectCount(client, "select count(*) from public.eventos_sanitario where fazenda_id = $1", [farmId], 1, "manager le detalhes sanitarios da fazenda");
      await expectCount(client, "select count(*) from public.insumo_movimentacoes where fazenda_id = $1", [farmId], 1, "manager le movimentacoes de estoque da fazenda");
      await expectCount(client, "select count(*) from public.sociedades_pecuarias where fazenda_id = $1", [farmId], 1, "manager le sociedades da fazenda");
    });

    await withAuthenticatedUser(client, cowboy.id, async () => {
      await expectCount(client, "select count(*) from public.eventos_sanitario where fazenda_id = $1", [farmId], 1, "cowboy le detalhes sanitarios da fazenda");
      await expectCount(client, "select count(*) from public.insumo_movimentacoes where fazenda_id = $1", [farmId], 1, "cowboy le movimentacoes de estoque da fazenda");
      await expectCount(client, "select count(*) from public.sociedades_pecuarias where fazenda_id = $1", [farmId], 1, "cowboy le sociedades da fazenda");
      await expectError(
        () =>
          client.query(
            `
            insert into public.sociedades_pecuarias(
              fazenda_id, contraparte_id, nome, status, data_inicio,
              percentual_fazenda, percentual_parceiro
            )
            values ($1, $2, $3, 'ativa', current_date, 50, 50)
            `,
            [farmId, productive.contraparteId, `Sociedade Cowboy ${runId}`],
          ),
        "cowboy nao deve criar sociedade pelo contrato RLS atual",
        ["42501"],
      );
    });

    await withAuthenticatedUser(client, outsider.id, async () => {
      await expectCount(client, "select count(*) from public.eventos_sanitario where fazenda_id = $1", [farmId], 0, "outsider nao le detalhes sanitarios");
      await expectCount(client, "select count(*) from public.insumo_movimentacoes where fazenda_id = $1", [farmId], 0, "outsider nao le movimentacoes de estoque");
      await expectCount(client, "select count(*) from public.sociedades_pecuarias where fazenda_id = $1", [farmId], 0, "outsider nao le sociedades");
      await expectCount(client, "select count(*) from public.sociedade_animais where fazenda_id = $1", [farmId], 0, "outsider nao le vinculos societarios");
    });

    console.log("5/5 sync-batch real");
    const functionsServe = await startFunctionsServeNoVerify(env.FUNCTIONS_URL);

    try {
      const ownerToken = await signInUser(anonClient, owner);
      const outsiderToken = await signInUser(anonClient, outsider);
      const syncPastoId = randomUUID();
      const syncOpId = randomUUID();
      const syncTxId = randomUUID();
      const syncBody = {
        client_id: CLIENT_ID,
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
      assert(syncFirst.payload.results?.length === 1, `sync-batch owner deve retornar um resultado: ${JSON.stringify(syncFirst.payload)}`);
      assert(syncFirst.payload.results?.[0]?.status === "APPLIED", `sync-batch owner deveria aplicar: ${JSON.stringify(syncFirst.payload)}`);

      const syncSecond = await callSyncBatch({
        functionsUrl: env.FUNCTIONS_URL,
        anonKey: env.ANON_KEY,
        token: ownerToken,
        body: syncBody,
      });
      assert(syncSecond.status === 200, `sync-batch idempotente deveria retornar 200, recebeu ${syncSecond.status}: ${JSON.stringify(syncSecond.payload)}`);
      assert(syncSecond.payload.results?.length === 1, `replay deve retornar um resultado: ${JSON.stringify(syncSecond.payload)}`);
      assert(syncSecond.payload.results?.[0]?.status === "APPLIED", `sync-batch idempotente deveria retornar APPLIED: ${JSON.stringify(syncSecond.payload)}`);
      await expectCount(client, "select count(*) from public.pastos where id = $1 and fazenda_id = $2", [syncPastoId, farmId], 1, "sync idempotente sem duplicar pasto");

      const invalid = await callSyncBatch({
        functionsUrl: env.FUNCTIONS_URL,
        anonKey: env.ANON_KEY,
        token: ownerToken,
        body: {
          client_id: CLIENT_ID,
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
      assert(invalid.payload.results?.length === 1, `sync-batch invalid deve retornar um resultado: ${JSON.stringify(invalid.payload)}`);
      assert(invalid.payload.results?.[0]?.status === "REJECTED", `sync-batch invalid deveria rejeitar: ${JSON.stringify(invalid.payload)}`);
      assert(invalid.payload.results?.[0]?.reason_code === "SECURITY_BLOCKED_TABLE", `reason_code inesperado: ${JSON.stringify(invalid.payload)}`);

      const partialPastoId = randomUUID();
      const partial = await callSyncBatch({
        functionsUrl: env.FUNCTIONS_URL,
        anonKey: env.ANON_KEY,
        token: ownerToken,
        body: {
          client_id: CLIENT_ID,
          fazenda_id: farmId,
          client_tx_id: randomUUID(),
          ops: [
            {
              client_op_id: randomUUID(),
              table: "pastos",
              action: "INSERT",
              record: { id: partialPastoId, nome: `Pasto Parcial ${runId}`, area_ha: 3 },
            },
            {
              client_op_id: randomUUID(),
              table: "user_fazendas",
              action: "INSERT",
              record: { user_id: outsider.id, fazenda_id: farmId, role: "owner" },
            },
          ],
        },
      });
      assert(partial.status === 200, `sync-batch parcial deveria retornar 200, recebeu ${partial.status}`);
      assert(Array.isArray(partial.payload.results) && partial.payload.results.length === 2, `sync parcial deve retornar resultado por operacao: ${JSON.stringify(partial.payload)}`);
      assert(partial.payload.results[0]?.status === "APPLIED", `primeira operacao parcial deveria aplicar: ${JSON.stringify(partial.payload)}`);
      assert(partial.payload.results[1]?.status === "REJECTED", `segunda operacao parcial deveria rejeitar: ${JSON.stringify(partial.payload)}`);
      assert(partial.payload.results[1]?.reason_code === "SECURITY_BLOCKED_TABLE", `reason parcial inesperado: ${JSON.stringify(partial.payload)}`);
      await expectCount(client, "select count(*) from public.pastos where id = $1 and fazenda_id = $2", [partialPastoId, farmId], 1, "sucesso parcial persiste apenas operacao aceita");

      const forbidden = await callSyncBatch({
        functionsUrl: env.FUNCTIONS_URL,
        anonKey: env.ANON_KEY,
        token: outsiderToken,
        body: {
          client_id: CLIENT_ID,
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
      sanitary_direct_event_without_legacy_agenda: "passou",
      sanitary_inventory_sociedade_rls: "passou",
      sync_batch_real_edge_function: "passou",
      sync_batch_partial_success: "passou",
      facts_persisted: true,
      cleanup: "descarte externamente o ambiente local explicitamente autorizado; este script nao executa limpeza destrutiva",
    }, null, 2));
  } finally {
    await client.query("reset role").catch(() => undefined);
    if (createdFarmIds.length > 0 || createdUsers.length > 0) {
      console.log(`FIXTURE_MARKER=${JSON.stringify({ run_id: runId, client_id: CLIENT_ID, farms: createdFarmIds, user_ids: createdUsers.map((user) => user.id), facts_persisted: true, cleanup: "dispose_authorized_local_environment" })}`);
    }
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
