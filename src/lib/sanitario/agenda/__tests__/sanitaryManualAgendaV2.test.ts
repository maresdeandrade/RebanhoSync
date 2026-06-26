import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildManualSanitaryAgendaRecordsV2,
  createManualSanitaryAgendaV2,
  type CreateManualSanitaryAgendaInputV2,
  type ManualSanitaryAgendaLocalDbV2,
} from "@/lib/sanitario/agenda/sanitaryManualAgendaV2";
import { db } from "@/lib/offline/db";
import type {
  SanitarioAgendaAnimalLocalV2,
  SanitarioAgendaLocalV2,
} from "@/lib/offline/types";

function baseInput(
  overrides: Partial<CreateManualSanitaryAgendaInputV2> = {},
): CreateManualSanitaryAgendaInputV2 {
  return {
    target: {
      scope: "animal",
      id: "animal-1",
      fazendaId: "farm-1",
    },
    source: {
      kind: "sanitary_precheck_preview_v2",
      protocolId: "protocol-b19",
      familyCode: "brucelose_b19",
      itemKey: "b19_femeas_3_8_meses",
      itemLabel: "B19 — fêmeas de 3 a 8 meses",
      protocolName: "Brucelose B19",
      precheckStatus: "in_action_window",
      reasons: ["Fêmea bovina/bubalina dentro da janela B19 de 3 a 8 meses."],
      blockers: [],
      warnings: ["Classe técnica não substitui o produto real."],
      productRequirementKind: "product_class",
      productClass: "vacina_brucelose_b19",
      productClassGroupId: null,
      productClassGroupName: null,
    },
    plannedFor: "2026-05-10",
    notes: "Planejamento manual",
    createdBy: "user-1",
    clientOpId: "op-manual-1",
    confirmed: true,
    now: "2026-05-01T10:00:00.000Z",
    ...overrides,
  };
}

function createMemoryDb(): ManualSanitaryAgendaLocalDbV2 & {
  agendas: SanitarioAgendaLocalV2[];
  animals: SanitarioAgendaAnimalLocalV2[];
} {
  const agendas: SanitarioAgendaLocalV2[] = [];
  const animals: SanitarioAgendaAnimalLocalV2[] = [];

  return {
    agendas,
    animals,
    ops_sanitario_agenda_v2: {
      where: () => ({
        equals: (clientOpId: string) => ({
          first: async () =>
            agendas.find((agenda) => agenda.client_op_id === clientOpId),
        }),
      }),
      put: async (record) => {
        const index = agendas.findIndex((agenda) => agenda.id === record.id);
        if (index >= 0) agendas[index] = record;
        else agendas.push(record);
      },
    },
    ops_sanitario_agenda_animais_v2: {
      bulkPut: async (records) => {
        for (const record of records) {
          const index = animals.findIndex(
            (entry) =>
              entry.agenda_id === record.agenda_id &&
              entry.animal_id === record.animal_id,
          );
          if (index >= 0) animals[index] = record;
          else animals.push(record);
        }
      },
    },
    transaction: async (_mode, _stores, callback) => callback(),
  };
}

