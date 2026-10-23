// Synthetic scopes exercise RPC authorization; they are not veterinary approvals.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function verifyManualCatalogReview({ client, asUser, admin, outsider, preview, decide, check }) {
  const protectedState = async () => (await client.query(`select jsonb_build_object(
    'items',(select jsonb_agg(to_jsonb(i) order by id) from public.sanitario_protocolo_itens_versions_v2 i where status='active'),
    'protocols',(select jsonb_agg(to_jsonb(p) order by id) from public.sanitario_protocolos_v2 p where status in ('active','retired')),
    'gates',(select jsonb_agg(to_jsonb(g) order by fazenda_id) from public.sanitario_sync_v2_gates g)) as state`)).rows[0].state;
  const before = await protectedState();
  const protocol = (await client.query("select * from public.sanitario_protocolos_v2 where family_code='raiva_herbivoros' and deleted_at is null")).rows[0];
  const original = (await client.query("select * from public.sanitario_protocolo_itens_versions_v2 where protocol_id=$1 and logical_item_key='raiva_primovac_dose1' and deleted_at is null", [protocol.id])).rows[0];
  const template = (await client.query("select * from public.sanitario_protocolo_itens_versions_v2 where snapshot_template->'metadata'->>'planning_scope'='class_scheme' and status='active' limit 1")).rows[0];
  const sourceId = randomUUID();
  const sourceKey = "SRC_SYNTHETIC_MANUAL_REGIONAL_CONTRACT";
  await client.query(`insert into public.sanitario_fontes_tecnicas_v2
    (id,source_key,kind,scope,title,strength,evidence_status,jurisdiction_uf)
    values($1,$2,'norma_oficial','global','Synthetic national norm for RPC contract only','forte','SIM_NORMA',null)`, [sourceId, sourceKey]);
  const refs = {};
  for (const field of ["eligibility_rule", "operational_window", "product_requirement", "species_authorization"]) {
    const id = randomUUID();
    await client.query("insert into public.sanitario_fonte_cobertura_campos_v2(id,source_id,field_key,coverage_status) values($1,$2,$3,'covers')", [id, sourceId, field]);
    refs[field] = [{ id: sourceId, source_ref: sourceKey, metadata: { coverage_ids: [id] } }];
  }
  const item = { ...original, id: randomUUID(), version: original.version + 1,
    status: "draft", allows_agenda_auto: false,
    product_requirement_kind: "product_class", product_class: template.product_class, product_id: null,
    dose_rule: null, route_rule: null,
    source_refs_by_field: refs,
    eligibility_rule: { species: ["bovino"], requires_regional_overlay: true },
    limitations: ["no_agenda_auto", "synthetic_contract_fixture_only"],
    snapshot_template: { executionProductPolicy: "required_at_execution",
      sourcePolicy: { operational_window: "compatible_product_required_at_execution" },
      metadata: { planning_scope: "class_scheme", catalog_review_scope: "manual_planning", proposal_only: true } },
  };
  await client.query(`insert into public.sanitario_protocolo_itens_versions_v2
    select * from jsonb_populate_record(null::public.sanitario_protocolo_itens_versions_v2, $1::jsonb)`, [JSON.stringify(item)]);
  await check("national manual review rejects v1, missing no_agenda_auto and auto flag without requiring a farm or region", async () => {
    const content = (await client.query("select public.internal_sanitario_review_content_v2($1,$2) as content", [protocol.id, [item.id]])).rows[0].content;
    content.items[0].version = 1;
    await assert.rejects(client.query("select public.internal_sanitario_review_fields_v2($1,$2,now(),'fixture')", [content, admin]),
      e => e.message === "MANUAL_REVIEW_CONTRACT_REQUIRED");
    for (const changes of [
      { allows_agenda_auto: true }, { limitations: [] },
      { snapshot_template: { ...item.snapshot_template, metadata: { ...item.snapshot_template.metadata, planning_scope: "assessment_only" } } },
    ]) {
      const changed = { ...item, ...changes };
      await client.query(`update public.sanitario_protocolo_itens_versions_v2 set
        allows_agenda_auto=$2,limitations=$3,eligibility_rule=$4,snapshot_template=$5 where id=$1`,
      [item.id, changed.allows_agenda_auto, JSON.stringify(changed.limitations), changed.eligibility_rule, changed.snapshot_template]);
      const v = await asUser(admin, c => preview(c, protocol.id, [item.id]));
      assert.deepEqual(v.blockers, ["MANUAL_REVIEW_CONTRACT_REQUIRED"]);
      await assert.rejects(asUser(admin, c => decide(c, v)), e => e.code === "23514");
    }
    await client.query(`update public.sanitario_protocolo_itens_versions_v2 set allows_agenda_auto=false,
      limitations=$2,eligibility_rule=$3,snapshot_template=$4 where id=$1`,
    [item.id, JSON.stringify(item.limitations), item.eligibility_rule, item.snapshot_template]);
  });
  const v = await asUser(admin, c => preview(c, protocol.id, [item.id]));
  await check("manual preview remains authenticated and source-backed; stale digest cannot approve", async () => {
    assert.deepEqual(v.blockers, []);
    await assert.rejects(asUser(outsider, c => preview(c, protocol.id, [item.id])), e => e.code === "42501");
    await assert.rejects(asUser(admin, c => decide(c, v, randomUUID(), "approved", "0".repeat(64))), e => e.message === "REVIEW_DIGEST_CONFLICT");
    const invalid = { ...item.source_refs_by_field, operational_window: [] };
    await client.query("update public.sanitario_protocolo_itens_versions_v2 set source_refs_by_field=$2 where id=$1", [item.id, invalid]);
    const missing = await asUser(admin, c => preview(c, protocol.id, [item.id]));
    assert.deepEqual(missing.blockers, ["FIELD_SOURCE_REQUIRED:operational_window"]);
    await client.query("update public.sanitario_protocolo_itens_versions_v2 set source_refs_by_field=$2 where id=$1", [item.id, item.source_refs_by_field]);
  });
  await check("manual approval records scope, replays and keeps automation OFF without altering approved scopes", async () => {
    const fresh = await asUser(admin, c => preview(c, protocol.id, [item.id]));
    const request = randomUUID();
    const [a, b] = await Promise.all([asUser(admin, c => decide(c, fresh, request)), asUser(admin, c => decide(c, fresh, request))]);
    assert.deepEqual(a, b);
    assert.equal(a.item_versions[0].review_scope, "manual_planning");
    const current = (await client.query("select * from public.sanitario_protocolo_itens_versions_v2 where id=$1", [item.id])).rows[0];
    assert.equal(current.status, "active"); assert.equal(current.allows_agenda_auto, false);
    assert.equal(current.snapshot_template.metadata.agenda_allowed, false);
    assert(current.limitations.includes("no_agenda_auto"));
    const p = (await client.query("select * from public.sanitario_protocolos_v2 where id=$1", [protocol.id])).rows[0];
    assert.equal(p.approval_status, "approved"); assert.equal(p.metadata.agenda_allowed, false);
    assert.equal(p.metadata.automationStatus, "manual_only");
    assert.equal((await client.query("select count(*)::int n from public.app_admin_audit_events where id=$1", [request])).rows[0].n, 1);
    const after = await protectedState();
    assert.deepEqual(after.items.filter(i => i.id !== item.id), before.items);
    assert.deepEqual(after.protocols.filter(p => p.id !== protocol.id), before.protocols.filter(p => p.id !== protocol.id));
    assert.deepEqual(after.gates, before.gates);
    assert.deepEqual((await client.query("select * from public.sanitario_protocolo_itens_versions_v2 where id=$1", [original.id])).rows[0], original);
  });
}
