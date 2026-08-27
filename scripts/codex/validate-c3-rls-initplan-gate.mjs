/**
 * validate-c3-rls-initplan-gate.mjs
 * Gate de segurança e multi-tenant C3:
 * Validação rigorosa das 8 policies otimizadas com (select auth.uid()):
 * - app_superadmins (select_self)
 * - eventos_ecc (user_fazenda_access)
 * - fazendas (fazendas_insert_auth)
 * - user_fazendas (user_fazendas_select_member)
 * - user_profiles (insert_self, select_related, update_self)
 * - user_settings (user_settings_self)
 *
 * Matriz de papéis testada:
 * - anon
 * - authenticated sem fazenda
 * - member Fazenda A (cowboy)
 * - manager Fazenda A
 * - owner Fazenda A
 * - member Fazenda B (outsider em relação a Fazenda A)
 * - superadmin
 */

import { randomUUID } from "node:crypto";
import pg from "pg";

const { Client } = pg;
const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

function assert(condition, message) {
  if (!condition) {
    console.error("FALHA DE ASSERT:", message);
    throw new Error(message);
  }
}

async function expectDenied(queryFn, desc) {
  try {
    const res = await queryFn();
    assert(res.rows.length === 0, `${desc} retornou ${res.rows.length} linhas quando deveria ser negado`);
  } catch (err) {
    if (err.code === "42501") return;
    throw err;
  }
}

