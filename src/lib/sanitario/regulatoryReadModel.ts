import { db } from "@/lib/offline/db";
import type {
  CatalogoProtocoloOficial,
  CatalogoProtocoloOficialItem,
  FazendaSanidadeConfig,
} from "@/lib/offline/types";
import {
  buildActiveRegulatoryOverlayEntries,
  type RegulatoryOverlayEntry,
} from "@/lib/sanitario/compliance";
import {
  EMPTY_REGULATORY_COMPLIANCE_ATTENTION,
  summarizeRegulatoryComplianceAttention,
  type RegulatoryComplianceAttentionSummary,
} from "@/lib/sanitario/complianceAttention";
import {
  resolveComplianceFlowGuards,
  type ComplianceFlowGuardResult,
} from "@/lib/sanitario/complianceGuards";

export interface RegulatorySurfaceSource {
  config: FazendaSanidadeConfig | null;
  templates: CatalogoProtocoloOficial[];
  items: CatalogoProtocoloOficialItem[];
}

export interface RegulatoryFlowReadModel extends ComplianceFlowGuardResult {
  totalCount: number;
  blockerCount: number;
  warningCount: number;
  firstBlockerMessage: string | null;
  firstWarningMessage: string | null;
  hasIssues: boolean;
  tone: "success" | "warning" | "danger";
}

export type RegulatoryAnalyticsSubareaKey =
  | "feed_ban"
  | "quarentena"
  | "documental"
  | "agua_limpeza";

export type RegulatoryAnalyticsImpactKey =
  | "nutrition"
  | "movementInternal"
  | "sale";

export interface RegulatorySubareaAnalyticalCut {
  key: RegulatoryAnalyticsSubareaKey;
  label: string;
  openCount: number;
  blockerCount: number;
  warningCount: number;
  adjustmentCount: number;
  pendingCount: number;
  tone: "success" | "warning" | "danger";
  affectedImpacts: RegulatoryAnalyticsImpactKey[];
  recommendation: string;
}

export interface RegulatoryImpactAnalyticalCut {
  key: RegulatoryAnalyticsImpactKey;
  label: string;
  blockerCount: number;
  warningCount: number;
  totalCount: number;
  tone: "success" | "warning" | "danger";
  message: string;
}

export interface RegulatoryOperationalAnalytics {
  subareas: RegulatorySubareaAnalyticalCut[];
  impacts: RegulatoryImpactAnalyticalCut[];
}

export interface RegulatoryOperationalReadModel {
  entries: RegulatoryOverlayEntry[];
  attention: RegulatoryComplianceAttentionSummary;
  flows: {
    nutrition: RegulatoryFlowReadModel;
    movementInternal: RegulatoryFlowReadModel;
    movementExternal: RegulatoryFlowReadModel;
    sale: RegulatoryFlowReadModel;
  };
  analytics: RegulatoryOperationalAnalytics;
  hasOpenIssues: boolean;
  hasBlockingIssues: boolean;
}

export const EMPTY_REGULATORY_SURFACE_SOURCE: RegulatorySurfaceSource = {
  config: null,
  templates: [],
  items: [],
};

const EMPTY_FLOW_READ_MODEL: RegulatoryFlowReadModel = {
  blockers: [],
  warnings: [],
  totalCount: 0,
  blockerCount: 0,
  warningCount: 0,
  firstBlockerMessage: null,
  firstWarningMessage: null,
  hasIssues: false,
  tone: "success",
};

const REGULATORY_ANALYTICS_SUBAREA_KEYS: RegulatoryAnalyticsSubareaKey[] = [
  "feed_ban",
  "quarentena",
  "documental",
  "agua_limpeza",
];

const REGULATORY_ANALYTICS_IMPACT_KEYS: RegulatoryAnalyticsImpactKey[] = [
  "nutrition",
  "movementInternal",
  "sale",
];

const EMPTY_REGULATORY_ANALYTICS: RegulatoryOperationalAnalytics = {
  subareas: [],
  impacts: [],
};

export const EMPTY_REGULATORY_OPERATIONAL_READ_MODEL: RegulatoryOperationalReadModel = {
  entries: [],
  attention: EMPTY_REGULATORY_COMPLIANCE_ATTENTION,
  flows: {
    nutrition: EMPTY_FLOW_READ_MODEL,
    movementInternal: EMPTY_FLOW_READ_MODEL,
    movementExternal: EMPTY_FLOW_READ_MODEL,
    sale: EMPTY_FLOW_READ_MODEL,
  },
  analytics: EMPTY_REGULATORY_ANALYTICS,
  hasOpenIssues: false,
  hasBlockingIssues: false,
};

export function getRegulatoryAnalyticsSubareaLabel(
  key: RegulatoryAnalyticsSubareaKey,
) {
  if (key === "feed_ban") return "Feed-ban";
  if (key === "quarentena") return "Quarentena";
  if (key === "documental") return "Documental";
  return "Agua e limpeza";
}

