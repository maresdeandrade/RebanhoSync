import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/offline/db";
import { loadSanitaryAgendaExecutionOptionsV2 } from "@/components/sanitario/SanitaryAgendaExecutionConfirmV2";
import {
  pullSanitarioTechnicalCatalogV2,
  pullSanitarioProductClassV2Catalog,
  pullSanitarioProtocolCatalogV2,
} from "@/lib/offline/pull";
import { createManualSanitaryAgendaV2 } from "@/lib/sanitario/agenda/sanitaryManualAgendaV2";
import { executeSanitaryAgendaV2 } from "@/lib/sanitario/execution/sanitaryAgendaExecutionV2";
import { hasStrongSourceCoveringFieldV2 } from "@/lib/sanitario/rules/sanitarySourceV2";
import type { SanitaryLocalAgendaListItemV2 } from "@/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2";
import type { SanitarioProtocoloItemVersionLocalV2 } from "@/lib/offline/types";

const remote = vi.hoisted(() => ({
  rows: {} as Record<string, Array<Record<string, unknown>>>,
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      const filters: Array<(r: Record<string, unknown>) => boolean> = [];
      const rows = () =>
        (remote.rows[table] ?? []).filter((r) => filters.every((f) => f(r)));
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => {
          filters.push((r) => r[k] === v);
          return q;
        },
        is: (k: string, v: unknown) => {
          filters.push((r) => r[k] === v);
          return q;
        },
        in: (k: string, v: unknown[]) => {
          filters.push((r) => v.includes(r[k]));
          return q;
        },
        gte: (k: string, v: string) => {
          filters.push((r) => String(r[k]) >= v);
          return q;
        },
        order: () => q,
        range: (a: number, b: number) =>
          Promise.resolve({ data: rows().slice(a, b + 1), error: null }),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({
            data: rows(),
            count: rows().length,
            error: null,
          }).then(resolve),
      };
      return q;
    },
  },
}));

