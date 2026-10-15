import type {
  SanitarioAgendaLocalV2,
  SanitarioProtocoloItemVersionLocalV2,
  SanitarioProtocoloLocalV2,
} from "@/lib/offline/types";

// Prospective use requires current catalog approval. Explicit factual registration
// preserves already performed applications; catalog review becomes an audit warning.
// Identity, tenant scope and immutable item bindings remain enforced in both modes.
export function sanitaryProtocolExecutionRejectionsV2(
  agenda: SanitarioAgendaLocalV2,
  protocol: SanitarioProtocoloLocalV2 | undefined,
  item: SanitarioProtocoloItemVersionLocalV2 | undefined,
  farmUf?: string | null,
  mode: "prospective" | "executed_fact" = "prospective",
): string[] {
  const rejected: string[] = [];
  const factual = mode === "executed_fact";
  if (
    (!protocol && !factual) || (protocol && (
      (!factual && protocol.deleted_at) || protocol.id !== agenda.protocolo_id ||
      (protocol.scope === "fazenda" && protocol.fazenda_id !== agenda.fazenda_id) ||
      (protocol.scope !== "fazenda" && protocol.fazenda_id !== null)
    ))
  ) {
    rejected.push("protocol_not_available");
  } else if (!factual && protocol && (
    protocol.status !== "active" || protocol.approval_status !== "approved" ||
    ["bloqueado", "experimental_alerta"].includes(protocol.legal_status) ||
    protocol.metadata.automationStatus === "blocked" || protocol.metadata.archived === true
  )) {
    rejected.push("protocol_not_approved");
  }
  if (!factual && protocol?.metadata.requires_uf_context === true) {
    const uf = farmUf?.trim().toUpperCase();
    const excluded = Array.isArray(protocol.metadata.excluded_ufs)
      ? protocol.metadata.excluded_ufs : [];
    if (!uf) rejected.push("missing_jurisdiction_context");
    else if (excluded.includes(uf)) rejected.push("protocol_region_not_authorized");
  }
  const snapshotAction = agenda.protocol_item_snapshot.actionType ?? agenda.protocol_item_snapshot.action_type;
  const snapshotStatus = agenda.protocol_item_snapshot.itemStatus ?? agenda.protocol_item_snapshot.item_status;
  if (snapshotAction === "alerta" || snapshotStatus === "somente_alerta" || agenda.acao_sanitaria === "alerta") {
    rejected.push("protocol_item_not_executable");
  }
  if (
    (!item && !factual) || (item && (
      (!factual && item.deleted_at) || item.id !== agenda.protocol_item_version_id ||
      item.protocol_id !== agenda.protocolo_id
    ))
  ) {
    rejected.push("protocol_item_not_available");
  } else if (item && (
    item.item_status === "somente_alerta" || item.action_type === "alerta" ||
    (!factual && (item.status !== "active" || item.item_status === "bloqueado"))
  )) {
    rejected.push("protocol_item_not_executable");
  }
  if (item && !item.deleted_at) {
    const requirement = agenda.metadata.productRequirementKind ??
      agenda.protocol_item_snapshot.productRequirementKind ??
      agenda.protocol_item_snapshot.product_requirement_kind ?? "none";
    if (requirement !== item.product_requirement_kind) {
      rejected.push("protocol_item_requirement_mismatch");
    }
    if (item.product_requirement_kind === "product_class") {
      const plannedClass = agenda.produto_classe ?? agenda.metadata.productClass ??
        agenda.protocol_item_snapshot.productClass ?? agenda.protocol_item_snapshot.product_class;
      if (plannedClass !== item.product_class) rejected.push("protocol_item_requirement_mismatch");
    }
    if (item.product_requirement_kind === "specific_product") {
      const plannedProduct = agenda.produto_veterinario_id ??
        agenda.produto_snapshot.productId ?? agenda.produto_snapshot.plannedProductId ??
        agenda.protocol_item_snapshot.productId ?? agenda.protocol_item_snapshot.product_id;
      if (!item.product_id || plannedProduct !== item.product_id) {
        rejected.push("protocol_item_requirement_mismatch");
      }
    }
    if (item.product_requirement_kind === "product_class_group") {
      const plannedGroup = agenda.metadata.productClassGroupId ??
        agenda.protocol_item_snapshot.productClassGroupId ??
        agenda.protocol_item_snapshot.product_class_group_id;
      if (!item.product_class_group_id || plannedGroup !== item.product_class_group_id) {
        rejected.push("protocol_item_requirement_mismatch");
      }
    }
  }
  return rejected;
}
