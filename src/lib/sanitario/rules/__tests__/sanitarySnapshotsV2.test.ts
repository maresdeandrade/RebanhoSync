import { describe, expect, it } from "vitest";
import {
  validateAgendaTechnicalSnapshotV2,
  validateEventTechnicalSnapshotV2,
  type AgendaTechnicalSnapshot,
  type EventTechnicalSnapshot,
  type SanitaryProductSnapshotV2,
  type WithdrawalSnapshotV2,
} from "../sanitarySnapshotsV2";
import type { SanitarySourceRefV2 } from "../sanitarySourceV2";

const labelSource: SanitarySourceRefV2 = {
  kind: "bula",
  title: "Bula registrada",
  issuer: "Fabricante",
  strength: "forte",
  evidenceStatus: "SIM_BULA",
  fieldKeys: ["withdrawal", "species_authorization"],
};

const productSnapshot: SanitaryProductSnapshotV2 = {
  productId: "prod-1",
  nomeComercial: "Produto executado",
  classe: "vacina",
  tipoProduto: "imunobiologico",
  speciesCode: "bovino",
  authorizationStatus: "SIM_BULA",
  sourceRefs: [labelSource],
};

const withdrawalSnapshot: WithdrawalSnapshotV2 = {
  productId: "prod-1",
  speciesCode: "bovino",
  aptitude: "corte",
  meatDays: 0,
  applicability: "zero",
  sourceRefs: [labelSource],
};

function validAgenda(overrides: Partial<AgendaTechnicalSnapshot> = {}): AgendaTechnicalSnapshot {
  return {
    schemaVersion: "sanitario-agenda-technical-snapshot-v2",
    protocolId: "protocol-1",
    protocolVersion: 1,
    protocolItemVersionId: "item-1",
    logicalItemKey: "item",
    itemVersion: 1,
    actionType: "vacinacao",
    itemStatus: "recomendado",
    legalStatus: "recomendado_tecnico",
    speciesScope: ["bovino"],
    productRequirement: { kind: "product_class", productClass: "vacina" },
    eligibilityRuleSnapshot: {},
    operationalWindowSnapshot: {},
    sourceRefs: [labelSource],
    fieldSourceStatus: [],
    limitations: [],
    ...overrides,
  };
}

function validEvent(overrides: Partial<EventTechnicalSnapshot> = {}): EventTechnicalSnapshot {
  return {
    schemaVersion: "sanitario-event-technical-snapshot-v2",
    eventId: "event-1",
    executedProductId: "prod-1",
    executedProductSnapshot: productSnapshot,
    executedDose: { quantity: 2, unit: "mL", basis: "animal" },
    executedRoute: "subcutanea",
    withdrawalSnapshot,
    sourceRefs: [labelSource],
    limitations: [],
    ...overrides,
  };
}

describe("sanitarySnapshotsV2", () => {
  it("produto planejado nao vira produto executado", () => {
    const result = validateEventTechnicalSnapshotV2({
      ...validEvent(),
      executedProductId: "",
      plannedProductId: "prod-planejado",
    } as EventTechnicalSnapshot & Record<string, unknown>);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "event_snapshot_requires_executed_product" }),
      ]),
    );
  });

  it("AgendaTechnicalSnapshot nao contem carencia ativa", () => {
    const result = validateAgendaTechnicalSnapshotV2({
      ...validAgenda(),
      withdrawalSnapshot,
      carenciaAtiva: true,
    } as AgendaTechnicalSnapshot & Record<string, unknown>);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "agenda_snapshot_must_not_carry_withdrawal" }),
        expect.objectContaining({ code: "agenda_snapshot_must_not_carry_active_withdrawal" }),
      ]),
    );
  });

  it("EventTechnicalSnapshot exige produto executado real", () => {
    const result = validateEventTechnicalSnapshotV2({
      ...validEvent(),
      executedProductId: "",
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "event_snapshot_requires_executed_product" }),
      ]),
    );
  });

  it("EventTechnicalSnapshot valido carrega produto executado e snapshot de carencia", () => {
    expect(validateEventTechnicalSnapshotV2(validEvent()).ok).toBe(true);
  });
});
