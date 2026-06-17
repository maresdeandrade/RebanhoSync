import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/offline/db";
import { getLocalStoreName, getRemoteTableName } from "@/lib/offline/tableMap";
import type {
  SanitarioProtocoloItemVersionLocalV2,
  SanitarioProtocoloLocalV2,
  SanitarioProductClassGroupLocalV2,
} from "@/lib/offline/types";

const stores = [
  "catalog_sanitario_protocolos_v2",
  "catalog_sanitario_protocolo_itens_versions_v2",
  "catalog_sanitario_product_class_groups_v2",
] as const;

const now = "2026-06-15T12:00:00.000Z";

describe("offline sanitario protocol catalog v2 stores", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all(stores.map((store) => db.table(store).clear()));
    await db.queue_ops.clear();
  });

  afterEach(async () => {
    await Promise.all(stores.map((store) => db.table(store).clear()));
    await db.queue_ops.clear();
  });

  it("registra stores Dexie do catalogo de protocolos sanitarios v2", () => {
    expect(db.verno).toBeGreaterThanOrEqual(27);
    expect(db.tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([...stores]),
    );
  });

  it("mapeia tabelas remotas para stores catalog_* pull-only", () => {
    expect(getLocalStoreName("sanitario_protocolos_v2")).toBe(
      "catalog_sanitario_protocolos_v2",
    );
    expect(getRemoteTableName("catalog_sanitario_protocolos_v2")).toBe(
      "sanitario_protocolos_v2",
    );
    expect(getLocalStoreName("sanitario_protocolo_itens_versions_v2")).toBe(
      "catalog_sanitario_protocolo_itens_versions_v2",
    );
    expect(getRemoteTableName("catalog_sanitario_protocolo_itens_versions_v2")).toBe(
      "sanitario_protocolo_itens_versions_v2",
    );
  });

  it("preserva protocolo, item, ProductClassGroup, JSON, arrays e tombstones sem queue_ops", async () => {
    const protocol: SanitarioProtocoloLocalV2 = {
      id: "protocol-b19",
      family_code: "brucelose_b19",
      name: "Brucelose B19",
      scope: "global",
      fazenda_id: null,
      species_scope: { especies: ["bovino", "bubalino"] },
      jurisdiction_scope: { pais: "BR", escopo: "nacional" },
      legal_status: "obrigatorio_norma",
      version: 1,
      status: "draft",
      source_refs_snapshot: [{ source_ref: "SRC_B19" }],
      approval_status: "draft",
      metadata: { agenda_allowed: false, approved_for_catalog: false },
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    const item: SanitarioProtocoloItemVersionLocalV2 = {
      id: "item-b19",
      protocol_id: protocol.id,
      logical_item_key: "b19_femeas_3_8_meses",
      version: 1,
      item_status: "obrigatorio",
      action_type: "vacinacao",
      product_requirement_kind: "none",
      product_id: null,
      product_class: null,
      product_class_group_id: null,
      eligibility_rule: { sexo: "femea", idade_min_meses: 3, idade_max_meses: 8 },
      operational_window_rule: {},
      dose_rule: null,
      route_rule: null,
      booster_rule: null,
      species_authorization: [],
      source_refs_by_field: {},
      limitations: ["read-only"],
      snapshot_template: {},
      allows_agenda_auto: false,
      requires_mv_responsavel: true,
      status: "draft",
      created_at: now,
      updated_at: now,
      deleted_at: "2026-06-15T13:00:00.000Z",
    };
    const group: SanitarioProductClassGroupLocalV2 = {
      id: "group-antiparasitario",
      fazenda_id: null,
      scope: "global",
      group_key: "pcg_antiparasitarios_recria_estrategicos",
      name: "Antiparasitarios recria",
      requires_mv_for_other_class: true,
      curation_status: "needs_review",
      automation_status: "blocked",
      limitations: ["members_sem_class_id_bloqueados"],
      metadata: { agenda_allowed: false, approved_for_catalog: false },
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    await db.catalog_sanitario_protocolos_v2.put(protocol);
    await db.catalog_sanitario_protocolo_itens_versions_v2.put(item);
    await db.catalog_sanitario_product_class_groups_v2.put(group);

    expect(await db.catalog_sanitario_protocolos_v2.get(protocol.id)).toMatchObject({
      family_code: "brucelose_b19",
      fazenda_id: null,
      approval_status: "draft",
    });
    expect(await db.catalog_sanitario_protocolo_itens_versions_v2.get(item.id))
      .toMatchObject({
        logical_item_key: "b19_femeas_3_8_meses",
        allows_agenda_auto: false,
        deleted_at: "2026-06-15T13:00:00.000Z",
      });
    expect(await db.catalog_sanitario_product_class_groups_v2.get(group.id))
      .toMatchObject({
        group_key: "pcg_antiparasitarios_recria_estrategicos",
        curation_status: "needs_review",
        automation_status: "blocked",
      });
    expect(await db.queue_ops.count()).toBe(0);
  });
});
