import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { SanitaryAgendaMaterializationCommand } from "../../agenda/sanitaryAgendaMaterialization";
import { createSanitaryEventExecutionCommand } from "../sanitaryEventExecution";

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
    animalIds: ["animal-1", "animal-2"],
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

describe("createSanitaryEventExecutionCommand", () => {
  it("gera comando de execucao sanitaria como evento a partir da agenda planejada", () => {
    const result = createSanitaryEventExecutionCommand({
      occurredAt: "2026-05-01T10:30:00Z",
      agendaCommand: agendaCommand(),
      executedAnimalIds: ["animal-2", "animal-1"],
      product: {
        doseQuantity: 1,
        doseUnit: "dose",
        route: "subcutanea",
        inventoryLotId: "estoque-lote-1",
      },
      responsibleName: "Maria",
    });

    expect(result.rejected).toEqual([]);
    expect(result.command).toMatchObject({
      domain: "sanitario",
      executionType: "event_fact",
      eventIntentType: "sanitary_execution",
      occurredAt: "2026-05-01T10:30:00.000Z",
      protocolRuleId: "brucelose-b19",
      protocolItemId: "item-brucelose",
      actionType: "vacinacao",
      loteId: "lote-1",
      executedAnimalIds: ["animal-1", "animal-2"],
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
    });
    expect(result.source).toEqual({
      creates: "event_execution_intent",
      createsEvent: true,
      persistsEvent: false,
      createsAgenda: false,
      closesAgenda: false,
      createsInventoryMovement: false,
    });
  });

  it("permite execucao parcial com motivo para animais nao executados", () => {
    const result = createSanitaryEventExecutionCommand({
      occurredAt: "2026-05-01",
      agendaCommand: agendaCommand(),
      executedAnimalIds: ["animal-1"],
      nonExecutionReasonsByAnimalId: {
        "animal-2": "Animal nao estava no curral",
      },
    });

    expect(result.rejected).toEqual([]);
    expect(result.command?.notExecutedAnimals).toEqual([
      {
        animalId: "animal-2",
        reason: "Animal nao estava no curral",
      },
    ]);
  });

  it("rejeita execucao parcial sem motivo para animal previsto nao executado", () => {
    const result = createSanitaryEventExecutionCommand({
      occurredAt: "2026-05-01",
      agendaCommand: agendaCommand(),
      executedAnimalIds: ["animal-1"],
    });

    expect(result.command).toBeNull();
    expect(result.rejected).toEqual([
      {
        reason: "missing_non_execution_reason",
        animalId: "animal-2",
      },
    ]);
  });

  it("rejeita animal executado fora do escopo planejado", () => {
    const result = createSanitaryEventExecutionCommand({
      occurredAt: "2026-05-01",
      agendaCommand: agendaCommand(),
      executedAnimalIds: ["animal-1", "animal-3"],
      nonExecutionReasonsByAnimalId: {
        "animal-2": "Nao manejado",
      },
    });

    expect(result.command).toBeNull();
    expect(result.rejected).toContainEqual({
      reason: "animal_outside_planned_scope",
      animalId: "animal-3",
    });
  });

  it("rejeita data de execucao ausente ou invalida", () => {
    const missing = createSanitaryEventExecutionCommand({
      occurredAt: "",
      agendaCommand: agendaCommand(),
      executedAnimalIds: ["animal-1", "animal-2"],
    });
    const invalid = createSanitaryEventExecutionCommand({
      occurredAt: "2026-02-31",
      agendaCommand: agendaCommand(),
      executedAnimalIds: ["animal-1", "animal-2"],
    });

    expect(missing.rejected).toContainEqual({ reason: "missing_occurred_at" });
    expect(invalid.rejected).toContainEqual({ reason: "invalid_occurred_at" });
  });

  it("rejeita data-hora inexistente", () => {
    const result = createSanitaryEventExecutionCommand({
      occurredAt: "2026-02-31T10:00:00Z",
      agendaCommand: agendaCommand(),
      executedAnimalIds: ["animal-1", "animal-2"],
    });

    expect(result.command).toBeNull();
    expect(result.rejected).toContainEqual({ reason: "invalid_occurred_at" });
  });

  it("rejeita execucao sem animais ou protocolo", () => {
    const noAnimals = createSanitaryEventExecutionCommand({
      occurredAt: "2026-05-01",
      agendaCommand: agendaCommand(),
      executedAnimalIds: [],
    });
    const noProtocol = createSanitaryEventExecutionCommand({
      occurredAt: "2026-05-01",
      executedAnimalIds: ["animal-1"],
    });

    expect(noAnimals.rejected).toContainEqual({ reason: "empty_executed_animal_ids" });
    expect(noProtocol.rejected).toContainEqual({ reason: "missing_protocol" });
  });

  it("mantem dedupKey deterministica e sem depender de labels mutaveis", () => {
    const first = createSanitaryEventExecutionCommand({
      occurredAt: "2026-05-01",
      agendaCommand: agendaCommand({ productName: "Vacina B19", loteName: "Bezerras 2026" }),
      executedAnimalIds: ["animal-2", "animal-1"],
    });
    const second = createSanitaryEventExecutionCommand({
      occurredAt: "2026-05-01",
      agendaCommand: agendaCommand({ productName: "Vacina renomeada", loteName: "Lote novo" }),
      executedAnimalIds: ["animal-1", "animal-2"],
    });

    expect(first.command?.dedupKey).toBe(second.command?.dedupKey);
    expect(first.command?.dedupKey).not.toContain("Vacina B19");
    expect(first.command?.dedupKey).not.toContain("Bezerras 2026");
  });

  it("separa execucoes manuais por productId e productClass na dedupKey", () => {
    const first = createSanitaryEventExecutionCommand({
      occurredAt: "2026-05-01",
      protocolRuleId: "protocolo-1",
      protocolItemId: "item-1",
      actionType: "vacinacao",
      loteId: "lote-1",
      executedAnimalIds: ["animal-1"],
      product: {
        productId: "produto-a",
        productClass: "classe-a",
      },
    });

    const second = createSanitaryEventExecutionCommand({
      occurredAt: "2026-05-01",
      protocolRuleId: "protocolo-1",
      protocolItemId: "item-1",
      actionType: "vacinacao",
      loteId: "lote-1",
      executedAnimalIds: ["animal-1"],
      product: {
        productId: "produto-b",
        productClass: "classe-a",
      },
    });

    expect(first.command?.dedupKey).not.toBe(second.command?.dedupKey);
  });

  it("nao muta inputs", () => {
    const input = {
      occurredAt: "2026-05-01",
      agendaCommand: agendaCommand(),
      executedAnimalIds: ["animal-2", "animal-1"],
    };
    const snapshot = JSON.stringify(input);

    createSanitaryEventExecutionCommand(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("modulo nao usa Supabase, Dexie, React, UI, RPC, storage, baixa ou Date.now", () => {
    const moduleSource = readFileSync(resolve(__dirname, "../sanitaryEventExecution.ts"), "utf8");

    expect(moduleSource).not.toMatch(/from ["']@\/lib\/supabase["']/);
    expect(moduleSource).not.toMatch(/from ["']dexie["']/i);
    expect(moduleSource).not.toMatch(/from ["']react["']/i);
    expect(moduleSource).not.toMatch(/from ["']@\/pages\//);
    expect(moduleSource).not.toMatch(/from ["']@\/components\//);
    expect(moduleSource).not.toMatch(/Date\.now\(/);
    expect(moduleSource).not.toMatch(/localStorage|sessionStorage|storage|rpc\(/i);
    expect(moduleSource).not.toMatch(/insumo_movimentacoes|inventoryMovementId/);
  });
});
