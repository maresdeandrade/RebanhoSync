import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeSanitaryEligibility,
  type ComputeSanitaryEligibilityInput,
  type SanitaryEligibilityAnimal,
  type SanitaryExecutedEvent,
  type SanitaryEligibilityProtocolRule,
} from "../sanitaryEligibility";

const protocolRule: SanitaryEligibilityProtocolRule = {
  id: "brucelose-b19",
  name: "Brucelose B19",
  applicability: {
    sex: "F",
    species: "bovina",
  },
  eligibilityWindow: {
    start: { anchor: "nascimento", offsetDays: 90 },
    end: { anchor: "nascimento", offsetDays: 240 },
    permissibility: "allowed",
    sourceRefs: [
      {
        kind: "norma_oficial",
        title: "Norma oficial",
        fieldKeys: ["eligibilityWindow"],
      },
    ],
  },
  completionCriteria: {
    requiresExecutedEvent: true,
    compatibleProductClass: "vacina_brucelose",
    requiredDoseCount: 1,
    sourceRefs: [
      {
        kind: "norma_oficial",
        title: "Norma oficial",
        fieldKeys: ["completionCriteria"],
      },
    ],
  },
  productRequirement: {
    kind: "product_class",
    classKey: "vacina_brucelose",
    sourceRefs: [
      {
        kind: "norma_oficial",
        title: "Norma oficial",
        fieldKeys: ["productRequirement"],
      },
    ],
  },
};

const animal: SanitaryEligibilityAnimal = {
  id: "animal-1",
  birthDate: "2026-01-01",
  sex: "F",
  species: "bovina",
  loteId: "lote-1",
};

function input(
  overrides: Partial<ComputeSanitaryEligibilityInput> = {},
): ComputeSanitaryEligibilityInput {
  return {
    animal,
    protocolRule,
    executedEvents: [],
    referenceDate: "2026-01-01",
    ...overrides,
  };
}

function compatibleEvent(overrides: Partial<SanitaryExecutedEvent> = {}): SanitaryExecutedEvent {
  return {
    id: "event-1",
    animalId: "animal-1",
    occurredAt: "2026-04-10",
    productClass: "vacina_brucelose",
    ...overrides,
  };
}

