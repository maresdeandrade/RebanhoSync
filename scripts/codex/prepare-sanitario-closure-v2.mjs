// Preparation only. No connection, SQL writer, import, decision or gate activation.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { CANONICAL_ARTIFACT_VERSION, normalizeCanonicalData, validateCanonicalTechnicalContract } from "./sanitario-v2-contract.mjs";
import { classDeltaDigest, CLASS_DELTA_PATH } from "./prepare-sanitario-class-delta-v2.mjs";

export const BASELINE_PATH = "docs/review/evidence/SANITARIO_V2_CLOSURE_BASELINE_20261022.json";
export const CANDIDATE_PATH = "docs/review/evidence/SANITARIO_V2_CLOSURE_CANDIDATES_20261022.json";
export const ELIGIBLE_DELTA_PATH = "docs/review/evidence/SANITARIO_V2_CLOSURE_ELIGIBLE_DELTA_20261022.json";
export const CLOSURE_DELTA_KIND = "closure_eligible_20261022";
export const BOOTSTRAP_VERSION = "sanitario-initial-20261022-v1";
export const BOOTSTRAP_PATH = "docs/review/evidence/SANITARIO_V2_INITIAL_BOOTSTRAP_20261022.json";
const fields = ["eligibility_rule", "operational_window", "product_requirement", "species_authorization"];
const labels = {
  poliguard: { source_key: "SRC_MSD_POLIGUARD_REVIEW_20261022", title: "Poliguard — resumo da bula oficial MSD",
    url: "https://www.msd-saude-animal.com.br/produto/poliguard/", issuer: "MSD Saúde Animal", dose_ml: 5, route: "SC", interval: [21, 30] },
  cattlemaster: { source_key: "SRC_ZOETIS_CATTLEMASTER_GOLD_REVIEW_20261022", title: "CattleMaster GOLD FP 5/L5 — bula oficial Zoetis",
    url: "https://www.zoetis.com.br/especies/bovinos/cattlemaster-gold/download/bula-cattlemaster-gold.pdf", issuer: "Zoetis", dose_ml: 5, route: "SC", interval: [21, 21] },
  v4j5: { source_key: "SRC_VIRBAC_BOVIGEN_V4J5_REVIEW_20261022", title: "Bovigen V4J5 — informações oficiais Virbac Brasil",
    url: "https://br.virbac.com/products/biologicos/bovigen-v4j5", issuer: "Virbac", dose_ml: 5, route: "SC", interval: [21, 30] },
  lepto8: { source_key: "SRC_VIRBAC_BOVIGEN_LEPTO8_REVIEW_20261022", title: "Bovigen Lepto 8 — informações oficiais Virbac Brasil",
    url: "https://br.virbac.com/products/biologicos/bovigen-lepto-8", issuer: "Virbac", dose_ml: 3, route: "SC", interval: [21, 30] },
};

