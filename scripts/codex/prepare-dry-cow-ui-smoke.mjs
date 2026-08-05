import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import process from "node:process";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client } = pg;

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

async function main() {
  const runId = randomUUID().slice(0, 8);
  const email = process.env.UI_SMOKE_EMAIL?.trim() || `dry-cow-ui-${runId}@functional.local`;
  const password = process.env.UI_SMOKE_PASSWORD;
  const allowReuse = process.env.UI_SMOKE_REUSE_USER === "1";

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
    if (existingUser && !allowReuse) {
      throw new Error(
        "UI_SMOKE_EMAIL ja existe. Use outro email ou defina UI_SMOKE_REUSE_USER=1 conscientemente.",
      );
    }

    const userResult = existingUser
      ? await adminClient.auth.admin.updateUserById(existingUser.id, {
          password,
          email_confirm: true,
          user_metadata: {
            ...(existingUser.user_metadata ?? {}),
            dry_cow_ui_smoke: true,
          },
        })
      : await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { dry_cow_ui_smoke: true },
        });
    if (userResult.error) {
      throw new Error(`falha ao preparar auth user: ${userResult.error.message}`);
    }
    const userId = userResult.data.user.id;
    if (!existingUser) createdUserId = userId;

    const fixture = await prepareDatabaseFixture(dbClient, { userId, runId });
    console.log(
      JSON.stringify(
        {
          runId,
          email,
          userId,
          ...fixture,
          mode: "completo",
          userSource: existingUser ? "reused" : "created",
          note: "Fixture local persistente; remova-a ou resete o banco apos o smoke.",
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
