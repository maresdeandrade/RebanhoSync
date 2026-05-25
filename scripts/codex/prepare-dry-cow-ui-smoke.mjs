import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client } = pg;

const DEFAULT_PASSWORD = "SupabaseFunctional1!";

function readSupabaseStatusEnv() {
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
    if (!env[key]) throw new Error(`supabase status -o env nao retornou ${key}`);
  }

  return env;
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

async function main() {
  const runId = randomUUID().slice(0, 8);
  const email = process.env.UI_SMOKE_EMAIL ?? `dry-cow-ui-${runId}@functional.local`;
  const password = process.env.UI_SMOKE_PASSWORD ?? DEFAULT_PASSWORD;
  const env = readSupabaseStatusEnv();
  const adminClient = createClient(env.API_URL, env.SERVICE_ROLE_KEY);
  const dbClient = new Client({ connectionString: env.DB_URL });
  await dbClient.connect();

  try {
    const usersResult = await adminClient.auth.admin.listUsers();
    if (usersResult.error) {
      throw new Error(`falha ao listar auth users: ${usersResult.error.message}`);
    }
    const existingUser = usersResult.data.users.find((user) => user.email === email);
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
    const farmName = `Fazenda Smoke Vaca Seca ${runId}`;
    const fazendaId = await withAuthenticatedUser(dbClient, userId, async () => {
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
      const result = await dbClient.query(
        `
          select public.create_fazenda(
            $1, $2, $3, 'GO'::public.estado_uf_enum, null, 120,
            'leite'::public.tipo_producao_enum,
            'pastagem'::public.sistema_manejo_enum
          ) as id
        `,
        [farmName, `dry-cow-ui-${runId}`, "Teste"],
      );
      return result.rows[0].id;
    });

    const protocolId = randomUUID();
    const itemId = randomUUID();
    await withServiceRole(dbClient, async () => {
      await dbClient.query(
        `
          update public.fazendas
          set metadata = jsonb_set(metadata, '{app_experience}', '{"mode":"completo"}'::jsonb, true)
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
                  true, $3, 'dry-cow-ui-smoke', $4, now())
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
          values ($1, $2, $3, $4, 1, 'medicamento',
                  'Antibiotico Intramamario (Vaca Seca)', 60, 1, false, $5,
                  'dry-cow-ui-smoke', $6, now())
        `,
        [itemId, fazendaId, protocolId, randomUUID(), dryCowPayload(), randomUUID()],
      );
    });

    console.log(
      JSON.stringify(
        {
          email,
          farmName,
          fazendaId,
          protocolId,
          itemId,
          mode: "completo",
          userSource: process.env.UI_SMOKE_EMAIL ? "provided" : "generated",
        },
        null,
        2,
      ),
    );
  } finally {
    await dbClient.end();
  }
}

main().catch((error) => {
  console.error(`Falha ao preparar smoke UI Vaca Seca: ${error.message}`);
  process.exit(1);
});
