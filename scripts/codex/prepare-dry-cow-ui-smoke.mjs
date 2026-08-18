import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client } = pg;
const CLIENT_ID = "dry-cow-ui-smoke";
const REPOSITORY_ROOT = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readSupabaseStatusEnv() {
  const output = execFileSync("supabase", ["status", "-o", "env"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  const env = {};
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator);
    if (!/^[A-Z0-9_]+$/.test(key)) continue;
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  for (const key of ["DB_URL", "API_URL", "SERVICE_ROLE_KEY"]) {
    assert(env[key], `supabase status -o env nao retornou ${key}`);
  }
  const apiUrl = new URL(env.API_URL);
  assert(
    ["127.0.0.1", "localhost", "::1"].includes(apiUrl.hostname),
    `Smoke bloqueado fora do Supabase local: ${apiUrl.hostname}`,
  );

  return env;
}

async function findAuthUserByEmail(adminClient, email) {
  const perPage = 100;
  for (let page = 1; page <= 100; page += 1) {
    const result = await adminClient.auth.admin.listUsers({ page, perPage });
    if (result.error) {
      throw new Error(`falha ao listar auth users: ${result.error.message}`);
    }
    const user = result.data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    );
    if (user) return user;
    if (result.data.users.length < perPage) return null;
  }
  throw new Error("busca de auth user excedeu 100 paginas");
}

function dryCowPayload() {
  return {
    standard_id: "med-mastite-seca",
    family_code: "terapia_vaca_seca",
    item_code: "secagem-intramamario",
    protocol_id: "med-mastite-seca",
    calendario_base: {
      mode: "clinical_protocol",
      anchor: "dry_off",
    },
    dry_cow_therapy: {
      activation_status: "clinical_support_only",
      materialization_contract_version: 1,
    },
  };
}

async function prepareDatabaseFixture(dbClient, { userId, runId }) {
  const farmName = `Fazenda Smoke Vaca Seca ${runId}`;
  const protocolId = randomUUID();
  const itemId = randomUUID();
  let fazendaId;

  await dbClient.query("begin");
  try {
    await dbClient.query("set local role authenticated");
    await dbClient.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    await dbClient.query(
      "select set_config('request.jwt.claim.role', 'authenticated', true)",
    );
    await dbClient.query(
      `
        insert into public.user_profiles(user_id, display_name)
        values ($1, $2)
        on conflict (user_id) do update
        set display_name = excluded.display_name,
            deleted_at = null
      `,
      [userId, `Dry Cow UI ${runId}`],
    );
    await dbClient.query(
      `
        insert into public.user_settings(user_id)
        values ($1)
        on conflict (user_id) do update
        set updated_at = now()
      `,
      [userId],
    );
    const farmResult = await dbClient.query(
      `
        select public.create_fazenda(
          $1, $2, $3, 'GO'::public.estado_uf_enum, null, 120,
          'leite'::public.tipo_producao_enum,
          'pastagem'::public.sistema_manejo_enum
        ) as id
      `,
      [farmName, `dry-cow-ui-${runId}`, "Teste"],
    );
    fazendaId = farmResult.rows[0]?.id;
    assert(fazendaId, "create_fazenda nao retornou id");

    await dbClient.query("set local role service_role");
    await dbClient.query(
      `
        update public.fazendas
        set metadata = jsonb_set(
          coalesce(metadata, '{}'::jsonb),
          '{app_experience}',
          '{"mode":"completo"}'::jsonb,
          true
        )
        where id = $1
      `,
      [fazendaId],
    );
    await dbClient.query(
      `
        update public.user_settings
        set active_fazenda_id = $2, updated_at = now()
        where user_id = $1
      `,
      [userId, fazendaId],
    );
    await dbClient.query(
      `
        insert into public.protocolos_sanitarios(
          id, fazenda_id, nome, descricao, ativo, payload, client_id,
          client_op_id, client_recorded_at
        )
        values ($1, $2, 'Terapia de Vaca Seca', 'Smoke UI de exposicao controlada',
                true, $3, $4, $5, now())
      `,
      [
        protocolId,
        fazendaId,
        {
          origem: "biblioteca_canonica_fazenda",
          standard_id: "med-mastite-seca",
          family_code: "terapia_vaca_seca",
        },
        `dry-cow-ui-smoke:${runId}`,
        randomUUID(),
      ],
    );
    await dbClient.query(
      `
        insert into public.protocolos_sanitarios_itens(
          id, fazenda_id, protocolo_id, logical_item_key, item_code, version, ativo, tipo,
          produto, intervalo_dias, dose_num, gera_agenda, payload, client_id,
          client_op_id, client_recorded_at
        )
        values ($1, $2, $3, $4, 'secagem-intramamario', 1, true, 'medicamento',
                'Antibiotico Intramamario (Vaca Seca)', 60, 1, false, $5, $6, $7, now())
      `,
      [
        itemId,
        fazendaId,
        protocolId,
        randomUUID(),
        dryCowPayload(),
        `dry-cow-ui-smoke:${runId}`,
        randomUUID(),
      ],
    );
    await dbClient.query("commit");
  } catch (error) {
    await dbClient.query("rollback");
    throw error;
  }

  return { farmName, fazendaId, protocolId, itemId };
}

