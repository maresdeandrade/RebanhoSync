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
