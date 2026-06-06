import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  SanitaryEligibilityProtocolRule,
  SanitaryEligibilityResult,
} from "../../eligibility/sanitaryEligibility";
import {
  computeSanitaryDemandGroups,
  createSanitaryDemandGroupsFromEligibilityResults,
  type SanitaryDemandAnimal,
  type SanitaryDemandEligibilityEntry,
} from "../sanitaryDemand";

const sourceRefs = [
  {
    kind: "norma_oficial" as const,
    title: "Norma oficial",
    fieldKeys: ["eligibilityWindow", "completionCriteria", "productRequirement"],
  },
];

const protocolRule: SanitaryEligibilityProtocolRule = {
  id: "brucelose-b19",
  name: "Brucelose B19",
  eligibilityWindow: {
    start: { anchor: "nascimento", offsetDays: 90 },
    end: { anchor: "nascimento", offsetDays: 240 },
    sourceRefs,
  },
  completionCriteria: {
    requiresExecutedEvent: true,
    compatibleProductClass: "vacina_brucelose",
    requiredDoseCount: 1,
    sourceRefs,
  },
  productRequirement: {
    kind: "product_class",
    classKey: "vacina_brucelose",
    sourceRefs,
  },
};

function animal(overrides: Partial<SanitaryDemandAnimal> = {}): SanitaryDemandAnimal {
  return {
    id: "animal-1",
    birthDate: "2026-01-01",
    sex: "F",
    species: "bovina",
    loteId: "lote-1",
    loteName: "Bezerras 2026",
    ...overrides,
  };
}

function eligibility(
  overrides: Partial<SanitaryEligibilityResult> = {},
): SanitaryEligibilityResult {
  return {
    status: "in_action_window",
    limitations: [],
    matchedEventIds: [],
    window: {
      startDate: "2026-04-01",
      endDate: "2026-08-29",
    },
    ...overrides,
  };
}

function entry(
  overrides: Partial<SanitaryDemandEligibilityEntry> = {},
): SanitaryDemandEligibilityEntry {
  return {
    animal: animal(),
    protocolRule,
    eligibility: eligibility(),
    metadata: {
      protocolItemId: "item-brucelose",
      productId: "produto-b19",
      productName: "Vacina B19",
      productClass: "vacina_brucelose",
      actionType: "vacinacao",
    },
    ...overrides,
  };
}

