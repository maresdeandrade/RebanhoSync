import type { OfflineDB } from "@/lib/offline/db";
import type { SanitarioProdutoCarenciaRuleLocalV2, SanitarioProdutoFonteLocalV2 } from "@/lib/offline/types";

type EvidenceDb = Pick<OfflineDB, "catalog_sanitario_produto_carencia_fontes_v2" | "catalog_sanitario_fontes_tecnicas_v2" | "catalog_sanitario_fonte_cobertura_campos_v2">;

export async function readWithdrawalEvidenceCatalogV2(
  db: EvidenceDb,
  rules: SanitarioProdutoCarenciaRuleLocalV2[],
  productSources: SanitarioProdutoFonteLocalV2[],
) {
  const withdrawalSources = rules.length
    ? await db.catalog_sanitario_produto_carencia_fontes_v2
        .where("withdrawal_rule_id").anyOf(rules.map(rule => rule.id)).toArray()
    : [];
  const sourceIds = [...new Set(productSources.map(entry => entry.source_id))];
  const [sources, coverages] = await Promise.all([
    db.catalog_sanitario_fontes_tecnicas_v2.bulkGet(sourceIds),
    sourceIds.length
      ? db.catalog_sanitario_fonte_cobertura_campos_v2.where("source_id").anyOf(sourceIds).toArray()
      : Promise.resolve([]),
  ]);
  return { withdrawalSources, sources, coverages };
}
