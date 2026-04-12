export function normalizeTableMutationRecord(
  table: string,
  record: Record<string, unknown>,
  fallbackFazendaId?: string,
): Record<string, unknown> {
  const normalized = { ...record };

  if (table !== "fazenda_sanidade_config") {
    return normalized;
  }

  const legacyId =
    typeof normalized.id === "string" && normalized.id.length > 0
      ? normalized.id
      : null;
  const currentFazendaId =
    typeof normalized.fazenda_id === "string" &&
    normalized.fazenda_id.length > 0
      ? normalized.fazenda_id
      : null;
  const canonicalFazendaId =
    fallbackFazendaId && fallbackFazendaId.length > 0
      ? fallbackFazendaId
      : currentFazendaId ?? legacyId;

  if (canonicalFazendaId) {
    normalized.fazenda_id = canonicalFazendaId;
  }

  delete normalized.id;

  return normalized;
}