describe("sanitaryDemand", () => {
  it("agrupa animais por protocolo e lote", () => {
    const groups = createSanitaryDemandGroupsFromEligibilityResults({
      entries: [
        entry({ animal: animal({ id: "animal-2" }) }),
        entry({ animal: animal({ id: "animal-1" }) }),
        entry({ animal: animal({ id: "animal-3", loteId: "lote-2", loteName: "Lote 2" }) }),
      ],
    });

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      protocolRuleId: "brucelose-b19",
      loteId: "lote-1",
      loteName: "Bezerras 2026",
      statusSummary: expect.objectContaining({ total: 2, inActionWindow: 2 }),
    });
    expect(groups[0].animalIdsByStatus.in_action_window).toEqual(["animal-1", "animal-2"]);
    expect(groups[1]).toMatchObject({
      loteId: "lote-2",
      statusSummary: expect.objectContaining({ total: 1, inActionWindow: 1 }),
    });
  });

  it("agrupa por item, produto e classe quando disponiveis", () => {
    const groups = createSanitaryDemandGroupsFromEligibilityResults({
      entries: [
        entry(),
        entry({
          metadata: {
            protocolItemId: "item-raiva",
            productId: "produto-raiva",
            productName: "Vacina Raiva",
            productClass: "vacina_raiva",
            actionType: "vacinacao",
          },
        }),
      ],
    });

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.productId)).toEqual(["produto-b19", "produto-raiva"]);
    expect(groups.map((group) => group.productClass)).toEqual([
      "vacina_brucelose",
      "vacina_raiva",
    ]);
  });

  it("separa grupos por janela diferente", () => {
    const groups = createSanitaryDemandGroupsFromEligibilityResults({
      entries: [
        entry(),
        entry({
          animal: animal({ id: "animal-2" }),
          eligibility: eligibility({
            window: {
              startDate: "2026-05-01",
              endDate: "2026-09-28",
            },
          }),
        }),
      ],
    });

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.windowStart)).toEqual(["2026-04-01", "2026-05-01"]);
  });

  it("nao fragmenta grupo quando apenas nomes de lote ou produto divergem para o mesmo id", () => {
    const groups = createSanitaryDemandGroupsFromEligibilityResults({
      entries: [
        entry({
          animal: animal({
            id: "animal-1",
            loteId: "lote-1",
            loteName: "Bezerras 2026",
          }),
          metadata: {
            protocolItemId: "item-brucelose",
            productId: "produto-b19",
            productName: "Vacina B19",
            productClass: "vacina_brucelose",
            actionType: "vacinacao",
          },
        }),
        entry({
          animal: animal({
            id: "animal-2",
            loteId: "lote-1",
            loteName: "Bezerras",
          }),
          metadata: {
            protocolItemId: "item-brucelose",
            productId: "produto-b19",
            productName: "B19",
            productClass: "vacina_brucelose",
            actionType: "vacinacao",
          },
        }),
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].statusSummary.total).toBe(2);
    expect(groups[0].animalIdsByStatus.in_action_window).toEqual(["animal-1", "animal-2"]);
  });

  it("preserva insufficient_data e nao inclui not_applicable em acionaveis", () => {
    const groups = createSanitaryDemandGroupsFromEligibilityResults({
      entries: [
        entry({
          animal: animal({ id: "animal-cadastro" }),
          eligibility: eligibility({
            status: "insufficient_data",
            limitations: ["missing_birth_date"],
            window: undefined,
          }),
        }),
        entry({
          animal: animal({ id: "animal-fora" }),
          eligibility: eligibility({ status: "not_applicable", window: undefined }),
        }),
      ],
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].statusSummary).toMatchObject({
      total: 2,
      insufficientData: 1,
      notApplicable: 1,
    });
    expect(groups[0].animalIdsByStatus.insufficient_data).toEqual(["animal-cadastro"]);
    expect(groups[0].animalIdsByStatus.not_applicable).toEqual(["animal-fora"]);
    expect(groups[0].actionableAnimalIds).toEqual([]);
    expect(groups[0].limitations).toEqual(["missing_birth_date"]);
  });

  it("soma completed, overdue, near_deadline, in_action_window e eligible_soon", () => {
    const groups = createSanitaryDemandGroupsFromEligibilityResults({
      entries: [
        entry({ animal: animal({ id: "completed" }), eligibility: eligibility({ status: "completed" }) }),
        entry({ animal: animal({ id: "overdue" }), eligibility: eligibility({ status: "overdue" }) }),
        entry({
          animal: animal({ id: "near-deadline" }),
          eligibility: eligibility({ status: "near_deadline" }),
        }),
        entry({
          animal: animal({ id: "in-window" }),
          eligibility: eligibility({ status: "in_action_window" }),
        }),
        entry({
          animal: animal({ id: "eligible-soon" }),
          eligibility: eligibility({ status: "eligible_soon" }),
        }),
      ],
    });

    expect(groups[0].statusSummary).toMatchObject({
      total: 5,
      completed: 1,
      overdue: 1,
      nearDeadline: 1,
      inActionWindow: 1,
      eligibleSoon: 1,
    });
    expect(groups[0].actionableAnimalIds).toEqual([
      "eligible-soon",
      "in-window",
      "near-deadline",
      "overdue",
    ]);
  });

  it("preserva e deduplica limitacoes agregadas", () => {
    const groups = createSanitaryDemandGroupsFromEligibilityResults({
      entries: [
        entry({
          animal: animal({ id: "animal-1" }),
          eligibility: eligibility({
            status: "insufficient_data",
            limitations: ["missing_birth_date", "estimated_age"],
          }),
        }),
        entry({
          animal: animal({ id: "animal-2" }),
          eligibility: eligibility({
            status: "insufficient_data",
            limitations: ["estimated_age", "missing_sex"],
          }),
        }),
      ],
    });

    expect(groups[0].limitations).toEqual([
      "estimated_age",
      "missing_birth_date",
      "missing_sex",
    ]);
  });

  it("mantem saida deterministica", () => {
    const groups = createSanitaryDemandGroupsFromEligibilityResults({
      entries: [
        entry({ animal: animal({ id: "z", loteId: "lote-b", loteName: "B" }) }),
        entry({ animal: animal({ id: "b" }) }),
        entry({ animal: animal({ id: "a" }) }),
      ],
    });

    expect(groups.map((group) => group.loteId)).toEqual(["lote-1", "lote-b"]);
    expect(groups[0].animalIdsByStatus.in_action_window).toEqual(["a", "b"]);
  });

  it("calcula demanda chamando o motor puro com referenceDate explicita", () => {
    const groups = computeSanitaryDemandGroups({
      animals: [
        animal({ id: "em-janela", birthDate: "2026-01-01" }),
        animal({ id: "concluido", birthDate: "2026-01-01" }),
      ],
      protocolRules: [protocolRule],
      executedEvents: [
        {
          id: "evento-1",
          animalId: "concluido",
          occurredAt: "2026-04-10",
          productClass: "vacina_brucelose",
        },
      ],
      referenceDate: "2026-05-01",
      metadataByProtocolRuleId: {
        "brucelose-b19": {
          protocolItemId: "item-brucelose",
          productName: "Vacina B19",
          actionType: "vacinacao",
        },
      },
    });

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.statusSummary)).toEqual([
      expect.objectContaining({
        total: 1,
        completed: 1,
      }),
      expect.objectContaining({
        total: 1,
        inActionWindow: 1,
      }),
    ]);
    expect(groups[0].source).toEqual({
      protocolSource: "SanitaryProtocolRule",
      eligibilitySource: "computeSanitaryEligibility",
      materialization: "none",
    });
  });

  it("nao cria agenda ou evento", () => {
    const groups = createSanitaryDemandGroupsFromEligibilityResults({
      entries: [entry()],
    });

    expect(groups[0].source.materialization).toBe("none");
    expect(groups[0]).not.toHaveProperty("agendaId");
    expect(groups[0]).not.toHaveProperty("eventId");
  });

  it("nao muta inputs", () => {
    const input = {
      entries: [
        entry({
          animal: animal({ id: "animal-2" }),
          eligibility: eligibility({ limitations: ["estimated_age"] }),
        }),
      ],
    };
    const snapshot = JSON.stringify(input);

    createSanitaryDemandGroupsFromEligibilityResults(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("modulo nao usa Supabase, Dexie, React, UI, storage ou Date.now", () => {
    const moduleSource = readFileSync(resolve(__dirname, "../sanitaryDemand.ts"), "utf8");

    expect(moduleSource).not.toMatch(/from ["']@\/lib\/supabase["']/);
    expect(moduleSource).not.toMatch(/from ["']dexie["']/i);
    expect(moduleSource).not.toMatch(/from ["']react["']/i);
    expect(moduleSource).not.toMatch(/from ["']@\/pages\//);
    expect(moduleSource).not.toMatch(/from ["']@\/components\//);
    expect(moduleSource).not.toMatch(/from ["']@\/lib\/agenda/);
    expect(moduleSource).not.toMatch(/Date\.now\(/);
    expect(moduleSource).not.toMatch(/localStorage|sessionStorage|storage|rpc\(/i);
  });
});
