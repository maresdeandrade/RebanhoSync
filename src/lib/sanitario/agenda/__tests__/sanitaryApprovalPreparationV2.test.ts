import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import packet from "../../../../../docs/review/evidence/SANITARIO_V2_FECHAMENTO_DECISOES_20261016.json";
import canonical from "../../../../../docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json";
import { adaptSanitaryProtocolV2Row, adaptSanitaryProtocolItemV2Row } from "../../catalog/sanitaryProtocolCatalogV2";
import { sanitaryPlanningBlockersV2 } from "../../preview/sanitaryWindowPlanningPreviewV2";

const items = canonical.payload.sanitario_protocolo_itens_versions_v2.rows;
const groups = packet.decision_sets;

describe("preparação curatorial sem autorização operacional", () => {
  it("cobre exatamente os 20 itens uma vez e preserva a referência canônica", () => {
    const keys = groups.flatMap((group) => group.item_keys);
    expect(keys.sort()).toEqual(items.map((item) => item.logical_item_key).sort());
    expect(new Set(keys).size).toBe(20);
    const bytes = readFileSync(new URL("../../../../../docs/review/evidence/SANITARIO_PROTOCOLS_V2_CANONICAL_PAYLOAD_12F10.json", import.meta.url));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(packet.source_canonical_sha256);
    expect(items.every((item) => item.allows_agenda_auto === false)).toBe(true);
  });

  it("separa prontidão, contexto, produto e proibição sem somar fixture como aprovação", () => {
    const count = (category: string) => groups.filter((group) => group.category === category).flatMap((group) => group.item_keys).length;
    expect(count("READY_FOR_APPROVAL")).toBe(1);
    expect(count("PRODUCT_SCHEME_REQUIRED")).toBe(5);
    expect(count("COMMERCIAL_SOURCE_REQUIRED")).toBe(2);
    expect(count("FARM_CONTEXT_SOURCE_REQUIRED")).toBe(6);
    expect(count("EXPLICIT_AUTO_RESTRICTION")).toBe(6);
    expect(groups.filter((group) => group.technically_ready_for_single_decision).map((group) => group.id)).toEqual(["B19"]);
  });

  it("não assina decisão, ativa flag ou permite importação pelo pacote", () => {
    expect(packet).toMatchObject({ execute_import: false, changes_operational_flags: false, approvals_granted: 0 });
    expect(groups.every((group) => group.approval.status === "NOT_GRANTED" && group.approval.actor_id === null && group.approval.approved_at === null)).toBe(true);
    expect(groups.every((group) => group.requested_decision.length > 0)).toBe(true);
    expect(groups.filter((group) => !group.technically_ready_for_single_decision && group.category !== "EXPLICIT_AUTO_RESTRICTION")
      .every((group) => group.unresolved_inputs.length > 0)).toBe(true);
    for (const group of groups) {
      if (group.category === "EXPLICIT_AUTO_RESTRICTION") {
        expect(group.requested_state_transition).toBeNull();
        continue;
      }
      expect(group.requested_state_transition).toMatchObject({ execution_status: "PROPOSAL_ONLY_NOT_APPLIED",
        protocol_after_approval: { status: "active", approval_status: "approved", metadata: { agenda_allowed: true, approved_for_catalog: true } },
        item_after_approval: { status: "active", allows_agenda_auto: true } });
      expect(group.requested_state_transition!.requires).toContain("signed_decision_with_actor_date_reference");
      expect(group.requested_state_transition!.requires).toContain("approved_field_bindings_materialized");
    }
  });

  it("prepara versões físicas novas com precondição de versão e preserva protocolo estável para histórico", () => {
    expect(packet.prepared_protocol_records).toHaveLength(8);
    expect(packet.prepared_item_records).toHaveLength(14);
    const ids = new Set(items.map((item) => item.id));
    for (const entry of packet.prepared_item_records) {
      const original = items.find((item) => item.id === entry.expected_previous_id)!;
      expect(entry.expected_previous_version).toBe(original.version);
      expect(entry.record.version).toBe(original.version + 1);
      expect(ids.has(entry.record.id)).toBe(false);
      expect(entry.record.protocol_id).toBe(original.protocol_id);
      expect(entry.record).toMatchObject({ status: "draft", allows_agenda_auto: false });
      expect(entry.record.snapshot_template.metadata.supersedes).toMatchObject({ id: original.id, version: original.version });
      expect(entry.record.eligibility_rule).toEqual(original.eligibility_rule);
      expect(entry.record.operational_window_rule).toEqual(original.operational_window_rule);
    }
    expect(new Set(packet.prepared_item_records.map((entry) => entry.record.id)).size).toBe(14);
  });

  it("o domínio continua rejeitando a automação de todos os registros preparados sem decisão", () => {
    for (const entry of packet.prepared_item_records) {
      const protocol = packet.prepared_protocol_records.find((row) => row.record.id === entry.record.protocol_id)!;
      const result = sanitaryPlanningBlockersV2(adaptSanitaryProtocolV2Row(protocol.record), adaptSanitaryProtocolItemV2Row(entry.record), "automatic");
      expect(result.length).toBeGreaterThan(0);
      expect(protocol.record).toMatchObject({ status: "draft", approval_status: "draft", metadata: { agenda_allowed: false, approved_for_catalog: false } });
    }
  });

  it("mantém raiva, aftosa e dose 2 canônica de leptospirose sem qualquer alteração", () => {
    expect(packet.retained_restricted_records).toHaveLength(6);
    for (const record of packet.retained_restricted_records)
      expect(record).toEqual(items.find((item) => item.id === record.id));
    const raiva = packet.retained_restricted_records.filter((item) => item.logical_item_key.startsWith("raiva_"));
    expect(raiva).toHaveLength(3);
    expect(raiva.every((item) => JSON.stringify(item).includes("no_agenda_auto"))).toBe(true);
  });

  it("referencia evidências cadastradas e distingue proposta de vínculo de coverage aprovado", () => {
    const sourceKeys = new Set(canonical.payload.sanitario_fontes_tecnicas_v2.rows.map((source) => source.source_key));
    const coverage = new Map(canonical.payload.coverage_rows.map((row) => [row.id, row]));
    for (const group of groups) {
      expect(group.evidence_source_keys.every((key) => sourceKeys.has(key))).toBe(true);
      expect(group.evidence_coverage_ids.every((id) => coverage.has(id))).toBe(true);
    }
    for (const binding of packet.proposed_source_bindings) {
      expect(binding.status).toBe("PROPOSED_MAPPING_REQUIRES_SIGNED_DECISION");
      expect(binding.registered_coverage_ids.length).toBeGreaterThan(0);
      expect(binding.registered_coverage_ids.every((id) => coverage.get(id)?.coverage_status === "covers")).toBe(true);
    }
  });
});