export function getRegulatoryAnalyticsImpactLabel(
  key: RegulatoryAnalyticsImpactKey,
) {
  if (key === "nutrition") return "Impacta nutricao";
  if (key === "movementInternal") return "Impacta lote";
  return "Impacta transito/venda";
}

export function parseRegulatoryAnalyticsSubareaKey(
  value: string | null | undefined,
): RegulatoryAnalyticsSubareaKey | null {
  if (
    value === "feed_ban" ||
    value === "quarentena" ||
    value === "documental" ||
    value === "agua_limpeza"
  ) {
    return value;
  }

  return null;
}

export function parseRegulatoryAnalyticsImpactKey(
  value: string | null | undefined,
): RegulatoryAnalyticsImpactKey | null {
  if (
    value === "nutrition" ||
    value === "movementInternal" ||
    value === "sale"
  ) {
    return value;
  }

  return null;
}

export function resolveRegulatoryAnalyticsSubareaFromAttributes(input: {
  subarea?: string | null;
  complianceKind?: string | null;
}): RegulatoryAnalyticsSubareaKey | null {
  if (input.complianceKind === "feed_ban") return "feed_ban";
  if (input.subarea === "quarentena") return "quarentena";
  if (input.subarea === "agua_limpeza") return "agua_limpeza";
  if (
    input.subarea === "atualizacao_rebanho" ||
    input.subarea === "comprovacao_brucelose"
  ) {
    return "documental";
  }

  return null;
}

export function resolveRegulatoryAnalyticsSubareaKey(
  entry: RegulatoryOverlayEntry,
): RegulatoryAnalyticsSubareaKey | null {
  return resolveRegulatoryAnalyticsSubareaFromAttributes({
    subarea: entry.subarea,
    complianceKind: entry.complianceKind,
  });
}

export function resolveRegulatoryAnalyticsImpactsFromAttributes(input: {
  subarea?: string | null;
  complianceKind?: string | null;
}): RegulatoryAnalyticsImpactKey[] {
  const subareaKey = resolveRegulatoryAnalyticsSubareaFromAttributes(input);
  if (subareaKey === "feed_ban") return ["nutrition"];
  if (subareaKey === "agua_limpeza") return ["nutrition"];
  if (subareaKey === "quarentena") return ["movementInternal"];
  if (subareaKey === "documental") return ["sale"];
  return [];
}

export function resolveRegulatoryAnalyticsImpactsForEntry(
  entry: RegulatoryOverlayEntry,
): RegulatoryAnalyticsImpactKey[] {
  return resolveRegulatoryAnalyticsImpactsFromAttributes({
    subarea: entry.subarea,
    complianceKind: entry.complianceKind,
  });
}

export function matchesRegulatoryAnalyticsSubarea(
  entry: RegulatoryOverlayEntry,
  subarea: RegulatoryAnalyticsSubareaKey,
) {
  return resolveRegulatoryAnalyticsSubareaKey(entry) === subarea;
}

export function matchesRegulatoryAnalyticsImpact(
  entry: RegulatoryOverlayEntry,
  impact: RegulatoryAnalyticsImpactKey,
) {
  return resolveRegulatoryAnalyticsImpactsForEntry(entry).includes(impact);
}

function toFlowReadModel(result: ComplianceFlowGuardResult): RegulatoryFlowReadModel {
  const blockerCount = result.blockers.length;
  const warningCount = result.warnings.length;

  return {
    ...result,
    totalCount: blockerCount + warningCount,
    blockerCount,
    warningCount,
    firstBlockerMessage: result.blockers[0]?.message ?? null,
    firstWarningMessage: result.warnings[0]?.message ?? null,
    hasIssues: blockerCount + warningCount > 0,
    tone: blockerCount > 0 ? "danger" : warningCount > 0 ? "warning" : "success",
  };
}

function buildSubareaRecommendation(key: RegulatoryAnalyticsSubareaKey) {
  if (key === "feed_ban") {
    return "Revisar formulacao de ruminantes antes de liberar qualquer registro de nutricao.";
  }
  if (key === "quarentena") {
    return "Concluir segregacao e revisao de entrada antes de movimentar o lote.";
  }
  if (key === "documental") {
    return "Regularizar GTA, comprovacao ou etapa documental antes de liberar transito e venda.";
  }
  return "Fechar agua, cochos, bebedouros e equipamentos antes de seguir com a rotina nutricional.";
}

