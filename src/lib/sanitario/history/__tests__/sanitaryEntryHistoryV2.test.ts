/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/offline/db";
import {
  applySanitarioV2Cutover,
  SANITARIO_V2_STAGING_PROJECT_REF,
  setSanitarioV2PushEnabled,
} from "@/lib/offline/sanitarioV2Cutover";
import type {
  SanitaryProtocolCatalogReadModelV2,
  SanitaryProtocolItemV2ReadModel,
  SanitaryProtocolV2ReadModel,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import { createSanitaryEntryHistoryV2 } from "@/lib/sanitario/history/sanitaryEntryHistoryV2";
import { getAnimalSanitaryExecutedHistoryV2 } from "@/lib/sanitario/history/sanitaryExecutedHistoryV2";

const FARM_ID = "10000000-0000-4000-8000-000000000001";
const ANIMAL_ID = "20000000-0000-4000-8000-000000000001";
const PROTOCOL_ID = "30000000-0000-4000-8000-000000000001";
const ITEM_ID = "40000000-0000-4000-8000-000000000001";

const protocol: SanitaryProtocolV2ReadModel = {
  id: PROTOCOL_ID,
  familyCode: "brucelose_b19",
  name: "Brucelose B19",
  scope: "global",
  fazendaId: null,
  speciesScope: {},
  jurisdictionScope: {},
  legalStatus: "manual_only",
  version: 1,
  status: "draft",
  approvalStatus: "draft",
  sourceRefsSnapshot: [],
  metadata: {},
};

const item: SanitaryProtocolItemV2ReadModel = {
  id: ITEM_ID,
  protocolId: PROTOCOL_ID,
  logicalItemKey: "b19_femeas_3_8_meses",
  version: 1,
  itemStatus: "draft",
  actionType: "vacinacao",
  productRequirementKind: "product_class",
  productId: null,
  productClass: "vacina_brucelose_b19",
  productClassGroupId: null,
  eligibilityRule: { species: ["bovino"], sex: "femea" },
  operationalWindowRule: {},
  doseRule: {},
  routeRule: {},
  boosterRule: {},
  speciesAuthorization: {},
  sourceRefsByField: {},
  limitations: [],
  snapshotTemplate: {},
  allowsAgendaAuto: false,
  requiresMvResponsavel: false,
  status: "draft",
};

const catalog: SanitaryProtocolCatalogReadModelV2 = {
  protocols: [protocol],
  items: [item],
  productClassGroups: [],
};

async function clearStores() {
  await Promise.all([
    db.event_eventos.clear(),
    db.event_eventos_sanitario.clear(),
    db.event_eventos_animais.clear(),
    db.state_insumo_movimentacoes.clear(),
    db.ops_sanitario_agenda_v2.clear(),
    db.queue_ops.clear(),
    db.queue_gestures.clear(),
    db.sync_sanitario_v2_cutovers.clear(),
  ]);
}

describe("sanitaryEntryHistoryV2", () => {
  beforeEach(async () => {
    await db.open();
    await clearStores();
    setSanitarioV2PushEnabled(false, SANITARIO_V2_STAGING_PROJECT_REF);
  });

  afterEach(async () => {
    setSanitarioV2PushEnabled(false, SANITARIO_V2_STAGING_PROJECT_REF);
    await clearStores();
  });

  it("registra histórico externo documentado sem estoque, carência, agenda ou queue_ops", async () => {
    const result = await createSanitaryEntryHistoryV2({
      fazendaId: FARM_ID,
      animalId: ANIMAL_ID,
      protocolId: PROTOCOL_ID,
      itemId: ITEM_ID,
      occurredOn: "2024-06-01",
      dateApproximate: false,
      source: "external_documented",
      evidenceClass: "documented",
      evidenceType: "certificado",
      evidenceReference: "certificado-b19-2024",
      evidenceCoveredFields: ["protocol_item_completion", "product_class"],
      notes: "Certificado apresentado na compra.",
      catalog,
    });

    expect(result).toMatchObject({
      createsAgenda: false,
      createsStockMovement: false,
      createsActiveWithdrawal: false,
      createsQueueOps: false,
    });
    expect(await db.event_eventos.count()).toBe(1);
    expect(await db.event_eventos_sanitario.count()).toBe(1);
    expect(await db.event_eventos_animais.count()).toBe(1);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
    expect(await db.queue_ops.count()).toBe(0);

    const history = await getAnimalSanitaryExecutedHistoryV2({
      fazendaId: FARM_ID,
      animalId: ANIMAL_ID,
      catalog,
    });
    expect(history[0].events[0]).toMatchObject({
      eventId: result.eventId,
      source: "external_documented",
      evidenceClass: "documented",
      evidenceReference: "certificado-b19-2024",
      evidenceCoveredFields: ["protocol_item_completion", "product_class"],
      itemKey: "b19_femeas_3_8_meses",
    });
    expect(await db.event_eventos.get(result.eventId)).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      animal_id: ANIMAL_ID,
      source_sanitario_agenda_v2_id: null,
      sanitario_sync_v2_nature: "standalone_fact",
    });
  });

  it("rejeita nova entrada documentada sem referencia antes de persistir", async () => {
    await expect(
      createSanitaryEntryHistoryV2({
        fazendaId: FARM_ID,
        animalId: ANIMAL_ID,
        protocolId: PROTOCOL_ID,
        itemId: ITEM_ID,
        occurredOn: "2024-06-01",
        dateApproximate: false,
        source: "external_documented",
        evidenceClass: "documented",
        evidenceType: "certificado",
        evidenceReference: "  ",
        evidenceCoveredFields: ["protocol_item_completion"],
        catalog,
      }),
    ).rejects.toThrow("SANITARY_ENTRY_HISTORY_DOCUMENT_REFERENCE_REQUIRED");
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.queue_ops.count()).toBe(0);
  });

  it("enfileira external_declared como standalone_fact sem efeitos operacionais", async () => {
    await applySanitarioV2Cutover(FARM_ID, async () => undefined);
    setSanitarioV2PushEnabled(true, SANITARIO_V2_STAGING_PROJECT_REF);
    const result = await createSanitaryEntryHistoryV2({
      fazendaId: FARM_ID,
      animalId: ANIMAL_ID,
      protocolId: PROTOCOL_ID,
      itemId: ITEM_ID,
      occurredOn: null,
      dateApproximate: true,
      source: "external_declared",
      evidenceClass: "declared",
      evidenceType: "declaracao_produtor",
      catalog,
      sync: {
        clientId: "staging-client",
        projectRef: SANITARIO_V2_STAGING_PROJECT_REF,
      },
    });

    expect(result.createsQueueOps).toBe(true);
    expect(await db.queue_gestures.count()).toBe(1);
    const queued = await db.queue_ops.toCollection().first();
    expect(queued?.record).toMatchObject({
      command: "apply_factual_core",
      payload: {
        event: {
          id: result.eventId,
          natureza: "standalone_fact",
          source_sanitario_agenda_v2_id: null,
          payload: {
            entry_history_source: "external_declared",
            evidence_covered_fields: [],
          },
        },
        event_animals: [{ animal_id: ANIMAL_ID }],
      },
    });
    expect(queued?.record.payload).not.toHaveProperty("agenda");
    expect(queued?.record.payload).not.toHaveProperty("stock_movements");
    expect(queued?.record.payload).not.toHaveProperty("withdrawals");
  });
});
