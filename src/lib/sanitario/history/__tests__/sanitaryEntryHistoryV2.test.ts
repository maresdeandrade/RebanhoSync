import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/offline/db";
import type {
  SanitaryProtocolCatalogReadModelV2,
  SanitaryProtocolItemV2ReadModel,
  SanitaryProtocolV2ReadModel,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import { createSanitaryEntryHistoryV2 } from "@/lib/sanitario/history/sanitaryEntryHistoryV2";
import { getAnimalSanitaryExecutedHistoryV2 } from "@/lib/sanitario/history/sanitaryExecutedHistoryV2";

const protocol: SanitaryProtocolV2ReadModel = {
  id: "protocol-b19",
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
  id: "item-b19",
  protocolId: "protocol-b19",
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
    db.state_insumo_movimentacoes.clear(),
    db.ops_sanitario_agenda_v2.clear(),
    db.queue_ops.clear(),
  ]);
}

describe("sanitaryEntryHistoryV2", () => {
  beforeEach(async () => {
    await db.open();
    await clearStores();
  });

  afterEach(clearStores);

  it("registra histórico externo documentado sem estoque, carência, agenda ou queue_ops", async () => {
    const result = await createSanitaryEntryHistoryV2({
      fazendaId: "farm-1",
      animalId: "animal-1",
      protocolId: "protocol-b19",
      itemId: "item-b19",
      occurredOn: "2024-06-01",
      dateApproximate: false,
      source: "external_documented",
      evidenceClass: "documented",
      evidenceType: "certificado",
      evidenceReference: "certificado-b19-2024",
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
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
    expect(await db.queue_ops.count()).toBe(0);

    const history = await getAnimalSanitaryExecutedHistoryV2({
      fazendaId: "farm-1",
      animalId: "animal-1",
      catalog,
    });
    expect(history[0].events[0]).toMatchObject({
      eventId: result.eventId,
      source: "external_documented",
      evidenceClass: "documented",
      evidenceReference: "certificado-b19-2024",
      itemKey: "b19_femeas_3_8_meses",
    });
  });
});