describe("computeSanitaryEligibility", () => {
  it("antes da janela retorna not_yet_eligible", () => {
    const result = computeSanitaryEligibility(input({ referenceDate: "2026-02-01" }));

    expect(result.status).toBe("not_yet_eligible");
    expect(result.window).toEqual({
      startDate: "2026-04-01",
      endDate: "2026-08-29",
    });
  });

  it("proximo da janela retorna eligible_soon", () => {
    const result = computeSanitaryEligibility(input({ referenceDate: "2026-03-25" }));

    expect(result.status).toBe("eligible_soon");
  });

  it("dentro da janela retorna in_action_window", () => {
    const result = computeSanitaryEligibility(input({ referenceDate: "2026-05-01" }));

    expect(result.status).toBe("in_action_window");
  });

  it("perto do limite retorna near_deadline", () => {
    const result = computeSanitaryEligibility(input({ referenceDate: "2026-08-25" }));

    expect(result.status).toBe("near_deadline");
  });

  it("apos limite sem evento retorna overdue", () => {
    const result = computeSanitaryEligibility(input({ referenceDate: "2026-09-01" }));

    expect(result.status).toBe("overdue");
  });

  it("evento sanitario compativel do mesmo animal retorna completed", () => {
    const result = computeSanitaryEligibility(
      input({
        referenceDate: "2026-09-01",
        executedEvents: [compatibleEvent()],
      }),
    );

    expect(result.status).toBe("completed");
    expect(result.matchedEventIds).toEqual(["event-1"]);
  });

  it("evento compativel de outro animal nao completa", () => {
    const result = computeSanitaryEligibility(
      input({
        referenceDate: "2026-09-01",
        executedEvents: [compatibleEvent({ animalId: "outro-animal" })],
      }),
    );

    expect(result.status).toBe("overdue");
    expect(result.matchedEventIds).toEqual([]);
  });

  it("evento futuro em relacao a referenceDate nao completa", () => {
    const result = computeSanitaryEligibility(
      input({
        referenceDate: "2026-04-01",
        executedEvents: [compatibleEvent({ occurredAt: "2026-04-10" })],
      }),
    );

    expect(result.status).toBe("in_action_window");
    expect(result.matchedEventIds).toEqual([]);
  });

  it("evento incompativel nao completa", () => {
    const result = computeSanitaryEligibility(
      input({
        referenceDate: "2026-09-01",
        executedEvents: [compatibleEvent({ productClass: "vacina_raiva" })],
      }),
    );

    expect(result.status).toBe("overdue");
    expect(result.matchedEventIds).toEqual([]);
  });

  it("animal fora da aplicabilidade nao completa mesmo com evento compativel", () => {
    const result = computeSanitaryEligibility(
      input({
        animal: { ...animal, sex: "M" },
        referenceDate: "2026-09-01",
        executedEvents: [compatibleEvent()],
      }),
    );

    expect(result.status).toBe("not_applicable");
    expect(result.matchedEventIds).toEqual([]);
  });

  it("evento cancelado ou deletado nao completa", () => {
    const result = computeSanitaryEligibility(
      input({
        referenceDate: "2026-09-01",
        executedEvents: [
          compatibleEvent({ id: "deleted", deletedAt: "2026-04-11T00:00:00.000Z" }),
          compatibleEvent({ id: "canceled", canceledAt: "2026-04-11T00:00:00.000Z" }),
        ],
      }),
    );

    expect(result.status).toBe("overdue");
    expect(result.matchedEventIds).toEqual([]);
  });

  it("femea sem nascimento em regra por nascimento retorna insufficient_data", () => {
    const result = computeSanitaryEligibility(
      input({
        animal: { ...animal, birthDate: null },
        referenceDate: "2026-05-01",
      }),
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.limitations).toContain("missing_birth_date");
  });

  it("birthDate invalida retorna insufficient_data e limitacao segura", () => {
    const result = computeSanitaryEligibility(
      input({
        animal: { ...animal, birthDate: "2026-02-30" },
        referenceDate: "2026-05-01",
      }),
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.limitations).toContain("invalid_birth_date");
  });

  it("animal com idade estimada retorna limitacao sem bloquear", () => {
    const result = computeSanitaryEligibility(
      input({
        animal: { ...animal, birthDateEstimated: true },
        referenceDate: "2026-05-01",
      }),
    );

    expect(result.status).toBe("in_action_window");
    expect(result.limitations).toContain("estimated_age");
  });

  it("regra sem janela retorna limitacao", () => {
    const result = computeSanitaryEligibility(
      input({
        protocolRule: {
          ...protocolRule,
          eligibilityWindow: undefined,
        },
      }),
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.limitations).toContain("missing_protocol_window");
  });

  it("animal fora da aplicabilidade retorna not_applicable", () => {
    const result = computeSanitaryEligibility(
      input({
        animal: { ...animal, sex: "M" },
        referenceDate: "2026-05-01",
      }),
    );

    expect(result.status).toBe("not_applicable");
    expect(result.limitations).toEqual([]);
  });

  it("sexo ausente quando requerido retorna insufficient_data", () => {
    const result = computeSanitaryEligibility(
      input({
        animal: { ...animal, sex: null },
        referenceDate: "2026-05-01",
      }),
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.limitations).toContain("missing_sex");
  });

  it("especie ausente quando requerida retorna insufficient_data", () => {
    const result = computeSanitaryEligibility(
      input({
        animal: { ...animal, species: null },
        referenceDate: "2026-05-01",
      }),
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.limitations).toContain("missing_species");
  });

  it("referenceDate invalida retorna limitacao segura", () => {
    const result = computeSanitaryEligibility(input({ referenceDate: "2026-02-30" }));

    expect(result.status).toBe("insufficient_data");
    expect(result.limitations).toContain("invalid_reference_date");
  });

  it("occurredAt invalido nao completa", () => {
    const result = computeSanitaryEligibility(
      input({
        referenceDate: "2026-09-01",
        executedEvents: [compatibleEvent({ occurredAt: "2026-02-30" })],
      }),
    );

    expect(result.status).toBe("overdue");
    expect(result.matchedEventIds).toEqual([]);
    expect(result.limitations).toContain("invalid_event_date");
  });

  it("requiredDoseCount maior que um exige multiplos eventos", () => {
    const result = computeSanitaryEligibility(
      input({
        referenceDate: "2026-09-01",
        protocolRule: {
          ...protocolRule,
          completionCriteria: {
            ...protocolRule.completionCriteria,
            requiredDoseCount: 2,
          },
        },
        executedEvents: [compatibleEvent()],
      }),
    );

    expect(result.status).toBe("overdue");
    expect(result.limitations).toEqual(
      expect.arrayContaining([
        "insufficient_event_history",
        "unsupported_required_dose_count",
      ]),
    );
  });

  it("requiredDoseCount maior que um com eventos genericos nao retorna completed", () => {
    const result = computeSanitaryEligibility(
      input({
        referenceDate: "2026-09-01",
        protocolRule: {
          ...protocolRule,
          completionCriteria: {
            ...protocolRule.completionCriteria,
            requiredDoseCount: 2,
          },
        },
        executedEvents: [
          compatibleEvent({ id: "dose-1", doseNumber: 1 }),
          compatibleEvent({ id: "dose-2", doseNumber: 2, occurredAt: "2026-05-10" }),
        ],
      }),
    );

    expect(result.status).toBe("overdue");
    expect(result.matchedEventIds).toEqual(["dose-1", "dose-2"]);
    expect(result.limitations).toContain("unsupported_required_dose_count");
  });

  it("ancora por evento sem criterio explicito retorna insufficient_data", () => {
    const result = computeSanitaryEligibility(
      input({
        protocolRule: {
          ...protocolRule,
          eligibilityWindow: {
            ...protocolRule.eligibilityWindow!,
            start: { anchor: "evento", offsetDays: 30 },
          },
        },
        referenceDate: "2026-05-01",
        executedEvents: [],
      }),
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.limitations).toContain("missing_anchor_event_criteria");
  });

  it("anchorEventCriteria vazio retorna insufficient_data", () => {
    const result = computeSanitaryEligibility(
      input({
        protocolRule: {
          ...protocolRule,
          anchorEventCriteria: {},
          eligibilityWindow: {
            ...protocolRule.eligibilityWindow!,
            start: { anchor: "evento", offsetDays: 30 },
          },
        },
        referenceDate: "2026-05-01",
        executedEvents: [compatibleEvent({ productClass: "vacina_raiva" })],
      }),
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.limitations).toContain("missing_anchor_event_criteria");
  });

  it("evento ancora ausente retorna insufficient_data", () => {
    const result = computeSanitaryEligibility(
      input({
        protocolRule: {
          ...protocolRule,
          anchorEventCriteria: { productClass: "vacina_raiva" },
          eligibilityWindow: {
            ...protocolRule.eligibilityWindow!,
            start: { anchor: "evento", offsetDays: 30 },
          },
        },
        referenceDate: "2026-05-01",
        executedEvents: [],
      }),
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.limitations).toContain("missing_anchor_event");
  });

  it("evento ancora ambiguo retorna insufficient_data", () => {
    const result = computeSanitaryEligibility(
      input({
        protocolRule: {
          ...protocolRule,
          anchorEventCriteria: { productClass: "vacina_raiva" },
          eligibilityWindow: {
            ...protocolRule.eligibilityWindow!,
            start: { anchor: "evento", offsetDays: 30 },
          },
        },
        referenceDate: "2026-05-20",
        executedEvents: [
          compatibleEvent({ id: "anchor-1", productClass: "vacina_raiva" }),
          compatibleEvent({
            id: "anchor-2",
            productClass: "vacina_raiva",
            occurredAt: "2026-04-20",
          }),
        ],
      }),
    );

    expect(result.status).toBe("insufficient_data");
    expect(result.limitations).toContain("ambiguous_anchor_event");
  });

  it("funcao nao usa agenda", () => {
    const result = computeSanitaryEligibility(
      input({
        referenceDate: "2026-09-01",
        // Campo estranho deve ser ignorado: conclusao depende apenas de evento executado.
        animal: { ...animal, agendaStatus: "completed" } as SanitaryEligibilityAnimal,
      }),
    );

    expect(result.status).toBe("overdue");
  });

  it("funcao nao muta inputs", () => {
    const original = input({
      referenceDate: "2026-05-01",
      executedEvents: [compatibleEvent({ productClass: "vacina_raiva" })],
    });
    const snapshot = JSON.stringify(original);

    computeSanitaryEligibility(original);

    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("thresholds alteram resultado", () => {
    const defaultResult = computeSanitaryEligibility(
      input({ referenceDate: "2026-03-10" }),
    );
    const customResult = computeSanitaryEligibility(
      input({
        referenceDate: "2026-03-10",
        thresholds: { eligibleSoonDays: 30 },
      }),
    );

    expect(defaultResult.status).toBe("not_yet_eligible");
    expect(customResult.status).toBe("eligible_soon");
  });

  it("modulo nao importa Supabase, Dexie, React, UI ou agenda", () => {
    const moduleSource = readFileSync(resolve(__dirname, "../sanitaryEligibility.ts"), "utf8");

    expect(moduleSource).not.toMatch(/from ["']@\/lib\/supabase["']/);
    expect(moduleSource).not.toMatch(/from ["']dexie["']/i);
    expect(moduleSource).not.toMatch(/from ["']react["']/i);
    expect(moduleSource).not.toMatch(/from ["']@\/pages\//);
    expect(moduleSource).not.toMatch(/from ["']@\/components\//);
    expect(moduleSource).not.toMatch(/from ["']@\/lib\/agenda/);
    expect(moduleSource).not.toMatch(/\.at\(/);
    expect(moduleSource).not.toMatch(/Date\.now\(/);
    expect(moduleSource).not.toMatch(/localStorage|sessionStorage|rpc\(/i);
  });
});
