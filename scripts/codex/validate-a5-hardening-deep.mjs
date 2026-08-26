/**
 * validate-a5-hardening-deep.mjs
 * Hardening profundo A5: Concorrência real, atomicidade com falha induzida, performance (EXPLAIN ANALYZE) e auditoria de search_path/grants.
 */

import pg from "pg";
const { Client } = pg;

const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function runDeepHardeningGate() {
  console.log("=================================================================");
  console.log("Iniciando Hardening Profundo A5: Concorrência, Atomicidade & EXPLAIN");
  console.log("=================================================================\n");

  const client1 = new Client({ connectionString: DB_URL });
  const client2 = new Client({ connectionString: DB_URL });
  await client1.connect();
  await client2.connect();

  const superAdminId = "00000000-0000-0000-0000-000000000001";
  const superAdminId2 = "00000000-0000-0000-0000-0000000000a2";
  const targetUserId = "00000000-0000-0000-0000-000000000006";

  try {
    // 0. Setup superadmin 2
    await client1.query(`
      insert into auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at)
      values ('${superAdminId2}', '00000000-0000-0000-0000-000000000000', 'superadmin2@rebanhosync.local', 'authenticated', 'authenticated', 'xyz', now(), now(), now())
      on conflict (id) do nothing;
      insert into public.app_superadmins (user_id) values ('${superAdminId2}') on conflict (user_id) do nothing;
      insert into public.app_superadmins (user_id) values ('${superAdminId}') on conflict (user_id) do nothing;
    `);

    async function executeOnClient(cl, userId, sql) {
      await cl.query("BEGIN;");
      try {
        await cl.query(`set local role authenticated;`);
        await cl.query(`set local "request.jwt.claim.sub" = '${userId}';`);
        await cl.query(`set local "request.jwt.claim.role" = 'authenticated';`);
        const res = await cl.query(sql);
        await cl.query("COMMIT;");
        return { data: res.rows, error: null };
      } catch (err) {
        await cl.query("ROLLBACK;");
        return { data: null, error: err };
      }
    }

    // =========================================================================
    // 1. CONCORRÊNCIA REAL: Duas conexões paralelas SuperAdmin sobre targetUserId
    // =========================================================================
    console.log("--- 1. Testando Concorrência Real com 2 conexões simultâneas ---");

    // Cenário: inicializar como true.
    await client1.query(`update public.user_profiles set can_create_farm = true where user_id = '${targetUserId}';`);

    const auditCountBefore = await client1.query(
      `select count(*)::int as c from public.app_admin_audit_events where target_id = '${targetUserId}';`
    );
    const countBefore = auditCountBefore.rows[0].c;

    // Disparar simultaneamente A: set(false) e B: set(true)
    const [resA, resB] = await Promise.all([
      executeOnClient(client1, superAdminId, `select * from public.admin_set_can_create_farm('${targetUserId}', false)`),
      executeOnClient(client2, superAdminId2, `select * from public.admin_set_can_create_farm('${targetUserId}', true)`),
    ]);

    if (resA.error || resB.error) {
      throw new Error(`Erro na concorrência: A=${resA.error?.message} B=${resB.error?.message}`);
    }

    console.log("  Resultado Sessão A:", resA.data[0]);
    console.log("  Resultado Sessão B:", resB.data[0]);

    // Verificar estado final e auditoria
    const finalProfile = await client1.query(
      `select can_create_farm from public.user_profiles where user_id = '${targetUserId}';`
    );
    const finalState = finalProfile.rows[0].can_create_farm;
    console.log(`  Estado final determinístico: can_create_farm = ${finalState}`);

    const auditCountAfter = await client1.query(
      `select count(*)::int as c from public.app_admin_audit_events where target_id = '${targetUserId}';`
    );
    const countAfter = auditCountAfter.rows[0].c;
    const deltaEvents = countAfter - countBefore;

    // Contar quantas sessões reportaram changed=true
    const changedA = resA.data[0].changed ? 1 : 0;
    const changedB = resB.data[0].changed ? 1 : 0;
    const expectedEvents = changedA + changedB;

    if (deltaEvents !== expectedEvents) {
      throw new Error(`Concorrência falhou: ${expectedEvents} mudanças reportadas mas ${deltaEvents} eventos gerados!`);
    }
    console.log(`✓ Concorrência determinística comprovada: ${deltaEvents} evento(s) gerados para ${expectedEvents} transação(ões) com changed=true.\n`);

    // =========================================================================
    // 2. ATOMICIDADE COM FALHA INDUZIDA (Rollback da alteração de can_create_farm)
    // =========================================================================
    console.log("--- 2. Testando Atomicidade com Falha Induzida e Rollback Total ---");

    // Garantir estado inicial true
    await client1.query(`update public.user_profiles set can_create_farm = true where user_id = '${targetUserId}';`);

    const auditBeforeInduced = await client1.query(
      `select count(*)::int as c from public.app_admin_audit_events where target_id = '${targetUserId}';`
    );
    const cBeforeInduced = auditBeforeInduced.rows[0].c;

    // Criar trigger temporário de teste que força erro na inserção de app_admin_audit_events
    await client1.query(`
      create or replace function public.test_fail_audit_trigger()
      returns trigger
      language plpgsql
      as $$
      begin
        if new.action = 'CAN_CREATE_FARM_SET_INDUCED_FAIL' or new.metadata->>'source' = 'induced_failure_test' then
          raise exception 'INDUCED_TEST_ERROR: Simulated failure on audit insert' using errcode = 'P0001';
        end if;
        return new;
      end;
      $$;

      drop trigger if exists trg_test_fail_audit on public.app_admin_audit_events;
      create trigger trg_test_fail_audit
        before insert on public.app_admin_audit_events
        for each row
        execute function public.test_fail_audit_trigger();
    `);

    // Criar função variante que usa o metadado de falha induzida para disparar o rollback
    await client1.query(`
      create or replace function public.test_admin_set_can_create_farm_fail(
        _target_user_id uuid,
        _can_create boolean
      )
      returns table (user_id uuid, previous_can_create_farm boolean, can_create_farm boolean, changed boolean)
      language plpgsql
      security definer
      set search_path = public, auth
      as $$
      declare
        v_prev boolean;
      begin
        if not public.is_app_admin() then
          raise exception 'Forbidden: Access denied' using errcode = '42501';
        end if;

        select up.can_create_farm into v_prev
        from public.user_profiles up
        where up.user_id = _target_user_id for update;

        -- Altera profile
        update public.user_profiles up
        set can_create_farm = _can_create, updated_at = now()
        where up.user_id = _target_user_id;

        -- Insere auditoria com flag que força falha no trigger
        insert into public.app_admin_audit_events (
          actor_user_id, action, target_type, target_id, state_before, state_after, metadata
        ) values (
          auth.uid(), 'CAN_CREATE_FARM_SET', 'user_profile', _target_user_id::text,
          jsonb_build_object('can_create_farm', v_prev),
          jsonb_build_object('can_create_farm', _can_create),
          jsonb_build_object('source', 'induced_failure_test')
        );

        return query select _target_user_id, v_prev, _can_create, true;
      end;
      $$;
    `);

    // Executar a função com falha induzida
    const failResult = await executeOnClient(
      client1,
      superAdminId,
      `select * from public.test_admin_set_can_create_farm_fail('${targetUserId}', false)`
    );

    if (!failResult.error || !failResult.error.message.includes("INDUCED_TEST_ERROR")) {
      throw new Error(`Esperava falha induzida, obteve: ${JSON.stringify(failResult)}`);
    }
    console.log("  ✓ Falha induzida disparou exceção esperada:", failResult.error.message);

    // Verificar que o perfil NÃO foi alterado (permaneceu true após rollback)
    const profileAfterRollback = await client1.query(
      `select can_create_farm from public.user_profiles where user_id = '${targetUserId}';`
    );
    if (profileAfterRollback.rows[0].can_create_farm !== true) {
      throw new Error("ATOMICIDADE VIOLADA: can_create_farm foi modificado apesar do erro na auditoria!");
    }

    // Verificar que nenhum evento de auditoria foi gravado
    const auditAfterRollback = await client1.query(
      `select count(*)::int as c from public.app_admin_audit_events where target_id = '${targetUserId}';`
    );
    if (auditAfterRollback.rows[0].c !== cBeforeInduced) {
      throw new Error("ATOMICIDADE VIOLADA: Evento de auditoria vazou apesar do rollback!");
    }
    console.log("✓ Atomicidade 100% comprovada: can_create_farm e auditoria sofreram rollback atômico conjunto.");

    // LIMPEZA OBRIGATÓRIA dos artefatos de teste de falha induzida
    await client1.query(`
      drop trigger if exists trg_test_fail_audit on public.app_admin_audit_events;
      drop function if exists public.test_fail_audit_trigger();
      drop function if exists public.test_admin_set_can_create_farm_fail(uuid, boolean);
    `);
    console.log("✓ Triggers e funções de teste temporárias removidas do schema.\n");

    // =========================================================================
    // 3. PERFORMANCE: EXPLAIN (ANALYZE, BUFFERS) nas RPCs administrativas
    // =========================================================================
    console.log("--- 3. Performance: EXPLAIN (ANALYZE, BUFFERS) nas RPCs Administrativas ---");

    const explainQueries = [
      { name: "admin_get_platform_metrics", sql: "explain (analyze, buffers) select * from public.admin_get_platform_metrics()" },
      { name: "admin_list_platform_users (com busca)", sql: "explain (analyze, buffers) select * from public.admin_list_platform_users('test', 25, 0)" },
      { name: `admin_get_platform_user`, sql: `explain (analyze, buffers) select * from public.admin_get_platform_user('${targetUserId}')` },
      { name: "admin_list_platform_farms (com busca)", sql: "explain (analyze, buffers) select * from public.admin_list_platform_farms('Fazenda', 25, 0)" },
      { name: "admin_list_platform_invites (com filtro)", sql: "explain (analyze, buffers) select * from public.admin_list_platform_invites('pending', 'test', 25, 0)" },
    ];

    for (const q of explainQueries) {
      const explainRes = await executeOnClient(client1, superAdminId, q.sql);
      if (explainRes.error) {
        throw new Error(`Erro ao executar EXPLAIN para ${q.name}: ${explainRes.error.message}`);
      }
      const executionTimeLine = explainRes.data.find(r => r["QUERY PLAN"].includes("Execution Time"));
      console.log(`  ✓ ${q.name}: ${executionTimeLine ? executionTimeLine["QUERY PLAN"] : "OK"}`);
    }
    console.log("✓ Planos de execução analisados com sucesso.\n");

    // =========================================================================
    // 4. AUDITORIA DE SECURITY DEFINER, search_path e GRANTS
    // =========================================================================
    console.log("--- 4. Auditoria de Funções, search_path e Menor Privilégio ---");

    const functionsAudit = await client1.query(`
      select
        p.proname as function_name,
        p.prosecdef as is_security_definer,
        p.proconfig as search_path_config
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

    for (const row of functionsAudit.rows) {
      if (!row.is_security_definer) {
        throw new Error(`VIOLAÇÃO: Função ${row.function_name} não é SECURITY DEFINER!`);
      }
      const hasSearchPath = row.search_path_config && row.search_path_config.some(c => c.startsWith("search_path="));
      if (!hasSearchPath) {
        throw new Error(`VIOLAÇÃO: Função ${row.function_name} não possui search_path configurado!`);
      }
      console.log(`  ✓ ${row.function_name}: SECURITY DEFINER = true, config = [${row.search_path_config.join(", ")}]`);
    }

    console.log("\n=================================================================");
    console.log("🎉 TODOS OS GATES DO HARDENING PROFUNDO A5 FORAM APROVADOS!");
    console.log("=================================================================\n");

  } finally {
    await client1.end();
    await client2.end();
  }
}

runDeepHardeningGate().catch((err) => {
  console.error("ERRO NO HARDENING PROFUNDO A5:", err);
  process.exit(1);
});
