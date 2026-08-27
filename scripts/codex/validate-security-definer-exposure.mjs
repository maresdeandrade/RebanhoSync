/**
 * validate-security-definer-exposure.mjs
 * Gate de segurança C0 + C1: Validação autoritativa de privilégios de execução,
 * exposição pela Data API e isolamento tenant de funções SECURITY DEFINER no Postgres local do Supabase.
 */

import pg from "pg";
const { Client } = pg;

const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function runSecurityDefinerGate() {
  console.log("=================================================================");
  console.log("Iniciando Validação de Segurança C0 + C1 (SECURITY DEFINER Exposure Gate)");
  console.log("=================================================================\n");

  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  try {
    // -------------------------------------------------------------
    // FASE 1: Verificação de Catálogo de todas as funções SECURITY DEFINER
    // -------------------------------------------------------------
    console.log("--- 1. Auditoria de Catálogo pg_proc (Schema public) ---");

    const catalogQuery = `
      SELECT 
        p.proname AS name,
        p.oid,
        pg_get_function_identity_arguments(p.oid) AS identity_arguments,
        pg_get_function_result(p.oid) AS result_type,
        p.prosecdef AS is_security_definer,
        p.proconfig AS config,
        has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute,
        has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
        has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef = true
      ORDER BY p.proname, identity_arguments;
    `;

    const { rows: functions } = await client.query(catalogQuery);
    console.log(`Total de funções SECURITY DEFINER encontradas: ${functions.length}`);

    if (functions.length !== 34) {
      throw new Error(`Esperado exatamente 34 funções SECURITY DEFINER em public, encontrado: ${functions.length}`);
    }

    // 1.1 Nenhum privilégio EXECUTE concedido a PUBLIC
    const leakingPublic = functions.filter(f => f.public_execute);
    if (leakingPublic.length > 0) {
      throw new Error(`Falha C1: ${leakingPublic.length} funções ainda expõem EXECUTE para PUBLIC:\n` +
        leakingPublic.map(f => `  - ${f.name}(${f.identity_arguments})`).join("\n")
      );
    }
    console.log("✓ 100% das funções SECURITY DEFINER têm EXECUTE revogado de PUBLIC (0 vazamentos).");

    // 1.2 Apenas as RPCs com anon intencional devem ter anon_execute = true
    const allowedAnonFunctions = new Set(["get_invite_preview", "reject_invite"]);
    const leakingAnon = functions.filter(f => f.anon_execute && !allowedAnonFunctions.has(f.name));
    if (leakingAnon.length > 0) {
      throw new Error(`Falha C1: Funções não autorizadas expõem EXECUTE para anon:\n` +
        leakingAnon.map(f => `  - ${f.name}(${f.identity_arguments})`).join("\n")
      );
    }
    const anonCount = functions.filter(f => f.anon_execute).length;
    if (anonCount !== 2) {
      throw new Error(`Esperado exatamente 2 funções com anon EXECUTE (get_invite_preview, reject_invite), encontrado: ${anonCount}`);
    }
    console.log("✓ Apenas as 2 funções públicas intencionais (get_invite_preview, reject_invite) são executáveis por 'anon'.");

    // 1.3 Funções de trigger, internas de serviço e legadas NÃO devem ter authenticated EXECUTE
    const forbiddenAuthenticated = new Set([
      "apply_insumo_movimentacao_saldo",
      "seed_default_finance_categories",
      "trg_sanitario_recompute_on_animal_mutation",
      "sanitario_reconcile_eligible_fazendas",
      "sanitario_reconcile_touch",
      "sanitario_recompute_agenda_core_without_dry_cow",
      "sanitario_recompute_dry_cow_therapy_agenda"
    ]);

    const leakingAuthenticated = functions.filter(f => f.authenticated_execute && forbiddenAuthenticated.has(f.name));
    if (leakingAuthenticated.length > 0) {
      throw new Error(`Falha C1: Funções internas/triggers ainda expõem EXECUTE para authenticated:\n` +
        leakingAuthenticated.map(f => `  - ${f.name}(${f.identity_arguments})`).join("\n")
      );
    }
    console.log("✓ Todas as funções de trigger (3), serviço interno (2) e legadas (2) têm EXECUTE revogado de 'authenticated'.");

    // 1.4 Verificação de search_path imutável em 100% das funções SECURITY DEFINER
    const mutableSearchPath = functions.filter(f => !f.config || !f.config.some(c => c.startsWith("search_path=")));
    if (mutableSearchPath.length > 0) {
      throw new Error(`Falha C1 (search_path mutável): ${mutableSearchPath.length} funções sem search_path fixo:\n` +
        mutableSearchPath.map(f => `  - ${f.name}(${f.identity_arguments})`).join("\n")
      );
    }
    console.log("✓ 100% das funções SECURITY DEFINER possuem search_path imutável fixado (C1_SEARCH_PATH_BLOCKER resolvido).\n");

    // -------------------------------------------------------------
    // FASE 2: Validação Funcional com Fixtures Reais
    // -------------------------------------------------------------
    console.log("--- 2. Validação Funcional de Negação e Execução de RPCs ---");

    // Criar fixtures de teste em transação isolada
    await client.query("BEGIN;");

    const userA = "00000000-0000-0000-0000-0000000000a1";
    const userB = "00000000-0000-0000-0000-0000000000b1";
    const userOutside = "00000000-0000-0000-0000-0000000000c1";
    const farmA = "00000000-0000-0000-0000-0000000000fa";
    const farmB = "00000000-0000-0000-0000-0000000000fb";

    // Inserir usuários no auth.users
    const users = [
      { id: userA, email: "usera@rebanhosync.local" },
      { id: userB, email: "userb@rebanhosync.local" },
      { id: userOutside, email: "outside@rebanhosync.local" },
    ];

    for (const u of users) {
      await client.query(`
        INSERT INTO auth.users (id, instance_id, email, aud, role, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
        VALUES ('${u.id}', '00000000-0000-0000-0000-000000000000', '${u.email}', 'authenticated', 'authenticated', 'xyz', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"${u.email}"}')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.user_profiles (user_id, display_name, can_create_farm)
        VALUES ('${u.id}', '${u.email}', true)
        ON CONFLICT (user_id) DO UPDATE SET can_create_farm = true;
      `);
    }

    // Inserir fazendas e memberships
    await client.query(`
      INSERT INTO public.fazendas (id, nome, codigo, created_by)
      VALUES 
        ('${farmA}', 'Fazenda Alpha', 'ALP-01', '${userA}'),
        ('${farmB}', 'Fazenda Beta', 'BET-01', '${userB}')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO public.user_fazendas (fazenda_id, user_id, role, accepted_at)
      VALUES 
        ('${farmA}', '${userA}', 'owner', now()),
        ('${farmA}', '${userB}', 'cowboy', now()),
        ('${farmB}', '${userB}', 'owner', now())
      ON CONFLICT (user_id, fazenda_id) DO UPDATE SET deleted_at = null, role = EXCLUDED.role;
    `);

    // Inserir convite de teste para preview
    const inviteToken = "00000000-0000-0000-0000-0000000000ee";
    const inviteId = "00000000-0000-0000-0000-0000000000ef";
    await client.query(`
      INSERT INTO public.farm_invites (id, fazenda_id, invited_by, token, email, role, status, expires_at)
      VALUES ('${inviteId}', '${farmA}', '${userA}', '${inviteToken}', 'novo@rebanhosync.local', 'cowboy', 'pending', now() + interval '7 days')
      ON CONFLICT (id) DO NOTHING;
    `);

    // 2.1 Teste como 'anon': Tentativas de RPC autenticada devem falhar com 42501 (Permission Denied)
    await client.query("SET LOCAL ROLE anon;");
    const testCasesAnon = [
      { name: "create_fazenda", sql: `SELECT public.create_fazenda('F', 'C', 'M', 'MT'::public.estado_uf_enum, '000', 10, 'corte'::public.tipo_producao_enum, 'pastagem'::public.sistema_manejo_enum);` },
      { name: "accept_invite", sql: `SELECT public.accept_invite('${inviteToken}');` },
      { name: "admin_remove_member", sql: `SELECT public.admin_remove_member('${farmA}', '${userB}');` },
      { name: "admin_set_member_role", sql: `SELECT public.admin_set_member_role('${farmA}', '${userB}', 'manager'::public.farm_role_enum);` },
      { name: "can_create_farm", sql: `SELECT public.can_create_farm();` },
      { name: "cancel_invite", sql: `SELECT public.cancel_invite('${inviteId}');` },
      { name: "create_invite", sql: `SELECT public.create_invite('${farmA}', 'teste@local.com', null, 'cowboy'::public.farm_role_enum);` },
      { name: "get_user_emails", sql: `SELECT * FROM public.get_user_emails(ARRAY['${userA}']::uuid[]);` },
      { name: "materialize_standard_sanitary_protocols", sql: `SELECT public.materialize_standard_sanitary_protocols('${farmA}');` },
      { name: "sanitario_recompute_agenda_core", sql: `SELECT public.sanitario_recompute_agenda_core('${farmA}', null, CURRENT_DATE);` },
      { name: "seed_default_finance_categories", sql: `SELECT public.seed_default_finance_categories();` },
      { name: "apply_insumo_movimentacao_saldo", sql: `SELECT public.apply_insumo_movimentacao_saldo();` },
      { name: "sanitario_reconcile_eligible_fazendas", sql: `SELECT * FROM public.sanitario_reconcile_eligible_fazendas(now());` },
    ];

    for (const tc of testCasesAnon) {
      await client.query("SAVEPOINT tc_sp;");
      try {
        await client.query(tc.sql);
        throw new Error(`Falha: anon conseguiu executar ${tc.name}!`);
      } catch (err) {
        if (err.code !== "42501") {
          throw new Error(`Esperado erro 42501 (permission denied) para ${tc.name} via anon, recebeu ${err.code}: ${err.message}`);
        }
      } finally {
        await client.query("ROLLBACK TO SAVEPOINT tc_sp;");
      }
    }
    console.log(`✓ Papel 'anon': Negação estrita (42501) confirmada em todas as ${testCasesAnon.length} RPCs testadas.`);

    // 2.2 Teste como 'anon': RPCs públicas intencionais devem ser permitidas
    const previewRes = await client.query(`SELECT * FROM public.get_invite_preview('${inviteToken}');`);
    if (previewRes.rows.length !== 1 || previewRes.rows[0].fazenda_nome !== "Fazenda Alpha") {
      throw new Error(`Falha no get_invite_preview via anon: dados incorretos ou não encontrados`);
    }
    console.log("✓ Papel 'anon': get_invite_preview executado com sucesso e contrato íntegro.");

    const rejectRes = await client.query(`SELECT public.reject_invite('${inviteToken}');`);
    console.log("✓ Papel 'anon': reject_invite executado com sucesso.");

    // 2.3 Teste como 'authenticated': Funções de trigger e internas bloqueadas diretamente
    await client.query("SET LOCAL ROLE authenticated;");
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userA}';`);

    const forbiddenCallsAuth = [
      { name: "apply_insumo_movimentacao_saldo", sql: `SELECT public.apply_insumo_movimentacao_saldo();` },
      { name: "seed_default_finance_categories", sql: `SELECT public.seed_default_finance_categories();` },
      { name: "trg_sanitario_recompute_on_animal_mutation", sql: `SELECT public.trg_sanitario_recompute_on_animal_mutation();` },
      { name: "sanitario_reconcile_eligible_fazendas", sql: `SELECT * FROM public.sanitario_reconcile_eligible_fazendas(now());` },
      { name: "sanitario_reconcile_touch", sql: `SELECT public.sanitario_reconcile_touch('${farmA}');` },
      { name: "sanitario_recompute_agenda_core_without_dry_cow", sql: `SELECT public.sanitario_recompute_agenda_core_without_dry_cow('${farmA}', null, CURRENT_DATE);` },
      { name: "sanitario_recompute_dry_cow_therapy_agenda", sql: `SELECT public.sanitario_recompute_dry_cow_therapy_agenda('${farmA}', null, CURRENT_DATE);` },
    ];

    for (const tc of forbiddenCallsAuth) {
      await client.query("SAVEPOINT auth_sp;");
      try {
        await client.query(tc.sql);
        throw new Error(`Falha: authenticated conseguiu chamar função interna/trigger ${tc.name}!`);
      } catch (err) {
        if (err.code !== "42501") {
          throw new Error(`Esperado 42501 para ${tc.name} via authenticated, recebeu ${err.code}: ${err.message}`);
        }
      } finally {
        await client.query("ROLLBACK TO SAVEPOINT auth_sp;");
      }
    }
    console.log("✓ Papel 'authenticated': Bloqueio direto (42501) confirmado sobre triggers, funções de serviço e legadas.");


    // 2.4 Teste de get_user_emails: Isolamento Tenant e Proteção contra Enumeração
    console.log("--- 3. Testando Isolamento Tenant em get_user_emails ---");

    // userA (Fazenda Alpha) consulta: self (userA), peer (userB), outsider (userOutside)
    const emailsQueryA = await client.query(`
      SELECT user_id, email FROM public.get_user_emails(ARRAY['${userA}', '${userB}', '${userOutside}']::uuid[]);
    `);

    const returnedIdsA = emailsQueryA.rows.map(r => r.user_id);
    if (!returnedIdsA.includes(userA)) throw new Error("get_user_emails não retornou o próprio usuário");
    if (!returnedIdsA.includes(userB)) throw new Error("get_user_emails não retornou o par (membro da mesma fazenda)");
    if (returnedIdsA.includes(userOutside)) throw new Error("VULNERABILIDADE: get_user_emails vazou e-mail de usuário fora da fazenda (cross-tenant)!");
    console.log("✓ userA consultou membros: retornou self e peer, bloqueou estritamente o outsider.");

    // userOutside (sem fazenda) consulta: self e userA
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userOutside}';`);
    const emailsQueryOutside = await client.query(`
      SELECT user_id, email FROM public.get_user_emails(ARRAY['${userOutside}', '${userA}', '${userB}']::uuid[]);
    `);
    const returnedIdsOutside = emailsQueryOutside.rows.map(r => r.user_id);
    if (returnedIdsOutside.length !== 1 || returnedIdsOutside[0] !== userOutside) {
      throw new Error(`get_user_emails permitiu outsider visualizar outros e-mails: ${JSON.stringify(returnedIdsOutside)}`);
    }
    console.log("✓ Usuário isolado (sem fazendas em comum) só consegue obter seu próprio e-mail.");

    // 2.5 Teste de Triggers operacionais sob usuário autenticado
    console.log("--- 4. Testando Execução Transparente de Triggers via DML ---");
    await client.query("RESET ROLE;");

    const triggerFarmId = "00000000-0000-0000-0000-0000000000f9";
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userA}';`);
    await client.query("SET LOCAL ROLE authenticated;");

    // Trigger de categorias financeiras via create_fazenda
    await client.query(`
      SELECT public.create_fazenda(
        'Fazenda Trigger Gate',
        'FTG-01',
        'Cuiaba',
        'MT'::public.estado_uf_enum,
        '78000-000',
        150.0,
        'corte'::public.tipo_producao_enum,
        'pastagem'::public.sistema_manejo_enum
      );
    `);

    await client.query("RESET ROLE;");
    const countCats = await client.query(`
      SELECT count(*) FROM public.finance_categories fc
      JOIN public.fazendas f ON f.id = fc.fazenda_id
      WHERE f.codigo = 'FTG-01';
    `);

    if (parseInt(countCats.rows[0].count, 10) !== 12) {
      throw new Error(`Trigger trg_seed_default_finance_categories falhou: ${countCats.rows[0].count} categorias`);
    }
    console.log("✓ Trigger trg_seed_default_finance_categories executado perfeitamente durante criação de fazenda.");

    // Rollback da transação de teste
    await client.query("ROLLBACK;");
    console.log("✓ Fixtures de teste revertidas limpas (ROLLBACK).");

    console.log("\n=================================================================");
    console.log("🎉 GATE DE SEGURANÇA C0 + C1 APROVADO COM SUCESSO!");
    console.log("=================================================================\n");

  } catch (err) {
    try { await client.query("ROLLBACK;"); } catch (_) {}
    console.error("\n❌ FALHA NO GATE DE SEGURANÇA C0 + C1:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSecurityDefinerGate();
