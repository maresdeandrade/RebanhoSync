// PostgreSQL isolated from all existing clusters and external networks.
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

test("product-class migration: evidence, multivalence, ACL, revocation and remote matching", async () => {
  const run = randomUUID();
  let cid;
  const docker = (args) =>
    execFileSync("docker", args, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  const sql = (input) =>
    new Promise((resolve, reject) => {
      const child = spawn("docker", [
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
      child.stdout.on("data", (x) => (out += x));
      child.stderr.on("data", (x) => (err += x));
      child.on("error", reject);
      child.on("exit", (code) =>
        code ? reject(Error(err)) : resolve(out.trim()),
      );
      child.stdin.end(input);
    });
  try {
    cid = docker([
      "run",
      "--rm",
      "--detach",
      "--network",
      "none",
      "--label",
      `rebanhosync.product-class.run=${run}`,
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
    for (const file of readdirSync("supabase/migrations")
      .filter((x) => x.endsWith(".sql"))
      .sort()) {
      try {
        await sql(readFileSync(`supabase/migrations/${file}`, "utf8"));
      } catch (error) {
        throw Error(`${file}: ${error.message}`);
      }
    }
    const p = randomUUID(),
      c = randomUUID(),
      c2 = randomUUID(),
      source = randomUUID(),
      l = randomUUID();
    await sql(`insert into public.sanitario_produtos_v2(id,nome_comercial,classe,tipo_produto,status_curatorial) values('${p}','Synthetic multivalent','vacina','vacina','ativo');
      insert into public.sanitario_product_classes_v2(id,class_key,name,product_type,species_scope,curation_status) values
      ('${c}','synthetic_a','A','vacina',array['bovino'],'approved_for_catalog'),('${c2}','synthetic_b','B','vacina',array['bovino'],'approved_for_catalog');
      insert into public.sanitario_fontes_tecnicas_v2(id,kind,title,strength,evidence_status) values('${source}','bula','Synthetic evidence','forte','SIM_BULA');`);
    await sql(
      `insert into public.sanitario_fonte_cobertura_campos_v2(source_id,field_key,coverage_status) values('${source}','product_class','covers'); insert into public.sanitario_produto_fontes_v2(product_id,source_id,field_key) values('${p}','${source}','product_class');`,
    );
    const insert = (
      id,
      cls,
      status = "ativo",
      refs = `[{"id":"${source}","field":"product_class"}]`,
    ) =>
      `insert into public.sanitario_produto_class_links_v2(id,product_id,class_id,status_curatorial,source_refs) values('${id}','${p}','${cls}','${status}','${refs}'::jsonb)`;
    await assert.rejects(
      sql(insert(l, c, "ativo", "[]")),
      /PRODUCT_CLASS_TECHNICAL_EVIDENCE_REQUIRED/,
    );
    await sql(insert(l, c));
    await sql(insert(randomUUID(), c2));
    assert.equal(
      await sql(
        `select public.sanitario_product_matches_requirement_v2('${p}','synthetic_a',null),public.sanitario_product_matches_requirement_v2('${p}','synthetic_b',null)`,
      ),
      "t|t",
    );
    await assert.rejects(sql(insert(randomUUID(), c)), /duplicate key/);
    const farm = randomUUID(),
      actor = randomUUID(),
      animal = randomUUID(),
      protocol = randomUUID(),
      item = randomUUID();
    await sql(`insert into auth.users(id) values('${actor}');
      insert into public.fazendas(id,nome) values('${farm}','Product class fixture');
      insert into public.user_fazendas(user_id,fazenda_id,role) values('${actor}','${farm}','owner');
      insert into public.animais(id,fazenda_id,identificacao,sexo) values('${animal}','${farm}','fixture','F');
      insert into public.sanitario_sync_v2_gates(fazenda_id,enabled,minimum_contract_version,maximum_contract_version,foundation_state) values('${farm}',true,3,3,'ready');
      insert into public.sanitario_protocolos_v2(id,family_code,name,scope,legal_status,version,status,approval_status) values('${protocol}','fixture','Fixture','global','recomendado_tecnico',1,'active','approved');
      insert into public.sanitario_protocolo_itens_versions_v2(id,protocol_id,logical_item_key,version,item_status,action_type,product_requirement_kind,product_class,eligibility_rule,operational_window_rule,species_authorization,source_refs_by_field)
      values('${item}','${protocol}','fixture',1,'recomendado','vacinacao','product_class','synthetic_a','{}','{}','[]','{}');`);
    const quote = (value) => "'" + String(value).replaceAll("'", "''") + "'";
    const args = (extra) => ({
      actor_user_id: actor,
      fazenda_id: farm,
      contract_version: 3,
      client_op_id: randomUUID(),
      domain_op_id: randomUUID(),
      ...extra,
    });
    const admit = async (command, input) =>
      JSON.parse(
        await sql(
          `begin;set local role service_role;select public.internal_sanitario_admit_v3('${actor}','${farm}',${quote(command)},${quote(JSON.stringify(input))}::jsonb,false);commit;`,
        ),
      );
    const agendaInput = (planned = true) => {
      const id = randomUUID();
      return args({
        payload: {
          id,
          dedup_key: id,
          janela_inicio: "2026-11-20",
          data_programada: "2026-11-20",
          acao_sanitaria: "vacinacao",
          client_id: "class-link-test",
          client_recorded_at: new Date().toISOString(),
          protocolo_id: protocol,
          protocol_item_version_id: item,
          produto_snapshot: planned ? { plannedProductId: p } : {},
          produto_classe: "synthetic_a",
          protocol_item_snapshot: {
            productRequirementKind: "product_class",
            productClass: "synthetic_a",
          },
        },
        animal_ids: [animal],
      });
    };
    const planned = agendaInput();
    assert.equal(
      (await admit("create_agenda", planned)).agenda_id,
      planned.payload.id,
    );
    const linkProof = JSON.parse(
      await sql(
        `select jsonb_build_object('linkId',l.id,'classId',l.class_id,'classKey','synthetic_a','catalogUpdatedAt',l.updated_at,'sourceRefs',l.source_refs) from public.sanitario_produto_class_links_v2 l where l.id='${l}'`,
      ),
    );
    const factualInput = (agendaId) =>
      args({
        expected_revision: 0,
        event_payload: {
          id: randomUUID(),
          natureza: "primary_execution",
          source_sanitario_agenda_v2_id: agendaId,
          occurred_at: new Date().toISOString(),
          client_id: "class-link-test",
          client_tx_id: randomUUID(),
          client_recorded_at: new Date().toISOString(),
          payload: {
            sanitario_v3_progressive: true,
            registration_mode: "executed_fact",
            prospective_authorization: false,
          },
        },
        detail_payload: {
          tipo: "vacinacao",
          produto_sanitario_v2_id: p,
          produto_nome_snapshot: "Synthetic multivalent",
          dose_quantidade: 2,
          dose_unidade: "mL",
          via_aplicacao: "SC",
          produto_snapshot: {
            productClassLinks: [linkProof],
            fieldEvidence: [],
          },
        },
        event_animals: [{ id: randomUUID(), animal_id: animal }],
      });
    const performed = factualInput(planned.payload.id);
    const receipt = await admit("apply_factual_core", performed);
    assert.equal(receipt.confirmed, true);
    const historical = await sql(
      `select produto_snapshot::text from public.eventos_sanitario where evento_id='${performed.event_payload.id}'`,
    );
    const member = (query) =>
      `begin;set local role authenticated;${query};commit;`;
    assert.equal(
      await sql(
        member(`select count(*) from public.sanitario_produto_class_links_v2`),
      ),
      "2",
    );
    for (const query of [
      insert(randomUUID(), c),
      `update public.sanitario_produto_class_links_v2 set status_curatorial='ativo'`,
      `delete from public.sanitario_produto_class_links_v2`,
    ])
      await assert.rejects(sql(member(query)), /permission denied/);
    await assert.rejects(
      sql(
        `begin;set local role anon;select * from public.sanitario_produto_class_links_v2;commit;`,
      ),
      /permission denied/,
    );
    await sql(
      `update public.sanitario_produto_class_links_v2 set status_curatorial='bloqueado',deleted_at=now() where id='${l}'`,
    );
    assert.equal(
      await sql(
        member(
          `select count(*) from public.sanitario_produto_class_links_v2 where deleted_at is not null`,
        ),
      ),
      "1",
      "tombstone readable for incremental pull",
    );
    assert.equal(
      await sql(
        `select public.sanitario_product_matches_requirement_v2('${p}','synthetic_a',null)`,
      ),
      "f",
    );
    await assert.rejects(
      admit("create_agenda", agendaInput()),
      /SANITARIO_PRODUCT_CLASS_LINK_MISMATCH/,
    );
    assert.deepEqual(
      await admit("apply_factual_core", performed),
      receipt,
      "lost ACK after revocation preserves receipt",
    );
    assert.equal(
      await sql(
        `select produto_snapshot::text from public.eventos_sanitario where evento_id='${performed.event_payload.id}'`,
      ),
      historical,
      "revocation never rewrites persisted fact",
    );
    const unplanned = agendaInput(false);
    await admit("create_agenda", unplanned);
    const retrospective = factualInput(unplanned.payload.id);
    assert.equal(
      (await admit("apply_factual_core", retrospective)).confirmed,
      true,
    );
    assert.equal(
      await sql(
        `select produto_snapshot->'productClassLinks' from public.eventos_sanitario where evento_id='${retrospective.event_payload.id}'`,
      ),
      "[]",
      "retrospective admission keeps application without certifying revoked relation",
    );
    for (const omitted of [true, false]) {
      const other = agendaInput(false);
      await admit("create_agenda", other);
      const unproven = factualInput(other.payload.id);
      if (omitted)
        delete unproven.detail_payload.produto_snapshot.productClassLinks;
      else unproven.detail_payload.produto_snapshot.productClassLinks = [];
      unproven.detail_payload.produto_snapshot.fieldEvidence = [
        { reason: "class_scheme_product_compatibility_verified" },
      ];
      await admit("apply_factual_core", unproven);
      assert.equal(
        await sql(
          `select produto_snapshot->'fieldEvidence' from public.eventos_sanitario where evento_id='${unproven.event_payload.id}'`,
        ),
        "[]",
        "no proof cannot preserve class-scheme certification",
      );
    }
    await sql(insert(randomUUID(), c, "precisa_validar", "[]"));
    assert.equal(
      await sql(
        `select public.sanitario_product_matches_requirement_v2('${p}','synthetic_a',null)`,
      ),
      "f",
      "pending does not match",
    );
    await assert.rejects(
      sql(`delete from public.sanitario_produtos_v2 where id='${p}'`),
      /foreign key/,
    );
    await assert.rejects(sql(`update public.sanitario_product_classes_v2 set scope='tenant',fazenda_id='${farm}' where id='${c2}'`),/PRODUCT_CLASS_LINK_GLOBAL_SCOPE_IMMUTABLE/);
    await sql(`update public.sanitario_product_classes_v2 set curation_status='blocked' where id='${c2}'`);
    assert.equal(await sql(`select count(*) from public.sanitario_produto_class_links_v2 where class_id='${c2}' and status_curatorial='bloqueado' and deleted_at is null`),'1','parent revocation propagates through the link updated_at');
    await sql(`update public.sanitario_product_classes_v2 set curation_status='approved_for_catalog' where id='${c2}'`);
    assert.equal(await sql(`select public.sanitario_product_matches_requirement_v2('${p}','synthetic_b',null)`),'f','reapproving class does not silently reactivate product links');
    await sql(`update public.sanitario_produtos_v2 set deleted_at=now() where id='${p}'`);
    assert.equal(await sql(`select count(*) from public.sanitario_produto_class_links_v2 where product_id='${p}' and deleted_at is null`),'0','product soft deletion propagates association tombstones');
    console.log(
      "Clean migration chain; active evidence, uniqueness, multivalence, authenticated/anon ACL, pending, tombstones and remote matcher verified.",
    );
  } finally {
    if (cid) {
      assert.equal(
        docker([
          "inspect",
          "--format",
          `{{index .Config.Labels "rebanhosync.product-class.run"}}`,
          cid,
        ]),
        run,
      );
      docker(["stop", cid]);
    }
  }
});