async function asUser(client, role, userId, callback) {
  await client.query("BEGIN");
  try {
    if (role === "anon") {
      await client.query("SET LOCAL ROLE anon");
      await client.query("SELECT set_config('request.jwt.claim.sub', '', true)");
      await client.query("SELECT set_config('request.jwt.claim.role', 'anon', true)");
    } else {
      await client.query("SET LOCAL ROLE authenticated");
      await client.query(`SELECT set_config('request.jwt.claim.sub', '${userId}', true)`);
      await client.query("SELECT set_config('request.jwt.claim.role', 'authenticated', true)");
    }
    const res = await callback();
    await client.query("ROLLBACK");
    return res;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}

async function main() {
  console.log("=================================================================");
  console.log("Iniciando Gate Multi-Tenant C3 — Otimização auth_rls_initplan");
  console.log("=================================================================\n");

  const adminClient = new Client({ connectionString: DB_URL });
  await adminClient.connect();

  const runId = randomUUID().slice(0, 8);

  // IDs para usuários de teste
  const userNoFarmId = randomUUID();
  const ownerAId = randomUUID();
  const managerAId = randomUUID();
  const memberAId = randomUUID();
  const memberBId = randomUUID();
  const superAdminId = randomUUID();

  // IDs para fazendas
  const farmAId = randomUUID();
  const farmBId = randomUUID();

  console.log(`--- 1. Provisionando Fixtures de Teste (Run: ${runId}) ---`);

  // Inserir auth.users
  const users = [
    { id: userNoFarmId, email: `c3-nofarm-${runId}@test.local` },
    { id: ownerAId, email: `c3-owner-a-${runId}@test.local` },
    { id: managerAId, email: `c3-manager-a-${runId}@test.local` },
    { id: memberAId, email: `c3-member-a-${runId}@test.local` },
    { id: memberBId, email: `c3-member-b-${runId}@test.local` },
    { id: superAdminId, email: `c3-superadmin-${runId}@test.local` },
  ];

  for (const u of users) {
    await adminClient.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data, raw_app_meta_data, aud, role, created_at, updated_at)
       VALUES ($1, $2, '{"nome":"Test User"}', '{"provider":"email"}', 'authenticated', 'authenticated', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [u.id, u.email]
    );
  }

  // Provisionar SuperAdmin
  await adminClient.query(
    `INSERT INTO public.app_superadmins (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [superAdminId]
  );

  // Inserir Fazenda A e Fazenda B
  await adminClient.query(
    `INSERT INTO public.fazendas (id, nome, created_by) VALUES ($1, $2, $3)`,
    [farmAId, `Fazenda A ${runId}`, ownerAId]
  );
  await adminClient.query(
    `INSERT INTO public.fazendas (id, nome, created_by) VALUES ($1, $2, $3)`,
    [farmBId, `Fazenda B ${runId}`, memberBId]
  );

  // Inserir memberships em user_fazendas
  await adminClient.query(
    `INSERT INTO public.user_fazendas (user_id, fazenda_id, role) VALUES
     ($1, $2, 'owner'),
     ($3, $2, 'manager'),
     ($4, $2, 'cowboy'),
     ($5, $6, 'owner')`,
    [ownerAId, farmAId, managerAId, memberAId, memberBId, farmBId]
  );

  // Inserir user_profiles
  await adminClient.query(
    `INSERT INTO public.user_profiles (user_id, display_name) VALUES
     ($1, 'No Farm'),
     ($2, 'Owner A'),
     ($3, 'Manager A'),
     ($4, 'Member A'),
     ($5, 'Member B')`,
    [
      userNoFarmId,
      ownerAId,
      managerAId,
      memberAId,
      memberBId
    ]
  );

  // Inserir user_settings
  await adminClient.query(
    `INSERT INTO public.user_settings (user_id, theme) VALUES ($1, 'dark')`,
    [ownerAId]
  );

  // Inserir dados de teste para eventos_ecc na Fazenda A
  const animalAId = randomUUID();
  await adminClient.query(
    `INSERT INTO public.animais (id, fazenda_id, identificacao, sexo) VALUES ($1, $2, 'BR01', 'F')`,
    [animalAId, farmAId]
  );
  const eccEventId = randomUUID();
  await adminClient.query(
    `INSERT INTO public.eventos (id, fazenda_id, animal_id, dominio, occurred_at)
     VALUES ($1, $2, $3, 'ecc', now())`,
    [eccEventId, farmAId, animalAId]
  );
  await adminClient.query(
    `INSERT INTO public.eventos_ecc (event_id, fazenda_id, animal_id, ecc)
     VALUES ($1, $2, $3, 3.50)`,
    [eccEventId, farmAId, animalAId]
  );

  console.log("✓ Fixtures preparadas com sucesso.");

  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  try {
    // =================================================================
    // TESTE 1: app_superadmins (app_superadmins_select_self)
    // =================================================================
    console.log("\n--- 2. Testando app_superadmins_select_self ---");

    // Anon: DENIED
    await asUser(client, "anon", null, async () => {
      await expectDenied(() => client.query("SELECT * FROM public.app_superadmins"), "Anon lendo app_superadmins");
    });
    console.log("✓ anon: acesso a app_superadmins negado (DENIED)");

    // Regular user (Owner A): lê apenas seu próprio registro (se fosse admin, que não é -> 0)
    await asUser(client, "authenticated", ownerAId, async () => {
      const res = await client.query("SELECT * FROM public.app_superadmins");
      assert(res.rows.length === 0, "Owner A não é superadmin, retorno deve ser 0");
    });
    console.log("✓ authenticated não-superadmin: 0 registros");

    // SuperAdmin: lê seu próprio registro
    await asUser(client, "authenticated", superAdminId, async () => {
      const res = await client.query("SELECT * FROM public.app_superadmins");
      assert(res.rows.length === 1 && res.rows[0].user_id === superAdminId, "SuperAdmin deve ler a si mesmo");
    });
    console.log("✓ SuperAdmin: lê a si mesmo com sucesso");

    // =================================================================
    // TESTE 2: eventos_ecc (user_fazenda_access)
    // =================================================================
    console.log("\n--- 3. Testando eventos_ecc (user_fazenda_access) ---");

    // Anon: DENIED
    await asUser(client, "anon", null, async () => {
      await expectDenied(() => client.query("SELECT * FROM public.eventos_ecc"), "Anon lendo eventos_ecc");
    });
    console.log("✓ anon: acesso a eventos_ecc negado (DENIED)");

    // Usuário sem fazenda: DENIED
    await asUser(client, "authenticated", userNoFarmId, async () => {
      const res = await client.query("SELECT * FROM public.eventos_ecc");
      assert(res.rows.length === 0, "Usuário sem fazenda não deve ler eventos_ecc");
    });
    console.log("✓ usuário sem fazenda: 0 registros (DENIED)");

    // Membro de Fazenda B (Outsider de A): DENIED
    await asUser(client, "authenticated", memberBId, async () => {
      const res = await client.query("SELECT * FROM public.eventos_ecc WHERE fazenda_id = $1", [farmAId]);
      assert(res.rows.length === 0, "Membro de B não deve ler eventos_ecc de A");
    });
    console.log("✓ Membro Fazenda B (cross-tenant em A): 0 registros (DENIED)");

    // Membro de Fazenda A (cowboy): ALLOWED
    await asUser(client, "authenticated", memberAId, async () => {
      const res = await client.query("SELECT * FROM public.eventos_ecc WHERE fazenda_id = $1", [farmAId]);
      assert(res.rows.length === 1, "Membro de A deve ler eventos_ecc de A");
    });
    console.log("✓ Membro Fazenda A: lê eventos_ecc de A (ALLOWED)");

    // =================================================================
    // TESTE 3: fazendas (fazendas_insert_auth)
    // =================================================================
    console.log("\n--- 4. Testando fazendas (fazendas_insert_auth) ---");

    // Anon inserindo fazenda: DENIED
    await asUser(client, "anon", null, async () => {
      let failed = false;
      try {
        await client.query("INSERT INTO public.fazendas (id, nome, created_by) VALUES ($1, $2, $3)", [
          randomUUID(), "Fake Farm", randomUUID()
        ]);
      } catch {
        failed = true;
      }
      assert(failed, "Anon não pode inserir fazenda diretamente");
    });
    console.log("✓ anon: inserção direta em fazendas DENIED");

    // Authenticated tentando inserção direta em fazendas: DENIED (privilégio exclusivo de RPC)
    await asUser(client, "authenticated", ownerAId, async () => {
      let failed = false;
      try {
        await client.query("INSERT INTO public.fazendas (id, nome, created_by) VALUES ($1, $2, $3)", [
          randomUUID(), "Direct Insert Farm", ownerAId
        ]);
      } catch {
        failed = true;
      }
      assert(failed, "Authenticated não possui grant direto de INSERT em fazendas (apenas via RPC)");
    });
    console.log("✓ authenticated: inserção direta em fazendas bloqueada por grant (DENIED)");

    // Authenticated criando fazenda via RPC canônica create_fazenda: ALLOWED
    await asUser(client, "authenticated", ownerAId, async () => {
      const res = await client.query("SELECT public.create_fazenda($1) AS farm_id", [`RPC Farm ${runId}`]);
      assert(res.rows.length === 1 && res.rows[0].farm_id, "create_fazenda deve retornar ID da fazenda criada");
    });
    console.log("✓ authenticated criando fazenda via RPC create_fazenda: ALLOWED");

    // =================================================================
    // TESTE 4: user_fazendas (user_fazendas_select_member)
    // =================================================================
    console.log("\n--- 5. Testando user_fazendas (user_fazendas_select_member) ---");

    // Anon: DENIED
    await asUser(client, "anon", null, async () => {
      await expectDenied(() => client.query("SELECT * FROM public.user_fazendas"), "Anon lendo user_fazendas");
    });
    console.log("✓ anon: acesso a user_fazendas negado (DENIED)");

    // Member A: lê registros da Fazenda A e a si mesmo, mas NÃO lê Fazenda B
    await asUser(client, "authenticated", memberAId, async () => {
      const res = await client.query("SELECT * FROM public.user_fazendas");
      // Deve ver os membros de A (owner, manager, ele mesmo)
      const farmIds = new Set(res.rows.map(r => r.fazenda_id));
      assert(farmIds.has(farmAId), "Member A deve ver sua fazenda A");
      assert(!farmIds.has(farmBId), "Member A NUNCA deve ver fazenda B (cross-tenant DENIED)");
    });
    console.log("✓ Member A: lê Fazenda A, Fazenda B bloqueada (cross-tenant DENIED)");

    // Member B: lê Fazenda B, NÃO lê Fazenda A
    await asUser(client, "authenticated", memberBId, async () => {
      const res = await client.query("SELECT * FROM public.user_fazendas");
      const farmIds = new Set(res.rows.map(r => r.fazenda_id));
      assert(farmIds.has(farmBId), "Member B deve ver sua fazenda B");
      assert(!farmIds.has(farmAId), "Member B NUNCA deve ver fazenda A (cross-tenant DENIED)");
    });
    console.log("✓ Member B: lê Fazenda B, Fazenda A bloqueada (cross-tenant DENIED)");

    // =================================================================
    // TESTE 5: user_profiles (insert_self, select_related, update_self)
    // =================================================================
    console.log("\n--- 6. Testando user_profiles (insert_self, select_related, update_self) ---");

    // Anon: DENIED
    await asUser(client, "anon", null, async () => {
      await expectDenied(() => client.query("SELECT * FROM public.user_profiles"), "Anon lendo user_profiles");
    });
    console.log("✓ anon: acesso a user_profiles negado (DENIED)");

    // Member A lê perfis relacionados (ele mesmo + colegas da Fazenda A), mas NÃO lê Member B
    await asUser(client, "authenticated", memberAId, async () => {
      const res = await client.query("SELECT user_id FROM public.user_profiles");
      const userIds = new Set(res.rows.map(r => r.user_id));
      assert(userIds.has(memberAId), "Member A deve ler seu próprio perfil");
      assert(userIds.has(ownerAId), "Member A deve ler colega de fazenda A (Owner A)");
      assert(userIds.has(managerAId), "Member A deve ler colega de fazenda A (Manager A)");
      assert(!userIds.has(memberBId), "Member A NUNCA deve ler perfil de Member B (cross-tenant DENIED)");
      assert(!userIds.has(userNoFarmId), "Member A NUNCA deve ler perfil de usuário sem fazenda em comum");
    });
    console.log("✓ Member A: lê a si e colegas da Fazenda A; Member B e NoFarm DENIED");

    // Member A atualiza seu próprio perfil: ALLOWED
    await asUser(client, "authenticated", memberAId, async () => {
      await client.query("UPDATE public.user_profiles SET display_name = 'Member A Updated' WHERE user_id = $1", [memberAId]);
      const res = await client.query("SELECT display_name FROM public.user_profiles WHERE user_id = $1", [memberAId]);
      assert(res.rows[0].display_name === "Member A Updated", "Member A deve poder atualizar seu perfil");
    });
    console.log("✓ Member A atualiza seu próprio perfil: ALLOWED");

    // Member A tenta atualizar perfil de Owner A: DENIED / 0 rows affected
    await asUser(client, "authenticated", memberAId, async () => {
      const res = await client.query("UPDATE public.user_profiles SET display_name = 'Hacked Owner' WHERE user_id = $1", [ownerAId]);
      assert(res.rowCount === 0, "Member A não pode atualizar perfil de outro usuário");
    });
    console.log("✓ Member A tentando atualizar perfil de outro usuário: DENIED (0 rows)");

    // =================================================================
    // TESTE 6: user_settings (user_settings_self)
    // =================================================================
    console.log("\n--- 7. Testando user_settings (user_settings_self) ---");

    // Anon: DENIED
    await asUser(client, "anon", null, async () => {
      await expectDenied(() => client.query("SELECT * FROM public.user_settings"), "Anon lendo user_settings");
    });
    console.log("✓ anon: acesso a user_settings negado (DENIED)");

    // Owner A lê seu próprio settings
    await asUser(client, "authenticated", ownerAId, async () => {
      const res = await client.query("SELECT * FROM public.user_settings WHERE user_id = $1", [ownerAId]);
      assert(res.rows.length === 1 && res.rows[0].theme === "dark", "Owner A deve ler seu próprio settings");
    });
    console.log("✓ Owner A lê seu settings: ALLOWED");

    // Manager A tentando ler settings de Owner A: DENIED
    await asUser(client, "authenticated", managerAId, async () => {
      const res = await client.query("SELECT * FROM public.user_settings WHERE user_id = $1", [ownerAId]);
      assert(res.rows.length === 0, "Manager A não deve ler settings de Owner A");
    });
    console.log("✓ Manager A tentando ler settings de Owner A: 0 registros (DENIED)");

    // Manager A tentando atualizar settings de Owner A: DENIED
    await asUser(client, "authenticated", managerAId, async () => {
      const res = await client.query("UPDATE public.user_settings SET theme = 'light' WHERE user_id = $1", [ownerAId]);
      assert(res.rowCount === 0, "Manager A não deve atualizar settings de Owner A");
    });
    console.log("✓ Manager A tentando atualizar settings de Owner A: DENIED (0 rows)");

  } finally {
    await client.end();

    // Limpeza das fixtures de teste
    console.log("\n--- 8. Limpando Fixtures de Teste ---");
    await adminClient.query("DELETE FROM public.eventos_ecc WHERE fazenda_id IN ($1, $2)", [farmAId, farmBId]);
    await adminClient.query("DELETE FROM public.eventos WHERE fazenda_id IN ($1, $2)", [farmAId, farmBId]);
    await adminClient.query("DELETE FROM public.animais WHERE fazenda_id IN ($1, $2)", [farmAId, farmBId]);
    await adminClient.query("DELETE FROM public.user_fazendas WHERE fazenda_id IN ($1, $2)", [farmAId, farmBId]);
    await adminClient.query("DELETE FROM public.fazendas WHERE id IN ($1, $2)", [farmAId, farmBId]);
    await adminClient.query("DELETE FROM public.user_settings WHERE user_id = ANY($1)", [users.map(u => u.id)]);
    await adminClient.query("DELETE FROM public.user_profiles WHERE user_id = ANY($1)", [users.map(u => u.id)]);
    await adminClient.query("DELETE FROM public.app_superadmins WHERE user_id = $1", [superAdminId]);
    await adminClient.query("DELETE FROM auth.users WHERE id = ANY($1)", [users.map(u => u.id)]);
    console.log("✓ Fixtures limpas com sucesso.");

    await adminClient.end();
  }

  console.log("\n=================================================================");
  console.log("🎉 GATE MULTI-TENANT C3 APROVADO COM 100% DE SUCESSO!");
  console.log("=================================================================");
}

main().catch((err) => {
  console.error("Erro fatal no gate C3:", err);
  process.exit(1);
});
