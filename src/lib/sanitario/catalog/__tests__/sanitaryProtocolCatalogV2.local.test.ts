import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/offline/db";
import {
  buildSanitaryProtocolCatalogSummaryV2,
  getLocalSanitaryProtocolV2WithItems,
  readLocalSanitaryProtocolCatalogV2,
  validateSanitaryProtocolCatalogReadOnlyInvariantsV2,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";

const now = "2026-06-15T12:00:00.000Z";

const protocol = (familyCode: string, overrides: Record<string, unknown> = {}) => ({
  id: `protocol-${familyCode}`,
  family_code: familyCode,
  name: familyCode,
  scope: "global",
  fazenda_id: null,
  species_scope: { especies: ["bovino"] },
  jurisdiction_scope: { pais: "BR", escopo: "nacional" },
  legal_status: "manual_only",
  version: 1,
  status: "draft",
  source_refs_snapshot: [{ source_ref: `SRC_${familyCode}` }],
  approval_status: "draft",
  metadata: { agenda_allowed: false, approved_for_catalog: false },
  created_at: now,
  updated_at: now,
  deleted_at: null,
  ...overrides,
});

const item = (
  protocolId: string,
  logicalItemKey: string,
  overrides: Record<string, unknown> = {},
) => ({
  id: `item-${logicalItemKey}`,
  protocol_id: protocolId,
  logical_item_key: logicalItemKey,
  version: 1,
  item_status: "obrigatorio",
  action_type: "vacinacao",
  product_requirement_kind: "none",
  product_id: null,
  product_class: null,
  product_class_group_id: null,
  eligibility_rule: {},
  operational_window_rule: {},
  dose_rule: null,
  route_rule: null,
  booster_rule: null,
  species_authorization: [],
  source_refs_by_field: {},
  limitations: [],
  snapshot_template: {},
  allows_agenda_auto: false,
  requires_mv_responsavel: false,
  status: "draft",
  created_at: now,
  updated_at: now,
  deleted_at: null,
  ...overrides,
});

const group = (groupKey: string) => ({
  id: `group-${groupKey}`,
  fazenda_id: null,
  scope: "global",
  group_key: groupKey,
  name: groupKey,
  requires_mv_for_other_class: true,
  curation_status: "needs_review",
  automation_status: "blocked",
  limitations: ["members_sem_class_id_bloqueados"],
  metadata: { agenda_allowed: false, approved_for_catalog: false },
  created_at: now,
  updated_at: now,
  deleted_at: null,
});

const familyId = (familyCode: string) => `protocol-${familyCode}`;
const groupId = (groupKey: string) => `group-${groupKey}`;
const antiparasitic = (groupKey: string) => ({
  action_type: "vermifugacao",
  product_requirement_kind: "product_class_group",
  product_class_group_id: groupId(groupKey),
});

const protocolRows = [
  protocol("brucelose_b19", {
    species_scope: { especies: ["bovino", "bubalino"] },
  }),
  protocol("febre_aftosa", { legal_status: "bloqueado", status: "retired" }),
  protocol("controle_parasitario_recria"),
  protocol("controle_parasitario_pre_desmama"),
  protocol("controle_parasitario_pre_confinamento"),
  protocol("controle_parasitario_matrizes"),
  protocol("raiva_herbivoros"),
  protocol("clostridioses"),
  protocol("leptospirose_ibr_bvd"),
  protocol("rastreabilidade_medicamentos"),
];

const itemRows = [
  item(familyId("brucelose_b19"), "b19_femeas_3_8_meses", {
    eligibility_rule: { sexo: "femea", idade_min_meses: 3, idade_max_meses: 8 },
  }),
  item(familyId("febre_aftosa"), "aftosa_vacinacao_bloqueada"),
  item(familyId("febre_aftosa"), "aftosa_sem_agenda"),
  item(
    familyId("controle_parasitario_recria"),
    "recria_maio",
    antiparasitic("antiparasitario_endectocida"),
  ),
  item(
    familyId("controle_parasitario_recria"),
    "recria_julho",
    antiparasitic("antiparasitario_endectocida"),
  ),
  item(
    familyId("controle_parasitario_recria"),
    "recria_setembro",
    antiparasitic("antiparasitario_endectocida"),
  ),
  item(
    familyId("controle_parasitario_pre_desmama"),
    "pre_desmama_situacional",
    antiparasitic("antiparasitario_pre_desmama"),
  ),
  item(
    familyId("controle_parasitario_pre_confinamento"),
    "pre_confinamento_dose_unica",
    antiparasitic("antiparasitario_pre_confinamento"),
  ),
  item(
    familyId("controle_parasitario_matrizes"),
    "matrizes_pre_parto_antiparasitario",
    antiparasitic("antiparasitario_matrizes"),
  ),
  item(familyId("raiva_herbivoros"), "raiva_d1"),
  item(familyId("raiva_herbivoros"), "raiva_reforco"),
  item(familyId("clostridioses"), "clostridioses_primovacinacao"),
  item(familyId("clostridioses"), "clostridioses_reforco"),
  item(familyId("leptospirose_ibr_bvd"), "reprodutivas_pre_estacao"),
  item(familyId("leptospirose_ibr_bvd"), "reprodutivas_reforco"),
  item(familyId("rastreabilidade_medicamentos"), "medicamento_antibiotico"),
  item(familyId("rastreabilidade_medicamentos"), "medicamento_antiinflamatorio"),
  item(familyId("rastreabilidade_medicamentos"), "medicamento_suporte"),
  item(familyId("rastreabilidade_medicamentos"), "medicamento_outros"),
];

const groupRows = [
  group("antiparasitario_endectocida"),
  group("antiparasitario_pre_desmama"),
  group("antiparasitario_pre_confinamento"),
  group("antiparasitario_matrizes"),
];

describe("local sanitary protocol catalog v2", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all([
      db.catalog_sanitario_protocolos_v2.clear(),
      db.catalog_sanitario_protocolo_itens_versions_v2.clear(),
      db.catalog_sanitario_product_class_groups_v2.clear(),
      db.queue_ops.clear(),
    ]);
    await db.catalog_sanitario_protocolos_v2.bulkPut(protocolRows);
    await db.catalog_sanitario_protocolo_itens_versions_v2.bulkPut(itemRows);
    await db.catalog_sanitario_product_class_groups_v2.bulkPut(groupRows);
  });

  afterEach(async () => {
    await Promise.all([
      db.catalog_sanitario_protocolos_v2.clear(),
      db.catalog_sanitario_protocolo_itens_versions_v2.clear(),
      db.catalog_sanitario_product_class_groups_v2.clear(),
      db.queue_ops.clear(),
    ]);
  });

  it("le Dexie local e confirma resumo read-only dos protocolos sanitarios v2", async () => {
    const readModel = await readLocalSanitaryProtocolCatalogV2();
    const summary = buildSanitaryProtocolCatalogSummaryV2(readModel);

    expect(summary).toMatchObject({
      protocolCount: 10,
      itemCount: 19,
      productClassGroupCount: 4,
      memberImportBlockedCount: 16,
      hasB19NationalRule: true,
      hasAftosaBlockedRule: true,
      antiparasiticItemsUseProductClassGroup: true,
      hasAgendaAutoEnabled: false,
      hasApprovedCatalogProtocol: false,
      createsAgenda: false,
      createsEvent: false,
      createsStockMovement: false,
      createsActiveWithdrawal: false,
      allowsOperationalRelease: false,
      productClassGroupAuthorizesExecution: false,
      productClassGroupAuthorizesDose: false,
      productClassGroupAuthorizesWithdrawal: false,
      requiresRealProductForExecution: true,
    });
    expect(validateSanitaryProtocolCatalogReadOnlyInvariantsV2(readModel)).toEqual([]);
    expect(await db.queue_ops.count()).toBe(0);
  });

  it("lista B19 local com item nacional femeas bovinas/bubalinas 3-8 meses", async () => {
    const b19 = await getLocalSanitaryProtocolV2WithItems({
      familyCode: "brucelose_b19",
    });

    expect(b19?.protocol.speciesScope.especies).toEqual(["bovino", "bubalino"]);
    expect(b19?.items).toHaveLength(1);
    expect(b19?.items[0]).toMatchObject({
      logicalItemKey: "b19_femeas_3_8_meses",
      allowsAgendaAuto: false,
    });
  });
});
