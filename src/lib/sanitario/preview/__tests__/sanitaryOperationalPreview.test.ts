import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { SanitaryEligibilityStatus } from "../../eligibility/sanitaryEligibility";
import type { SanitaryDemandGroup, SanitaryDemandStatusSummary } from "../../demand/sanitaryDemand";
import { createSanitaryOperationalPreview } from "../sanitaryOperationalPreview";

const statuses: readonly SanitaryEligibilityStatus[] = [
  "not_applicable",
  "insufficient_data",
  "not_yet_eligible",
  "eligible_soon",
  "in_action_window",
  "near_deadline",
  "overdue",
  "completed",
];

function emptyAnimalIdsByStatus(): Record<SanitaryEligibilityStatus, string[]> {
  return {
    not_applicable: [],
    insufficient_data: [],
    not_yet_eligible: [],
    eligible_soon: [],
    in_action_window: [],
    near_deadline: [],
    overdue: [],
    completed: [],
  };
}

function emptySummary(): SanitaryDemandStatusSummary {
  return {
    total: 0,
    completed: 0,
    notApplicable: 0,
    insufficientData: 0,
    notYetEligible: 0,
    eligibleSoon: 0,
    inActionWindow: 0,
    nearDeadline: 0,
    overdue: 0,
  };
}

function demandGroup(overrides: Partial<SanitaryDemandGroup> = {}): SanitaryDemandGroup {
  return {
    protocolRuleId: "brucelose-b19",
    protocolName: "Brucelose B19",
    protocolItemId: "item-brucelose",
    productId: "produto-b19",
    productName: "Vacina B19",
    productClass: "vacina_brucelose",
    actionType: "vacinacao",
    loteId: "lote-1",
    loteName: "Bezerras 2026",
    windowStart: "2026-04-01",
    windowEnd: "2026-08-29",
    statusSummary: {
      ...emptySummary(),
      total: 2,
      inActionWindow: 2,
    },
    animalIdsByStatus: {
      ...emptyAnimalIdsByStatus(),
      in_action_window: ["animal-2", "animal-1"],
    },
    actionableAnimalIds: ["animal-2", "animal-1"],
    limitations: [],
    source: {
      protocolSource: "SanitaryProtocolRule",
      eligibilitySource: "computeSanitaryEligibility",
      materialization: "none",
    },
    ...overrides,
  };
}

