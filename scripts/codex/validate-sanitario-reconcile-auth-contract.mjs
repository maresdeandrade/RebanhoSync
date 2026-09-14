import pg from 'pg'

const { Client } = pg
const DB_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const USER_MEMBER = '00000000-0000-0000-0000-00000000a1a1'
const USER_OUTSIDER = '00000000-0000-0000-0000-00000000b1b1'
const FARM_MEMBER = '00000000-0000-0000-0000-00000000f1a1'
const FARM_OUTSIDE = '00000000-0000-0000-0000-00000000f1b1'
const FARM_MISSING = '00000000-0000-0000-0000-00000000ffff'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function resetRole(client) {
  await client.query('RESET ROLE')
  await client.query(`SET LOCAL "request.jwt.claim.sub" = ''`)
}

async function expectDatabaseError(client, label, expectedCode, callback) {
  await client.query('SAVEPOINT expected_error')
  try {
    await callback()
    throw new Error(`${label}: operação deveria ter sido negada`)
  } catch (error) {
    if (error.code !== expectedCode) {
      throw new Error(
        `${label}: esperado SQLSTATE ${expectedCode}, recebido ${error.code}: ${error.message}`,
      )
    }
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT expected_error')
  }
}

async function main() {
  const client = new Client({ connectionString: DB_URL })
  await client.connect()

  try {
    await client.query('BEGIN')
    await client.query(`
      insert into auth.users (
        id, instance_id, email, aud, role, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data
      ) values
        ('${USER_MEMBER}', '00000000-0000-0000-0000-000000000000',
         'reconcile-member@rebanhosync.local', 'authenticated', 'authenticated',
         'test', now(), now(), now(),
         '{"provider":"email","providers":["email"]}', '{}'),
        ('${USER_OUTSIDER}', '00000000-0000-0000-0000-000000000000',
         'reconcile-outsider@rebanhosync.local', 'authenticated', 'authenticated',
         'test', now(), now(), now(),
         '{"provider":"email","providers":["email"]}', '{}');

      insert into public.user_profiles (user_id, display_name)
      values
        ('${USER_MEMBER}', 'Reconcile Member'),
        ('${USER_OUTSIDER}', 'Reconcile Outsider');

      insert into public.fazendas (id, nome, codigo, created_by)
      values
        ('${FARM_MEMBER}', 'Reconcile Farm A', 'REC-A', '${USER_MEMBER}'),
        ('${FARM_OUTSIDE}', 'Reconcile Farm B', 'REC-B', '${USER_OUTSIDER}');

      insert into public.user_fazendas (fazenda_id, user_id, role, accepted_at)
      values
        ('${FARM_MEMBER}', '${USER_MEMBER}', 'owner', now()),
        ('${FARM_OUTSIDE}', '${USER_OUTSIDER}', 'owner', now());
    `)

    const before = await client.query(`
      select
        (select count(*) from public.agenda_itens) as legacy_agenda,
        (select count(*) from public.sanitario_agenda_v2) as agenda_v2
    `)

    await client.query('SET LOCAL ROLE service_role')
    const serviceFirst = await client.query(
      `select public.internal_sanitario_recompute_agenda_for_fazenda($1, current_date) value`,
      [FARM_MEMBER],
    )
    const serviceReplay = await client.query(
      `select public.internal_sanitario_recompute_agenda_for_fazenda($1, current_date) value`,
      [FARM_MEMBER],
    )
    assert(serviceFirst.rows[0].value === 0, 'service_role: retorno inicial inválido')
    assert(serviceReplay.rows[0].value === 0, 'service_role: replay inválido')

    await expectDatabaseError(client, 'fazenda inexistente', 'P0002', () =>
      client.query(
        `select public.internal_sanitario_recompute_agenda_for_fazenda($1, current_date)`,
        [FARM_MISSING],
      ),
    )
    await expectDatabaseError(client, 'core interno via service_role', '42501', () =>
      client.query(
        `select public.internal_sanitario_recompute_agenda_core($1, null, current_date)`,
        [FARM_MEMBER],
      ),
    )
    await resetRole(client)

    await client.query('SET LOCAL ROLE authenticated')
    await client.query(
      `SET LOCAL "request.jwt.claim.sub" = '${USER_MEMBER}'`,
    )
    const member = await client.query(
      `select public.sanitario_recompute_agenda_for_fazenda($1, current_date) value`,
      [FARM_MEMBER],
    )
    assert(member.rows[0].value === 0, 'membro autenticado: retorno inválido')

    await expectDatabaseError(client, 'cross-farm', 'P0001', () =>
      client.query(
        `select public.sanitario_recompute_agenda_for_fazenda($1, current_date)`,
        [FARM_OUTSIDE],
      ),
    )
    await expectDatabaseError(client, 'core direto via authenticated', '42501', () =>
      client.query(
        `select public.sanitario_recompute_agenda_core($1, null, current_date)`,
        [FARM_MEMBER],
      ),
    )
    await expectDatabaseError(client, 'core interno via authenticated', '42501', () =>
      client.query(
        `select public.internal_sanitario_recompute_agenda_core($1, null, current_date)`,
        [FARM_MEMBER],
      ),
    )
    await resetRole(client)

    await client.query('SET LOCAL ROLE anon')
    await expectDatabaseError(client, 'wrapper user-facing via anon', '42501', () =>
      client.query(
        `select public.sanitario_recompute_agenda_for_fazenda($1, current_date)`,
        [FARM_MEMBER],
      ),
    )
    await expectDatabaseError(client, 'wrapper server-only via anon', '42501', () =>
      client.query(
        `select public.internal_sanitario_recompute_agenda_for_fazenda($1, current_date)`,
        [FARM_MEMBER],
      ),
    )
    await expectDatabaseError(client, 'core interno via anon', '42501', () =>
      client.query(
        `select public.internal_sanitario_recompute_agenda_core($1, null, current_date)`,
        [FARM_MEMBER],
      ),
    )
    await resetRole(client)

    const publicAcl = await client.query(`
      select
        has_function_privilege(
          'public',
          'public.internal_sanitario_recompute_agenda_core(uuid,uuid,date)',
          'EXECUTE'
        ) as internal_core,
        has_function_privilege(
          'public',
          'public.internal_sanitario_recompute_agenda_for_fazenda(uuid,date)',
          'EXECUTE'
        ) as backend_wrapper
    `)
    assert(!publicAcl.rows[0].internal_core, 'PUBLIC executa o core interno')
    assert(!publicAcl.rows[0].backend_wrapper, 'PUBLIC executa o wrapper backend')

    const after = await client.query(`
      select
        (select count(*) from public.agenda_itens) as legacy_agenda,
        (select count(*) from public.sanitario_agenda_v2) as agenda_v2
    `)
    assert(
      JSON.stringify(before.rows[0]) === JSON.stringify(after.rows[0]),
      'reexecução alterou a agenda apesar do core no-op',
    )

    console.log('SERVICE_ROLE_RECOMPUTE=PASS')
    console.log('AUTHENTICATED_MEMBER_RECOMPUTE=PASS')
    console.log('CROSS_FARM_RECOMPUTE=DENIED')
    console.log('ANON_RECOMPUTE=DENIED')
    console.log('INTERNAL_CORE_DIRECT_EXECUTE=DENIED')
    console.log('INVALID_FARM=DENIED_WITHOUT_SIDE_EFFECT')
    console.log('RECOMPUTE_IDEMPOTENCE=PASS')
  } finally {
    await client.query('ROLLBACK').catch(() => undefined)
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
