import { execFileSync, spawn } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { compileProductClassPublicationV2 } from "../../scripts/codex/sanitario-product-class-publication-v2.mjs";

test("commercial catalog publication and canonical flows in isolated PostgreSQL/Dexie", async () => {
  let cid;
  let success = false;
  const keep = process.env.PRODUCT_CLASS_KEEP_LOCAL === "1";
  const run = randomUUID();
  const docker = (args) =>
    execFileSync("docker", args, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  const sql = (input) =>
    new Promise((resolve, reject) => {
      const c = spawn("docker", [
        "exec",
        "-i",
        cid,
        "psql",
        "-XqAt",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
      ]);
      let out = "",
        err = "";
      c.stdout.on("data", (b) => (out += b));
      c.stderr.on("data", (b) => (err += b));
      c.on("error", reject);
      c.on("exit", (code) => (code ? reject(Error(err)) : resolve(out.trim())));
      c.stdin.end(input);
    });
  const quote = (s) => `'${String(s).replaceAll("'", "''")}'`;
  try {
    cid = docker([
      "run",
      "--rm",
      "--detach",
      "--network",
      "none",
      "--label",
      `rebanhosync.product-class-commercial.run=${run}`,
      "--env",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "public.ecr.aws/supabase/postgres:17.6.1.167",
    ]);
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        docker([
          "exec",
          cid,
          "pg_isready",
          "-h",
          "127.0.0.1",
          "-U",
          "postgres",
        ]);
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    assert(ready);
    for (const f of readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort())
      try {
        await sql(readFileSync("supabase/migrations/" + f, "utf8"));
      } catch (e) {
        throw Error(f + ": " + e.message);
      }
    await sql(
      "comment on database postgres is 'PRODUCT_CLASS_DISPOSABLE_LOCAL_ONLY'",
    );
    const technical = JSON.parse(
      readFileSync(
        "tests/fixtures/sanitario-product-class-technical-20261120.json",
        "utf8",
      ),
    ).rows;
    const catalog = JSON.parse(
      readFileSync(
        "tests/fixtures/sanitario-product-class-catalog-20261120.json",
        "utf8",
      ),
    ).catalog;
    const mapping = {
      sanitario_product_classes_v2: catalog.classes,
      sanitario_product_class_groups_v2: catalog.groups,
      sanitario_product_class_group_members_v2: catalog.members,
      sanitario_protocolos_v2: catalog.protocols,
      sanitario_protocolo_itens_versions_v2: catalog.items,
    };
    const rows = { ...technical, ...mapping };
    const order = [
      "sanitario_fontes_tecnicas_v2",
      "sanitario_fonte_cobertura_campos_v2",
      "sanitario_produtos_v2",
      "sanitario_product_classes_v2",
      "sanitario_product_class_groups_v2",
      "sanitario_product_class_group_members_v2",
      "sanitario_produto_fontes_v2",
      "sanitario_produto_dose_rules_v2",
      "sanitario_produto_especie_autorizacao_v2",
      "sanitario_produto_carencia_rules_v2",
      "sanitario_produto_carencia_fontes_v2",
      "sanitario_protocolos_v2",
      "sanitario_protocolo_itens_versions_v2",
    ];
    for (const table of order) {
      const columns = JSON.parse(
        await sql(
          `select json_agg(column_name) from information_schema.columns where table_schema='public' and table_name=${quote(table)}`,
        ),
      );
      const data = rows[table].map((r) =>
        Object.fromEntries(
          Object.entries(r).filter(
            ([k]) =>
              columns.includes(k) && !["created_by", "approved_by"].includes(k),
          ),
        ),
      );
      const keys = columns.filter((k) => data.some((r) => k in r));
      await sql(
        `insert into public.${table}(${keys.map((k) => '"' + k + '"').join(",")}) select ${keys.map((k) => '"' + k + '"').join(",")} from jsonb_populate_recordset(null::public.${table},${quote(JSON.stringify(data))}::jsonb)`,
      );
    }
    const snapshot = () =>
      sql(
        "select jsonb_agg(to_jsonb(t) order by id)::text from public.sanitario_produtos_v2 t",
      );
    const originalProducts = await snapshot();
    const packet = JSON.parse(
      readFileSync(
        "docs/review/evidence/SANITARIO_PRODUCT_CLASS_PUBLICATION_20261120.json",
        "utf8",
      ),
    );
    const publication = compileProductClassPublicationV2(packet);
    await sql(publication);
    assert.equal(
      await snapshot(),
      originalProducts,
      "existing product approvals and compositions are unchanged",
    );
    assert.equal(
      await sql(
        "select count(*) from public.sanitario_produto_class_links_v2 where status_curatorial='ativo' and deleted_at is null",
      ),
      "37",
    );
    assert.equal(
      await sql(
        "select count(distinct product_id) from public.sanitario_produto_class_links_v2 where status_curatorial='ativo' and deleted_at is null",
      ),
      "33",
    );
    assert.equal(
      await sql(
        "select count(*) from public.sanitario_product_classes_v2 where curation_status='approved_for_catalog' and deleted_at is null",
      ),
      "8",
    );
    const stable = await sql(
      "select jsonb_agg(to_jsonb(t) order by id)::text from public.sanitario_produto_class_links_v2 t",
    );
    await sql(publication);
    assert.equal(
      await sql(
        "select jsonb_agg(to_jsonb(t) order by id)::text from public.sanitario_produto_class_links_v2 t",
      ),
      stable,
      "publication replay does not mutate timestamps, IDs or content",
    );
    assert.equal(
      await sql(
        "select count(*) from public.sanitario_product_classes_v2 where metadata->>'can_validate_execution' is distinct from 'false'",
      ),
      "0",
    );
    assert.equal(
      await sql(
        "select count(*) from public.sanitario_fonte_cobertura_campos_v2 c join public.sanitario_fontes_tecnicas_v2 s on s.id=c.source_id where s.evidence_status='SIM_COMPOSICAO_FABRICANTE' and c.field_key not in ('composition','product_class')",
      ),
      "0",
    );
    const restricted = packet.sources.find(
      (s) => s.evidence_status === "SIM_COMPOSICAO_FABRICANTE",
    );
    await assert.rejects(
      sql(
        `insert into public.sanitario_fonte_cobertura_campos_v2(source_id,field_key,coverage_status) values('${restricted.id}','dose','covers')`,
      ),
      /COMPOSITION_EVIDENCE_FIELD_ONLY/,
    );
    const output = {};
    for (const table of [...order, "sanitario_produto_class_links_v2"])
      output[table] = JSON.parse(
        await sql(
          `select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.${table} t`,
        ),
      );
    mkdirSync("scratch", { recursive: true });
    const fixture = "scratch/product-class-commercial-persisted.json";
    writeFileSync(fixture, JSON.stringify(output));
    const result = execFileSync(
      process.execPath,
      [
        "node_modules/vitest/vitest.mjs",
        "run",
        "tests/codex/sanitary-product-class-commercial.integration.test.ts",
      ],
      {
        encoding: "utf8",
        env: { ...process.env, PRODUCT_CLASS_PERSISTED_FIXTURE: fixture },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    console.log(result);
    success = true;
    if (keep) {
      writeFileSync(
        "scratch/product-class-local-environment.json",
        JSON.stringify(
          {
            containerId: cid,
            run,
            network: "none",
            database: "postgres",
            products: 33,
            activeLinks: 37,
            approvedClasses: 8,
          },
          null,
          2,
        ),
      );
      console.log("Isolated local catalog kept active: " + cid);
    }
    console.log(
      "Persisted: 33 classified products, 37 active links, 8 catalog classes; real catalog preserved and replay idempotent.",
    );
  } finally {
    if (cid) {
      assert.equal(
        docker([
          "inspect",
          "--format",
          '{{index .Config.Labels "rebanhosync.product-class-commercial.run"}}',
          cid,
        ]),
        run,
      );
      if (!keep || !success) docker(["stop", cid]);
    }
  }
});