describe.skipIf(!process.env.PRODUCT_CLASS_PERSISTED_FIXTURE)(
  "commercial rows persisted by PostgreSQL publication",
  () => {
    const farm = "11221122-1122-4122-a122-112211221122",
      animal = "22332233-2233-4233-a233-223322332233";
    let items: SanitarioProtocoloItemVersionLocalV2[];
    const selection = (item: SanitarioProtocoloItemVersionLocalV2) =>
      ({
        fazendaId: farm,
        productRequirementKind: "product_class",
        productClass: item.product_class,
      }) as SanitaryLocalAgendaListItemV2;
    beforeAll(async () => {
      remote.rows = JSON.parse(
        readFileSync(process.env.PRODUCT_CLASS_PERSISTED_FIXTURE!, "utf8"),
      );
      await Promise.all(db.tables.map((t) => t.clear()));
      await pullSanitarioProductClassV2Catalog(farm);
      await pullSanitarioTechnicalCatalogV2(farm);
      await pullSanitarioProtocolCatalogV2();
      items = (
        await db.catalog_sanitario_protocolo_itens_versions_v2.toArray()
      ).filter(
        (i) =>
          i.status === "active" &&
          i.product_requirement_kind === "product_class",
      );
    });
    it("offers classified commercial products for all 13 active class requirements and four actual groups", async () => {
      expect(items).toHaveLength(13);
      for (const item of items) {
        const options = await loadSanitaryAgendaExecutionOptionsV2([
          selection(item),
        ]);
        expect(
          options.productOptions.length,
          item.logical_item_key,
        ).toBeGreaterThan(0);
      }
      for (const group of await db.catalog_sanitario_product_class_groups_v2.toArray())
        expect(
          (
            await loadSanitaryAgendaExecutionOptionsV2([
              {
                fazendaId: farm,
                productRequirementKind: "product_class_group",
                productClassGroupId: group.id,
              } as SanitaryLocalAgendaListItemV2,
            ])
          ).productOptions.length,
          group.group_key,
        ).toBeGreaterThan(0);
      const pair = items.filter((i) =>
        ["vacina_ibr_bvd", "vacina_leptospirose"].includes(
          i.product_class ?? "",
        ),
      );
      const cattle = "88c4a3c9-868d-5eb0-974c-b16812a8918e";
      for (const i of pair)
        expect(
          (
            await loadSanitaryAgendaExecutionOptionsV2([selection(i)])
          ).productOptions.some((p) => p.id === cattle),
        ).toBe(true);
    });
    it("creates compatible and unspecified planning; canonical factual writer records actual product without granting clinical approval", async () => {
      const item = items.find(
        (i) => i.product_class === "vacina_raiva_herbivoros",
      )!;
      const protocol = (await db.catalog_sanitario_protocolos_v2.get(
        item.protocol_id,
      ))!;
      const product = (
        await loadSanitaryAgendaExecutionOptionsV2([selection(item)])
      ).productOptions[0];
      await db.state_animais.put({
        id: animal,
        fazenda_id: farm,
        identificacao: "fixture",
        sexo: "F",
        status: "ativo",
        especie: "bovino",
        lote_id: null,
      } as never);
      await db.state_fazenda_sanidade_config.put({
        fazenda_id: farm,
        uf: "DF",
        aptidao: "corte",
      } as never);
      const base = {
        target: { scope: "animal" as const, id: animal, fazendaId: farm },
        source: {
          kind: "sanitary_precheck_preview_v2" as const,
          protocolId: protocol.id,
          protocolItemVersionId: item.id,
          actionType: item.action_type,
          familyCode: protocol.family_code,
          itemKey: item.logical_item_key,
          itemLabel: "Commercial fixture",
          protocolName: protocol.name,
          precheckStatus: "in_action_window" as const,
          productRequirementKind: "product_class",
          productClass: item.product_class,
          planningKind: "aplicacao_esquema_definido" as const,
          planningEvidence: {
            planningScope: "class_scheme",
            itemVersion: item.version,
            executionProductPolicy:
              item.snapshot_template.executionProductPolicy,
            sourceRefsByField: item.source_refs_by_field,
            operationalWindowRule: item.operational_window_rule,
            boosterRule: item.booster_rule ?? {},
          },
        },
        plannedFor: "2026-11-20",
        clientOpId: "commercial-planned",
        confirmed: true,
      };
      const planned = await createManualSanitaryAgendaV2(
        { ...base, source: { ...base.source, plannedProductId: product.id } },
        db,
      );
      const unspecified = await createManualSanitaryAgendaV2(
        { ...base, clientOpId: "commercial-unspecified" },
        db,
      );
      expect(
        (await db.ops_sanitario_agenda_v2.get(unspecified.agendaId))
          ?.produto_snapshot.plannedProductId,
      ).toBeNull();
      const result = await executeSanitaryAgendaV2(
        {
          fazendaId: farm,
          agendaId: planned.agendaId,
          clientOpId: "commercial-fact",
          executedAt: "2026-11-20T00:00:00-03:00",
          registrationMode: "executed_fact",
          product: { productId: product.id, productName: product.name },
          application: { dose: 2, doseUnit: "mL", route: "SC" },
          confirmation: { userConfirmedExecution: true },
        },
        db,
      );
      const detail = await db.event_eventos_sanitario.get(result.eventId);
      expect(detail?.produto_snapshot).toMatchObject({
        productClassLinks: [
          expect.objectContaining({ classKey: "vacina_raiva_herbivoros" }),
        ],
      });
      expect(detail?.payload).toMatchObject({
        registration_mode: "executed_fact",
        prospective_authorization: false,
      });
      expect(result.createsActiveWithdrawal).toBe(false);
    });
    it("preserves clinical evidence guards and persisted associations after offline reopen", async () => {
      const sources = await db.catalog_sanitario_fontes_tecnicas_v2.toArray();
      for (const s of sources.filter(
        (s) => s.evidence_status === "SIM_COMPOSICAO_FABRICANTE",
      ))
        for (const field of [
          "dose",
          "route",
          "withdrawal",
          "species_authorization",
        ])
          expect(
            hasStrongSourceCoveringFieldV2(
              [
                {
                  kind: s.kind,
                  strength: s.strength,
                  evidenceStatus: s.evidence_status,
                  fieldKeys: [field],
                } as never,
              ],
              field,
            ),
          ).toBe(false);
      const before =
        await db.catalog_sanitario_produto_class_links_v2.toArray();
      expect(
        before.filter((l) => l.status_curatorial === "ativo"),
      ).toHaveLength(37);
      db.close();
      await db.open();
      expect(
        await db.catalog_sanitario_produto_class_links_v2.toArray(),
      ).toEqual(before);
    });
  },
);
