export type RegistrarTargetMode = "existing" | "none";

export function formatCommercialBirthAge(
  birthDate: string | null | undefined,
  referenceDate: string,
) {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T12:00:00.000Z`);
  const reference = new Date(`${referenceDate.slice(0, 10)}T12:00:00.000Z`);
  if (
    Number.isNaN(birth.getTime()) ||
    Number.isNaN(reference.getTime()) ||
    birth > reference
  ) {
    return null;
  }
  let months =
    (reference.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
    reference.getUTCMonth() -
    birth.getUTCMonth();
  if (reference.getUTCDate() < birth.getUTCDate()) months -= 1;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${remainingMonths}m`;
  return remainingMonths === 0 ? `${years}a` : `${years}a ${remainingMonths}m`;
}

export function resolvePurchaseQuantity(
  scope: "animal" | "lote",
  requestedQuantity: number,
) {
  if (scope === "animal") return 1;
  if (!Number.isFinite(requestedQuantity)) return 2;
  return Math.max(2, Math.min(500, Math.trunc(requestedQuantity)));
}

export function resolveCommercialFormIssue(input: {
  operationType: "compra" | "venda" | "sociedade";
  scope: "animal" | "lote";
  quantity: number;
  newAnimalsCount: number;
  purchaseDestinationLotId: string;
  selectedAnimalIds: readonly string[];
  targetLotId: string | null;
  saleSnapshotIds: readonly string[];
  currentLotActiveAnimalIds: readonly string[];
}): string | null {
  if (input.operationType === "sociedade") return null;

  if (input.scope === "animal" && input.quantity !== 1) {
    return "Animal individual exige quantidade igual a 1.";
  }

  if (input.operationType === "compra") {
    if (input.scope === "animal" && input.newAnimalsCount !== 1) {
      return "Compra individual exige exatamente uma linha de novo animal.";
    }
    if (input.scope === "lote") {
      if (input.quantity < 2 || input.quantity > 500) {
        return "Compra em lote exige quantidade entre 2 e 500 animais.";
      }
      if (!input.purchaseDestinationLotId) {
        return "Compra em lote exige lote de destino.";
      }
    }
    if (input.newAnimalsCount !== input.quantity) {
      return "A quantidade deve corresponder às linhas de novos animais.";
    }
    return null;
  }

  if (input.scope === "animal") {
    return input.selectedAnimalIds.length === 1
      ? null
      : "Venda individual exige exatamente um animal existente.";
  }
  if (!input.targetLotId) return "Venda por lote exige um lote existente.";
  if (new Set(input.saleSnapshotIds).size !== input.saleSnapshotIds.length) {
    return "Atualize o snapshot integral dos animais ativos do lote.";
  }
  const frozen = [...new Set(input.saleSnapshotIds)].sort();
  const current = [...new Set(input.currentLotActiveAnimalIds)].sort();
  if (
    frozen.length === 0 ||
    JSON.stringify(frozen) !== JSON.stringify(current)
  ) {
    return "Atualize o snapshot integral dos animais ativos do lote.";
  }
  return null;
}
