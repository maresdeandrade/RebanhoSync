import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/offline/db";
import { getLocalStoreName, getRemoteTableName } from "@/lib/offline/tableMap";
import type {
  SanitarioProductClassDefaultRuleLocalV2,
  SanitarioProductClassGroupLocalV2,
  SanitarioProductClassGroupMemberLocalV2,
  SanitarioProductClassLocalV2,
} from "@/lib/offline/types";

const stores = [
  "catalog_sanitario_product_classes_v2",
  "catalog_sanitario_product_class_groups_v2",
  "catalog_sanitario_product_class_group_members_v2",
  "catalog_sanitario_product_class_default_rules_v2",
] as const;

const now = "2026-06-12T12:00:00.000Z";
const later = "2026-06-12T13:00:00.000Z";

describe("offline ProductClass v2 catalog stores", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all(stores.map((store) => db.table(store).clear()));
    await db.queue_ops.clear();
  });

  afterEach(async () => {
    await Promise.all(stores.map((store) => db.table(store).clear()));
    await db.queue_ops.clear();
  });

  it("registra stores ProductClass v2 no Dexie v23", () => {
    expect(db.verno).toBe(23);
    expect(db.tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([...stores]),
    );
  });

  it("mapeia tabelas remotas ProductClass v2 para stores locais catalog_* sem acionar state_*", () => {
    expect(getLocalStoreName("sanitario_product_classes_v2")).toBe(
      "catalog_sanitario_product_classes_v2",
    );
    expect(getRemoteTableName("catalog_sanitario_product_classes_v2")).toBe(
      "sanitario_product_classes_v2",
    );
  });

  it("preserva registro global com fazenda_id null, metadata, arrays e timestamps", async () => {
    const productClass: SanitarioProductClassLocalV2 = {
      id: "class-global-1",
      fazenda_id: null,
      scope: "global",
      class_key: "vacina_brucelose_b19",
      name: "Vacina contra brucelose B19",
      product_type: "vacina",
      product_subtype: "cepa_b19",
      target_condition: "brucelose",
      species_scope: ["bovino", "bubalino"],
      curation_status: "candidate",
      automation_status: "manual_only",
      limitations: ["requer fonte forte por produto executado"],
      metadata: { source: "phase_12e1_test", tags: ["catalog"] },
      created_at: now,
      updated_at: later,
      deleted_at: null,
    };

    await db.catalog_sanitario_product_classes_v2.put(productClass);

    const stored = await db.catalog_sanitario_product_classes_v2.get(productClass.id);
    expect(stored).toMatchObject({
      scope: "global",
      fazenda_id: null,
      updated_at: later,
      deleted_at: null,
    });
    expect(stored?.species_scope).toEqual(["bovino", "bubalino"]);
    expect(stored?.limitations).toEqual([
      "requer fonte forte por produto executado",
    ]);
    expect(stored?.metadata).toEqual({
      source: "phase_12e1_test",
      tags: ["catalog"],
    });
  });

  it("preserva registro tenant com fazenda_id preenchido e deleted_at", async () => {
    const group: SanitarioProductClassGroupLocalV2 = {
      id: "group-tenant-1",
      fazenda_id: "farm-1",
      scope: "tenant",
      group_key: "antiparasitarios_fazenda",
      name: "Antiparasitarios da fazenda",
      requires_mv_for_other_class: true,
      curation_status: "needs_review",
      automation_status: "preview_allowed",
      limitations: ["configuracao local ainda sem push"],
      metadata: { owner: "farm-1" },
      created_at: now,
      updated_at: later,
      deleted_at: "2026-06-12T14:00:00.000Z",
    };

    await db.catalog_sanitario_product_class_groups_v2.put(group);

    const stored = await db.catalog_sanitario_product_class_groups_v2.get(group.id);
    expect(stored).toMatchObject({
      scope: "tenant",
      fazenda_id: "farm-1",
      updated_at: later,
      deleted_at: "2026-06-12T14:00:00.000Z",
    });
    expect(stored?.limitations).toEqual(["configuracao local ainda sem push"]);
    expect(await db.queue_ops.count()).toBe(0);
  });

  it("preserva membership e default rule sem criar push remoto", async () => {
    const member: SanitarioProductClassGroupMemberLocalV2 = {
      id: "member-1",
      fazenda_id: null,
      scope: "global",
      group_id: "group-global-1",
      class_id: "class-global-1",
      is_allowed: true,
      requires_mv_override: null,
      limitations: ["membro de catalogo local"],
      metadata: { order: 1 },
      created_at: now,
      updated_at: later,
      deleted_at: null,
    };
    const rule: SanitarioProductClassDefaultRuleLocalV2 = {
      id: "rule-1",
      fazenda_id: null,
      scope: "global",
      class_id: "class-global-1",
      species_code: "bovino",
      aptitude: "leite",
      dose_rule: { kind: "by_label" },
      route_rule: { route: "subcutanea" },
      withdrawal_rule: { status: "requires_executed_product" },
      execution_product_policy: "required_at_execution",
      can_validate_execution: false,
      requires_executed_product_for_withdrawal: true,
      source_refs: [{ type: "label", field_keys: ["dose", "route"] }],
      limitations: ["nao calcula carencia ativa"],
      metadata: { phase: "12E1" },
      curation_status: "candidate",
      created_at: now,
      updated_at: later,
      deleted_at: null,
    };

    await db.catalog_sanitario_product_class_group_members_v2.put(member);
    await db.catalog_sanitario_product_class_default_rules_v2.put(rule);

    expect(
      await db.catalog_sanitario_product_class_group_members_v2.get(member.id),
    ).toMatchObject({
      scope: "global",
      group_id: "group-global-1",
      class_id: "class-global-1",
      updated_at: later,
      deleted_at: null,
    });
    expect(
      await db.catalog_sanitario_product_class_default_rules_v2.get(rule.id),
    ).toMatchObject({
      scope: "global",
      species_code: "bovino",
      aptitude: "leite",
      updated_at: later,
      deleted_at: null,
      source_refs: [{ type: "label", field_keys: ["dose", "route"] }],
    });
    expect(await db.queue_ops.count()).toBe(0);
  });
});
