import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { buildApprovalCandidate, buildApprovalForm, CANONICAL_PATH, DECISION_PATH } from "../../scripts/codex/prepare-sanitario-approval-v2.mjs";
import { createHash } from "node:crypto";
import { normalizeCanonicalData } from "../../scripts/codex/sanitario-v2-contract.mjs";
import { adaptSanitaryProtocolV2Row, adaptSanitaryProtocolItemV2Row } from "../../src/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import { sanitaryPlanningBlockersV2 } from "../../src/lib/sanitario/preview/sanitaryWindowPlanningPreviewV2";

const bytes = readFileSync(CANONICAL_PATH);
const packetBytes = readFileSync(DECISION_PATH);
const canonical = JSON.parse(bytes);
const packet = JSON.parse(packetBytes);
const build = (proposal = packet) => buildApprovalCandidate(canonical, proposal, bytes, packetBytes);

describe("candidato versionado sem aprovacao/publicacao", () => {
  it("vincula revisao curatorial ao hash exato e as 14 versoes sem registrar aprovacao", () => {
    const candidate = build();
    const form = buildApprovalForm(candidate, packet);
    expect(JSON.parse(readFileSync("docs/review/evidence/SANITARIO_V2_APROVACAO_PENDENTE_20261017.json"))).toEqual(form);
    expect(form.candidate_sha256).toBe(createHash("sha256").update(JSON.stringify(candidate, null, 2) + "\n").digest("hex"));
    expect(form.decisions).toHaveLength(8);
    expect(form.decisions.flatMap((decision) => decision.versions)).toHaveLength(14);
    expect(form.decisions.every((decision) => decision.catalog_review.actor_id === null && decision.catalog_review.approved_at === null)).toBe(true);
    expect(form.operational_authorization).toBe(false);
  });
  it("produz deterministicamente 20 itens, 14 novas versoes e preserva os seis restritos", () => {
    const candidate = build();
    expect(candidate).toEqual(build());
    expect(candidate.review_only).toBe(true);
    expect(candidate.payload.protocol_item_rows).toHaveLength(20);
    const original = normalizeCanonicalData(canonical);
    for (const row of candidate.payload.protocol_item_rows) {
      const old = original.protocol_item_rows.find((item) => item.logical_item_key === row.logical_item_key);
      expect(row.status).toBe("draft");
      expect(row.allows_agenda_auto).toBe(false);
      if (packet.retained_restricted_records.some((item) => item.id === row.id)) expect(row).toEqual(old);
      else expect(row).toMatchObject({ version: old.version + 1, protocol_id: old.protocol_id });
    }
    expect(JSON.parse(readFileSync(CANONICAL_PATH))).toEqual(canonical);
  });

  it("materializa B19 por campo; as fontes reais sustentam so avaliacao generica", () => {
    const data = build().payload;
    const row = data.protocol_item_rows.find((item) => item.logical_item_key === "b19_femeas_3_8_meses");
    const protocol = data.protocol_rows.find((item) => item.id === row.protocol_id);
    const adapted = adaptSanitaryProtocolItemV2Row(row);
    expect(sanitaryPlanningBlockersV2(adaptSanitaryProtocolV2Row(protocol), adapted, "automatic").length).toBeGreaterThan(0);
    // Authorized simulation only: signing/publication is never performed by the preparer.
    const signedSimulation = { ...protocol, status: "active", approval_status: "approved",
      metadata: { ...protocol.metadata, agenda_allowed: true, approved_for_catalog: true } };
    expect(sanitaryPlanningBlockersV2(adaptSanitaryProtocolV2Row(signedSimulation),
      { ...adapted, status: "active", allowsAgendaAuto: true }, "automatic")).toEqual([]);
    expect(row.product_id ?? null).toBeNull();
    expect(row.snapshot_template.metadata.planning_scope).toBe("assessment_only");
    for (const field of ["eligibility_rule", "operational_window", "product_requirement"])
      expect(row.source_refs_by_field[field].every((source) => source.metadata.bindingStatus === "PROPOSED_PENDING_CATALOG_DECISION")).toBe(true);
  });

  it("os seis manejos dispensam produto e continuam sem liberacao antes da revisao curatorial", () => {
    const data = build().payload;
    const groups = packet.decision_sets.filter((group) => group.category === "GLOBAL_FIELD_REVIEW_REQUIRED");
    const keys = groups.flatMap((group) => group.item_keys);
    expect(keys).toHaveLength(6);
    for (const row of data.protocol_item_rows.filter((item) => keys.includes(item.logical_item_key))) {
      expect(row).toMatchObject({ action_type: "manejo_sanitario", product_requirement_kind: "none", dose_rule: {}, route_rule: {} });
      expect(row.product_key ?? null).toBeNull();
      const protocol = data.protocol_rows.find((item) => item.id === row.protocol_id);
      expect(sanitaryPlanningBlockersV2(adaptSanitaryProtocolV2Row(protocol), adaptSanitaryProtocolItemV2Row(row), "automatic").length).toBeGreaterThan(0);
    }
    expect(groups.every((group) => group.submission_status === "READY_FOR_GLOBAL_RULE_REVIEW")).toBe(true);
    expect(groups.every((group) => group.catalog_review_request.requires_specific_farm === false)).toBe(true);
    expect(groups.every((group) => Object.keys(group.farm_activation_requirements.context_definition).length > 0)).toBe(true);
  });

  it("separa revisor global, ativacao pelo usuario e profissional exigido na execucao", () => {
    const form = buildApprovalForm(build(), packet);
    for (const decision of form.decisions) {
      expect(decision.catalog_review).toMatchObject({ reviewer_role: "authorized_catalog_reviewer", requires_farm_veterinarian: false, requires_crmv_by_default: false, requires_specific_farm: false });
      expect(decision.catalog_review).not.toHaveProperty("professional_registration");
      expect(decision.farm_activation).toMatchObject({ actor: "authorized_farm_user", confirmation_required: true, professional_identification_required_by_default: false });
      expect(decision.execution_compliance).toMatchObject({ missing_planned_professional_blocks_agenda: false, planning_authorizes_medication_dose_or_withdrawal: false });
    }
    expect(form.decisions.find((decision) => decision.id === "B19").execution_compliance.professional_sve_registration_required_for_b19).toBe(true);
  });

  it("adiciona tres produtos comerciais em rascunho sem reinterpretar genericos ou vincular os sete itens", () => {
    const data = build().payload;
    const original = normalizeCanonicalData(canonical);
    for (const product of original.product_rows) expect(data.product_rows).toContainEqual(product);
    const proposals = data.product_rows.filter((row) => row.metadata?.review_only);
    expect(proposals).toHaveLength(3);
    expect(proposals.every((row) => row.status_curatorial === "precisa_validar" && row.metadata.registration_current_validity === "unknown")).toBe(true);
    const productIds = proposals.map((row) => row.id);
    expect(data.protocol_item_rows.some((row) => productIds.includes(row.product_id))).toBe(false);
    expect(data.product_authorization_rows).toEqual(original.product_authorization_rows);
  });

  it.each(["signature", "version", "restriction", "hash", "operational_metadata"])("rejeita proposta adulterada: %s", (kind) => {
    const altered = structuredClone(packet);
    if (kind === "signature") altered.decision_sets[0].approval.actor_id = "invented";
    if (kind === "version") altered.prepared_item_records[0].expected_previous_version += 1;
    if (kind === "restriction") altered.retained_restricted_records[0].allows_agenda_auto = true;
    if (kind === "hash") altered.source_canonical_sha256 = "wrong";
    if (kind === "operational_metadata") altered.prepared_protocol_records[0].record.metadata.agenda_allowed = true;
    expect(() => build(altered)).toThrow();
  });

  it("recusa --apply de candidato antes de ler arquivo ou conectar em qualquer banco", () => {
    const run = spawnSync(process.execPath, ["scripts/codex/import-sanitario-protocols-v2.mjs", "--apply", "--review-candidate", "nao-existe.json"],
      { encoding: "utf8", env: { ...process.env, DB_URL: "not-a-database" } });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("REVIEW_CANDIDATE_CANNOT_APPLY");
  });
});
