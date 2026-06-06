import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { SanitaryEventExecutionCommand } from "../../execution/sanitaryEventExecution";
import type { SanitaryAgendaMaterializationCommand } from "../sanitaryAgendaMaterialization";
import { createSanitaryAgendaClosureCommand } from "../sanitaryAgendaClosure";

function agendaCommand(
  overrides: Partial<SanitaryAgendaMaterializationCommand> = {},
): SanitaryAgendaMaterializationCommand {
  return {
    dedupKey:
      "sanitario-agenda-v2|protocol:brucelose-b19|item:item-brucelose|product:produto-b19|class:vacina_brucelose|action:vacinacao|lote:lote-1|date:2026-05-01|start:2026-04-01|end:2026-08-29|animals:animal-1,animal-2",
    domain: "sanitario",
    materializationType: "agenda_intent",
    protocolRuleId: "brucelose-b19",
    protocolName: "Brucelose B19",
    protocolItemId: "item-brucelose",
    productId: "produto-b19",
    productName: "Vacina B19",
    productClass: "vacina_brucelose",
    actionType: "vacinacao",
    loteId: "lote-1",
    loteName: "Bezerras 2026",
    animalIds: ["animal-2", "animal-1"],
    scheduledDate: "2026-05-01",
    windowStart: "2026-04-01",
    windowEnd: "2026-08-29",
    responsibleId: "user-agenda",
    notes: "Planejado no preview",
    source: {
      previewGroupId: "preview-1",
      sourceDemandKey: "demand-1",
      sourceType: "SanitaryOperationalPreview",
      materialization: "agenda",
    },
    ...overrides,
  };
}

function eventExecutionCommand(
  overrides: Partial<SanitaryEventExecutionCommand> = {},
): SanitaryEventExecutionCommand {
  return {
    dedupKey:
      "sanitario-event-execution-v1|agenda:sanitario-agenda-v2|protocol:brucelose-b19|item:item-brucelose|product:produto-b19|class:vacina_brucelose|action:vacinacao|lote:lote-1|occurred:2026-05-01|animals:animal-1,animal-2",
    domain: "sanitario",
    executionType: "event_fact",
    eventIntentType: "sanitary_execution",
    occurredAt: "2026-05-01",
    protocolRuleId: "brucelose-b19",
    protocolName: "Brucelose B19",
    protocolItemId: "item-brucelose",
    actionType: "vacinacao",
    loteId: "lote-1",
    loteName: "Bezerras 2026",
    executedAnimalIds: ["animal-2", "animal-1"],
    notExecutedAnimals: [],
    product: {
      productId: "produto-b19",
      productName: "Vacina B19",
      productClass: "vacina_brucelose",
      doseQuantity: 1,
      doseUnit: "dose",
      route: "subcutanea",
      inventoryLotId: "estoque-lote-1",
    },
    responsibleId: "user-1",
    responsibleName: "Maria",
    notes: "Executado no curral",
    source: {
      sourceType: "SanitaryAgendaMaterializationCommand",
      agendaDedupKey: agendaCommand().dedupKey,
      previewGroupId: "preview-1",
      sourceDemandKey: "demand-1",
      createsAgenda: false,
      closesAgenda: false,
      persistsEvent: false,
      createsInventoryMovement: false,
    },
    ...overrides,
  };
}

