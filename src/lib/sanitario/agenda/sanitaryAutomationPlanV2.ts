import { z } from "zod";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { requireTenantSensitiveWrite } from "@/lib/offline/localReadBoundary";
import type { FazendaSanidadeConfig } from "@/lib/offline/types";
import {
  readLocalSanitaryProtocolCatalogV2,
  type SanitaryProtocolCatalogReadModelV2,
  type SanitaryProtocolCatalogLocalDb,
  type SanitaryProtocolItemV2ReadModel,
  type SanitaryProtocolV2ReadModel,
} from "../catalog/sanitaryProtocolCatalogV2";
import { sanitaryPlanningBlockersV2 } from "../preview/sanitaryWindowPlanningPreviewV2";

export const SANITARY_AUTOMATION_PLAN_KEY = "sanitary_agenda_automation_v2";
const contextSchema = z.object({
  rabiesRiskArea: z.boolean().nullable(),
  sanitaryCadence: z.enum(["annual", "semiannual"]).nullable(),
  reproductiveContext: z.enum(["prepartum", "peripartum"]).nullable(),
  management: z
    .enum(["pre_weaning", "rearing", "pre_feedlot", "deferred_pasture"])
    .nullable(),
});
const selectionSchema = z.object({
  protocolId: z.string().min(1),
  protocolVersion: z.number().int().positive(),
  itemId: z.string().min(1),
  itemVersion: z.number().int().positive(),
  productId: z.string().nullable(),
});
const planSchema = z.object({
  schemaVersion: z.literal(1),
  revision: z.number().int().positive(),
  enabled: z.boolean(),
  rules: z.array(selectionSchema),
  context: contextSchema,
  confirmedBy: z.string().min(1),
  confirmedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SanitaryAutomationRuleV2 = Required<
  z.infer<typeof selectionSchema>
>;
export type SanitaryAutomationPlanV2 = Omit<
  Required<z.infer<typeof planSchema>>,
  "context" | "rules"
> & {
  context: Required<z.infer<typeof contextSchema>>;
  rules: SanitaryAutomationRuleV2[];
};
export type SanitaryAutomationDraftV2 = Pick<
  SanitaryAutomationPlanV2,
  "rules" | "context"
>;

export function readSanitaryAutomationPlanV2(
  config: FazendaSanidadeConfig | undefined,
): SanitaryAutomationPlanV2 | null {
  if (config?.deleted_at) return null;
  const result = planSchema.safeParse(
    config?.payload?.[SANITARY_AUTOMATION_PLAN_KEY],
  );
  return result.success ? (result.data as SanitaryAutomationPlanV2) : null;
}

export function selectSanitaryAutomationRuleV2(
  protocol: SanitaryProtocolV2ReadModel,
  item: SanitaryProtocolItemV2ReadModel,
): SanitaryAutomationRuleV2 {
  return {
    protocolId: protocol.id,
    protocolVersion: protocol.version,
    itemId: item.id,
    itemVersion: item.version,
    productId: item.productId,
  };
}

export function resolveSanitaryAutomationRuleV2(
  catalog: SanitaryProtocolCatalogReadModelV2,
  rule: SanitaryAutomationRuleV2,
) {
  const protocol = catalog.protocols.find(
    (entry) =>
      entry.id === rule.protocolId && entry.version === rule.protocolVersion,
  );
  const item = catalog.items.find(
    (entry) =>
      entry.id === rule.itemId &&
      entry.protocolId === rule.protocolId &&
      entry.version === rule.itemVersion &&
      entry.productId === rule.productId,
  );
  if (!protocol || !item) return null;
  return { protocol, item };
}

function validatePlanRules(
  catalog: SanitaryProtocolCatalogReadModelV2,
  plan: SanitaryAutomationPlanV2,
  fazendaId: string,
) {
  if (!plan.enabled) return;
  if (!plan.rules.length)
    throw new Error("Selecione pelo menos uma regra autorizada.");
  for (const rule of plan.rules) {
    const resolved = resolveSanitaryAutomationRuleV2(catalog, rule);
    if (!resolved)
      throw new Error("Versão do protocolo alterada. Revise o plano.");
    if (
      resolved.protocol.fazendaId &&
      resolved.protocol.fazendaId !== fazendaId
    )
      throw new Error("Protocolo de outra fazenda.");
    if (
      sanitaryPlanningBlockersV2(resolved.protocol, resolved.item, "automatic")
        .length
    ) {
      throw new Error("Regra sem autorização técnica para geração automática.");
    }
  }
}

export async function saveSanitaryAutomationPlanV2(input: {
  fazendaId: string;
  expectedRevision: number;
  draft: SanitaryAutomationDraftV2;
  enabled: boolean;
  confirmed: boolean;
  actorId: string;
}): Promise<SanitaryAutomationPlanV2> {
  await requireTenantSensitiveWrite();
  if (!input.actorId || (input.enabled && !input.confirmed))
    throw new Error("Confirme a ativação do plano.");
  return db.transaction(
    "rw",
    [
      db.state_fazenda_sanidade_config,
      db.queue_gestures,
      db.queue_ops,
      db.catalog_sanitario_protocolos_v2,
      db.catalog_sanitario_protocolo_itens_versions_v2,
      db.catalog_sanitario_product_class_groups_v2,
    ],
    async () => {
      const config = await db.state_fazenda_sanidade_config.get(
        input.fazendaId,
      );
      if (!config || config.deleted_at)
        throw new Error("Configure primeiro o perfil sanitário da fazenda.");
      const previous = readSanitaryAutomationPlanV2(config);
      assertPlanRevision(config, previous, input.expectedRevision);
      const now = new Date().toISOString();
      const plan = planSchema.parse({
        ...input.draft,
        schemaVersion: 1,
        enabled: input.enabled,
        revision: input.expectedRevision + 1,
        confirmedBy: input.enabled ? input.actorId : previous?.confirmedBy ?? input.actorId,
        confirmedAt: input.enabled ? now : previous?.confirmedAt ?? now,
        updatedAt: now,
      }) as SanitaryAutomationPlanV2;
      const catalog = await readLocalSanitaryProtocolCatalogV2(
        db as unknown as SanitaryProtocolCatalogLocalDb,
      );
      validatePlanRules(catalog, plan, input.fazendaId);
      await createGesture(input.fazendaId, [
        {
          table: "fazenda_sanidade_config",
          action: "UPDATE",
          record: {
            fazenda_id: input.fazendaId,
            payload: {
              ...config.payload,
              [SANITARY_AUTOMATION_PLAN_KEY]: plan,
            },
          },
        },
      ]);
      return plan;
    },
  );
}

function assertPlanRevision(
  config: FazendaSanidadeConfig,
  previous: SanitaryAutomationPlanV2 | null,
  expectedRevision: number,
) {
  if (config.payload?.[SANITARY_AUTOMATION_PLAN_KEY] && !previous)
    throw new Error("Plano incompatível. Atualize o aplicativo.");
  if ((previous?.revision ?? 0) !== expectedRevision)
    throw new Error(
      "Plano alterado por outra operação. Reabra a configuração.",
    );
}
