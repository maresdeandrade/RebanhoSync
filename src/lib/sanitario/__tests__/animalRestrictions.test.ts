import { describe, expect, it } from "vitest";
import type { SanitarioCaso } from "@/lib/offline/types";
import { listAnimalSanitaryRestrictions } from "../compliance/animalRestrictions";
const animal = { id: "synthetic-animal", identificacao: "SYNTHETIC", fazenda_id: "farm-a", payload: {} };
const caseRow = (overrides: Partial<SanitarioCaso> = {}): SanitarioCaso => ({
  id: "case-a", animal_id: animal.id, fazenda_id: "farm-a", status: "aberto",
  movement_blocked: true, closed_at: null, deleted_at: null, disease_name: "Caso A", ...overrides,
} as SanitarioCaso);
describe("sanitary restrictions read model", () => {
  it("retains every blocking case after stale projection/CAS rejection without duplicates or writes", () => {
    const cases = [caseRow(), caseRow(), caseRow({ id: "case-b", disease_name: "Caso B", status: "em_acompanhamento" })];
    const before = JSON.stringify({ animal, cases });
    const result = listAnimalSanitaryRestrictions("farm-a", [animal, animal], cases);
    expect(result).toHaveLength(1);
    expect(result[0].caseIds).toEqual(["case-a", "case-b"]);
    expect(result[0].alert.diseaseName).toBe("Caso A; Caso B");
    expect(JSON.stringify({ animal, cases })).toBe(before);
  });
  it("closed/deleted/nonblocking cases do not erase other open cases or legacy evidence", () => {
    const legacy = { ...animal, payload: { sanidade_alerta: { status: "suspeita_aberta", movement_blocked: true, disease_name: "Legado" } } };
    const inactive = [caseRow({ status: "encerrado", closed_at: "2026-10-30" }), caseRow({ status: "cancelado", closed_at: "2026-10-30" }),
      caseRow({ deleted_at: "2026-10-30" }), caseRow({ movement_blocked: false })];
    expect(listAnimalSanitaryRestrictions("farm-a", [animal], inactive)).toEqual([]);
    expect(listAnimalSanitaryRestrictions("farm-a", [legacy], inactive)[0].alert.diseaseName).toBe("Legado");
    expect(listAnimalSanitaryRestrictions("farm-a", [legacy], [...inactive, caseRow({ id: "other", disease_name: "Outro" })])[0].alert.diseaseName).toBe("Outro; Legado");
  });
  it("does not trust a closed projection over an inconsistent open case", () => {
    const closed = { ...animal, payload: { sanidade_alerta: { status: "encerrada", movement_blocked: false } } };
    expect(listAnimalSanitaryRestrictions("farm-a", [closed], [caseRow({ closed_at: "inconsistent" })])[0].caseIds).toEqual(["case-a"]);
  });
  it("isolates farm and animal and retains legacy evidence with incomplete local data", () => {
    expect(listAnimalSanitaryRestrictions("farm-b", [animal], [caseRow()])).toEqual([]);
    expect(listAnimalSanitaryRestrictions(null, [animal], [caseRow()])).toEqual([]);
    expect(listAnimalSanitaryRestrictions("farm-a", [animal], [caseRow({ fazenda_id: "farm-b" }), caseRow({ animal_id: "other" })])).toEqual([]);
    const legacy = { ...animal, payload: { sanidade_alerta: { status: "suspeita_aberta", movement_blocked: true } } };
    expect(listAnimalSanitaryRestrictions("farm-a", [legacy])).toHaveLength(1);
  });
});
