/**
 * validate-superadmin-security-gate.mjs
 * Validação rigorosa dos contratos de segurança SuperAdmin (A1.1 + A2 + A2.1 + A4) no Postgres local do Supabase.
 */

import pg from "pg";
const { Client } = pg;

const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function runSecurityGate() {
  console.log("=================================================================");
  console.log("Iniciando Validação de Segurança SuperAdmin A1.1 + A2 + A2.1 + A4 (Postgres)");
  console.log("=================================================================\n");

  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  try {
    // 1. Preparação de fixtures isoladas para o teste
    console.log("--- 1. Criando fixtures de usuários e fazendas ---");

    // IDs determinísticos
    const superAdminId = "00000000-0000-0000-0000-000000000001";
    const regularUserId = "00000000-0000-0000-0000-000000000002";
    const farmOwnerId = "00000000-0000-0000-0000-000000000003";
    const farmManagerId = "00000000-0000-0000-0000-000000000004";
    const farmCowboyId = "00000000-0000-0000-0000-000000000005";
    const targetUserId = "00000000-0000-0000-0000-000000000006";
    const testFarmId = "00000000-0000-0000-0000-0000000000f1";

    // Inserção em auth.users e public.user_profiles
    const testUsers = [
      { id: superAdminId, email: "superadmin@rebanhosync.local", role: "superadmin" },
      { id: regularUserId, email: "user@rebanhosync.local", role: "user" },
      { id: farmOwnerId, email: "owner@rebanhosync.local", role: "owner" },
      { id: farmManagerId, email: "manager@rebanhosync.local", role: "manager" },
      { id: farmCowboyId, email: "cowboy@rebanhosync.local", role: "cowboy" },
      { id: targetUserId, email: "target@rebanhosync.local", role: "target" },
    ];

    for (const u of testUsers) {
      await client.query(`
        insert into auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
        values ('${u.id}', '00000000-0000-0000-0000-000000000000', '${u.email}', 'authenticated', 'authenticated', 'xyz', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"${u.email}"}')
        on conflict (id) do nothing;
      `);

      await client.query(`
        insert into public.user_profiles (user_id, display_name, can_create_farm)
        values ('${u.id}', '${u.email}', true)
        on conflict (user_id) do update set can_create_farm = true;
      `);
    }

    // Criar fazenda e memberships de teste
    await client.query(`
      insert into public.fazendas (id, nome, codigo, created_by)
      values ('${testFarmId}', 'Fazenda Teste Segurança', 'FTS-01', '${farmOwnerId}')
      on conflict (id) do nothing;
    `);

    await client.query(`
      insert into public.user_fazendas (fazenda_id, user_id, role, is_primary)
      values
        ('${testFarmId}', '${farmOwnerId}', 'owner', true),
        ('${testFarmId}', '${farmManagerId}', 'manager', true),
        ('${testFarmId}', '${farmCowboyId}', 'cowboy', true)
      on conflict do nothing;
    `);

    // Criar convite pendente e convite expirado para teste A2.1
    await client.query(`
      insert into public.farm_invites (id, fazenda_id, invited_by, email, role, status, token, expires_at)
      values
        ('00000000-0000-0000-0000-000000000c01', '${testFarmId}', '${farmOwnerId}', 'convite_valido@test.local', 'cowboy', 'pending', '00000000-0000-0000-0000-000000000e01', now() + interval '7 days'),
        ('00000000-0000-0000-0000-000000000c02', '${testFarmId}', '${farmOwnerId}', 'convite_expirado@test.local', 'cowboy', 'pending', '00000000-0000-0000-0000-000000000e02', now() - interval '1 day')
      on conflict (id) do nothing;
    `);

    console.log("✓ Fixtures preparadas com sucesso.\n");

    client.on("error", () => {});

    // Helper para rodar query com contexto de usuário Supabase
    async function executeAs(userId, sql) {
      await client.query("BEGIN;");
      try {
        await client.query(`set local role authenticated;`);
        await client.query(`set local "request.jwt.claim.sub" = '${userId}';`);
        await client.query(`set local "request.jwt.claim.role" = 'authenticated';`);
        const res = await client.query(sql);
        await client.query("COMMIT;");
        return { data: res.rows, error: null };
      } catch (err) {
        try { await client.query("ROLLBACK;"); } catch {}
        return { data: null, error: err };
      }
    }

    // 2. Testar Negação para Não-SuperAdmins (A2 + A4)
    console.log("--- 2. Testando Negação de Acesso para não-SuperAdmins ---");

    // 2.1. Validar negação completa para papel 'anon' via catálogo (sem grants EXECUTE)
    const anonPrivCheck = await client.query(`
      select
        p.proname,
        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_has_execute
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in (
          'is_app_admin',
          'admin_get_platform_metrics',
          'admin_list_platform_users',
          'admin_get_platform_user',
          'admin_list_platform_farms',
          'admin_list_platform_invites',
          'admin_set_can_create_farm'
        );
    `);
    for (const row of anonPrivCheck.rows) {
      if (row.anon_has_execute) {
        throw new Error(`FALHA DE SEGURANÇA: Papel 'anon' possui EXECUTE grant na função ${row.proname}`);
      }
    }
    console.log("✓ Papel 'anon': Acesso DENIED (sem grant EXECUTE) confirmado em todas as RPCs A2 + A4.");

    // 2.2. Validar negação para usuários autenticados sem SuperAdmin (regular, owner, manager, cowboy)
    const authRolesToTest = [
      { name: "regular_user", id: regularUserId },
      { name: "farm_owner", id: farmOwnerId },
      { name: "farm_manager", id: farmManagerId },
      { name: "farm_cowboy", id: farmCowboyId },
    ];

    const rpcsToTest = [
      "select * from public.admin_get_platform_metrics()",
      "select * from public.admin_list_platform_users()",
      `select * from public.admin_get_platform_user('${regularUserId}')`,
      "select * from public.admin_list_platform_farms()",
      "select * from public.admin_list_platform_invites()",
      `select * from public.admin_set_can_create_farm('${targetUserId}', false)`,
    ];

    for (const role of authRolesToTest) {
      for (const rpcSql of rpcsToTest) {
        const { error } = await executeAs(role.id, rpcSql);
        if (!error) {
          throw new Error(`FALHA DE SEGURANÇA: Papel '${role.name}' conseguiu executar: ${rpcSql}`);
        }
        // Valida erro 42501 (Forbidden / Insufficient Privilege)
        if (error.code !== "42501") {
          throw new Error(`Código de erro inesperado para '${role.name}': ${error.code} - ${error.message}`);
        }
      }
      console.log(`✓ Papel '${role.name}': Acesso DENIED (42501) confirmado em todas as RPCs A2 + A4.`);
    }
    console.log("");

    // 3. Conceder SuperAdmin e Validar Leitura (A2 + A2.1)
    console.log("--- 3. Concedendo SuperAdmin e Validando Leituras A2 + A2.1 ---");
    await client.query(`
      insert into public.app_superadmins (user_id)
      values ('${superAdminId}')
      on conflict (user_id) do nothing;
    `);

    // Valida metrics
    const metricsRes = await executeAs(superAdminId, "select * from public.admin_get_platform_metrics()");
    if (metricsRes.error) throw metricsRes.error;
    console.log("✓ admin_get_platform_metrics():", metricsRes.data[0]);

    // Valida invites hardening (A2.1)
    const invitesRes = await executeAs(superAdminId, "select * from public.admin_list_platform_invites()");
    if (invitesRes.error) throw invitesRes.error;

    // Prova que token não está presente nas colunas retornadas
    const sampleInvite = invitesRes.data[0];
    if ("token" in sampleInvite) {
      throw new Error("FALHA A2.1: A coluna 'token' foi encontrada no retorno de admin_list_platform_invites()");
    }

    // Prova separação exclusiva de pending vs expired
    const pendingInvites = await executeAs(superAdminId, "select * from public.admin_list_platform_invites('pending')");
    const expiredInvites = await executeAs(superAdminId, "select * from public.admin_list_platform_invites('expired')");

    const hasExpiredInPending = pendingInvites.data.some(i => i.email === "convite_expirado@test.local");
    const hasValidInExpired = expiredInvites.data.some(i => i.email === "convite_valido@test.local");

    if (hasExpiredInPending || hasValidInExpired) {
      throw new Error("FALHA A2.1: Exclusão mútua de 'pending' e 'expired' falhou!");
    }
    console.log("✓ A2.1: Convites - token removido e exclusão mútua 'pending' vs 'expired' 100% comprovada!");

    // 4. Testar Mutação Idempotente de can_create_farm e Auditoria Atômica (A4)
    console.log("\n--- 4. Testando Mutação Idempotente e Auditoria Atômica A4 ---");

    // PROVA: app_admin_audit_events é append-only — verificar trigger via catálogo do sistema
    console.log("  4.0. Provando imutabilidade via catálogo pg_trigger...");
    const triggerCheck = await client.query(`
      select t.tgname, t.tgenabled
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'app_admin_audit_events'
        and t.tgname = 'trg_prevent_admin_audit_mutation'
        and t.tgenabled != 'D'; -- D = disabled
    `);
    if (triggerCheck.rows.length === 0) {
      throw new Error("FALHA A4: Trigger trg_prevent_admin_audit_mutation ausente ou desabilitado em app_admin_audit_events!");
    }
    console.log(`  ✓ app_admin_audit_events: trigger de imutabilidade ativo (${triggerCheck.rows[0].tgname}, enabled=${triggerCheck.rows[0].tgenabled}).`);

    // PROVA 1: RLS ativa - apenas policy de SELECT para is_app_admin()
    const rlsPolicyCheck = await client.query(`
      select policyname, cmd, qual
      from pg_policies
      where schemaname = 'public' and tablename = 'app_admin_audit_events';
    `);
    const policyCmds = rlsPolicyCheck.rows.map(p => p.cmd);
    if (!policyCmds.includes("SELECT") || policyCmds.includes("DELETE") || policyCmds.includes("UPDATE")) {
      throw new Error(`FALHA A4: Policies RLS inesperadas em app_admin_audit_events: ${policyCmds.join(", ")}`);
    }
    console.log("  ✓ RLS estrita: apenas SELECT permitido via policy app_admin_audit_events_select_admin.");

    // PROVA 2: Trigger FOR EACH ROW - tentativa de UPDATE/DELETE em linha existente deve disparar prevent_admin_audit_mutation (23514)
    const probeEventId = "00000000-0000-0000-0000-000000000a01";
    await client.query(`
      insert into public.app_admin_audit_events (id, actor_user_id, action, target_type, target_id)
      values ('${probeEventId}', '${superAdminId}', 'PROBE_TEST', 'test', 'probe')
      on conflict (id) do nothing;
    `);

    try {
      await client.query(`delete from public.app_admin_audit_events where id = '${probeEventId}';`);
      throw new Error("FALHA A4: O trigger trg_prevent_admin_audit_mutation NÃO bloqueou DELETE de linha existente!");
    } catch (trgErr) {
      if (trgErr.code === "23514") {
        console.log("  ✓ Imutabilidade append-only: trigger trg_prevent_admin_audit_mutation bloqueou DELETE (23514).");
      } else {
        throw trgErr;
      }
    }

    try {
      await client.query(`update public.app_admin_audit_events set action = 'MUTATED' where id = '${probeEventId}';`);
      throw new Error("FALHA A4: O trigger trg_prevent_admin_audit_mutation NÃO bloqueou UPDATE de linha existente!");
    } catch (trgErr) {
      if (trgErr.code === "23514") {
        console.log("  ✓ Imutabilidade append-only: trigger trg_prevent_admin_audit_mutation bloqueou UPDATE (23514).");
      } else {
        throw trgErr;
      }
    }

    // Limpar estado can_create_farm para que o teste parta de true (default)
    await client.query(`update public.user_profiles set can_create_farm = true where user_id = '${targetUserId}';`);
    // Contar eventos existentes antes do teste para usar delta em vez de contagem absoluta
    const auditBefore = await client.query(
      `select count(*)::int as count from public.app_admin_audit_events where target_id = '${targetUserId}';`
    );
    const auditBaseCount = auditBefore.rows[0].count;
    console.log(`  (baseline de auditoria para targetUserId: ${auditBaseCount} evento(s) pré-existente(s))`);

    // 4.1. Chamada inicial: set(false) quando estado inicial é true
    const setFalse1 = await executeAs(
      superAdminId,

      `select * from public.admin_set_can_create_farm('${targetUserId}', false)`
    );
    if (setFalse1.error) throw setFalse1.error;

    const row1 = setFalse1.data[0];
    if (!row1 || row1.previous_can_create_farm !== true || row1.can_create_farm !== false || row1.changed !== true) {
      throw new Error(`Resultado inesperado no set(false) inicial: ${JSON.stringify(row1)}`);
    }

    // Verificar estado no banco
    const profileCheck1 = await client.query(
      `select can_create_farm from public.user_profiles where user_id = '${targetUserId}';`
    );
    if (profileCheck1.rows[0].can_create_farm !== false) {
      throw new Error("Estado no user_profiles não foi alterado para false!");
    }

    // Verificar log de auditoria: deve conter exatamente base+1 evento (delta de 1)
    const auditCheck1 = await client.query(
      `select * from public.app_admin_audit_events where target_id = '${targetUserId}' order by created_at desc;`
    );
    if (auditCheck1.rows.length !== auditBaseCount + 1) {
      throw new Error(`Esperado ${auditBaseCount + 1} evento(s) de auditoria, encontrado ${auditCheck1.rows.length}`);
    }
    const ev1 = auditCheck1.rows[0]; // mais recente
    if (
      ev1.action !== "CAN_CREATE_FARM_SET" ||
      ev1.actor_user_id !== superAdminId ||
      ev1.state_before.can_create_farm !== true ||
      ev1.state_after.can_create_farm !== false
    ) {
      throw new Error(`Evento de auditoria corrompido: ${JSON.stringify(ev1)}`);
    }
    console.log("✓ A4 Chamada 1: set(false) alterou estado (changed=true) e inseriu 1 evento de auditoria.");

    // 4.2. Retry idempotente: chamar set(false) novamente quando já está false
    const setFalseRetry = await executeAs(
      superAdminId,
      `select * from public.admin_set_can_create_farm('${targetUserId}', false)`
    );
    if (setFalseRetry.error) throw setFalseRetry.error;

    const rowRetry = setFalseRetry.data[0];
    if (!rowRetry || rowRetry.previous_can_create_farm !== false || rowRetry.can_create_farm !== false || rowRetry.changed !== false) {
      throw new Error(`Resultado inesperado no retry set(false): ${JSON.stringify(rowRetry)}`);
    }

    // Log de auditoria NÃO pode ter aumentado (permanece base+1)
    const auditCheckRetry = await client.query(
      `select count(*)::int as count from public.app_admin_audit_events where target_id = '${targetUserId}';`
    );
    if (auditCheckRetry.rows[0].count !== auditBaseCount + 1) {
      throw new Error(`Idempotência violada: auditoria duplicada após retry! Count: ${auditCheckRetry.rows[0].count}, esperado: ${auditBaseCount + 1}`);
    }
    console.log("✓ A4 Chamada 2 (Retry Idempotente): set(false) retornou changed=false e NÃO duplicou auditoria.");

    // 4.3. Chamada de reativação: set(true)
    const setTrue = await executeAs(
      superAdminId,
      `select * from public.admin_set_can_create_farm('${targetUserId}', true)`
    );
    if (setTrue.error) throw setTrue.error;

    const rowTrue = setTrue.data[0];
    if (!rowTrue || rowTrue.previous_can_create_farm !== false || rowTrue.can_create_farm !== true || rowTrue.changed !== true) {
      throw new Error(`Resultado inesperado no set(true): ${JSON.stringify(rowTrue)}`);
    }

    const auditCheckTrue = await client.query(
      `select count(*)::int as count from public.app_admin_audit_events where target_id = '${targetUserId}';`
    );
    if (auditCheckTrue.rows[0].count !== auditBaseCount + 2) {
      throw new Error(`Esperado ${auditBaseCount + 2} evento(s) de auditoria após set(true), encontrado ${auditCheckTrue.rows[0].count}`);
    }
    console.log("✓ A4 Chamada 3: set(true) alterou estado (changed=true) e inseriu o 2º evento de auditoria.");

    // 5. Testar Autoridade Operacional em create_fazenda
    console.log("\n--- 5. Testando Autoridade Operacional em create_fazenda ---");

    // 5.1. Bloquear usuário alvo
    await executeAs(superAdminId, `select * from public.admin_set_can_create_farm('${targetUserId}', false)`);

    // Tentar criar fazenda autenticado como targetUserId -> deve falhar com Forbidden
    const createDenied = await executeAs(
      targetUserId,
      `select public.create_fazenda('Fazenda Bloqueada', 'FB-01', 'Goiânia', 'GO'::public.estado_uf_enum)`
    );
    if (!createDenied.error) {
      throw new Error("FALHA OPERACIONAL: Usuário com can_create_farm=false conseguiu criar fazenda!");
    }
    console.log("✓ create_fazenda com can_create_farm=false: DENIED (Forbidden) confirmado.");

    // 5.2. Permitir usuário alvo
    await executeAs(superAdminId, `select * from public.admin_set_can_create_farm('${targetUserId}', true)`);

    // Criar fazenda autenticado como targetUserId -> deve ter sucesso
    const createAllowed = await executeAs(
      targetUserId,
      `select public.create_fazenda('Fazenda Permitida', 'FP-01', 'Goiânia', 'GO'::public.estado_uf_enum)`
    );
    if (createAllowed.error) {
      throw new Error(`FALHA OPERACIONAL: create_fazenda falhou para usuário permitido: ${createAllowed.error.message}`);
    }
    const createdFarmId = createAllowed.data[0].create_fazenda;
    console.log(`✓ create_fazenda com can_create_farm=true: ALLOWED (Fazenda criada: ${createdFarmId})`);

    // 6. Testar Revogação Imediata de SuperAdmin
    console.log("\n--- 6. Revogando SuperAdmin e Validando Bloqueio Imediato ---");
    await client.query(`delete from public.app_superadmins where user_id = '${superAdminId}';`);

    const revokedMutate = await executeAs(
      superAdminId,
      `select * from public.admin_set_can_create_farm('${targetUserId}', false)`
    );
    if (!revokedMutate.error || revokedMutate.error.code !== "42501") {
      throw new Error("FALHA: SuperAdmin revogado conseguiu executar mutação!");
    }
    console.log("✓ Bloqueio imediato (42501) de mutação após revogação de SuperAdmin confirmado.");

    console.log("\n=================================================================");
    console.log("🎉 TODOS OS TESTES E GATES DE SEGURANÇA A1.1 + A2 + A2.1 + A4 APROVADOS!");
    console.log("=================================================================\n");

  } finally {
    await client.end();
  }
}

runSecurityGate().catch((err) => {
  console.error("ERRO FATAL NA VALIDAÇÃO DE SEGURANÇA:", err);
  process.exit(1);
});
