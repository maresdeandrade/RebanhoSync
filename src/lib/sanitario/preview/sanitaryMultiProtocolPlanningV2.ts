import type { SanitarioProdutoLocalV2 } from "@/lib/offline/types";
import type { SanitaryProtocolItemV2ReadModel } from "../catalog/sanitaryProtocolCatalogV2";
import { sanitaryPlanningHasFieldSourceV2 } from "../agenda/sanitaryPlanningPolicyV2";

function provenCommercialIdentity(
  product: SanitarioProdutoLocalV2 | undefined,
) {
  if (!product || product.deleted_at || product.status_curatorial !== "ativo")
    return false;
  return [
    product.nome_comercial,
    product.registro_numero,
    product.principio_ativo,
  ].every((value) => !!value?.trim());
}

// The canonical agenda/detail has ONE protocol_item_version_id. These groups are
// informational until a versioned multi-coverage factual contract exists.
export function identifySanitaryMultiProtocolGroupsV2(input: {
  items: SanitaryProtocolItemV2ReadModel[];
  products: SanitarioProdutoLocalV2[];
}) {
  const groups = new Map<string, SanitaryProtocolItemV2ReadModel[]>();
  for (const item of input.items) {
    if (!item.productId) continue;
    const members = groups.get(item.productId) ?? [];
    members.push(item);
    groups.set(item.productId, members);
  }
  return [...groups.entries()].flatMap(([productId, items]) => {
    if (new Set(items.map((item) => item.protocolId)).size < 2) return [];
    const product = input.products.find((entry) => entry.id === productId);
    const commercialIdentityProven = provenCommercialIdentity(product);
    const coverageProven =
      commercialIdentityProven &&
      items.every(
        (item) =>
          sanitaryPlanningHasFieldSourceV2(item, "composition") &&
          sanitaryPlanningHasFieldSourceV2(item, "product_requirement"),
      );
    const schemeKey = (item: SanitaryProtocolItemV2ReadModel) =>
      JSON.stringify([
        item.operationalWindowRule,
        item.doseRule,
        item.routeRule,
        item.boosterRule,
        item.eligibilityRule.species,
      ]);
    return [
      {
        productId,
        productName: product?.nome_comercial ?? null,
        coverageProven,
        compatibleScheme:
          coverageProven && new Set(items.map(schemeKey)).size === 1,
        itemVersions: items
          .map((item) => ({
            protocolId: item.protocolId,
            itemId: item.id,
            version: item.version,
          }))
          .sort((a, b) => a.itemId.localeCompare(b.itemId)),
        materializationAllowed: false as const,
        limitation:
          "Vínculo factual multiprotocolo não implementado; revisar aplicação única antes de materializar.",
      },
    ];
  });
}