export function prepareClosureCandidates(baseline, identities) {
  const original = structuredClone(baseline);
  const payload = normalizeCanonicalData({});
  const id = key => { assert(identities[key], `PROSPECTIVE_ID_REQUIRED:${key}`); return identities[key]; };
  const protocols = new Map(baseline.protocols.map(p => [p.family_code, p]));
  const lookup = key => { const row = baseline.items.find(i => i.logical_item_key === key); assert(row, `BASELINE_ITEM_REQUIRED:${key}`); return row; };
  const referencedFamilies = ["ibr_bvd", "leptospirose", "raiva_herbivoros"];
  payload.protocol_rows = referencedFamilies.map(family => ({ ...protocols.get(family), protocol_key: family }));
  payload.product_class_rows = baseline.classes.filter(c => ["vacina_ibr_bvd", "vacina_leptospirose", "vacina_raiva_herbivoros"].includes(c.class_key));
  const sourceRefs = {};
  for (const [variant, label] of Object.entries(labels)) {
    const sourceId = id(`source:${variant}`);
    payload.source_rows.push({ id: sourceId, source_key: label.source_key, title: label.title, url: label.url,
      issuer: label.issuer, kind: "bula", scope: "global", strength: "forte", evidence_status: "SIM_BULA",
      accessed_at: "2026-10-22", jurisdiction_country: "BR", limitations: ["bovine_label_only", "not_product_registration_verification"] });
    sourceRefs[variant] = Object.fromEntries(fields.map(field => {
      const coverageId = id(`coverage:${variant}:${field}`);
      payload.coverage_rows.push({ id: coverageId, source_id: sourceId, source_key: label.source_key,
        field_key: field, coverage_status: "covers", notes: `Somente a formulação ${label.title}; condições maternas/reprodutivas próprias, sem generalização por classe. Proposta não aprovada.` });
      return [field, [{ id: sourceId, source_ref: label.source_key, kind: "bula", scope: "global", title: label.title,
        strength: "forte", evidenceStatus: "SIM_BULA", fieldKeys: [field], metadata: { coverage_ids: [coverageId] } }]];
    }));
  }
  function candidate(prior, variant, key = prior.logical_item_key, blockers = []) {
    const version = key === prior.logical_item_key ? prior.version + 1 : 1;
    const row = { ...structuredClone(prior), id: id(`item:${key}`), logical_item_key: key, version,
      protocol_key: protocols.get(referencedFamilies.find(f => protocols.get(f).id === prior.protocol_id)).family_code,
      class_key: prior.product_class, status: "draft", item_status: blockers.length ? "bloqueado" : "condicional",
      allows_agenda_auto: false, product_id: null, dose_rule: null, route_rule: null,
      eligibility_rule: { species: ["bovino"] }, source_refs_by_field: sourceRefs[variant] ?? {},
      species_authorization: [{ species: "bovino", source_ref: labels[variant]?.source_key }],
      limitations: ["bovine_only", "do_not_generalize_class", "withdrawal_by_executed_product", ...blockers],
      snapshot_template: { executionProductPolicy: "required_at_execution",
        sourcePolicy: { operational_window: "compatible_product_required_at_execution", withdrawal: "by_executed_product_snapshot" },
        metadata: { proposal_only: true, planning_scope: "class_scheme", agenda_allowed: false, approved_for_catalog: false,
          automationStatus: "decision_required", variant_key: variant, approval_blockers: blockers,
          ...(key === prior.logical_item_key ? { supersedes: { id: prior.id, version: prior.version, reason: "Proposta prospectiva; histórico preservado." } } : {}) } } };
    delete row.created_at; delete row.updated_at; delete row.deleted_at;
    payload.protocol_item_rows.push(row);
    return row;
  }
  for (const step of [1, 2]) {
    const prior = lookup(`ibr_bvd_primovac_dose${step}`);
    const poliguard = candidate(prior, "poliguard");
    poliguard.eligibility_rule = { species: ["bovino"], category: "bezerro", maternal_age_conditions: {
      vaccinated: { min_months: 4, exclusive: true }, unvaccinated: { no_minimum_in_source: true } } };
    poliguard.snapshot_template.metadata.approval_blockers = ["canonical_publisher_scope_extension", "authenticated_preview_and_explicit_decision", "class_review_required"];
    const v4 = candidate(prior, "v4j5", `ibr_bvd_v4j5_primovac_dose${step}`);
    v4.eligibility_rule = { species: ["bovino"], category: "bezerro", maternal_age_conditions: {
      vaccinated: { min_months: 2 }, unvaccinated: { min_days: 15 } } };
    const cattle = candidate(prior, "cattlemaster", `ibr_bvd_cattlemaster_gold_primovac_dose${step}`,
      ["calf_revaccination_and_reproductive_context_require_runtime"]);
    cattle.operational_window_rule = step === 1 ? { type: "hybrid", anchor: "manual_context" } :
      { type: "relative", anchor: "previous_dose", min_offset_days: 21, max_offset_days: 21 };
    for (const [row, first] of [[poliguard, "ibr_bvd_primovac_dose1"], [v4, "ibr_bvd_v4j5_primovac_dose1"], [cattle, "ibr_bvd_cattlemaster_gold_primovac_dose1"]]) {
      if (step === 2) {
        row.eligibility_rule.requires_previous_dose = first;
        row.booster_rule.previous_logical_item_key = first;
      }
    }
  }
  const leptoKeys = ["lepto_primovac_dose1", "lepto_primovac_dose2", "lepto_reforco_anual_semestral"];
  const newLeptoKeys = ["lepto_bovigen8_primovac_dose1", "lepto_bovigen8_primovac_dose2", "lepto_bovigen8_reforco_anual"];
  for (let index = 0; index < 3; index++) {
    const row = candidate(lookup(leptoKeys[index]), "lepto8", newLeptoKeys[index], ["maternal_prenatal_mortality_and_reproductive_context_require_runtime"]);
    row.operational_window_rule = index === 0 ? { type: "hybrid", anchor: "manual_context" } : index === 1 ?
      { type: "relative", anchor: "previous_dose", min_offset_days: 21, max_offset_days: 30 } : { type: "relative", anchor: "last_execution" };
    row.booster_rule = { recurrenceRule: { kind: index === 0 ? "primovaccination_dose_1" : index === 1 ? "primovaccination_dose_2" : "annual" }, tolerance: { days: 0 },
      ...(index ? { previous_logical_item_key: newLeptoKeys[1 === index ? 0 : 1] } : {}) };
    if (index === 1) row.eligibility_rule.requires_previous_dose = newLeptoKeys[0];
  }
  const rabiesSource = baseline.sources.find(s => s.source_key === "SRC_MAPA_IN_05_2002_RAIVA_HERBIVOROS");
  assert(rabiesSource?.evidence_status === "SIM_NORMA");
  const rabiesRefs = Object.fromEntries(fields.map(field => {
    const coverageId = id(`coverage:rabies:${field}`);
    payload.coverage_rows.push({ id: coverageId, source_id: rabiesSource.id, source_key: rabiesSource.source_key, field_key: field,
      coverage_status: "covers", notes: "Consulta e planejamento manual nacional conforme IN 5/2002; aplicação regional por fazenda. Sem automação global, produto real e carência somente por evidência própria." });
    return [field, [{ id: rabiesSource.id, source_ref: rabiesSource.source_key, kind: rabiesSource.kind, scope: "global", title: rabiesSource.title,
      strength: "forte", evidenceStatus: "SIM_NORMA", fieldKeys: [field], metadata: { coverage_ids: [coverageId] } }]];
  }));
  for (const key of ["raiva_primovac_dose1", "raiva_primovac_reforco_30d", "raiva_reforco_anual_area_risco"]) {
    const prior = lookup(key);
    const row = candidate(prior, "national_manual_rabies", key);
    row.eligibility_rule = { ...prior.eligibility_rule, requires_regional_overlay: true };
    row.species_authorization = prior.species_authorization;
    row.limitations.push("no_agenda_auto");
    row.snapshot_template.metadata.catalog_review_scope = "manual_planning";
    row.snapshot_template.metadata.automationStatus = "manual_only";
    row.source_refs_by_field = rabiesRefs;
    row.booster_rule.tolerance = { days: 0 };
    if (key === "raiva_reforco_anual_area_risco") {
      row.booster_rule.previous_logical_item_key = "raiva_primovac_reforco_30d";
      row.booster_rule.recurrenceRule = { kind: "annual" };
    }
  }
  // Add existing references without promoting their source status or inventing coverages.
  const used = JSON.stringify(payload);
  payload.source_rows.push(...baseline.sources.filter(s => used.includes(s.source_key)));
  const packet = { artifact: "sanitario_closure_review_candidates", artifact_version: CANONICAL_ARTIFACT_VERSION, identity_model: "VERSIONED_EXPLICIT_UUID", review_only: true,
    approved: false, execute_import: false, import_gate: { import_real_authorized: false, authorization_reference: null },
    project_ref: "zqloazqzhwauamcejmuz", identities, payload,
    label_facts_for_review_only: Object.fromEntries(Object.entries(labels).map(([key, label]) => [key, { ...label, milk_withdrawal: "unknown", slaughter_withdrawal: "unknown" }])),
    excluded: [{ variant: "bovela", reason: "BVD-only; no IBR coverage inferred. Brazilian label and scoped contract still required." }],
    publication_blockers: ["This full review artifact cannot be applied. Only its separately validated eligible subset uses the existing incremental publisher.",
      "No remote publication or curatorial authorization. Taxonomic class review does not approve execution.",
      "Rabies global candidates authorize consultation/manual planning only; farm adoption and regional applicability remain separate. Global automation stays blocked."],
  };
  validateCanonicalTechnicalContract(packet);
  assert.deepEqual(baseline, original);
  assert(!packet.payload.protocol_item_rows.some(i => baseline.items.some(old => old.id === i.id)));
  return packet;
}

