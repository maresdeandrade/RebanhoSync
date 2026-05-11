import { execFileSync } from "node:child_process";
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
      FUNCTIONS_URL: process.env.API_URL + "/functions/v1",
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

  if (error) {
    throw new Error(`falha ao logar user ${user.email}: ${error.message}`);
  }

  return data.session.access_token;
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

async function main() {
  const runId = randomUUID().slice(0, 8);
  console.log(`🚀 Iniciando teste de contrato RPC duplicidade (run ${runId})`);

  const env = readSupabaseStatusEnv();
  const adminClient = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    db: { url: env.DB_URL },
  });
  const anonClient = createClient(env.API_URL, env.ANON_KEY, {
    db: { url: env.DB_URL },
  });

  const dbClient = new Client({ connectionString: env.DB_URL });
  await dbClient.connect();

  try {
    // Criar usuário de teste
    const user = await createAuthUser(adminClient, runId, "rpc-duplicidade-test");
    console.log(`✅ Usuário criado: ${user.email}`);

    // Logar usuário
    const token = await signInUser(anonClient, user);
    console.log(`✅ Usuário logado`);

    // Criar fazenda usando create_fazenda (que configura membership automaticamente)
    const fazendaId = await withAuthenticatedUser(dbClient, user.id, async () => {
      // Criar profile e settings primeiro
      await dbClient.query(`
        insert into public.user_profiles(user_id, display_name) values ($1, $2)
      `, [user.id, `Test User ${runId}`]);
      await dbClient.query(`
        insert into public.user_settings(user_id) values ($1)
      `, [user.id]);

      // Usar create_fazenda function
      const result = await dbClient.query(`
        select public.create_fazenda($1, $2, $3, 'GO'::public.estado_uf_enum, null, 120, 'corte'::public.tipo_producao_enum, 'pastagem'::public.sistema_manejo_enum) as id
      `, [`Fazenda Teste ${runId}`, `test-${runId}`, 'Test City']);
      return result.rows[0].id;
    });
    console.log(`✅ Fazenda criada: ${fazendaId}`);

    // Criar lote de teste primeiro
    const loteId = randomUUID();
    await withServiceRole(dbClient, async () => {
      await dbClient.query(`
        insert into public.lotes (id, fazenda_id, nome, client_id, client_op_id, client_recorded_at)
        values ($1, $2, $3, $4, $5, $6)
      `, [loteId, fazendaId, `Lote Teste ${runId}`, 'baseline-functional', randomUUID(), new Date().toISOString()]);
    });
    console.log(`✅ Lote criado: ${loteId}`);

    // Criar animal de teste (usar service role para bypass RLS)
    const animalId = randomUUID();
    await withServiceRole(dbClient, async () => {
      await dbClient.query(`
        insert into public.animais (
          id, fazenda_id, identificacao, sexo, lote_id, data_nascimento,
          client_id, client_op_id, client_recorded_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        animalId, fazendaId, `Animal Teste ${runId}`, 'F', loteId,
        new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 120 dias atrás
        'baseline-functional', randomUUID(), new Date().toISOString()
      ]);
    });
    console.log(`✅ Animal criado: ${animalId}`);

    // Criar item de agenda sanitário agendado (usar service role para bypass RLS)
    const agendaItemId = randomUUID();
    await withServiceRole(dbClient, async () => {
      await dbClient.query(`
        insert into public.agenda_itens (
          id, fazenda_id, dominio, tipo, status, data_prevista, animal_id,
          source_kind, payload, client_id, client_op_id, client_recorded_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        agendaItemId, fazendaId, 'sanitario', 'vacinacao', 'agendado',
        new Date().toISOString().split('T')[0], animalId,
        'manual', '{"produto": "Vacina Teste"}', 'baseline-functional', randomUUID(), new Date().toISOString()
      ]);
    });
    console.log(`✅ Item de agenda criado: ${agendaItemId} (status: agendado)`);

    // Verificar estado inicial
    const initialEvents = await dbClient.query(`
      select count(*) from public.eventos where source_task_id = $1 and fazenda_id = $2
    `, [agendaItemId, fazendaId]);
    assert(Number(initialEvents.rows[0].count) === 0, "Estado inicial: deve haver 0 eventos");
    console.log(`✅ Estado inicial: 0 eventos para agenda item`);

    // PRIMEIRA CHAMADA DA RPC
    console.log(`\n📞 Chamada 1 da RPC (client_op_id: uuid-1)`);
    const clientOpId1 = randomUUID();
    const result1 = await withAuthenticatedUser(dbClient, user.id, async () => {
      return await dbClient.query(`
        select public.sanitario_complete_agenda_with_event(
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) as evento_id
      `, [
        agendaItemId, // _agenda_item_id
        new Date().toISOString(), // _occurred_at
        'vacinacao', // _tipo
        'Vacina Teste', // _produto
        'Observacao teste 1', // _observacoes
        '{"origem": "teste"}', // _sanitario_payload
        'baseline-functional', // _client_id
        clientOpId1, // _client_op_id
        randomUUID(), // _client_tx_id
        new Date().toISOString() // _client_recorded_at
      ]);
    });
    const eventoId1 = result1.rows[0].evento_id;
    console.log(`✅ Chamada 1: evento criado ${eventoId1}`);

    // Verificar após primeira chamada
    const afterFirstEvents = await dbClient.query(`
      select count(*) from public.eventos where source_task_id = $1 and fazenda_id = $2
    `, [agendaItemId, fazendaId]);
    const afterFirstAgenda = await dbClient.query(`
      select status, source_evento_id from public.agenda_itens where id = $1 and fazenda_id = $2
    `, [agendaItemId, fazendaId]);
    assert(Number(afterFirstEvents.rows[0].count) === 1, "Após primeira chamada: deve haver 1 evento");
    assert(afterFirstAgenda.rows[0].status === 'concluido', "Após primeira chamada: agenda deve estar concluida");
    assert(afterFirstAgenda.rows[0].source_evento_id === eventoId1, "Após primeira chamada: agenda deve referenciar evento correto");
    console.log(`✅ Após chamada 1: 1 evento, agenda concluida referenciando ${eventoId1}`);

    // SEGUNDA CHAMADA DA RPC (mesmo agenda_item_id, novo client_op_id)
    console.log(`\n📞 Chamada 2 da RPC (mesmo agenda_item_id, client_op_id: uuid-2)`);
    const clientOpId2 = randomUUID();
    const result2 = await withAuthenticatedUser(dbClient, user.id, async () => {
      return await dbClient.query(`
        select public.sanitario_complete_agenda_with_event(
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        ) as evento_id
      `, [
        agendaItemId, // _agenda_item_id (MESMO!)
        new Date().toISOString(), // _occurred_at
        'vacinacao', // _tipo
        'Vacina Teste', // _produto
        'Observacao teste 2', // _observacoes
        '{"origem": "teste"}', // _sanitario_payload
        'baseline-functional', // _client_id
        clientOpId2, // _client_op_id (NOVO!)
        randomUUID(), // _client_tx_id
        new Date().toISOString() // _client_recorded_at
      ]);
    });
    const eventoId2 = result2.rows[0].evento_id;
    console.log(`✅ Chamada 2: evento criado ${eventoId2}`);

    // Verificar após segunda chamada
    const afterSecondEvents = await dbClient.query(`
      select count(*) from public.eventos where source_task_id = $1 and fazenda_id = $2
    `, [agendaItemId, fazendaId]);
    const afterSecondAgenda = await dbClient.query(`
      select status, source_evento_id from public.agenda_itens where id = $1 and fazenda_id = $2
    `, [agendaItemId, fazendaId]);
    const eventCount = Number(afterSecondEvents.rows[0].count);
    console.log(`✅ Após chamada 2: ${eventCount} eventos, agenda status=${afterSecondAgenda.rows[0].status}, source_evento_id=${afterSecondAgenda.rows[0].source_evento_id}`);

    // RESULTADO DO TESTE
    console.log(`\n🎯 RESULTADO DO TESTE DE CONTRATO:`);
    if (eventCount === 1) {
      console.log(`✅ IDEMPOTENTE: Segunda chamada retornou mesmo evento ou falhou`);
      console.log(`   - Evento único: ${eventoId1}`);
      console.log(`   - Agenda aponta para: ${afterSecondAgenda.rows[0].source_evento_id}`);
    } else if (eventCount === 2) {
      console.log(`❌ DUPLICIDADE CONFIRMADA: Segunda chamada criou novo evento`);
      console.log(`   - Evento 1: ${eventoId1}`);
      console.log(`   - Evento 2: ${eventoId2}`);
      console.log(`   - Agenda aponta para: ${afterSecondAgenda.rows[0].source_evento_id} (último)`);
      console.log(`   - Evento órfão: ${eventoId1 === afterSecondAgenda.rows[0].source_evento_id ? eventoId2 : eventoId1}`);
    } else {
      console.log(`⚠️  INESPERADO: ${eventCount} eventos`);
    }

    // Verificar se eventos são distintos
    if (eventoId1 !== eventoId2) {
      console.log(`✅ Eventos distintos: ${eventoId1} vs ${eventoId2}`);
    } else {
      console.log(`⚠️  Mesmo evento retornado: ${eventoId1}`);
    }

    console.log(`\n🏁 Teste concluído com sucesso`);

  } finally {
    await dbClient.end();
  }
}

main().catch((error) => {
  console.error(`❌ Erro no teste: ${error.message}`);
  process.exit(1);
});