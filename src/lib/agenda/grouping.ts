import type {
  AgendaItem,
  ProtocoloSanitario,
} from "@/lib/offline/types";

export interface AgendaEventGroupMeta {
  key: string;
  title: string;
  subtitle: string;
}

interface BuildAgendaEventGroupMetaInput {
  item: Pick<
    AgendaItem,
    | "dominio"
    | "tipo"
    | "source_kind"
    | "source_ref"
    | "payload"
    | "protocol_item_version_id"
    | "interval_days_applied"
    | "dedup_key"
  >;
  produtoLabel: string;
  protocol?: Pick<ProtocoloSanitario, "id" | "nome"> | null;
}

function readString(
  record: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(
  record: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeToken(value: string | null | undefined): string {
  if (!value) return "na";

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "na";
}

function formatTypeLabel(value: string): string {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function buildSubtitle(input: BuildAgendaEventGroupMetaInput): string {
  const protocolItemId = readString(input.item.source_ref, "protocolo_item_id");
  const milestoneKey = readString(input.item.source_ref, "milestone_key");
  const doseNum = readNumber(input.item.source_ref, "dose_num");
  const parts: string[] = [];

  if (input.protocol?.nome) {
    parts.push(input.protocol.nome);
  } else if (protocolItemId) {
    parts.push(`Item ${protocolItemId.slice(0, 8)}`);
  } else if (milestoneKey) {
    parts.push(`Marco ${milestoneKey.replaceAll("_", " ")}`);
  } else {
    parts.push(formatTypeLabel(input.item.tipo));
  }

  if (typeof doseNum === "number" && doseNum > 0) {
    parts.push(`Dose ${doseNum}`);
  }

  if (
    typeof input.item.interval_days_applied === "number" &&
    input.item.interval_days_applied > 0
  ) {
    parts.push(`${input.item.interval_days_applied}d`);
  }

  parts.push(input.item.source_kind === "automatico" ? "Automatico" : "Manual");

  return parts.join(" | ");
}

export function buildAgendaEventGroupMeta(
  input: BuildAgendaEventGroupMetaInput,
): AgendaEventGroupMeta {
  const protocolItemId = readString(input.item.source_ref, "protocolo_item_id");
  const protocolId =
    readString(input.item.source_ref, "protocolo_id") ?? input.protocol?.id ?? null;
  const milestoneKey = readString(input.item.source_ref, "milestone_key");
  const indicacao =
    readString(input.item.source_ref, "indicacao") ??
    readString(input.item.payload, "indicacao");
  const doseNum = readNumber(input.item.source_ref, "dose_num");

  let key: string;

  if (input.item.protocol_item_version_id) {
    key = `protocol-version:${input.item.protocol_item_version_id}`;
  } else if (protocolItemId) {
    key = `protocol-item:${protocolItemId}`;
  } else if (milestoneKey) {
    key = `milestone:${normalizeToken(milestoneKey)}`;
  } else {
    key = [
      `kind:${input.item.source_kind}`,
      `dom:${input.item.dominio}`,
      `tipo:${normalizeToken(input.item.tipo)}`,
      `produto:${normalizeToken(input.produtoLabel)}`,
      `proto:${normalizeToken(protocolId)}`,
      `indicacao:${normalizeToken(indicacao)}`,
      `interval:${input.item.interval_days_applied ?? 0}`,
      `dose:${doseNum ?? 0}`,
    ].join("|");
  }

  return {
    key,
    title: input.produtoLabel,
    subtitle: buildSubtitle(input),
  };
}
