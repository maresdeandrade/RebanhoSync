import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BOOTSTRAP_PATH, BASELINE_PATH, ELIGIBLE_DELTA_PATH } from "../../scripts/codex/prepare-sanitario-closure-v2.mjs";

export async function verifyInitialBootstrap({ client, admin, second, check, dir, database, contract }) {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")).catalog;
  const packet = JSON.parse(readFileSync(ELIGIBLE_DELTA_PATH, "utf8"));
  const plan = JSON.parse(readFileSync(BOOTSTRAP_PATH, "utf8"));
  // Real remote timestamps are part of the content digest. Reproduce them only in
  // this disposable fixture, never relax the deployment's exact CLO/LEP CAS.
  const fixtures = [
    ["sanitario_protocolos_v2", baseline.protocols.filter(p => plan.groups.some(g => g.protocol_id === p.id))],
    ["sanitario_protocolo_itens_versions_v2", baseline.items.filter(i => ["clostridioses", "leptospirose"].some(f =>
      baseline.protocols.some(p => p.family_code === f && p.id === i.protocol_id)) && i.status === "draft")],
    ["sanitario_fontes_tecnicas_v2", baseline.sources], ["sanitario_fonte_cobertura_campos_v2", baseline.coverage],
    ["sanitario_product_classes_v2", baseline.classes],
  ];
  await client.query("set session_replication_role=replica");
  try { for (const [table, rows] of fixtures) for (const row of rows) {
    const columns = (await client.query("select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position", [table])).rows.map(r => r.column_name).filter(k => k !== "id" && Object.hasOwn(row, k));
    assert(/^[a-z_0-9]+$/.test(table) && columns.every(k => /^[a-z_0-9]+$/.test(k)));
    await client.query(`update public.${table} t set (${columns.join(',')})=(select ${columns.join(',')} from jsonb_populate_record(null::public.${table},$2::jsonb)) where t.id=$1`, [row.id, JSON.stringify(row)]);
  } } finally { await client.query("set session_replication_role=origin"); }
  const file = path.join(dir, "authorized-initial-bootstrap-delta.json");
  writeFileSync(file, JSON.stringify({ ...packet, import_gate: { import_real_authorized: true, authorization_reference: "Explicit synthetic execution authorization in disposable DB only" } }));
  const publish = (confirmation = packet.content_sha256, mode = "apply", useBootstrap = true) => new Promise(resolve => execFile(process.execPath,
    ["scripts/codex/import-sanitario-protocols-v2.mjs", `--${mode}`, "--incremental", file, ...(useBootstrap ? ["--bootstrap-initial", BOOTSTRAP_PATH] : [])],
    { encoding: "utf8", windowsHide: true, maxBuffer: 8*1024*1024, env: { ...process.env, PGUSER: "postgres", DB_URL: `postgresql://127.0.0.1:55435/${database}`,
      ALLOW_SANITARIO_IMPORT: "1", SANITARIO_IMPORT_CONFIRM: contract.CANONICAL_ARTIFACT_VERSION,
      SANITARIO_DELTA_CONFIRM: confirmation } },
    (error, stdout, stderr) => resolve({ code: error?.code ?? 0, stdout, stderr })));
  const protectedState = async () => (await client.query(`select jsonb_build_object(
    'protocols',(select jsonb_agg(to_jsonb(p) order by id) from public.sanitario_protocolos_v2 p where family_code not in ('clostridioses','leptospirose','ibr_bvd','raiva_herbivoros')),
    'items',(select jsonb_agg(to_jsonb(i) order by id) from public.sanitario_protocolo_itens_versions_v2 i where id=any($1::uuid[]) or logical_item_key='lepto_primovac_dose2'),
    'agendas',(select jsonb_agg(to_jsonb(a) order by id) from public.sanitario_agenda_v2 a),
    'events',(select count(*) from public.eventos),'gates',(select jsonb_agg(to_jsonb(g) order by fazenda_id) from public.sanitario_sync_v2_gates g),
    'interactive_decisions',(select count(*) from public.app_admin_audit_events where action='SANITARY_RULE_DECISION_V2')) as state`, [packet.protected.approved_item_ids])).rows[0].state;
  const before = await protectedState();
  await client.query("delete from public.app_superadmins where user_id=$1", [second]);
  await check("initial bootstrap reuses publication authorization and rejects a changed CLO/LEP digest atomically", async () => {
    const blocked = await publish(""); assert.notEqual(blocked.code, 0); assert.match(blocked.stderr, /INCREMENTAL_EXPLICIT_AUTHORIZATION_REQUIRED/);
    const id = plan.groups[0].item_versions[0].id;
    await client.query("update public.sanitario_protocolo_itens_versions_v2 set limitations=limitations||'[\"synthetic_stale_edit\"]'::jsonb where id=$1", [id]);
    const stale = await publish(); assert.notEqual(stale.code, 0); assert.match(stale.stderr, /BOOTSTRAP_CONTENT_DIGEST_CONFLICT/);
    // Restore the complete remote timestamp-bearing fixture after this stale write.
    const original = baseline.items.find(i => i.id === id);
    await client.query("set session_replication_role=replica");
    try { await client.query("update public.sanitario_protocolo_itens_versions_v2 set limitations=$2,updated_at=$3 where id=$1", [id, JSON.stringify(original.limitations), original.updated_at]); }
    finally { await client.query("set session_replication_role=origin"); }
    assert.equal((await client.query("select count(*)::int n from public.sanitario_protocolo_itens_versions_v2 where id=any($1::uuid[])", [packet.payload.protocol_item_rows.map(i => i.id)])).rows[0].n, 0);
  });
  await check("initial bootstrap audit failure rolls back publication, coverage, class changes and approvals", async () => {
    await client.query("create function public.bootstrap_audit_failure() returns trigger language plpgsql as $$begin if new.action='SANITARY_CATALOG_BOOTSTRAP_V2' then raise exception 'synthetic bootstrap audit failure'; end if; return new; end$$; create trigger bootstrap_audit_failure before insert on public.app_admin_audit_events for each row execute function public.bootstrap_audit_failure()");
    const failed = await publish(); assert.notEqual(failed.code, 0); assert.match(failed.stderr, /synthetic bootstrap audit failure/);
    assert.equal((await client.query("select count(*)::int n from public.sanitario_protocolo_itens_versions_v2 where id=any($1::uuid[])", [packet.payload.protocol_item_rows.map(i => i.id)])).rows[0].n, 0);
    assert.deepEqual(await protectedState(), before);
    await client.query("drop trigger bootstrap_audit_failure on public.app_admin_audit_events; drop function public.bootstrap_audit_failure()");
  });
  await check("initial bootstrap reaches nine families with distinct deployment provenance and convergent concurrent replay", async () => {
    for (const result of await Promise.all([publish(), publish()])) assert.equal(result.code, 0, result.stderr);
    const replay = await publish(); assert.equal(replay.code, 0, replay.stderr); assert.match(replay.stdout, /"replay":true/);
    const ordinaryReplay = await publish(packet.content_sha256, "apply", false); assert.equal(ordinaryReplay.code, 0, ordinaryReplay.stderr);
    const audit = (await client.query("select * from public.app_admin_audit_events where id=$1", [plan.request_id])).rows[0];
    assert.equal(audit.action, "SANITARY_CATALOG_BOOTSTRAP_V2"); assert.equal(audit.actor_user_id, admin);
    assert.equal(audit.state_after.interactive_review, false); assert.equal(audit.state_after.groups.length, 4);
    const protocols = (await client.query("select * from public.sanitario_protocolos_v2 where id=any($1::uuid[])", [baseline.protocols.map(p => p.id)])).rows;
    assert.equal(protocols.filter(p => p.status === "active" && p.approval_status === "approved").length, 9);
    for (const p of protocols.filter(p => plan.groups.some(g => g.protocol_id === p.id))) assert.equal(p.approved_by, null);
    for (const group of audit.state_after.catalog_after) for (const item of group.items) {
      assert.equal(item.allows_agenda_auto, group.protocol.family_code !== "raiva_herbivoros");
      assert.equal(item.snapshot_template.metadata.catalog_decision_reference, undefined);
      for (const refs of Object.values(item.source_refs_by_field)) for (const ref of refs) {
        assert.equal(ref.metadata.catalogFieldReview, undefined); assert(ref.metadata.catalogBootstrap);
      }
    }
    assert.deepEqual(await protectedState(), before);
    writeFileSync(path.join(dir,"initial-bootstrap-receipt.json"), JSON.stringify(audit.state_after, null, 2));
  });
}