describe("createSanitaryOperationalPreview", () => {
  it("gera preview apenas para grupos acionaveis", () => {
    const preview = createSanitaryOperationalPreview({
      referenceDate: "2026-05-01",
      demandGroups: [
        demandGroup(),
        demandGroup({
          protocolRuleId: "protocolo-concluido",
          statusSummary: {
            ...emptySummary(),
            total: 1,
            completed: 1,
          },
          animalIdsByStatus: {
            ...emptyAnimalIdsByStatus(),
            completed: ["animal-concluido"],
          },
          actionableAnimalIds: [],
        }),
      ],
    });

    expect(preview.groups).toHaveLength(1);
    expect(preview.groups[0].protocolRuleId).toBe("brucelose-b19");
    expect(preview.groups[0].actionableAnimalIds).toEqual(["animal-1", "animal-2"]);
    expect(preview.summary).toMatchObject({
      totalGroups: 1,
      actionableGroups: 1,
      actionableAnimals: 2,
    });
  });

  it("exclui not_applicable do preview operacional", () => {
    const preview = createSanitaryOperationalPreview({
      referenceDate: "2026-05-01",
      demandGroups: [
        demandGroup({
          statusSummary: {
            ...emptySummary(),
            total: 1,
            notApplicable: 1,
          },
          animalIdsByStatus: {
            ...emptyAnimalIdsByStatus(),
            not_applicable: ["animal-fora"],
          },
          actionableAnimalIds: [],
        }),
      ],
    });

    expect(preview.groups).toEqual([]);
    expect(preview.blocked).toEqual([]);
    expect(preview.summary.totalAnimals).toBe(0);
  });

  it("preserva insufficient_data como bloqueado", () => {
    const preview = createSanitaryOperationalPreview({
      referenceDate: "2026-05-01",
      demandGroups: [
        demandGroup({
          statusSummary: {
            ...emptySummary(),
            total: 2,
            insufficientData: 2,
          },
          animalIdsByStatus: {
            ...emptyAnimalIdsByStatus(),
            insufficient_data: ["animal-b", "animal-a"],
          },
          actionableAnimalIds: [],
          limitations: ["missing_birth_date", "missing_sex"],
        }),
      ],
    });

    expect(preview.groups).toEqual([]);
    expect(preview.blocked).toEqual([
      {
        protocolRuleId: "brucelose-b19",
        protocolName: "Brucelose B19",
        protocolItemId: "item-brucelose",
        productId: "produto-b19",
        productName: "Vacina B19",
        productClass: "vacina_brucelose",
        actionType: "vacinacao",
        loteId: "lote-1",
        loteName: "Bezerras 2026",
        windowStart: "2026-04-01",
        windowEnd: "2026-08-29",
        reason: "insufficient_data",
        animalIds: ["animal-a", "animal-b"],
        limitations: ["missing_birth_date", "missing_sex"],
        sourceDemandKey: [
          "brucelose-b19",
          "item-brucelose",
          "produto-b19",
          "vacina_brucelose",
          "vacinacao",
          "lote-1",
          "2026-04-01",
          "2026-08-29",
        ].join("\u0001"),
      },
    ]);
    expect(preview.summary).toMatchObject({
      totalGroups: 1,
      blockedGroups: 1,
      blockedAnimals: 2,
    });
  });

  it("preserva identidade de bloqueios por item e janela", () => {
    const preview = createSanitaryOperationalPreview({
      referenceDate: "2026-05-01",
      demandGroups: [
        demandGroup({
          protocolItemId: "item-2",
          windowStart: "2026-06-01",
          windowEnd: "2026-06-30",
          statusSummary: {
            ...emptySummary(),
            total: 1,
            insufficientData: 1,
          },
          animalIdsByStatus: {
            ...emptyAnimalIdsByStatus(),
            insufficient_data: ["animal-2"],
          },
          actionableAnimalIds: [],
        }),
        demandGroup({
          protocolItemId: "item-1",
          windowStart: "2026-04-01",
          windowEnd: "2026-04-30",
          statusSummary: {
            ...emptySummary(),
            total: 1,
            insufficientData: 1,
          },
          animalIdsByStatus: {
            ...emptyAnimalIdsByStatus(),
            insufficient_data: ["animal-1"],
          },
          actionableAnimalIds: [],
        }),
      ],
    });

    expect(preview.blocked).toHaveLength(2);
    expect(preview.blocked.map((item) => item.protocolItemId)).toEqual(["item-1", "item-2"]);
    expect(new Set(preview.blocked.map((item) => item.sourceDemandKey)).size).toBe(2);
  });

  it("mantem origem da demanda", () => {
    const preview = createSanitaryOperationalPreview({
      referenceDate: "2026-05-01",
      demandGroups: [demandGroup()],
    });

    expect(preview.source).toEqual({
      demandSource: "SanitaryDemandGroup",
      materialization: "none",
    });
    expect(preview.groups[0].sourceDemandKey).toContain("brucelose-b19");
    expect(preview.groups[0].sourceDemandKey).toContain("item-brucelose");
  });

  it("sugere data dentro da janela quando possivel", () => {
    const beforeWindow = createSanitaryOperationalPreview({
      referenceDate: "2026-03-20",
      demandGroups: [demandGroup()],
    });
    const insideWindow = createSanitaryOperationalPreview({
      referenceDate: "2026-05-01",
      demandGroups: [demandGroup()],
    });
    const afterWindow = createSanitaryOperationalPreview({
      referenceDate: "2026-09-01",
      demandGroups: [demandGroup()],
    });

    expect(beforeWindow.groups[0].suggestedExecutionDate).toBe("2026-04-01");
    expect(insideWindow.groups[0].suggestedExecutionDate).toBe("2026-05-01");
    expect(afterWindow.groups[0].suggestedExecutionDate).toBeUndefined();
  });

  it("mantem campos editaveis sem persistir nada", () => {
    const preview = createSanitaryOperationalPreview({
      referenceDate: "2026-05-01",
      demandGroups: [demandGroup()],
    });

    expect(preview.groups[0].editableFields).toEqual({
      executionDate: true,
      responsibleId: true,
      notes: true,
    });
    expect(preview.source.materialization).toBe("none");
    expect(preview.groups[0]).not.toHaveProperty("persistedAt");
    expect(preview.groups[0]).not.toHaveProperty("agendaId");
    expect(preview.groups[0]).not.toHaveProperty("eventId");
  });

  it("mantem saida deterministica", () => {
    const preview = createSanitaryOperationalPreview({
      referenceDate: "2026-05-01",
      demandGroups: [
        demandGroup({
          protocolRuleId: "z-protocolo",
          loteId: "lote-b",
          actionableAnimalIds: ["z", "y"],
          animalIdsByStatus: {
            ...emptyAnimalIdsByStatus(),
            overdue: ["z", "y"],
          },
        }),
        demandGroup({
          protocolRuleId: "a-protocolo",
          loteId: "lote-a",
          actionableAnimalIds: ["b", "a"],
          animalIdsByStatus: {
            ...emptyAnimalIdsByStatus(),
            in_action_window: ["b", "a"],
          },
        }),
      ],
    });

    expect(preview.groups.map((group) => group.protocolRuleId)).toEqual([
      "a-protocolo",
      "z-protocolo",
    ]);
    expect(preview.groups[0].actionableAnimalIds).toEqual(["a", "b"]);
    expect(preview.groups[1].actionableAnimalIds).toEqual(["y", "z"]);
  });

  it("mantem ids de preview distintos para productId e productClass iguais em campos diferentes", () => {
    const preview = createSanitaryOperationalPreview({
      referenceDate: "2026-05-01",
      demandGroups: [
        demandGroup({
          protocolItemId: "item-produto",
          productId: "vacina_brucelose",
          productClass: null,
        }),
        demandGroup({
          protocolItemId: "item-classe",
          productId: null,
          productClass: "vacina_brucelose",
        }),
      ],
    });

    expect(preview.groups.map((group) => group.previewGroupId)).toEqual([
      "sanitary-preview|protocol:brucelose-b19|item:item-classe|product:none|class:vacina_brucelose|action:vacinacao|lote:lote-1|start:2026-04-01|end:2026-08-29",
      "sanitary-preview|protocol:brucelose-b19|item:item-produto|product:vacina_brucelose|class:none|action:vacinacao|lote:lote-1|start:2026-04-01|end:2026-08-29",
    ]);
  });

  it("nao muta inputs", () => {
    const input = {
      referenceDate: "2026-05-01",
      demandGroups: [demandGroup()],
    };
    const snapshot = JSON.stringify(input);

    createSanitaryOperationalPreview(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("nao cria agenda ou evento", () => {
    const preview = createSanitaryOperationalPreview({
      referenceDate: "2026-05-01",
      demandGroups: [demandGroup()],
    });

    expect(preview.source.materialization).toBe("none");
    expect(preview).not.toHaveProperty("agendaId");
    expect(preview).not.toHaveProperty("eventId");
    expect(preview.groups[0]).not.toHaveProperty("agendaId");
    expect(preview.groups[0]).not.toHaveProperty("eventId");
  });

  it("modulo nao usa Supabase, Dexie, React, UI, storage ou Date.now", () => {
    const moduleSource = readFileSync(
      resolve(__dirname, "../sanitaryOperationalPreview.ts"),
      "utf8",
    );

    expect(moduleSource).not.toMatch(/from ["']@\/lib\/supabase["']/);
    expect(moduleSource).not.toMatch(/from ["']dexie["']/i);
    expect(moduleSource).not.toMatch(/from ["']react["']/i);
    expect(moduleSource).not.toMatch(/from ["']@\/pages\//);
    expect(moduleSource).not.toMatch(/from ["']@\/components\//);
    expect(moduleSource).not.toMatch(/from ["']@\/lib\/agenda/);
    expect(moduleSource).not.toMatch(/Date\.now\(/);
    expect(moduleSource).not.toMatch(/localStorage|sessionStorage|storage|rpc\(/i);
  });

  it("usa apenas os status previstos para montar totais operacionais", () => {
    expect(statuses).toEqual([
      "not_applicable",
      "insufficient_data",
      "not_yet_eligible",
      "eligible_soon",
      "in_action_window",
      "near_deadline",
      "overdue",
      "completed",
    ]);
  });
});