describe("sanitaryManualAgendaV2", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all([
      db.ops_sanitario_agenda_v2.clear(),
      db.ops_sanitario_agenda_animais_v2.clear(),
      db.queue_ops.clear(),
      db.event_eventos.clear(),
      db.event_eventos_sanitario.clear(),
      db.state_insumo_movimentacoes.clear(),
    ]);
  });

  afterEach(async () => {
    await Promise.all([
      db.ops_sanitario_agenda_v2.clear(),
      db.ops_sanitario_agenda_animais_v2.clear(),
      db.queue_ops.clear(),
      db.event_eventos.clear(),
      db.event_eventos_sanitario.clear(),
      db.state_insumo_movimentacoes.clear(),
    ]);
  });

  it("cria agenda futura sem evento, estoque ou carencia ativa", async () => {
    const db = createMemoryDb();

    const result = await createManualSanitaryAgendaV2(baseInput(), db);

    expect(result).toMatchObject({
      clientOpId: "op-manual-1",
      status: "scheduled",
      created: true,
      createsEvent: false,
      createsStockMovement: false,
      createsActiveWithdrawal: false,
    });
    expect(db.agendas).toHaveLength(1);
    expect(db.animals).toHaveLength(1);
    expect(db.agendas[0]).toMatchObject({
      status: "programada",
      execution_evento_id: null,
      produto_veterinario_id: null,
      data_programada: "2026-05-10",
    });
    expect(db.agendas[0].produto_snapshot).toMatchObject({
      planningOnly: true,
      realProductDefinedOnlyAtExecution: true,
      doseDefinedOnlyAtExecution: true,
      withdrawalDefinedOnlyAtExecution: true,
    });
  });

  it("e idempotente por clientOpId e nao duplica agenda", async () => {
    const db = createMemoryDb();

    const first = await createManualSanitaryAgendaV2(baseInput(), db);
    const second = await createManualSanitaryAgendaV2(baseInput(), db);

    expect(first.agendaId).toBe(second.agendaId);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(db.agendas).toHaveLength(1);
    expect(db.animals).toHaveLength(1);
  });

  it("permite atraso como agenda manual futura", async () => {
    const db = createMemoryDb();

    const result = await createManualSanitaryAgendaV2(
      baseInput({
        source: {
          ...baseInput().source,
          precheckStatus: "overdue",
          reasons: ["Animal acima da janela B19 de 3 a 8 meses."],
        },
      }),
      db,
    );

    expect(result.status).toBe("scheduled");
  });

  it("rejeita pendencia de dados, nao aplicavel, concluido e bloqueado", async () => {
    const db = createMemoryDb();

    await expect(
      createManualSanitaryAgendaV2(
        baseInput({
          source: { ...baseInput().source, precheckStatus: "insufficient_data" },
        }),
        db,
      ),
    ).rejects.toThrow("status_not_allowed");

    await expect(
      createManualSanitaryAgendaV2(
        baseInput({
          source: { ...baseInput().source, precheckStatus: "not_applicable" },
        }),
        db,
      ),
    ).rejects.toThrow("status_not_allowed");

    await expect(
      createManualSanitaryAgendaV2(
        baseInput({
          source: { ...baseInput().source, precheckStatus: "completed" },
        }),
        db,
      ),
    ).rejects.toThrow("status_not_allowed");

    await expect(
      createManualSanitaryAgendaV2(
        baseInput({
          source: {
            ...baseInput().source,
            blockers: ["Protocolo bloqueado ou retirado no catálogo sanitário v2."],
          },
        }),
        db,
      ),
    ).rejects.toThrow("blocked_item");

    expect(db.agendas).toHaveLength(0);
  });

  it("exige data planejada e confirmacao explicita", async () => {
    const db = createMemoryDb();

    await expect(
      createManualSanitaryAgendaV2(baseInput({ plannedFor: "" }), db),
    ).rejects.toThrow("missing_planned_for");

    await expect(
      createManualSanitaryAgendaV2(baseInput({ confirmed: false }), db),
    ).rejects.toThrow("missing_confirmation");
  });

  it("ProductClassGroup nao salva produto dose estoque ou carencia", () => {
    const records = buildManualSanitaryAgendaRecordsV2(
      baseInput({
        source: {
          ...baseInput().source,
          itemKey: "pre_desmama_situacional",
          itemLabel: "Vermifugação pré-desmama situacional",
          protocolName: "Vermifugação pré-desmama",
          productRequirementKind: "product_class_group",
          productClass: null,
          productClassGroupId: "grupo-tecnico-antiparasitarios",
          productClassGroupName: "Antiparasitários",
          warnings: [
            "Grupo técnico de produtos não valida execução, dose nem carência.",
            "Produto real obrigatório na execução.",
          ],
        },
      }),
    );

    expect(records.agenda.produto_veterinario_id).toBeNull();
    expect(records.agenda.produto_classe).toBeNull();
    expect(records.agenda.execution_evento_id).toBeNull();
    expect(records.agenda.metadata).toMatchObject({
      productRequirementKind: "product_class_group",
      productClass: null,
      productClassGroupId: "grupo-tecnico-antiparasitarios",
      productClassGroupName: "Antiparasitários",
      createsEvent: false,
      createsStockMovement: false,
      createsActiveWithdrawal: false,
    });
    expect(records.agenda.protocol_item_snapshot).toMatchObject({
      productRequirementKind: "product_class_group",
      productClass: null,
      productClassGroupId: "grupo-tecnico-antiparasitarios",
      productClassGroupName: "Antiparasitários",
    });
    expect(records.agenda.produto_snapshot).toMatchObject({
      planningOnly: true,
      doseDefinedOnlyAtExecution: true,
      withdrawalDefinedOnlyAtExecution: true,
      productRequirementKind: "product_class_group",
      productClassGroupId: "grupo-tecnico-antiparasitarios",
      productClassGroupName: "Antiparasitários",
    });
  });

  it("product_class persiste productClass real no snapshot", () => {
    const records = buildManualSanitaryAgendaRecordsV2(
      baseInput({
        source: {
          ...baseInput().source,
          productRequirementKind: "product_class",
          productClass: "vacina_brucelose_b19",
          productClassGroupId: null,
          productClassGroupName: null,
          warnings: ["Texto humanizado alterado pelo componente."],
        },
      }),
    );

    expect(records.agenda.produto_classe).toBe("vacina_brucelose_b19");
    expect(records.agenda.metadata).toMatchObject({
      productRequirementKind: "product_class",
      productClass: "vacina_brucelose_b19",
    });
    expect(records.agenda.protocol_item_snapshot).toMatchObject({
      productRequirementKind: "product_class",
      productClass: "vacina_brucelose_b19",
    });
    expect(records.agenda.produto_snapshot).toMatchObject({
      productRequirementKind: "product_class",
      productClass: "vacina_brucelose_b19",
    });
  });

  it("lote sem animalIds segue contrato explicito", () => {
    const records = buildManualSanitaryAgendaRecordsV2(
      baseInput({
        target: {
          scope: "lote",
          id: "lote-1",
          fazendaId: "farm-1",
          animalIds: [],
        },
      }),
    );

    expect(records.animals).toHaveLength(0);
    expect(records.agenda.lote_id).toBe("lote-1");
    expect(records.agenda.metadata).toMatchObject({
      targetAnimalIds: [],
      targetAnimalScope: "lote_sem_animais_explicitos",
    });
  });

  it("rejeita tentativa de carregar payload de execucao", async () => {
    const db = createMemoryDb();

    await expect(
      createManualSanitaryAgendaV2(
        baseInput({
          source: {
            ...baseInput().source,
            productId: "produto-real",
          } as CreateManualSanitaryAgendaInputV2["source"],
        }),
        db,
      ),
    ).rejects.toThrow("execution_payload_forbidden");
  });

  it("persistencia local nao cria queue_ops, evento, estoque ou carencia ativa", async () => {
    await createManualSanitaryAgendaV2(baseInput({ clientOpId: "op-dexie-1" }));

    expect(await db.ops_sanitario_agenda_v2.count()).toBe(1);
    expect(await db.ops_sanitario_agenda_animais_v2.count()).toBe(1);
    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.event_eventos_sanitario.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);

    const agenda = await db.ops_sanitario_agenda_v2
      .where("client_op_id")
      .equals("op-dexie-1")
      .first();

    expect(agenda).toMatchObject({
      execution_evento_id: null,
      produto_veterinario_id: null,
    });
    expect(agenda?.metadata).toMatchObject({
      createsEvent: false,
      createsStockMovement: false,
      createsActiveWithdrawal: false,
    });
  });
});