describe("createSanitaryAgendaClosureCommand", () => {
  it("cria fechamento executed_with_event com evento compativel", () => {
    const result = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand(),
      closureType: "executed_with_event",
      eventExecutionCommand: eventExecutionCommand(),
      closedAt: "2026-05-01T11:00:00Z",
      closedBy: "user-1",
    });

    expect(result.rejected).toEqual([]);
    expect(result.command).toMatchObject({
      domain: "sanitario",
      commandType: "agenda_closure_intent",
      agendaDedupKey: agendaCommand().dedupKey,
      closureType: "executed_with_event",
      closedAt: "2026-05-01T11:00:00.000Z",
      closedBy: "user-1",
      plannedAnimalIds: ["animal-1", "animal-2"],
      executedAnimalIds: ["animal-1", "animal-2"],
      notExecutedAnimals: [],
      source: {
        agendaSource: "SanitaryAgendaMaterializationCommand",
        eventSource: "SanitaryEventExecutionCommand",
        eventDedupKey: eventExecutionCommand().dedupKey,
        previewGroupId: "preview-1",
        sourceDemandKey: "demand-1",
        createsEvent: false,
        persistsEvent: false,
        createsInventoryMovement: false,
        calculatesWithdrawal: false,
        createsHistoricalFact: false,
      },
    });
    expect(result.source).toEqual({
      creates: "agenda_closure_intent",
      createsEvent: false,
      persistsEvent: false,
      createsHistoricalFact: false,
      createsInventoryMovement: false,
      calculatesWithdrawal: false,
    });
  });

  it("rejeita executed_with_event sem evento", () => {
    const result = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand(),
      closureType: "executed_with_event",
      closedAt: "2026-05-01",
    });

    expect(result.command).toBeNull();
    expect(result.rejected).toContainEqual({ reason: "missing_event_for_executed_closure" });
  });

  it("rejeita evento cujo agendaDedupKey nao corresponde a agenda", () => {
    const result = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand(),
      closureType: "executed_with_event",
      eventExecutionCommand: eventExecutionCommand({
        source: {
          ...eventExecutionCommand().source,
          agendaDedupKey: "outra-agenda",
        },
      }),
      closedAt: "2026-05-01",
    });

    expect(result.command).toBeNull();
    expect(result.rejected).toContainEqual({ reason: "event_does_not_match_agenda" });
  });

  it("rejeita executed_with_event se houver animal planejado nao executado", () => {
    const result = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand(),
      closureType: "executed_with_event",
      eventExecutionCommand: eventExecutionCommand({
        executedAnimalIds: ["animal-1"],
        notExecutedAnimals: [{ animalId: "animal-2", reason: "Nao estava no curral" }],
      }),
      closedAt: "2026-05-01",
    });

    expect(result.command).toBeNull();
    expect(result.rejected).toContainEqual({
      reason: "missing_non_execution_reason",
      animalId: "animal-2",
    });
  });

  it("cria fechamento partially_executed_with_event com motivo para nao executados", () => {
    const result = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand(),
      closureType: "partially_executed_with_event",
      eventExecutionCommand: eventExecutionCommand({
        executedAnimalIds: ["animal-1"],
        notExecutedAnimals: [{ animalId: "animal-2", reason: "Animal nao estava no curral" }],
      }),
      closedAt: "2026-05-01",
    });

    expect(result.rejected).toEqual([]);
    expect(result.command?.executedAnimalIds).toEqual(["animal-1"]);
    expect(result.command?.notExecutedAnimals).toEqual([
      {
        animalId: "animal-2",
        reason: "Animal nao estava no curral",
      },
    ]);
    expect(result.command?.source.createsHistoricalFact).toBe(false);
  });

  it("rejeita parcial sem motivo para animal nao executado", () => {
    const result = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand(),
      closureType: "partially_executed_with_event",
      eventExecutionCommand: eventExecutionCommand({
        executedAnimalIds: ["animal-1"],
        notExecutedAnimals: [],
      }),
      closedAt: "2026-05-01",
    });

    expect(result.command).toBeNull();
    expect(result.rejected).toContainEqual({
      reason: "missing_non_execution_reason",
      animalId: "animal-2",
    });
  });

  it("cria closed_without_execution com motivo", () => {
    const result = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand(),
      closureType: "closed_without_execution",
      reason: "Manejo substituido por novo planejamento",
      closedAt: "2026-05-01",
    });

    expect(result.rejected).toEqual([]);
    expect(result.command).toMatchObject({
      closureType: "closed_without_execution",
      reason: "Manejo substituido por novo planejamento",
      executedAnimalIds: [],
      notExecutedAnimals: [
        { animalId: "animal-1", reason: "" },
        { animalId: "animal-2", reason: "" },
      ],
      source: {
        createsHistoricalFact: false,
        createsEvent: false,
      },
    });
  });

  it("rejeita closed_without_execution sem motivo", () => {
    const result = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand(),
      closureType: "closed_without_execution",
      closedAt: "2026-05-01",
    });

    expect(result.command).toBeNull();
    expect(result.rejected).toContainEqual({ reason: "missing_reason" });
  });

  it("rejeita evento em fechamento sem execucao", () => {
    const result = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand(),
      closureType: "closed_without_execution",
      eventExecutionCommand: eventExecutionCommand(),
      reason: "Nao sera executado",
      closedAt: "2026-05-01",
    });

    expect(result.command).toBeNull();
    expect(result.rejected).toContainEqual({
      reason: "event_not_allowed_for_closure_type",
    });
  });

  it("rejeita animal executado fora do escopo planejado no fechamento", () => {
    const event = eventExecutionCommand({
      executedAnimalIds: ["animal-1", "animal-3"],
      notExecutedAnimals: [{ animalId: "animal-2", reason: "Nao estava no curral" }],
    });

    const result = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand(),
      closureType: "partially_executed_with_event",
      eventExecutionCommand: event,
      closedAt: "2026-05-01",
    });

    expect(result.command).toBeNull();
    expect(result.rejected).toContainEqual({
      reason: "executed_animal_outside_planned_scope",
      animalId: "animal-3",
    });
  });

  it("rejeita fechamento parcial quando todos os animais planejados foram executados", () => {
    const result = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand(),
      closureType: "partially_executed_with_event",
      eventExecutionCommand: eventExecutionCommand({
        executedAnimalIds: ["animal-1", "animal-2"],
        notExecutedAnimals: [],
      }),
      closedAt: "2026-05-01",
    });

    expect(result.command).toBeNull();
    expect(result.rejected).toContainEqual({
      reason: "partial_closure_without_not_executed_animals",
    });
  });

  it("cria cancelled com motivo", () => {
    const result = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand(),
      closureType: "cancelled",
      reason: "Erro de planejamento",
      closedAt: "2026-05-01",
    });

    expect(result.rejected).toEqual([]);
    expect(result.command?.closureType).toBe("cancelled");
    expect(result.command?.reason).toBe("Erro de planejamento");
  });

  it("cria dismissed com motivo", () => {
    const result = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand(),
      closureType: "dismissed",
      reason: "Responsavel tecnico dispensou o manejo",
      closedAt: "2026-05-01",
    });

    expect(result.rejected).toEqual([]);
    expect(result.command?.closureType).toBe("dismissed");
    expect(result.command?.reason).toBe("Responsavel tecnico dispensou o manejo");
  });

  it("rejeita closedAt ausente ou invalido", () => {
    const missing = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand(),
      closureType: "cancelled",
      reason: "Erro",
      closedAt: "",
    });
    const invalid = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand(),
      closureType: "cancelled",
      reason: "Erro",
      closedAt: "2026-02-31",
    });

    expect(missing.rejected).toContainEqual({ reason: "missing_closed_at" });
    expect(invalid.rejected).toContainEqual({ reason: "invalid_closed_at" });
  });

  it("dedupKey nao usa productName nem loteName", () => {
    const first = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand({ productName: "Vacina B19", loteName: "Bezerras 2026" }),
      closureType: "executed_with_event",
      eventExecutionCommand: eventExecutionCommand(),
      closedAt: "2026-05-01",
    });
    const second = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand({ productName: "B19 renomeada", loteName: "Lote novo" }),
      closureType: "executed_with_event",
      eventExecutionCommand: eventExecutionCommand(),
      closedAt: "2026-05-01",
    });

    expect(first.command?.dedupKey).toBe(second.command?.dedupKey);
    expect(first.command?.dedupKey).not.toContain("Vacina B19");
    expect(first.command?.dedupKey).not.toContain("Bezerras 2026");
  });

  it("mantem saida deterministica", () => {
    const first = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand({ animalIds: ["animal-2", "animal-1"] }),
      closureType: "executed_with_event",
      eventExecutionCommand: eventExecutionCommand({ executedAnimalIds: ["animal-2", "animal-1"] }),
      closedAt: "2026-05-01",
    });
    const second = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand({ animalIds: ["animal-1", "animal-2"] }),
      closureType: "executed_with_event",
      eventExecutionCommand: eventExecutionCommand({ executedAnimalIds: ["animal-1", "animal-2"] }),
      closedAt: "2026-05-01",
    });

    expect(first.command).toEqual(second.command);
  });

  it("nao muta inputs", () => {
    const input = {
      agendaCommand: agendaCommand(),
      closureType: "partially_executed_with_event" as const,
      eventExecutionCommand: eventExecutionCommand({
        executedAnimalIds: ["animal-1"],
        notExecutedAnimals: [{ animalId: "animal-2", reason: "Nao manejado" }],
      }),
      closedAt: "2026-05-01",
    };
    const snapshot = JSON.stringify(input);

    createSanitaryAgendaClosureCommand(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("modulo nao usa Supabase, Dexie, React, UI, RPC, storage ou Date.now", () => {
    const moduleSource = readFileSync(resolve(__dirname, "../sanitaryAgendaClosure.ts"), "utf8");

    expect(moduleSource).not.toMatch(/from ["']@\/lib\/supabase["']/);
    expect(moduleSource).not.toMatch(/from ["']dexie["']/i);
    expect(moduleSource).not.toMatch(/from ["']react["']/i);
    expect(moduleSource).not.toMatch(/from ["']@\/pages\//);
    expect(moduleSource).not.toMatch(/from ["']@\/components\//);
    expect(moduleSource).not.toMatch(/Date\.now\(/);
    expect(moduleSource).not.toMatch(/localStorage|sessionStorage|storage|rpc\(/i);
  });

  it("resultado declara que nao cria fato historico", () => {
    const result = createSanitaryAgendaClosureCommand({
      agendaCommand: agendaCommand(),
      closureType: "cancelled",
      reason: "Erro de planejamento",
      closedAt: "2026-05-01",
    });

    expect(result.source.createsHistoricalFact).toBe(false);
    expect(result.command?.source.createsHistoricalFact).toBe(false);
  });
});
