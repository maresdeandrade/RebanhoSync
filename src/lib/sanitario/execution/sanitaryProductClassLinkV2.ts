import type {
  SanitarioProductClassGroupMemberLocalV2,
  SanitarioProductClassLocalV2,
  SanitarioProdutoClassLinkLocalV2,
} from "@/lib/offline/types";

export type ProductClassLinkScopeEntryV2 = Pick<
  SanitarioProductClassLocalV2,
  "scope" | "fazenda_id"
>;

function classScopeAvailable(
  entry: ProductClassLinkScopeEntryV2,
  fazendaId: string | null,
) {
  return (
    (entry.scope === "global" && entry.fazenda_id === null) ||
    (entry.scope === "tenant" && entry.fazenda_id === fazendaId)
  );
}

export function resolveApprovedProductClassKeysV2(
  productId: string,
  productClassLinks: SanitarioProdutoClassLinkLocalV2[],
  productClasses: SanitarioProductClassLocalV2[],
  fazendaId: string | null,
) {
  const classKeysById = new Map(
    productClasses
      .filter(
        (entry) =>
          !entry.deleted_at &&
          entry.curation_status === "approved_for_catalog" &&
          entry.scope === "global" &&
          classScopeAvailable(entry, fazendaId),
      )
      .map((entry) => [entry.id, entry.class_key]),
  );
  const keys = new Set<string>();
  for (const link of productClassLinks) {
    if (
      link.deleted_at ||
      link.product_id !== productId ||
      link.status_curatorial !== "ativo" ||
      !link.source_refs.some(
        (ref) =>
          ref !== null &&
          typeof ref === "object" &&
          typeof ref.id === "string" &&
          ref.id.trim() &&
          ref.field === "product_class",
      )
    ) {
      continue;
    }
    const classKey = classKeysById.get(link.class_id);
    if (classKey) keys.add(classKey);
  }
  return keys;
}

export async function readProductRequirementMatchV2(
  db: Pick<
    typeof import("@/lib/offline/db").db,
    | "catalog_sanitario_produto_class_links_v2"
    | "catalog_sanitario_product_classes_v2"
    | "catalog_sanitario_product_class_group_members_v2"
  >,
  productId: string,
  requirement: {
    kind: string;
    classKey?: string | null;
    groupId?: string | null;
  },
  fazendaId: string,
) {
  const [links, classes, members] = await Promise.all([
    db.catalog_sanitario_produto_class_links_v2
      .where("product_id")
      .equals(productId)
      .toArray(),
    db.catalog_sanitario_product_classes_v2.toArray(),
    db.catalog_sanitario_product_class_group_members_v2.toArray(),
  ]);
  const keys = resolveApprovedProductClassKeysV2(
    productId,
    links,
    classes,
    fazendaId,
  );
  const allowed =
    requirement.kind === "product_class_group"
      ? resolveClassKeysByGroupV2(classes, members, fazendaId).get(
          requirement.groupId ?? "",
        )
      : new Set(requirement.classKey ? [requirement.classKey] : []);
  const matchingKeys = [...keys].filter((key) => allowed?.has(key));
  return {
    matches: matchingKeys.length > 0,
    links: links
      .filter((link) =>
        classes.some(
          (entry) =>
            entry.id === link.class_id &&
            matchingKeys.includes(entry.class_key),
        ),
      )
      .filter((link) => link.status_curatorial === "ativo" && !link.deleted_at)
      .map((link) => ({
        linkId: link.id,
        classId: link.class_id,
        classKey: classes.find((entry) => entry.id === link.class_id)!
          .class_key,
        catalogUpdatedAt: link.updated_at,
        sourceRefs: link.source_refs,
      })),
  };
}

export function resolveClassKeysByGroupV2(
  productClasses: SanitarioProductClassLocalV2[],
  groupMembers: SanitarioProductClassGroupMemberLocalV2[],
  fazendaId: string | null,
) {
  const classesByGroup = new Map<string, Set<string> | null>();
  const classKeysById = new Map(
    productClasses
      .filter(
        (entry) => !entry.deleted_at && classScopeAvailable(entry, fazendaId),
      )
      .map((entry) => [entry.id, entry.class_key]),
  );
  const unresolvedGroups = new Set<string>();
  for (const member of groupMembers) {
    if (member.deleted_at || !member.is_allowed) continue;
    if (!classScopeAvailable(member, fazendaId)) continue;
    const classKey = classKeysById.get(member.class_id);
    if (!classKey) {
      unresolvedGroups.add(member.group_id);
      continue;
    }
    const current = classesByGroup.get(member.group_id) ?? new Set<string>();
    current.add(classKey);
    classesByGroup.set(member.group_id, current);
  }
  for (const groupId of unresolvedGroups) classesByGroup.set(groupId, null);
  return classesByGroup;
}

export function productMatchesTechnicalRequirementV2(
  productId: string,
  requiredClass: string,
  productClassLinks: SanitarioProdutoClassLinkLocalV2[],
  productClasses: SanitarioProductClassLocalV2[],
  fazendaId: string | null,
) {
  return resolveApprovedProductClassKeysV2(
    productId,
    productClassLinks,
    productClasses,
    fazendaId,
  ).has(requiredClass);
}
