import pg from "pg";
const { Client } = pg;

const email = process.argv[2] || "maresdeandrade@gmail.com";
const password = process.argv[3] || "Admin123456!";
const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function createAndGrant() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  console.log(`Configurando usuário '${email}' com todas as tabelas e identidades do Supabase Auth...`);

  // Limpa registros anteriores incompletos se houver
  await client.query("delete from auth.users where email = $1", [email]);

  // 1. Inserir em auth.users
  const userRes = await client.query(`
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      $1,
      crypt($2, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"display_name":"SuperAdmin Dev"}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    )
    returning id;
  `, [email, password]);

  const userId = userRes.rows[0].id;

  // 2. Inserir em auth.identities (obrigatório para o GoTrue)
  await client.query(`
    insert into auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      gen_random_uuid(),
      $1::uuid,
      jsonb_build_object('sub', $2::text, 'email', $3::text),
      'email',
      $2::text,
      now(),
      now(),
      now()
    );
  `, [userId, userId, email]);

  // 3. Inserir em public.user_profiles
  await client.query(`
    insert into public.user_profiles (
      user_id,
      display_name,
      can_create_farm,
      locale,
      timezone
    ) values (
      $1,
      'SuperAdmin Dev',
      true,
      'pt-BR',
      'America/Sao_Paulo'
    )
    on conflict (user_id) do update set can_create_farm = true;
  `, [userId]);

  // 4. Inserir em public.user_settings
  await client.query(`
    insert into public.user_settings (
      user_id
    ) values (
      $1
    )
    on conflict (user_id) do nothing;
  `, [userId]);

  // 5. Inserir em public.app_superadmins
  await client.query(`
    insert into public.app_superadmins (
      user_id,
      notes
    ) values (
      $1,
      'Dev SuperAdmin'
    )
    on conflict (user_id) do nothing;
  `, [userId]);

  console.log(`\n🎉 USUÁRIO CONFIGURADO COM SUCESSO TOTAL!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📧 E-mail:    ${email}`);
  console.log(`🔑 Senha:     ${password}`);
  console.log(`🆔 User ID:   ${userId}`);
  console.log(`🛡️  SuperAdmin: SIM (app_superadmins)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  await client.end();
}

createAndGrant().catch(console.error);
