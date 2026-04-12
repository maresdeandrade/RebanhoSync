import type {
  CatalogoProtocoloOficial,
  CatalogoProtocoloOficialItem,
  FazendaSanidadeConfig,
} from "@/lib/offline/types";

export type RegulatoryOverlayStatus =
  | "pendente"
  | "conforme"
  | "ajuste_necessario";

export type RegulatoryOverlayComplianceKind = "feed_ban" | "checklist";

export interface RegulatoryOverlayRuntimeRecord {
  templateSlug: string;
  templateName: string;
  itemCode: string;
  itemLabel: string;
  subarea: string | null;
  complianceKind: RegulatoryOverlayComplianceKind;
  status: RegulatoryOverlayStatus;
  checkedAt: string;
  responsible: string | null;
  notes: string | null;
  sourceEventId: string | null;
  answers: Record<string, unknown>;
}

export interface RegulatoryOverlayEntry {
  template: CatalogoProtocoloOficial;
  item: CatalogoProtocoloOficialItem;
  label: string;
  subarea: string | null;
  complianceKind: RegulatoryOverlayComplianceKind;
  status: RegulatoryOverlayStatus;
  runtime: RegulatoryOverlayRuntimeRecord | null;
  animalCentric: boolean;
}

export interface RegulatoryOverlaySubmission {
  status: Extract<RegulatoryOverlayStatus, "conforme" | "ajuste_necessario">;
  occurredAt: string;
  responsible?: string | null;
  notes?: string | null;
  answers?: Record<string, unknown>;
}

const readString = (
  record: Record<string, unknown> | null | undefined,
  key: string,
): string | null => {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
};

const readBoolean = (
  record: Record<string, unknown> | null | undefined,
  key: string,
) => record?.[key] === true;