function resolveManifestPath(input) {
  const resolved = path.resolve(REPOSITORY_ROOT, input);
  const tmpRoot = path.join(REPOSITORY_ROOT, "tmp") + path.sep;
  assert(
    resolved.startsWith(tmpRoot),
    "Manifesto de smoke deve permanecer em tmp/ dentro do repositorio.",
  );
  return resolved;
}

async function cleanupFixture(manifestArgument) {
  const manifestPath = resolveManifestPath(manifestArgument);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert(manifest.clientId === CLIENT_ID, "Manifesto nao pertence ao smoke de Vaca Seca.");
  for (const key of ["userId", "fazendaId", "protocolId", "itemId"]) {
    assert(manifest[key], `Manifesto sem ${key}.`);
  }

  const env = readSupabaseStatusEnv();
  const adminClient = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const dbClient = new Client({ connectionString: env.DB_URL });
  await dbClient.connect();
  try {
    await dbClient.query("begin");
    await dbClient.query("set local role service_role");
    await dbClient.query(
      "delete from public.protocolos_sanitarios_itens where id = $1 and fazenda_id = $2",
      [manifest.itemId, manifest.fazendaId],
    );
    await dbClient.query(
      "delete from public.protocolos_sanitarios where id = $1 and fazenda_id = $2",
      [manifest.protocolId, manifest.fazendaId],
    );
    await dbClient.query(
      "update public.user_settings set active_fazenda_id = null where user_id = $1 and active_fazenda_id = $2",
      [manifest.userId, manifest.fazendaId],
    );
    await dbClient.query(
      "delete from public.user_fazendas where user_id = $1 and fazenda_id = $2",
      [manifest.userId, manifest.fazendaId],
    );
    await dbClient.query("delete from public.fazendas where id = $1", [manifest.fazendaId]);
    await dbClient.query("delete from public.user_settings where user_id = $1", [manifest.userId]);
    await dbClient.query("delete from public.user_profiles where user_id = $1", [manifest.userId]);
    await dbClient.query("commit");

    const residue = await dbClient.query(
      `select
        (select count(*) from public.fazendas where id = $1)::integer as fazendas,
        (select count(*) from public.protocolos_sanitarios where id = $2)::integer as protocolos,
        (select count(*) from public.protocolos_sanitarios_itens where id = $3)::integer as itens,
        (select count(*) from public.user_fazendas where user_id = $4)::integer as memberships,
        (select count(*) from public.user_settings where user_id = $4)::integer as settings,
        (select count(*) from public.user_profiles where user_id = $4)::integer as profiles`,
      [manifest.fazendaId, manifest.protocolId, manifest.itemId, manifest.userId],
    );
    assert(
      Object.values(residue.rows[0]).every((value) => Number(value) === 0),
      `Cleanup deixou residuos: ${JSON.stringify(residue.rows[0])}`,
    );

    const authCleanup = await adminClient.auth.admin.deleteUser(manifest.userId);
    if (authCleanup.error && !/not found/i.test(authCleanup.error.message)) {
      throw new Error(`Falha ao remover auth user: ${authCleanup.error.message}`);
    }
    const authResidue = await adminClient.auth.admin.getUserById(manifest.userId);
    assert(
      authResidue.error || !authResidue.data?.user,
      "Cleanup deixou usuario de autenticacao residual.",
    );
    fs.rmSync(manifestPath, { force: true });
    console.log(JSON.stringify({
      result: "CLEAN",
      runId: manifest.runId,
      residues: residue.rows[0],
      authUser: "absent",
    }, null, 2));
  } catch (error) {
    await dbClient.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await dbClient.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--cleanup") {
    assert(args.length === 2, "Uso: prepare-dry-cow-ui-smoke.mjs --cleanup tmp/<manifesto>.json");
    await cleanupFixture(args[1]);
    return;
  }
  assert(args.length === 0, "Argumento invalido. Use sem argumentos ou --cleanup <manifesto>." );

  const runId = randomUUID().slice(0, 8);
  const email = process.env.UI_SMOKE_EMAIL?.trim() || `dry-cow-ui-${runId}@functional.local`;
  const password = process.env.UI_SMOKE_PASSWORD;

  assert(password, "Defina UI_SMOKE_PASSWORD para preparar o smoke local.");
  assert(password.length >= 12, "UI_SMOKE_PASSWORD deve ter pelo menos 12 caracteres.");
  assert(!/[\r\n]/.test(email), "UI_SMOKE_EMAIL invalido.");

  const env = readSupabaseStatusEnv();
  const adminClient = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const dbClient = new Client({ connectionString: env.DB_URL });
  let createdUserId = null;

  await dbClient.connect();
  try {
    const existingUser = await findAuthUserByEmail(adminClient, email);
    assert(!existingUser, "UI_SMOKE_EMAIL ja existe. Use identidade exclusiva para permitir cleanup dirigido.");

    const userResult = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { dry_cow_ui_smoke: true, client_id: CLIENT_ID, run_id: runId },
    });
    if (userResult.error) {
      throw new Error(`falha ao preparar auth user: ${userResult.error.message}`);
    }
    const userId = userResult.data.user.id;
    createdUserId = userId;

    const fixture = await prepareDatabaseFixture(dbClient, { userId, runId });
    const manifestPath = resolveManifestPath(`tmp/dry-cow-ui-smoke-${runId}.json`);
    const manifest = {
      schemaVersion: 1,
      clientId: CLIENT_ID,
      runId,
      email,
      userId,
      ...fixture,
    };
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    console.log(
      JSON.stringify(
        {
          ...manifest,
          mode: "completo",
          manifestPath: path.relative(REPOSITORY_ROOT, manifestPath).replaceAll("\\", "/"),
          cleanup: "execute este script com --cleanup <manifestPath> ou use o runner CDP, que limpa automaticamente",
        },
        null,
        2,
      ),
    );
  } catch (error) {
    if (createdUserId) {
      const cleanup = await adminClient.auth.admin.deleteUser(createdUserId);
      if (cleanup.error) {
        console.error(`Falha ao remover auth user apos rollback: ${cleanup.error.message}`);
      }
    }
    throw error;
  } finally {
    await dbClient.end();
  }
}

main().catch((error) => {
  console.error(`Falha ao preparar smoke UI Vaca Seca: ${error.message}`);
  process.exitCode = 1;
});
