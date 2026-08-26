import pg from "pg";
const { Client } = pg;

const email = process.argv[2] || "maresdeandrade@gmail.com";
const DB_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function grant() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  console.log(`Buscando usuário pelo e-mail: ${email}...`);
  const res = await client.query("select id, email from auth.users where email = $1", [email]);

  if (res.rows.length === 0) {
    console.log(`\n⚠️  Usuário com e-mail '${email}' não foi encontrado no banco de dados local.`);
    console.log("Usuários atualmente cadastrados no banco local:");
    const allUsers = await client.query("select id, email, created_at from auth.users order by created_at desc limit 10");
    console.table(allUsers.rows);
    console.log("\n👉 Dica: Acesse a tela de Login/Cadastro na aplicação (http://localhost:8080) e crie sua conta primeiro.");
    console.log("Depois execute novamente: node scripts/grant-superadmin.mjs " + email);
  } else {
    const user = res.rows[0];
    await client.query(
      "insert into public.app_superadmins (user_id, notes) values ($1, $2) on conflict (user_id) do nothing",
      [user.id, "Dev SuperAdmin"]
    );
    console.log(`\n🎉 SUCESSO! Permissão de SuperAdmin concedida para:`);
    console.log(`   E-mail: ${user.email}`);
    console.log(`   ID:     ${user.id}`);
  }

  await client.end();
}

grant().catch(console.error);