export function prepareClosureDelta(baseline, candidates, preservation, inputs) {
  assert.deepEqual(candidates, prepareClosureCandidates(baseline, candidates.identities), "CLOSURE_CANDIDATE_CHANGED");
  const payload = normalizeCanonicalData({});
  payload.protocol_item_rows = candidates.payload.protocol_item_rows.filter(i =>
    i.logical_item_key.startsWith("raiva_") || ["ibr_bvd_primovac_dose1", "ibr_bvd_primovac_dose2",
      "ibr_bvd_v4j5_primovac_dose1", "ibr_bvd_v4j5_primovac_dose2"].includes(i.logical_item_key));
  assert.equal(payload.protocol_item_rows.length, 7);
  payload.protocol_rows = candidates.payload.protocol_rows.filter(p => payload.protocol_item_rows.some(i => i.protocol_id === p.id));
  payload.product_class_rows = candidates.payload.product_class_rows.filter(c => payload.protocol_item_rows.some(i => i.product_class === c.class_key))
    .map(c => ({ ...c, curation_status: c.class_key === "vacina_ibr_bvd" ? "approved_for_catalog" : c.curation_status }));
  const used = JSON.stringify([payload.protocol_rows, payload.protocol_item_rows]);
  payload.source_rows = candidates.payload.source_rows.filter(s => used.includes(s.source_key));
  payload.coverage_rows = candidates.payload.coverage_rows.filter(c => payload.source_rows.some(s => s.id === c.source_id));
  assert.equal(payload.coverage_rows.length, 12);
  const predecessors = baseline.items.filter(i => payload.protocol_item_rows.some(n => n.snapshot_template.metadata.supersedes?.id === i.id));
  assert.equal(predecessors.length, 5);
  const packet = { artifact: "sanitario_protocols_v2_incremental_delta", artifact_version: CANONICAL_ARTIFACT_VERSION,
    identity_model: "VERSIONED_EXPLICIT_UUID", delta_kind: CLOSURE_DELTA_KIND, project_ref: candidates.project_ref,
    execute_import: false, approved: false, import_gate: { import_real_authorized: false, authorization_reference: null }, inputs, payload,
    baseline: { source_rows: payload.source_rows.filter(s => baseline.sources.some(b => b.id === s.id)), product_rows: [],
      protocol_rows: payload.protocol_rows, product_class_rows: baseline.classes.filter(c => payload.product_class_rows.some(n => n.id === c.id)), predecessors },
    protected: structuredClone(preservation.protected) };
  assert.deepEqual(packet.protected.approved_item_ids, baseline.items.filter(i => i.status === "active" && i.allows_agenda_auto).map(i => i.id).sort());
  validateCanonicalTechnicalContract(packet);
  packet.content_sha256 = classDeltaDigest(packet);
  return packet;
}