function buildImpactMessage(
  key: RegulatoryAnalyticsImpactKey,
  flow: RegulatoryFlowReadModel,
) {
  if (flow.firstBlockerMessage) return flow.firstBlockerMessage;
  if (flow.firstWarningMessage) return flow.firstWarningMessage;

  if (key === "nutrition") {
    return "Nenhuma restricao aberta para nutricao no overlay oficial.";
  }
  if (key === "movementInternal") {
    return "Nenhuma restricao aberta para movimentacao interna de lote.";
  }
  return "Nenhuma restricao aberta para transito ou venda no momento.";
}

function buildRegulatoryOperationalAnalytics(input: {
  entries: RegulatoryOverlayEntry[];
  flows: RegulatoryOperationalReadModel["flows"];
}): RegulatoryOperationalAnalytics {
  const openEntries = input.entries.filter((entry) => entry.status !== "conforme");

  const subareas = REGULATORY_ANALYTICS_SUBAREA_KEYS.map((key) => {
    const groupedEntries = openEntries.filter((entry) =>
      matchesRegulatoryAnalyticsSubarea(entry, key),
    );
    if (groupedEntries.length === 0) return null;

    const adjustmentCount = groupedEntries.filter(
      (entry) => entry.status === "ajuste_necessario",
    ).length;
    const pendingCount = groupedEntries.length - adjustmentCount;
    const blockerCount =
      key === "feed_ban" || key === "documental"
        ? groupedEntries.length
        : adjustmentCount;
    const warningCount = Math.max(0, groupedEntries.length - blockerCount);

    return {
      key,
      label: getRegulatoryAnalyticsSubareaLabel(key),
      openCount: groupedEntries.length,
      blockerCount,
      warningCount,
      adjustmentCount,
      pendingCount,
      tone:
        blockerCount > 0
          ? "danger"
          : warningCount > 0
            ? "warning"
            : "success",
      affectedImpacts:
        key === "feed_ban" || key === "agua_limpeza"
          ? ["nutrition"]
          : key === "quarentena"
            ? ["movementInternal"]
            : ["sale"],
      recommendation: buildSubareaRecommendation(key),
    } satisfies RegulatorySubareaAnalyticalCut;
  }).filter((item): item is RegulatorySubareaAnalyticalCut => item !== null);

  const impacts = REGULATORY_ANALYTICS_IMPACT_KEYS.map((key) => {
    const flow =
      key === "nutrition"
        ? input.flows.nutrition
        : key === "movementInternal"
          ? input.flows.movementInternal
          : input.flows.sale;

    return {
      key,
      label: getRegulatoryAnalyticsImpactLabel(key),
      blockerCount: flow.blockerCount,
      warningCount: flow.warningCount,
      totalCount: flow.totalCount,
      tone: flow.tone,
      message: buildImpactMessage(key, flow),
    } satisfies RegulatoryImpactAnalyticalCut;
  });

  return {
    subareas,
    impacts,
  };
}

export async function loadRegulatorySurfaceSource(
  fazendaId: string,
): Promise<RegulatorySurfaceSource> {
  const [config, templates, items] = await Promise.all([
    db.state_fazenda_sanidade_config.get(fazendaId),
    db.catalog_protocolos_oficiais.toArray(),
    db.catalog_protocolos_oficiais_itens.toArray(),
  ]);

  return {
    config: config && !config.deleted_at ? config : null,
    templates,
    items,
  };
}

export function buildRegulatoryOperationalReadModel(
  source: RegulatorySurfaceSource | null | undefined,
): RegulatoryOperationalReadModel {
  const safeSource = source ?? EMPTY_REGULATORY_SURFACE_SOURCE;
  const entries = buildActiveRegulatoryOverlayEntries({
    config: safeSource.config,
    templates: safeSource.templates,
    items: safeSource.items,
  });

  if (entries.length === 0) {
    return EMPTY_REGULATORY_OPERATIONAL_READ_MODEL;
  }

  const attention = summarizeRegulatoryComplianceAttention({
    entries,
    limit: 4,
  });
  const nutrition = toFlowReadModel(
    resolveComplianceFlowGuards({
      entries,
      context: "nutrition",
    }),
  );
  const movementInternal = toFlowReadModel(
    resolveComplianceFlowGuards({
      entries,
      context: "movement",
      isExternalTransit: false,
    }),
  );
  const movementExternal = toFlowReadModel(
    resolveComplianceFlowGuards({
      entries,
      context: "movement",
      isExternalTransit: true,
    }),
  );

  return {
    entries,
    attention,
    flows: {
      nutrition,
      movementInternal,
      movementExternal,
      sale: movementExternal,
    },
    analytics: buildRegulatoryOperationalAnalytics({
      entries,
      flows: {
        nutrition,
        movementInternal,
        movementExternal,
        sale: movementExternal,
      },
    }),
    hasOpenIssues: attention.openCount > 0,
    hasBlockingIssues:
      attention.blockingCount > 0 ||
      nutrition.blockerCount > 0 ||
      movementInternal.blockerCount > 0 ||
      movementExternal.blockerCount > 0,
  };
}
