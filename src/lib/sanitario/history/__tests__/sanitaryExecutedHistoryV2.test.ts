import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { Evento, EventoSanitario } from "@/lib/offline/types";
import { db } from "@/lib/offline/db";
import {
  adaptSanitaryProtocolItemV2Row,
  adaptSanitaryProtocolV2Row,
  type JsonRecord,
  type SanitaryProtocolCatalogReadModelV2,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import {
  buildSanitaryExecutedHistoryV2,
  getAnimalSanitaryExecutedHistoryV2,
  getLotSanitaryExecutedHistoryV2,
} from "../sanitaryExecutedHistoryV2";

const protocol = (id: string, familyCode: string): JsonRecord => ({
  id,
  family_code: familyCode,
  name: familyCode,
  scope: "global",
  fazenda_id: null,
  species_scope: {},
  jurisdiction_scope: {},
  legal_status: "manual_only",
  version: 1,
  status: "draft",
  approval_status: "draft",
  source_refs_snapshot: [],
  metadata: {},
});

const item = (
  id: string,
  protocolId: string,
  itemKey: string,
): JsonRecord => ({
  id,
  protocol_id: protocolId,
  logical_item_key: itemKey,
  version: 1,
  item_status: "draft",
  action_type: "vacinacao",
  product_requirement_kind: "product_class",
  product_id: null,
  product_class: "vacina_teste",
  product_class_group_id: null,
  eligibility_rule: {},
  operational_window_rule: {},
  dose_rule: {},
  route_rule: {},
  booster_rule: {},
  species_authorization: {},
  source_refs_by_field: {},
  limitations: [],
  snapshot_template: {},
  allows_agenda_auto: false,
  requires_mv_responsavel: false,
  status: "draft",
});

function catalog(ambiguous = false): SanitaryProtocolCatalogReadModelV2 {
  return {
    protocols: [
      protocol("protocol-clostridioses", "clostridioses"),
      ...(ambiguous ? [protocol("protocol-outro", "outro_protocolo")] : []),
    ].map(adaptSanitaryProtocolV2Row),
    items: [
      item(
        "item-clostridial-dose1",
        "protocol-clostridioses",
        "clostridial_primovac_dose1",
      ),
      ...(ambiguous
        ? [
            item(
              "item-outro-dose1",
              "protocol-outro",
              "clostridial_primovac_dose1",
            ),
          ]
        : []),
    ].map(adaptSanitaryProtocolItemV2Row),
    productClassGroups: [],
  };
}

function event(overrides: Partial<Evento> = {}): Evento {
  return {
    id: "event-1",
    fazenda_id: "farm-1",
    dominio: "sanitario",
    occurred_at: "2026-04-01T10:00:00.000Z",
    animal_id: "animal-1",
    lote_id: null,
    source_task_id: null,
    source_tx_id: null,
    source_client_op_id: null,
    corrige_evento_id: null,
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-01T10:00:00.000Z",
    server_received_at: "2026-04-01T10:00:00.000Z",
    created_at: "2026-04-01T10:00:00.000Z",
    updated_at: "2026-04-01T10:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function detail(overrides: Partial<EventoSanitario> = {}): EventoSanitario {
  return {
    evento_id: "event-1",
    fazenda_id: "farm-1",
    tipo: "vacinacao",
    produto: "Vacina teste",
    produto_veterinario_id: "product-1",
    protocol_item_version_id: "item-clostridial-dose1",
    protocol_item_logical_key: "clostridial_primovac_dose1",
    protocol_item_version: 1,
    protocol_item_snapshot: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-detail-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-01T10:00:00.000Z",
    server_received_at: "2026-04-01T10:00:00.000Z",
    created_at: "2026-04-01T10:00:00.000Z",
    updated_at: "2026-04-01T10:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("sanitaryExecutedHistoryV2", () => {
  it("projeta somente evento sanitario executado com item resolvido", () => {
    const history = buildSanitaryExecutedHistoryV2({
      events: [event()],
      sanitaryDetails: [detail()],
      catalog: catalog(),
      fazendaId: "farm-1",
      allowedAnimalIds: ["animal-1"],
    });

    expect(history).toEqual([
      {
        animalId: "animal-1",
        events: [
          expect.objectContaining({
            eventId: "event-1",
            protocolId: "protocol-clostridioses",
            familyCode: "clostridioses",
            itemKey: "clostridial_primovac_dose1",
            productClass: "vacina_teste",
            productId: "product-1",
            executedAt: "2026-04-01T10:00:00.000Z",
            source: "event",
          }),
        ],
      },
    ]);
  });

  it("preserva referência documental estruturada no histórico externo", () => {
    const history = buildSanitaryExecutedHistoryV2({
      events: [
        event({
          payload: {
            entry_history_source: "external_documented",
            evidence_class: "documented",
            evidence_reference: "certificado-b19-2024",
          },
        }),
      ],
      sanitaryDetails: [detail()],
      catalog: catalog(),
      fazendaId: "farm-1",
    });

    expect(history[0]?.events[0]).toMatchObject({
      source: "external_documented",
      evidenceClass: "documented",
      evidenceReference: "certificado-b19-2024",
    });
  });

  it("expande evento de lote apenas com animal_ids explicitos", () => {
    const withoutTargets = buildSanitaryExecutedHistoryV2({
      events: [event({ animal_id: null, lote_id: "lot-1" })],
      sanitaryDetails: [detail()],
      catalog: catalog(),
      fazendaId: "farm-1",
      allowedAnimalIds: ["animal-1", "animal-2"],
    });
    const withTargets = buildSanitaryExecutedHistoryV2({
      events: [
        event({
          animal_id: null,
          lote_id: "lot-1",
          payload: { animal_ids: ["animal-1", "animal-2"] },
        }),
      ],
      sanitaryDetails: [detail()],
      catalog: catalog(),
      fazendaId: "farm-1",
      allowedAnimalIds: ["animal-1", "animal-2"],
    });

    expect(withoutTargets).toEqual([]);
    expect(withTargets.map((entry) => entry.animalId)).toEqual([
      "animal-1",
      "animal-2",
    ]);
  });

  it("le historico real das stores Dexie para animal e lote", async () => {
    const storedEvent = event({
      id: "event-dexie-history-v2",
      lote_id: "lot-1",
    });
    const storedDetail = detail({ evento_id: storedEvent.id });
    await db.event_eventos.put(storedEvent);
    await db.event_eventos_sanitario.put(storedDetail);

    try {
      const animalHistory = await getAnimalSanitaryExecutedHistoryV2({
        animalId: "animal-1",
        fazendaId: "farm-1",
        catalog: catalog(),
      });
      const lotHistory = await getLotSanitaryExecutedHistoryV2({
        loteId: "lot-1",
        animalIds: ["animal-1"],
        fazendaId: "farm-1",
        catalog: catalog(),
      });

      expect(animalHistory[0]?.events[0]?.eventId).toBe(storedEvent.id);
      expect(lotHistory[0]?.events[0]?.eventId).toBe(storedEvent.id);
    } finally {
      await db.event_eventos_sanitario.delete(storedEvent.id);
      await db.event_eventos.delete(storedEvent.id);
    }
  });

  it("descarta historico parcial, ambiguo, tombstone ou fora da fazenda", () => {
    const history = buildSanitaryExecutedHistoryV2({
      events: [
        event({ id: "partial" }),
        event({ id: "ambiguous" }),
        event({ id: "deleted", deleted_at: "2026-04-02T00:00:00.000Z" }),
        event({ id: "other-farm", fazenda_id: "farm-2" }),
      ],
      sanitaryDetails: [
        detail({ evento_id: "partial", protocol_item_version_id: null }),
        detail({
          evento_id: "ambiguous",
          protocol_item_version_id: null,
          protocol_item_logical_key: "clostridial_primovac_dose1",
        }),
        detail({ evento_id: "deleted" }),
        detail({ evento_id: "other-farm", fazenda_id: "farm-2" }),
      ],
      catalog: catalog(true),
      fazendaId: "farm-1",
    });

    expect(history).toEqual([]);
  });

  it("nao importa agenda, escrita, queue_ops, estoque ou carencia", () => {
    const source = readFileSync(
      resolve(__dirname, "../sanitaryExecutedHistoryV2.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/state_agenda_itens|ops_sanitario_agenda/i);
    expect(source).not.toMatch(/queue_ops|createGesture|sync-batch|\.add\(|\.put\(/i);
    expect(source).not.toMatch(/insumo_movimentacoes/i);
  });
});