const readStringArray = (
  record: Record<string, unknown> | null | undefined,
  key: string,
): string[] => {
  const value = record?.[key];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

const readRecord = (
  record: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown> | null => {
  const value = record?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

function isMaterializableOfficialItem(item: CatalogoProtocoloOficialItem) {
  return (
    item.area === "vacinacao" ||
    item.area === "parasitas" ||
    item.area === "medicamentos"
  );
}

const RUNTIME_OWNED_TEMPLATE_SLUGS = new Set([
  "transito-gta-precheck",
  "suspeita-notificacao-imediata",
]);

const readActivatedTemplateSlugs = (
  config: FazendaSanidadeConfig | null | undefined,
): string[] => readStringArray(config?.payload, "activated_template_slugs");

export function readRegulatoryOverlayRuntimeRecord(
  payload: Record<string, unknown> | null | undefined,
  itemCode: string,
): RegulatoryOverlayRuntimeRecord | null {
  const overlayRuntime = readRecord(payload, "overlay_runtime");
  const items = readRecord(overlayRuntime, "items");
  const entry = readRecord(items, itemCode);
  if (!entry) return null;

  const status = readString(entry, "status");
  if (
    status !== "pendente" &&
    status !== "conforme" &&
    status !== "ajuste_necessario"
  ) {
    return null;
  }

  const complianceKind = readString(entry, "compliance_kind");
  if (complianceKind !== "feed_ban" && complianceKind !== "checklist") {
    return null;
  }

  return {
    templateSlug: readString(entry, "template_slug") ?? "",
    templateName: readString(entry, "template_name") ?? "",
    itemCode: readString(entry, "item_code") ?? itemCode,
    itemLabel: readString(entry, "item_label") ?? itemCode,
    subarea: readString(entry, "subarea"),
    complianceKind,
    status,
    checkedAt: readString(entry, "checked_at") ?? "",
    responsible: readString(entry, "responsible"),
    notes: readString(entry, "notes"),
    sourceEventId: readString(entry, "source_evento_id"),
    answers: readRecord(entry, "answers") ?? {},
  };
}

export function getRegulatoryOverlayStatusTone(status: RegulatoryOverlayStatus) {
  if (status === "conforme") return "success";
  if (status === "ajuste_necessario") return "danger";
  return "warning";
}

export function getRegulatoryOverlayStatusLabel(status: RegulatoryOverlayStatus) {
  if (status === "conforme") return "Conforme";
  if (status === "ajuste_necessario") return "Ajuste necessario";
  return "Pendente";
}

export function buildActiveRegulatoryOverlayEntries({
  config,
  templates,
  items,
}: {
  config: FazendaSanidadeConfig | null | undefined;
  templates: CatalogoProtocoloOficial[];
  items: CatalogoProtocoloOficialItem[];
}): RegulatoryOverlayEntry[] {
  const activeSlugs = new Set(readActivatedTemplateSlugs(config));
  if (activeSlugs.size === 0) return [];

  const itemsByTemplate = new Map<string, CatalogoProtocoloOficialItem[]>();
  for (const item of items) {
    const current = itemsByTemplate.get(item.template_id) ?? [];
    current.push(item);
    itemsByTemplate.set(item.template_id, current);
  }

  const entries = templates.flatMap((template) => {
    if (!activeSlugs.has(template.slug)) return [];
    if (RUNTIME_OWNED_TEMPLATE_SLUGS.has(template.slug)) return [];

    return (itemsByTemplate.get(template.id) ?? [])
      .filter((item) => !isMaterializableOfficialItem(item))
      .map((item) => {
        const runtime = readRegulatoryOverlayRuntimeRecord(
          config?.payload,
          item.codigo,
        );
        const label =
          readString(item.payload, "label") ??
          readString(item.payload, "indicacao") ??
          item.codigo;
        const complianceKind: RegulatoryOverlayComplianceKind =
          item.codigo === "feed-ban" ? "feed_ban" : "checklist";

        return {
          template,
          item,
          label,
          subarea: readString(item.payload, "subarea"),
          complianceKind,
          status: runtime?.status ?? "pendente",
          runtime,
          animalCentric: readBoolean(template.payload, "animal_centric"),
        } satisfies RegulatoryOverlayEntry;
      });
  });

  return entries.sort((left, right) => {
    const leftWeight =
      left.status === "ajuste_necessario"
        ? 0
        : left.status === "pendente"
          ? 1
          : 2;
    const rightWeight =
      right.status === "ajuste_necessario"
        ? 0
        : right.status === "pendente"
          ? 1
          : 2;
    if (leftWeight !== rightWeight) return leftWeight - rightWeight;
    if (left.template.nome !== right.template.nome) {
      return left.template.nome.localeCompare(right.template.nome);
    }
    return left.label.localeCompare(right.label);
  });
}

export function buildRegulatoryOverlayEventPayload(
  entry: RegulatoryOverlayEntry,
  submission: RegulatoryOverlaySubmission,
): Record<string, unknown> {
  return {
    kind: "overlay_regulatorio",
    compliance_kind: entry.complianceKind,
    status: submission.status,
    official_template_id: entry.template.id,
    official_template_slug: entry.template.slug,
    official_item_id: entry.item.id,
    official_item_code: entry.item.codigo,
    official_item_label: entry.label,
    official_status_legal: entry.template.status_legal,
    official_scope: entry.template.escopo,
    official_uf: entry.template.uf,
    area: entry.item.area,
    subarea: entry.subarea,
    animal_centric: entry.animalCentric,
    notes: submission.notes?.trim() || null,
    responsible: submission.responsible?.trim() || null,
    answers: submission.answers ?? {},
  };
}

export function buildRegulatoryOverlayConfigPayload(
  currentPayload: Record<string, unknown> | null | undefined,
  entry: RegulatoryOverlayEntry,
  submission: RegulatoryOverlaySubmission,
  sourceEventId: string,
): Record<string, unknown> {
  const overlayRuntime = readRecord(currentPayload, "overlay_runtime") ?? {};
  const runtimeItems = readRecord(overlayRuntime, "items") ?? {};

  return {
    ...(currentPayload ?? {}),
    overlay_runtime: {
      ...overlayRuntime,
      items: {
        ...runtimeItems,
        [entry.item.codigo]: {
          template_slug: entry.template.slug,
          template_name: entry.template.nome,
          item_code: entry.item.codigo,
          item_label: entry.label,
          subarea: entry.subarea,
          compliance_kind: entry.complianceKind,
          status: submission.status,
          checked_at: submission.occurredAt,
          responsible: submission.responsible?.trim() || null,
          notes: submission.notes?.trim() || null,
          source_evento_id: sourceEventId,
          answers: submission.answers ?? {},
        },
      },
    },
  };
}
