import { describe, expect, it } from "vitest";

import { normalizeAgendaPageData } from "@/pages/Agenda/useAgendaPageData";
import type {
  AgendaItem,
  Animal,
  CatalogoProtocoloOficial,
  CatalogoProtocoloOficialItem,
  FazendaSanidadeConfig,
  Gesture,
  Lote,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
  SanitarioAgendaAnimalLocalV2,
  SanitarioAgendaLocalV2,
} from "@/lib/offline/types";

function recordWithDeletedAt<T extends { deleted_at?: string | null }>(
  id: string,
  deletedAt: string | null = null,
): T {
  return { id, deleted_at: deletedAt } as unknown as T;
}

describe("normalizeAgendaPageData", () => {
  it("removes soft-deleted records from the same collections filtered by the shell", () => {
    const activeAgenda = recordWithDeletedAt<AgendaItem>("agenda-active");
    const deletedAgenda = recordWithDeletedAt<AgendaItem>(
      "agenda-deleted",
      "2026-05-01T00:00:00.000Z",
    );
    const activeAnimal = recordWithDeletedAt<Animal>("animal-active");
    const deletedAnimal = recordWithDeletedAt<Animal>(
      "animal-deleted",
      "2026-05-01T00:00:00.000Z",
    );
    const activeLote = recordWithDeletedAt<Lote>("lote-active");
    const deletedLote = recordWithDeletedAt<Lote>(
      "lote-deleted",
      "2026-05-01T00:00:00.000Z",
    );
    const activeProtocol =
      recordWithDeletedAt<ProtocoloSanitario>("protocol-active");
    const deletedProtocol = recordWithDeletedAt<ProtocoloSanitario>(
      "protocol-deleted",
      "2026-05-01T00:00:00.000Z",
    );
    const activeProtocolItem =
      recordWithDeletedAt<ProtocoloSanitarioItem>("protocol-item-active");
    const deletedProtocolItem = recordWithDeletedAt<ProtocoloSanitarioItem>(
      "protocol-item-deleted",
      "2026-05-01T00:00:00.000Z",
    );
    const activeConfig =
      recordWithDeletedAt<FazendaSanidadeConfig>("config-active");

    const result = normalizeAgendaPageData({
      itens: [activeAgenda, deletedAgenda],
      animais: [activeAnimal, deletedAnimal],
      lotes: [activeLote, deletedLote],
      protocolos: [activeProtocol, deletedProtocol],
      protocoloItens: [activeProtocolItem, deletedProtocolItem],
      sanidadeConfig: activeConfig,
    });

    expect(result.itens).toEqual([activeAgenda]);
    expect(result.animais).toEqual([activeAnimal]);
    expect(result.lotes).toEqual([activeLote]);
    expect(result.protocolos).toEqual([activeProtocol]);
    expect(result.protocoloItens).toEqual([activeProtocolItem]);
    expect(result.sanidadeConfig).toBe(activeConfig);
  });

  it("removes a soft-deleted sanity config", () => {
    const deletedConfig = recordWithDeletedAt<FazendaSanidadeConfig>(
      "config-deleted",
      "2026-05-01T00:00:00.000Z",
    );

    expect(
      normalizeAgendaPageData({ sanidadeConfig: deletedConfig }).sanidadeConfig,
    ).toBeNull();
  });

  it("preserves gestures and official catalogs as loaded", () => {
    const gesture = { client_tx_id: "tx-1" } as unknown as Gesture;
    const template = {
      id: "template-1",
      deleted_at: "2026-05-01T00:00:00.000Z",
    } as unknown as CatalogoProtocoloOficial;
    const templateItem = {
      id: "template-item-1",
      deleted_at: "2026-05-01T00:00:00.000Z",
    } as unknown as CatalogoProtocoloOficialItem;

    const result = normalizeAgendaPageData({
      gestos: [gesture],
      officialTemplates: [template],
      officialTemplateItems: [templateItem],
    });

    expect(result.gestos).toEqual([gesture]);
    expect(result.officialTemplates).toEqual([template]);
    expect(result.officialTemplateItems).toEqual([templateItem]);
  });

  it("adapta agenda sanitária v2 local como item da Agenda global", () => {
    const sanitaryAgenda = {
      id: "san-agenda-1",
      fazenda_id: "farm-1",
      status: "programada",
      dedup_key: "dedup-1",
      client_id: "client-1",
      client_op_id: "op-1",
      client_tx_id: null,
      client_recorded_at: "2026-07-01T10:00:00.000Z",
      server_received_at: "2026-07-01T10:00:00.000Z",
      protocolo_id: "protocol-1",
      protocol_item_version_id: "item-version-1",
      protocol_item_snapshot: { protocolName: "Brucelose B19", itemLabel: "Dose anual" },
      data_programada: "2026-07-12",
      lote_id: "lot-1",
      produto_snapshot: {},
      produto_classe: "vacina_ibr_bvd",
      execution_evento_id: null,
      metadata: {},
      created_at: "2026-07-01T10:00:00.000Z",
      updated_at: "2026-07-01T10:00:00.000Z",
      deleted_at: null,
    } as SanitarioAgendaLocalV2;
    const lot = { id: "lot-1", nome: "Lote recria", deleted_at: null } as Lote;
    const agendaAnimal = {
      agenda_id: "san-agenda-1",
      animal_id: "animal-1",
    } as SanitarioAgendaAnimalLocalV2;

    const result = normalizeAgendaPageData({
      sanitaryAgendasV2: [sanitaryAgenda],
      sanitaryAgendaAnimalsV2: [agendaAnimal],
      lotes: [lot],
    });

    expect(result.itens).toHaveLength(1);
    expect(result.itens[0]).toMatchObject({
      id: "sanitario-v2:san-agenda-1",
      dominio: "sanitario",
      tipo: "Dose anual",
      status: "agendado",
      data_prevista: "2026-07-12",
      source_ref: expect.objectContaining({
        agenda_v2_id: "san-agenda-1",
        protocolo: "Brucelose B19",
        produto: "Vacina IBR/BVD",
      }),
    });
  });

  it("returns empty arrays and null config when sources are absent", () => {
    expect(normalizeAgendaPageData(undefined)).toEqual({
      itens: [],
      animais: [],
      lotes: [],
      protocolos: [],
      protocoloItens: [],
      gestos: [],
      sanidadeConfig: null,
      officialTemplates: [],
      officialTemplateItems: [],
    });
  });

  it("keeps the shape expected by the agenda shell", () => {
    expect(Object.keys(normalizeAgendaPageData(null))).toEqual([
      "itens",
      "animais",
      "lotes",
      "protocolos",
      "protocoloItens",
      "gestos",
      "sanidadeConfig",
      "officialTemplates",
      "officialTemplateItems",
    ]);
  });
});