export function prepareClosureBootstrap(delta, baseline, requestId) {
  assert.equal(delta.delta_kind, CLOSURE_DELTA_KIND);
  assert.match(requestId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  const existingKeys = ["clostridial_primovac_dose1", "clostridial_primovac_dose2", "clostridial_reforco_anual", "lepto_primovac_dose1", "lepto_reforco_anual_semestral"];
  const items = [...baseline.items.filter(i => existingKeys.includes(i.logical_item_key)), ...delta.payload.protocol_item_rows];
  assert.equal(items.length, 12);
  const families = ["clostridioses", "leptospirose", "ibr_bvd", "raiva_herbivoros"];
  const groups = families.map(family => {
    const protocol = baseline.protocols.find(p => p.family_code === family);
    assert(protocol?.status === "draft" && protocol.approval_status === "draft");
    const digests = { clostridioses: "83b5fe310eac94e2d9912bd425e1e147b4263e2ccaab594f5fc2c11a592410b3",
      leptospirose: "f80230a1aa845e3659a939f8cb118c3b3a39d10e234efe99844f8bcf5ef62bc1" };
    return { family, protocol_id: protocol.id, expected_version: protocol.version, expected_content_digest: digests[family] ?? null,
      item_versions: items.filter(i => i.protocol_id === protocol.id).map(i => ({ id: i.id, version: i.version, logical_item_key: i.logical_item_key })).sort((a,b) => a.id.localeCompare(b.id)) };
  });
  const plan = { artifact: "sanitario_initial_administrative_bootstrap", version: BOOTSTRAP_VERSION, request_id: requestId,
    project_ref: delta.project_ref, publication_sha256: delta.content_sha256, interactive_review: false, groups };
  plan.content_sha256 = createHash("sha256").update(JSON.stringify(plan)).digest("hex");
  return plan;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assert(process.argv.slice(2).length === 0 || ["--eligible-delta", "--bootstrap-plan"].includes(process.argv.slice(2).join()), "Preparation has no apply mode");
  if (process.argv.includes("--bootstrap-plan")) {
    const delta = JSON.parse(readFileSync(ELIGIBLE_DELTA_PATH, "utf8"));
    const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")).catalog;
    const requestId = existsSync(BOOTSTRAP_PATH) ? JSON.parse(readFileSync(BOOTSTRAP_PATH, "utf8")).request_id : randomUUID();
    const plan = prepareClosureBootstrap(delta, baseline, requestId);
    writeFileSync(BOOTSTRAP_PATH, JSON.stringify(plan, null, 2) + "\n");
    console.log(JSON.stringify({ file: BOOTSTRAP_PATH, content_sha256: plan.content_sha256, groups: plan.groups.length, items: 12, authorized: false }));
  } else
  if (process.argv.includes("--eligible-delta")) {
    const paths = { baseline: BASELINE_PATH, candidates: CANDIDATE_PATH, preservation: CLASS_DELTA_PATH,
      publisher: "scripts/codex/import-sanitario-protocols-v2.mjs", preparer: "scripts/codex/prepare-sanitario-closure-v2.mjs",
      contract: "scripts/codex/sanitario-v2-contract.mjs", migration: "supabase/migrations/20261022230000_sanitario_manual_catalog_review_v2.sql" };
    const inputs = Object.fromEntries(Object.entries(paths).map(([key, file]) => [key, { path: file, sha256: createHash("sha256").update(readFileSync(file)).digest("hex") }]));
    const json = key => JSON.parse(readFileSync(paths[key], "utf8"));
    const packet = prepareClosureDelta(json("baseline").catalog, json("candidates"), json("preservation"), inputs);
    writeFileSync(ELIGIBLE_DELTA_PATH, JSON.stringify(packet, null, 2) + "\n");
    console.log(JSON.stringify({ file: ELIGIBLE_DELTA_PATH, content_sha256: packet.content_sha256, items: 7, coverage: 12, authorized: false }));
  } else {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf8")).catalog;
  const identities = existsSync(CANDIDATE_PATH) ? JSON.parse(readFileSync(CANDIDATE_PATH, "utf8")).identities : {};
  // Allocate genuine prospective identities once, then preserve them on replay.
  for (const variant of Object.keys(labels)) {
    identities[`source:${variant}`] ??= randomUUID();
    for (const field of fields) identities[`coverage:${variant}:${field}`] ??= randomUUID();
  }
  for (const field of fields) identities[`coverage:rabies:${field}`] ??= randomUUID();
  for (const key of ["ibr_bvd_primovac_dose1", "ibr_bvd_primovac_dose2", "ibr_bvd_v4j5_primovac_dose1", "ibr_bvd_v4j5_primovac_dose2",
    "ibr_bvd_cattlemaster_gold_primovac_dose1", "ibr_bvd_cattlemaster_gold_primovac_dose2", "lepto_bovigen8_primovac_dose1", "lepto_bovigen8_primovac_dose2", "lepto_bovigen8_reforco_anual",
    "raiva_primovac_dose1", "raiva_primovac_reforco_30d", "raiva_reforco_anual_area_risco"]) identities[`item:${key}`] ??= randomUUID();
  const packet = prepareClosureCandidates(baseline, identities);
  writeFileSync(CANDIDATE_PATH, JSON.stringify(packet, null, 2) + "\n");
  console.log(JSON.stringify({ file: CANDIDATE_PATH, items: packet.payload.protocol_item_rows.length, approved: false, importable: false }));
  }
}
