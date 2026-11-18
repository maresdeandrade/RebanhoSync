import { describe, expect, it } from "vitest";
import { validateSanitarioSyncV2Operation } from "./sanitario-v2";

const id = (n: string) => `${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`;
const context = { fazendaId: id("1"), clientTxId: id("2"), clientId: "fixture", actorUserId: id("3"), membershipRole: "owner" as const };
function operation() {
  return { domain: "sanitario_v2", command: "apply_factual_core", contract_version: 3,
    fazenda_id: context.fazendaId, client_tx_id: context.clientTxId, client_op_id: id("4"), domain_op_id: id("5"),
    payload: { event: { id: id("6"), natureza: "standalone_fact", occurred_at: "2026-01-01T12:00:00Z",
      payload: { schema: "sanitary_assessment_v1", assessment: { schema_version: 1, result: "no_treatment_indicated", protocol_id: id("7"), item_id: id("8"), item_version: 1, cycle_key: "2026", responsible_name: "Responsável", origin: "farm_assessment", observation: null } } },
      detail: { tipo: "avaliacao", payload: {}, produto_snapshot: {} }, event_animals: [{ id: id("9"), animal_id: id("a") }] } };
}
describe("sanitary assessment admission", () => {
  it.each(["no_treatment_indicated", "treatment_indicated", "insufficient_data"])("aceita resultado factual %s", result => {
    const op = operation(); op.payload.event.payload.assessment.result = result;
    expect(validateSanitarioSyncV2Operation(op, context).ok).toBe(true);
  });
  it("rejeita produto ou dose em avaliação e impede disfarce de outro tipo", () => {
    for (const detail of [{ tipo: "avaliacao", dose_quantidade: 1 }, { tipo: "avaliacao", produto_sanitario_v2_id: id("b") }, { tipo: "vermifugacao" }]) {
      const op = operation(); Object.assign(op.payload.detail, detail);
      expect(validateSanitarioSyncV2Operation(op, context).ok).toBe(false);
    }
  });
  it("rejeita correção sem referência e motivo", () => {
    const op = operation(); op.payload.event.natureza = "correction";
    expect(validateSanitarioSyncV2Operation(op, context).ok).toBe(false);
  });
  it("rejeita ciclo que não corresponde ao ano da avaliação", () => {
    const op = operation(); op.payload.event.payload.assessment.cycle_key = "2025";
    expect(validateSanitarioSyncV2Operation(op, context).ok).toBe(false);
  });
  it("rejeita animal principal diferente dos participantes factuais", () => {
    const op = operation(); Object.assign(op.payload.event, { animal_id: id("b") });
    expect(validateSanitarioSyncV2Operation(op, context).ok).toBe(false);
  });
  it("usa o ano civil de São Paulo para data perto da virada UTC", () => {
    const op = operation(); op.payload.event.occurred_at = "2026-01-01T01:00:00Z"; op.payload.event.payload.assessment.cycle_key = "2025";
    expect(validateSanitarioSyncV2Operation(op, context).ok).toBe(true);
  });
});
