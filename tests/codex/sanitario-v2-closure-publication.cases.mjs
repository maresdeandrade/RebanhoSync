// Uses only the public incremental publisher against the disposable PostgreSQL fixture.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prepareClosureDelta, ELIGIBLE_DELTA_PATH } from "../../scripts/codex/prepare-sanitario-closure-v2.mjs";

export async function verifyClosurePublication({ client, asUser, admin, preview, decide, check, dir, database, contract }) {
  const packet = JSON.parse(readFileSync(ELIGIBLE_DELTA_PATH, "utf8"));
  const json = key => JSON.parse(readFileSync(packet.inputs[key].path, "utf8"));
  assert.deepEqual(packet, prepareClosureDelta(json("baseline").catalog, json("candidates"), json("preservation"), packet.inputs));
  const file = path.join(dir, "closure-local-authorized.json");
  writeFileSync(file, JSON.stringify({ ...packet, import_gate: { import_real_authorized: true,
    authorization_reference: "Synthetic closure publication authorized only in disposable DB" } }));
  const publish = (mode = "apply", input = file) => new Promise(resolve => execFile(process.execPath,
    ["scripts/codex/import-sanitario-protocols-v2.mjs", `--${mode}`, "--incremental", input],
    { encoding: "utf8", windowsHide: true, env: { ...process.env, PGUSER: "postgres", DB_URL: `postgresql://127.0.0.1:55435/${database}`,
      ALLOW_SANITARIO_IMPORT: "1", SANITARIO_IMPORT_CONFIRM: contract.CANONICAL_ARTIFACT_VERSION, SANITARIO_DELTA_CONFIRM: packet.content_sha256 } },
    (error, stdout, stderr) => resolve({ code: error?.code ?? 0, stdout, stderr })));
  const factualState = async () => (await client.query(`select jsonb_build_object(
    'approved',(select jsonb_agg(to_jsonb(i) order by id) from public.sanitario_protocolo_itens_versions_v2 i where id=any($1::uuid[])),
    'protected_protocols',(select jsonb_agg(to_jsonb(p) order by id) from public.sanitario_protocolos_v2 p where family_code not in ('ibr_bvd','raiva_herbivoros')),
    'agendas',(select jsonb_agg(to_jsonb(a) order by id) from public.sanitario_agenda_v2 a),
    'events',(select count(*) from public.eventos),
    'gates',(select jsonb_agg(to_jsonb(g) order by fazenda_id) from public.sanitario_sync_v2_gates g)) as state`, [packet.protected.approved_item_ids])).rows[0].state;
  const before = await factualState();
  await check("closure public publisher preserves authorization and rejects competing new variant identity", async () => {
    const dry = await publish("dry-run"); assert.equal(dry.code, 0, dry.stderr);
    const blocked = await publish("apply", ELIGIBLE_DELTA_PATH); assert.notEqual(blocked.code, 0); assert.match(blocked.stderr, /IMPORT_REAL_NOT_AUTHORIZED/);
    const item = packet.payload.protocol_item_rows.find(i => i.logical_item_key.includes("v4j5"));
    await client.query(`insert into public.sanitario_protocolo_itens_versions_v2 select (jsonb_populate_record(null::public.sanitario_protocolo_itens_versions_v2,
      to_jsonb(t)||$2::jsonb)).* from public.sanitario_protocolo_itens_versions_v2 t where id=$1`,
    [packet.baseline.predecessors.find(i => i.protocol_id === item.protocol_id).id,
      JSON.stringify({ logical_item_key: item.logical_item_key, version: 9, id: "0b9f4b64-7e9b-4f51-9862-d3305702151c" })]);
    const conflict = await publish(); assert.notEqual(conflict.code, 0); assert.match(conflict.stderr, /INCREMENTAL_NEW_LOGICAL_KEY_CONFLICT/);
    // Remove only the synthetic collision in this disposable test fixture.
    await client.query("delete from public.sanitario_protocolo_itens_versions_v2 where id='0b9f4b64-7e9b-4f51-9862-d3305702151c'");
  });
  await check("closure incremental concurrent publication converges without publishing incomplete variants", async () => {
    for (const result of await Promise.all([publish(), publish()])) assert.equal(result.code, 0, result.stderr);
    const replay = await publish(); assert.equal(replay.code, 0, replay.stderr); assert.match(replay.stdout, /"create":0,"update":0/);
    const actual = (await client.query("select * from public.sanitario_protocolo_itens_versions_v2 where id=any($1::uuid[])", [packet.payload.protocol_item_rows.map(i => i.id)])).rows;
    assert.equal(actual.length, 7); assert(actual.every(i => i.status === "draft" && !i.allows_agenda_auto));
    assert.equal((await client.query("select count(*)::int n from public.sanitario_protocolo_itens_versions_v2 where logical_item_key like '%cattlemaster%' or logical_item_key like 'lepto_bovigen8%'")).rows[0].n, 0);
  });
  await check("closure canonical previews and decisions reach nine families with manual rabies and audited import replay", async () => {
    for (const protocolId of [...new Set(packet.payload.protocol_item_rows.map(i => i.protocol_id))]) {
      const ids = packet.payload.protocol_item_rows.filter(i => i.protocol_id === protocolId).map(i => i.id);
      const v = await asUser(admin, c => preview(c, protocolId, ids)); assert.deepEqual(v.blockers, []);
      const receipt = await asUser(admin, c => decide(c, v)); assert.equal(receipt.result, "approved");
      assert.equal(receipt.item_versions.length, ids.length);
    }
    const rows = (await client.query("select * from public.sanitario_protocolo_itens_versions_v2 where id=any($1::uuid[])", [packet.payload.protocol_item_rows.map(i => i.id)])).rows;
    for (const row of rows) {
      assert.equal(row.status, "active");
      assert.equal(row.allows_agenda_auto, !row.logical_item_key.startsWith("raiva_"));
      if (row.logical_item_key.startsWith("raiva_")) assert(row.limitations.includes("no_agenda_auto"));
    }
    assert.equal((await client.query("select count(*)::int n from public.sanitario_protocolos_v2 where status='active' and approval_status='approved' and id=any($1::uuid[])",
      [json("baseline").catalog.protocols.map(p => p.id)])).rows[0].n, 9);
    const replay = await publish(); assert.equal(replay.code, 0, replay.stderr); assert.match(replay.stdout, /"create":0,"update":0/);
    assert.deepEqual(await factualState(), before);
  });
}
