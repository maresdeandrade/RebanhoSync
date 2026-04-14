import type { ProtocoloSanitario } from "@/lib/offline/types";

export type SanitaryProtocolLayer = "official" | "standard" | "custom";

export interface SanitaryFamilyCoverage {
  familyCode: string;
  layers: Set<SanitaryProtocolLayer>;
  protocolIds: string[];
}

export interface SanitaryFamilyConflict {
  familyCode: string;
  reason: "official_family_already_active" | "family_already_active";
  existingLayer: SanitaryProtocolLayer;
  protocolId: string;
}

function readString(
  record: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function normalizeSanitaryFamilyCode(
  value: string | null | undefined,
) {
  if (!value) return null;

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized.length > 0 ? normalized : null;
}

export function resolveSanitaryProtocolLayer(
  payload: Record<string, unknown> | null | undefined,
): SanitaryProtocolLayer {
  const origin = readString(payload, "origem");
  if (origin === "catalogo_oficial") return "official";
  if (origin === "template_padrao") return "standard";
  return "custom";
}

export function readSanitaryProtocolFamilyCode(
  payload: Record<string, unknown> | null | undefined,
) {
  return normalizeSanitaryFamilyCode(readString(payload, "family_code"));
}

export function buildSanitaryFamilyCoverageIndex(
  protocols: Array<Pick<ProtocoloSanitario, "id" | "payload" | "deleted_at">>,
) {
  const coverage = new Map<string, SanitaryFamilyCoverage>();

  for (const protocol of protocols) {
    if (protocol.deleted_at) continue;

    const familyCode = readSanitaryProtocolFamilyCode(protocol.payload);
    if (!familyCode) continue;

    const current = coverage.get(familyCode) ?? {
      familyCode,
      layers: new Set<SanitaryProtocolLayer>(),
      protocolIds: [],
    };

    current.layers.add(resolveSanitaryProtocolLayer(protocol.payload));
    current.protocolIds.push(protocol.id);
    coverage.set(familyCode, current);
  }

  return coverage;
}

export function findSanitaryFamilyConflict(input: {
  protocols: Array<Pick<ProtocoloSanitario, "id" | "payload" | "deleted_at">>;
  candidateFamilyCode: string | null | undefined;
  candidateLayer: SanitaryProtocolLayer;
  ignoreProtocolId?: string | null;
}): SanitaryFamilyConflict | null {
  const normalizedFamilyCode = normalizeSanitaryFamilyCode(input.candidateFamilyCode);
  if (!normalizedFamilyCode) return null;

  for (const protocol of input.protocols) {
    if (protocol.deleted_at) continue;
    if (input.ignoreProtocolId && protocol.id === input.ignoreProtocolId) continue;

    const familyCode = readSanitaryProtocolFamilyCode(protocol.payload);
    if (familyCode !== normalizedFamilyCode) continue;

    const existingLayer = resolveSanitaryProtocolLayer(protocol.payload);
    return {
      familyCode: normalizedFamilyCode,
      reason:
        existingLayer === "official" && input.candidateLayer !== "official"
          ? "official_family_already_active"
          : "family_already_active",
      existingLayer,
      protocolId: protocol.id,
    };
  }

  return null;
}

export function hasOfficialFamilyCoverage(
  coverage: Map<string, SanitaryFamilyCoverage>,
  familyCode: string | null | undefined,
) {
  const normalizedFamilyCode = normalizeSanitaryFamilyCode(familyCode);
  if (!normalizedFamilyCode) return false;

  return coverage.get(normalizedFamilyCode)?.layers.has("official") ?? false;
}

// ============================================================================
// PR1: Canonicalização e Precedência por Camada
// ============================================================================

export type SanitaryActivationState =
  | "active_official"
  | "active_custom"
  | "draft_template"
  | "superseded_legacy"
  | "overlay_only"
  | "unknown";

export interface SanitaryProtocolMetadata {
  protocolId: string;
  familyCode: string | null;
  layer: SanitaryProtocolLayer;
  activationState: SanitaryActivationState;
  supersededByFamilyCode: string | null;
  supersededByProtocolId: string | null;
  hiddenFromPrimaryList: boolean;
  operationalComplement: boolean;
}

/**
 * Resolve o estado de ativação de um protocolo individual.
 * Determina se está ativo, supersedido, draft ou overlay-only.
 */
export function resolveActivationState(
  protocol: Pick<ProtocoloSanitario, "payload">,
  layer: SanitaryProtocolLayer,
  isSuperseded: boolean = false,
): SanitaryActivationState {
  if (isSuperseded) return "superseded_legacy";

  const origem = readString(protocol.payload, "origem");
  if (origem === "catalogo_oficial") return "active_official";
  if (origem === "customizado_fazenda") {
    const isOperationalComplement = readBoolean(protocol.payload, "operational_complement");
    return isOperationalComplement ? "active_custom" : "draft_template";
  }
  if (origem === "template_padrao") return "draft_template";

  return "unknown";
}

/**
 * Helper: ler booleano do payload
 */
function readBoolean(
  record: Record<string, unknown> | null | undefined,
  key: string,
): boolean {
  return record?.[key] === true;
}

/**
 * Ordena camadas por precedência (oficial > custom > standard > legacy).
 * Retorna índice: menor = maior prioridade.
 */
function layerPrecedenceIndex(layer: SanitaryProtocolLayer): number {
  if (layer === "official") return 0;
  if (layer === "custom") return 1;
  if (layer === "standard") return 2;
  return 3; // legacy
}

/**
 * Resolve o protocolo efetivo (vencedor) para uma family_code específica.
 *
 * Prioridade fixa:
 * 1. official_pack
 * 2. custom_operational_complement
 * 3. canonical_template
 * 4. legacy_seed
 *
 * Regras:
 * - Protocolos official vencem todos da mesma família
 * - Protocolos custom só sobrevivem se operational_complement=true
 * - Templates canônicos (standard) nunca viram official_pack
 * - Perdedores são marcados como superseded
 */
export function resolveProtocolPrecedence(
  protocols: Array<Pick<ProtocoloSanitario, "id" | "payload" | "deleted_at">>,
  familyCode: string | null | undefined,
): { winnerId: string | null; losers: string[] } {
  const normalized = normalizeSanitaryFamilyCode(familyCode);
  if (!normalized) return { winnerId: null, losers: [] };

  // Filtrar protocolos da mesma família
  const candidates = protocols.filter((p) => {
    if (p.deleted_at) return false;
    return readSanitaryProtocolFamilyCode(p.payload) === normalized;
  });

  if (candidates.length === 0) return { winnerId: null, losers: [] };
  if (candidates.length === 1) return { winnerId: candidates[0].id, losers: [] };

  // Agrupar por layer
  const byLayer = new Map<SanitaryProtocolLayer, typeof candidates>();
  for (const candidate of candidates) {
    const layer = resolveSanitaryProtocolLayer(candidate.payload);
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer)!.push(candidate);
  }

  // Iterar em ordem de precedência, retornar primeiro não-vazio
  const layers: SanitaryProtocolLayer[] = ["official", "custom", "standard"];
  for (const layer of layers) {
    const group = byLayer.get(layer) ?? [];
    if (group.length > 0) {
      // Se custom, validar operational_complement
      if (layer === "custom") {
        const operationalComplement = group.find((p) =>
          readBoolean(p.payload, "operational_complement"),
        );
        if (operationalComplement) {
          const losers = candidates
            .filter((c) => c.id !== operationalComplement.id)
            .map((c) => c.id);
          return { winnerId: operationalComplement.id, losers };
        }
      } else {
        // official ou standard
        const winner = group[0]; // Pega primeiro (pode haver tie-break futura)
        const losers = candidates
          .filter((c) => c.id !== winner.id)
          .map((c) => c.id);
        return { winnerId: winner.id, losers };
      }
    }
  }

  return { winnerId: null, losers: candidates.map((c) => c.id) };
}

