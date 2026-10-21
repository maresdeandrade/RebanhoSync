import type {
  SanitarioAgendaLocalV2,
  SanitarioProtocoloItemVersionLocalV2,
  SanitarioProtocoloLocalV2,
} from "@/lib/offline/types";

function protocolUnavailable(
  agenda: SanitarioAgendaLocalV2,
  protocol: SanitarioProtocoloLocalV2 | undefined,
  factual: boolean,
) {
  if (!protocol) return !factual;
  if (!factual && protocol.deleted_at) return true;
  if (protocol.id !== agenda.protocolo_id) return true;
  return protocol.scope === "fazenda"
    ? protocol.fazenda_id !== agenda.fazenda_id
    : protocol.fazenda_id !== null;
}

function protocolUnapproved(protocol: SanitarioProtocoloLocalV2) {
  return protocol.status !== "active" || protocol.approval_status !== "approved" ||
    ["bloqueado", "experimental_alerta"].includes(protocol.legal_status) ||
    protocol.metadata.automationStatus === "blocked" || protocol.metadata.archived === true;
}

function jurisdictionRejections(
  protocol: SanitarioProtocoloLocalV2 | undefined,
  factual: boolean,
  farmUf?: string | null,
): string[] {
  if (factual || protocol?.metadata.requires_uf_context !== true) return [];
  const uf = farmUf?.trim().toUpperCase();
  const excluded = Array.isArray(protocol.metadata.excluded_ufs)
    ? protocol.metadata.excluded_ufs : [];
  if (!uf) return ["missing_jurisdiction_context"];
  return excluded.includes(uf) ? ["protocol_region_not_authorized"] : [];
}

function itemUnavailable(
  agenda: SanitarioAgendaLocalV2,
  item: SanitarioProtocoloItemVersionLocalV2 | undefined,
  factual: boolean,
) {
  if (!item) return !factual;
  if (!factual && item.deleted_at) return true;
  return item.id !== agenda.protocol_item_version_id || item.protocol_id !== agenda.protocolo_id;
}

function itemNotExecutable(item: SanitarioProtocoloItemVersionLocalV2, factual: boolean) {
  return item.item_status === "somente_alerta" || item.action_type === "alerta" ||
    (!factual && (item.status !== "active" || item.item_status === "bloqueado"));
}

function classRequirementMismatch(agenda: SanitarioAgendaLocalV2, item: SanitarioProtocoloItemVersionLocalV2) {
  const plannedClass = agenda.produto_classe ?? agenda.metadata.productClass ??
    agenda.protocol_item_snapshot.productClass ?? agenda.protocol_item_snapshot.product_class;
  return plannedClass !== item.product_class;
}

function productRequirementMismatch(agenda: SanitarioAgendaLocalV2, item: SanitarioProtocoloItemVersionLocalV2) {
  const plannedProduct = agenda.produto_veterinario_id ??
    agenda.produto_snapshot.productId ?? agenda.produto_snapshot.plannedProductId ??
    agenda.protocol_item_snapshot.productId ?? agenda.protocol_item_snapshot.product_id;
  return !item.product_id || plannedProduct !== item.product_id;
}

function groupRequirementMismatch(agenda: SanitarioAgendaLocalV2, item: SanitarioProtocoloItemVersionLocalV2) {
  const plannedGroup = agenda.metadata.productClassGroupId ??
    agenda.protocol_item_snapshot.productClassGroupId ??
    agenda.protocol_item_snapshot.product_class_group_id;
  return !item.product_class_group_id || plannedGroup !== item.product_class_group_id;
}

function plannedRequirementMismatch(agenda: SanitarioAgendaLocalV2, item: SanitarioProtocoloItemVersionLocalV2) {
  switch (item.product_requirement_kind) {
    case "product_class": return classRequirementMismatch(agenda, item);
    case "specific_product": return productRequirementMismatch(agenda, item);
    case "product_class_group": return groupRequirementMismatch(agenda, item);
    default: return false;
  }
}

function requirementRejections(agenda: SanitarioAgendaLocalV2, item: SanitarioProtocoloItemVersionLocalV2) {
  const rejected: string[] = [];
  const requirement = agenda.metadata.productRequirementKind ??
    agenda.protocol_item_snapshot.productRequirementKind ??
    agenda.protocol_item_snapshot.product_requirement_kind ?? "none";
  if (requirement !== item.product_requirement_kind) rejected.push("protocol_item_requirement_mismatch");
  if (plannedRequirementMismatch(agenda, item)) rejected.push("protocol_item_requirement_mismatch");
  return rejected;
}

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
  if (!factual && agenda.protocol_item_snapshot.planningKind === "avaliacao_manejo_generica") {
    rejected.push("generic_agenda_requires_explicit_scheme_revalidation");
  }
  if (protocolUnavailable(agenda, protocol, factual)) {
    rejected.push("protocol_not_available");
  } else if (!factual && protocol && protocolUnapproved(protocol)) {
    rejected.push("protocol_not_approved");
  }
  rejected.push(...jurisdictionRejections(protocol, factual, farmUf));
  const snapshotAction = agenda.protocol_item_snapshot.actionType ?? agenda.protocol_item_snapshot.action_type;
  const snapshotStatus = agenda.protocol_item_snapshot.itemStatus ?? agenda.protocol_item_snapshot.item_status;
  if (snapshotAction === "alerta" || snapshotStatus === "somente_alerta" || agenda.acao_sanitaria === "alerta") {
    rejected.push("protocol_item_not_executable");
  }
  if (itemUnavailable(agenda, item, factual)) {
    rejected.push("protocol_item_not_available");
  } else if (item && itemNotExecutable(item, factual)) {
    rejected.push("protocol_item_not_executable");
  }
  if (item && !item.deleted_at) {
    rejected.push(...requirementRejections(agenda, item));
  }
  return rejected;
}
