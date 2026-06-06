import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { SanitaryPreviewGroup } from "../../preview/sanitaryOperationalPreview";
import { createSanitaryAgendaMaterializationCommands } from "../sanitaryAgendaMaterialization";

function previewGroup(overrides: Partial<SanitaryPreviewGroup> = {}): SanitaryPreviewGroup {
  return {
    previewGroupId:
      "sanitary-preview|protocol:brucelose-b19|item:item-brucelose|product:produto-b19|class:vacina_brucelose|action:vacinacao|lote:lote-1|start:2026-04-01|end:2026-08-29",
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
    suggestedExecutionDate: "2026-05-01",
    actionableAnimalIds: ["animal-2", "animal-1"],
    editableFields: {
      executionDate: true,
      responsibleId: true,
      notes: true,
    },
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
    ...overrides,
  };
}

describe("createSanitaryAgendaMaterializationCommands", () => {
  it("cria comando de agenda a partir de preview acionavel", () => {
    const result = createSanitaryAgendaMaterializationCommands({
      referenceDate: "2026-05-01",
      previewGroups: [previewGroup()],
    });

    expect(result.commands).toHaveLength(1);
    expect(result.rejected).toEqual([]);
    expect(result.commands[0]).toMatchObject({
      domain: "sanitario",
      materializationType: "agenda_intent",
      protocolRuleId: "brucelose-b19",
      protocolItemId: "item-brucelose",
      productId: "produto-b19",
      productClass: "vacina_brucelose",
      actionType: "vacinacao",
      loteId: "lote-1",
      animalIds: ["animal-1", "animal-2"],
      scheduledDate: "2026-05-01",
      source: {
        previewGroupId:
          "sanitary-preview|protocol:brucelose-b19|item:item-brucelose|product:produto-b19|class:vacina_brucelose|action:vacinacao|lote:lote-1|start:2026-04-01|end:2026-08-29",
        sourceType: "SanitaryOperationalPreview",
        materialization: "agenda",
      },
    });
    expect(result.summary).toEqual({
      totalPreviewGroups: 1,
      commands: 1,
      rejected: 0,
      totalAnimals: 2,
    });
  });

  it("nao cria comando para grupo sem animais", () => {
    const result = createSanitaryAgendaMaterializationCommands({
      referenceDate: "2026-05-01",
      previewGroups: [previewGroup({ actionableAnimalIds: [] })],
    });

    expect(result.commands).toEqual([]);
    expect(result.rejected).toEqual([
      {
        previewGroupId:
          "sanitary-preview|protocol:brucelose-b19|item:item-brucelose|product:produto-b19|class:vacina_brucelose|action:vacinacao|lote:lote-1|start:2026-04-01|end:2026-08-29",
        reason: "empty_animal_ids",
        sourceDemandKey: previewGroup().sourceDemandKey,
      },
    ]);
  });

  it("rejeita grupo sem scheduledDate", () => {
    const result = createSanitaryAgendaMaterializationCommands({
      referenceDate: "2026-05-01",
      previewGroups: [previewGroup({ suggestedExecutionDate: undefined })],
    });

    expect(result.commands).toEqual([]);
    expect(result.rejected[0].reason).toBe("missing_scheduled_date");
  });

  it("aceita override de data, responsavel e observacao", () => {
    const group = previewGroup();
    const result = createSanitaryAgendaMaterializationCommands({
      referenceDate: "2026-05-01",
      previewGroups: [group],
      overridesByPreviewGroupId: {
        [group.previewGroupId]: {
          scheduledDate: "2026-06-10",
          responsibleId: "user-1",
          notes: "Manejo em tronco coletivo",
        },
      },
    });

    expect(result.commands[0]).toMatchObject({
      scheduledDate: "2026-06-10",
      responsibleId: "user-1",
      notes: "Manejo em tronco coletivo",
    });
    expect(result.commands[0].dedupKey).toContain("date:2026-06-10");
  });

  it("rejeita override fora da janela", () => {
    const group = previewGroup();
    const result = createSanitaryAgendaMaterializationCommands({
      referenceDate: "2026-05-01",
      previewGroups: [group],
      overridesByPreviewGroupId: {
        [group.previewGroupId]: {
          scheduledDate: "2026-09-01",
        },
      },
    });

    expect(result.commands).toEqual([]);
    expect(result.rejected[0].reason).toBe("scheduled_date_outside_window");
  });

  it("rejeita scheduledDate invalida", () => {
    const group = previewGroup();
    const result = createSanitaryAgendaMaterializationCommands({
      referenceDate: "2026-05-01",
      previewGroups: [group],
      overridesByPreviewGroupId: {
        [group.previewGroupId]: {
          scheduledDate: "2026-99-99",
        },
      },
    });

    expect(result.commands).toEqual([]);
    expect(result.rejected[0].reason).toBe("invalid_scheduled_date");
  });

  it("rejeita dia inexistente em scheduledDate", () => {
    const group = previewGroup();
    const result = createSanitaryAgendaMaterializationCommands({
      referenceDate: "2026-05-01",
      previewGroups: [group],
      overridesByPreviewGroupId: {
        [group.previewGroupId]: {
          scheduledDate: "2026-02-31",
        },
      },
    });

    expect(result.commands).toEqual([]);
    expect(result.rejected[0].reason).toBe("invalid_scheduled_date");
  });

  it("nao usa productName ou loteName na dedupKey", () => {
    const first = createSanitaryAgendaMaterializationCommands({
      referenceDate: "2026-05-01",
      previewGroups: [
        previewGroup({
          productName: "Vacina B19",
          loteName: "Bezerras 2026",
        }),
      ],
    });
    const second = createSanitaryAgendaMaterializationCommands({
      referenceDate: "2026-05-01",
      previewGroups: [
        previewGroup({
          productName: "B19 renomeada",
          loteName: "Bezerras renomeadas",
        }),
      ],
    });

    expect(first.commands[0].dedupKey).toBe(second.commands[0].dedupKey);
    expect(first.commands[0].dedupKey).not.toContain("Vacina B19");
    expect(first.commands[0].dedupKey).not.toContain("Bezerras 2026");
  });

  it("separa productId e productClass na dedupKey", () => {
    const result = createSanitaryAgendaMaterializationCommands({
      referenceDate: "2026-05-01",
      previewGroups: [
        previewGroup({
          previewGroupId: "product-id-group",
          protocolItemId: "item-produto",
          productId: "vacina_brucelose",
          productClass: null,
        }),
        previewGroup({
          previewGroupId: "product-class-group",
          protocolItemId: "item-classe",
          productId: null,
          productClass: "vacina_brucelose",
        }),
      ],
    });

    expect(result.commands.map((command) => command.dedupKey)).toEqual([
      expect.stringContaining("item:item-classe|product:none|class:vacina_brucelose"),
      expect.stringContaining("item:item-produto|product:vacina_brucelose|class:none"),
    ]);
  });

  it("ordena animais e comandos de forma deterministica", () => {
    const result = createSanitaryAgendaMaterializationCommands({
      referenceDate: "2026-05-01",
      previewGroups: [
        previewGroup({
          previewGroupId: "z-group",
          protocolRuleId: "z-protocolo",
          actionableAnimalIds: ["z", "y"],
        }),
        previewGroup({
          previewGroupId: "a-group",
          protocolRuleId: "a-protocolo",
          actionableAnimalIds: ["b", "a"],
        }),
      ],
    });

    expect(result.commands.map((command) => command.protocolRuleId)).toEqual([
      "a-protocolo",
      "z-protocolo",
    ]);
    expect(result.commands[0].animalIds).toEqual(["a", "b"]);
    expect(result.commands[1].animalIds).toEqual(["y", "z"]);
  });

  it("preserva vinculo com previewGroupId e sourceDemandKey", () => {
    const group = previewGroup({
      previewGroupId: "preview-1",
      sourceDemandKey: "demand-key-1",
    });
    const result = createSanitaryAgendaMaterializationCommands({
      referenceDate: "2026-05-01",
      previewGroups: [group],
    });

    expect(result.commands[0].source).toEqual({
      previewGroupId: "preview-1",
      sourceDemandKey: "demand-key-1",
      sourceType: "SanitaryOperationalPreview",
      materialization: "agenda",
    });
  });

  it("nao cria evento, estoque ou carencia", () => {
    const result = createSanitaryAgendaMaterializationCommands({
      referenceDate: "2026-05-01",
      previewGroups: [previewGroup()],
    });

    expect(result.source).toEqual({
      previewSource: "SanitaryOperationalPreview",
      creates: "agenda_intent",
      createsEvent: false,
      createsInventoryMovement: false,
    });
    expect(result).not.toHaveProperty("eventId");
    expect(result.commands[0]).not.toHaveProperty("eventId");
    expect(result.commands[0]).not.toHaveProperty("inventoryMovementId");
    expect(result.commands[0]).not.toHaveProperty("withdrawal");
  });

  it("aceita SanitaryOperationalPreview como entrada", () => {
    const result = createSanitaryAgendaMaterializationCommands({
      referenceDate: "2026-05-01",
      preview: {
        referenceDate: "2026-05-01",
        groups: [previewGroup()],
        blocked: [],
        summary: {
          totalGroups: 1,
          actionableGroups: 1,
          blockedGroups: 0,
          totalAnimals: 2,
          actionableAnimals: 2,
          blockedAnimals: 0,
        },
        source: {
          demandSource: "SanitaryDemandGroup",
          materialization: "none",
        },
      },
    });

    expect(result.commands).toHaveLength(1);
  });

  it("nao muta inputs", () => {
    const input = {
      referenceDate: "2026-05-01",
      previewGroups: [previewGroup()],
    };
    const snapshot = JSON.stringify(input);

    createSanitaryAgendaMaterializationCommands(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("modulo nao usa Supabase, Dexie, React, UI, RPC, storage ou Date.now", () => {
    const moduleSource = readFileSync(
      resolve(__dirname, "../sanitaryAgendaMaterialization.ts"),
      "utf8",
    );

    expect(moduleSource).not.toMatch(/from ["']@\/lib\/supabase["']/);
    expect(moduleSource).not.toMatch(/from ["']dexie["']/i);
    expect(moduleSource).not.toMatch(/from ["']react["']/i);
    expect(moduleSource).not.toMatch(/from ["']@\/pages\//);
    expect(moduleSource).not.toMatch(/from ["']@\/components\//);
    expect(moduleSource).not.toMatch(/Date\.now\(/);
    expect(moduleSource).not.toMatch(/localStorage|sessionStorage|storage|rpc\(/i);
  });
});
