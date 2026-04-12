import type {
  CatalogoProtocoloOficial,
  CatalogoProtocoloOficialItem,
  FazendaSanidadeConfig,
  SanitaryOfficialLegalStatusEnum,
} from "@/lib/offline/types";

export type RegulatoryOverlayStatus =
  | "pendente"
  | "conforme"
  | "ajuste_necessario";

export type RegulatoryOverlayComplianceKind = "feed_ban" | "checklist";
export type RegulatoryOverlaySourceScope = "oficial" | "fazenda";

export interface FarmCustomRegulatoryOverlayDefinition {
  id: string;
  label: string;
  description: string;
  subarea: string | null;
  statusLegal: SanitaryOfficialLegalStatusEnum;
  animalCentric: boolean;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

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
  sourceScope: RegulatoryOverlaySourceScope;
  editable: boolean;
  customOverlayId: string | null;
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

function readDefinitionArray(
  record: Record<string, unknown> | null | undefined,
  key: string,
): Record<string, unknown>[] {
  const value = record?.[key];
  if (!Array.isArray(value)) return [];

  return value.filter(
    (entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
  );
}

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

function normalizeCustomOverlayStatusLegal(
  value: string | null,
): SanitaryOfficialLegalStatusEnum {
  if (value === "obrigatorio") return value;
  if (value === "recomendado") return value;
  return "boa_pratica";
}

function resolveCustomOverlayArea(
  definition: FarmCustomRegulatoryOverlayDefinition,
): CatalogoProtocoloOficialItem["area"] {
  if (definition.subarea === "feed_ban" || definition.subarea === "agua_limpeza") {
    return "nutricao";
  }
  if (definition.subarea === "notificacao") {
    return "notificacao";
  }
  return "biosseguranca";
}

function buildFarmCustomOverlayTemplate(
  definition: FarmCustomRegulatoryOverlayDefinition,
): CatalogoProtocoloOficial {
  const now = definition.updatedAt ?? definition.createdAt ?? new Date().toISOString();

  return {
    id: `farm-overlay-template:${definition.id}`,
    slug: `farm-overlay:${definition.id}`,
    nome: "Complemento operacional da fazenda",
    versao: 1,
    escopo: "federal",
    uf: null,
    aptidao: "all",
    sistema: "all",
    status_legal: definition.statusLegal,
    base_legal_json: {},
    payload: {
      execution_mode: "checklist",
      animal_centric: definition.animalCentric,
      source_scope: "fazenda",
      custom_overlay_id: definition.id,
    },
    created_at: definition.createdAt ?? now,
    updated_at: now,
  };
}

function buildFarmCustomOverlayItem(
  definition: FarmCustomRegulatoryOverlayDefinition,
): CatalogoProtocoloOficialItem {
  const now = definition.updatedAt ?? definition.createdAt ?? new Date().toISOString();

  return {
    id: `farm-overlay-item:${definition.id}`,
    template_id: `farm-overlay-template:${definition.id}`,
    area: resolveCustomOverlayArea(definition),
    codigo: `farm-overlay:${definition.id}`,
    categoria_animal: null,
    gatilho_tipo: "calendario",
    gatilho_json: {},
    frequencia_json: {},
    requires_vet: false,
    requires_gta: false,
    carencia_regra_json: {},
    gera_agenda: false,
    payload: {
      label: definition.label,
      indicacao: definition.description,
      subarea: definition.subarea,
      custom_overlay_id: definition.id,
      source_scope: "fazenda",
    },
    created_at: definition.createdAt ?? now,
    updated_at: now,
  };
}

export function readFarmCustomRegulatoryOverlayDefinitions(
  payload: Record<string, unknown> | null | undefined,
): FarmCustomRegulatoryOverlayDefinition[] {
  return readDefinitionArray(payload, "custom_overlay_definitions")
    .map((entry) => {
      const id = readString(entry, "id");
      const label = readString(entry, "label");
      if (!id || !label) return null;

      return {
        id,
        label,
        description: readString(entry, "description") ?? "",
        subarea: readString(entry, "subarea"),
        statusLegal: normalizeCustomOverlayStatusLegal(
          readString(entry, "status_legal"),
        ),
        animalCentric: readBoolean(entry, "animal_centric"),
        active: entry.active !== false,
        createdAt: readString(entry, "created_at"),
        updatedAt: readString(entry, "updated_at"),
      } satisfies FarmCustomRegulatoryOverlayDefinition;
    })
    .filter(
      (entry): entry is FarmCustomRegulatoryOverlayDefinition => Boolean(entry),
    )
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function upsertFarmCustomRegulatoryOverlayDefinition(
  currentPayload: Record<string, unknown> | null | undefined,
  definition: FarmCustomRegulatoryOverlayDefinition,
): Record<string, unknown> {
  const definitions = readFarmCustomRegulatoryOverlayDefinitions(currentPayload);
  const nextDefinitions = [...definitions];
  const index = nextDefinitions.findIndex((entry) => entry.id === definition.id);

  if (index >= 0) {
    nextDefinitions[index] = definition;
  } else {
    nextDefinitions.push(definition);
  }

  return {
    ...(currentPayload ?? {}),
    custom_overlay_definitions: nextDefinitions
      .sort((left, right) => left.label.localeCompare(right.label))
      .map((entry) => ({
        id: entry.id,
        label: entry.label,
        description: entry.description,
        subarea: entry.subarea,
        status_legal: entry.statusLegal,
        animal_centric: entry.animalCentric,
        active: entry.active,
        created_at: entry.createdAt,
        updated_at: entry.updatedAt,
      })),
  };
}

export function removeFarmCustomRegulatoryOverlayDefinition(
  currentPayload: Record<string, unknown> | null | undefined,
  overlayId: string,
): Record<string, unknown> {
  const definitions = readFarmCustomRegulatoryOverlayDefinitions(currentPayload).filter(
    (entry) => entry.id !== overlayId,
  );
  const overlayRuntime = readRecord(currentPayload, "overlay_runtime") ?? {};
  const runtimeItems = { ...(readRecord(overlayRuntime, "items") ?? {}) };
  delete runtimeItems[`farm-overlay:${overlayId}`];

  return {
    ...(currentPayload ?? {}),
    custom_overlay_definitions: definitions.map((entry) => ({
      id: entry.id,
      label: entry.label,
      description: entry.description,
      subarea: entry.subarea,
      status_legal: entry.statusLegal,
      animal_centric: entry.animalCentric,
      active: entry.active,
      created_at: entry.createdAt,
      updated_at: entry.updatedAt,
    })),
    overlay_runtime: {
      ...overlayRuntime,
      items: runtimeItems,
    },
  };
}

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
  const itemsByTemplate = new Map<string, CatalogoProtocoloOficialItem[]>();
  for (const item of (items || [])) {
    const current = itemsByTemplate.get(item.template_id) ?? [];
    current.push(item);
    itemsByTemplate.set(item.template_id, current);
  }

  const officialEntries = (templates || []).flatMap((template) => {
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
          sourceScope: "oficial",
          editable: false,
          customOverlayId: null,
        } satisfies RegulatoryOverlayEntry;
      });
  });

  const customEntries = readFarmCustomRegulatoryOverlayDefinitions(config?.payload)
    .filter((definition) => definition.active)
    .map((definition) => {
      const template = buildFarmCustomOverlayTemplate(definition);
      const item = buildFarmCustomOverlayItem(definition);
      const runtime = readRegulatoryOverlayRuntimeRecord(
        config?.payload,
        item.codigo,
      );

      return {
        template,
        item,
        label: definition.label,
        subarea: definition.subarea,
        complianceKind: "checklist",
        status: runtime?.status ?? "pendente",
        runtime,
        animalCentric: definition.animalCentric,
        sourceScope: "fazenda",
        editable: true,
        customOverlayId: definition.id,
      } satisfies RegulatoryOverlayEntry;
    });

  const entries = [...officialEntries, ...customEntries];
  if (entries.length === 0) return [];

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
    if (left.sourceScope !== right.sourceScope) {
      return left.sourceScope === "oficial" ? -1 : 1;
    }
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
    source_scope: entry.sourceScope,
    compliance_kind: entry.complianceKind,
    status: submission.status,
    ...(entry.sourceScope === "oficial"
      ? {
          official_template_id: entry.template.id,
          official_template_slug: entry.template.slug,
          official_item_id: entry.item.id,
          official_item_code: entry.item.codigo,
          official_item_label: entry.label,
          official_status_legal: entry.template.status_legal,
          official_scope: entry.template.escopo,
          official_uf: entry.template.uf,
        }
      : {
          custom_overlay_id: entry.customOverlayId,
          custom_overlay_code: entry.item.codigo,
          custom_overlay_label: entry.label,
          custom_status_legal: entry.template.status_legal,
        }),
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
          source_scope: entry.sourceScope,
          custom_overlay_id: entry.customOverlayId,
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