/**
 * Resolve protocolos efetivos agrupados por family_code.
 * Retorna Map<family_code, protocolId> onde cada family_code mapeia
 * para seu único protocolo efetivo (vencedor por precedência).
 *
 * Efeito colateral: popula metatados de superseded.
 */
export function resolveEffectiveProtocolsByFamily(
  protocols: Array<Pick<ProtocoloSanitario, "id" | "payload" | "deleted_at">>,
): {
  effective: Map<string, string>;
  metadata: Map<string, SanitaryProtocolMetadata>;
} {
  const families = new Set<string>();

  // Coletar todas as families
  for (const protocol of protocols) {
    if (protocol.deleted_at) continue;
    const family = readSanitaryProtocolFamilyCode(protocol.payload);
    if (family) families.add(family);
  }

  const effective = new Map<string, string>();
  const metadata = new Map<string, SanitaryProtocolMetadata>();

  // Resolver vencedor por family_code
  for (const family of families) {
    const { winnerId, losers } = resolveProtocolPrecedence(protocols, family);

    if (winnerId) {
      effective.set(family, winnerId);
    }

    // Popula metadados
    for (const protocol of protocols) {
      if (protocol.deleted_at) continue;
      if (readSanitaryProtocolFamilyCode(protocol.payload) !== family) continue;

      const isSuperseded = losers.includes(protocol.id);
      const layer = resolveSanitaryProtocolLayer(protocol.payload);
      const activationState = resolveActivationState(protocol, layer, isSuperseded);

      metadata.set(protocol.id, {
        protocolId: protocol.id,
        familyCode: family,
        layer,
        activationState,
        supersededByProtocolId: isSuperseded ? winnerId : null,
        supersededByFamilyCode: isSuperseded ? family : null,
        hiddenFromPrimaryList: isSuperseded,
        operationalComplement: readBoolean(protocol.payload, "operational_complement"),
      });
    }
  }

  return { effective, metadata };
}
