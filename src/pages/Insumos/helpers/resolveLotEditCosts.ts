type CostOrigin = "manual" | "ausente" | "financeiro_vinculado";

type LotEditCostResolution =
  | { error: string }
  | {
      hasCustoTotal: boolean;
      hasCustoUnitario: boolean;
      resolvedCustoTotal: number | null;
      resolvedCustoUnitario: number | null;
      resolvedCustoStatus: "informado" | "ausente";
      resolvedOrigemCusto: CostOrigin;
    };

// Complexidade herdada de handleSaveLotEdit; validacoes e calculos preservados.
// fallow-ignore-next-line complexity
export function resolveLotEditCosts({
  quantidadeBase,
  custoTotal,
  custoUnitario,
  origemCusto,
}: {
  quantidadeBase: number;
  custoTotal: string;
  custoUnitario: string;
  origemCusto: CostOrigin;
}): LotEditCostResolution {
  const hasCustoTotal = custoTotal.trim() !== "";
  const hasCustoUnitario = custoUnitario.trim() !== "";

  let resolvedCustoUnitario: number | null = null;
  let resolvedCustoTotal: number | null = null;
  let resolvedCustoStatus: "informado" | "ausente" = "ausente";

  if (hasCustoTotal || hasCustoUnitario) {
    const parsedCustoTotal = hasCustoTotal
      ? parseFloat(custoTotal.replace(",", "."))
      : null;
    const parsedCustoUnitario = hasCustoUnitario
      ? parseFloat(custoUnitario.replace(",", "."))
      : null;

    if (
      hasCustoTotal &&
      (parsedCustoTotal === null ||
        isNaN(parsedCustoTotal) ||
        parsedCustoTotal < 0)
    ) {
      return { error: "Custo total informado é inválido." };
    }
    if (
      hasCustoUnitario &&
      (parsedCustoUnitario === null ||
        isNaN(parsedCustoUnitario) ||
        parsedCustoUnitario < 0)
    ) {
      return { error: "Custo unitário informado é inválido." };
    }

    if (parsedCustoTotal !== null && parsedCustoUnitario !== null) {
      const calculatedTotal = parsedCustoUnitario * quantidadeBase;
      if (Math.abs(parsedCustoTotal - calculatedTotal) > 0.01) {
        return {
          error: `Coerência de custos inválida: custo total informado (${parsedCustoTotal.toFixed(2)}) diverge do calculado (${calculatedTotal.toFixed(2)}) com base no custo unitário.`,
        };
      }
      resolvedCustoTotal = parsedCustoTotal;
      resolvedCustoUnitario = parsedCustoUnitario;
      resolvedCustoStatus = "informado";
    } else if (parsedCustoTotal !== null) {
      resolvedCustoTotal = parsedCustoTotal;
      resolvedCustoUnitario = parseFloat(
        (parsedCustoTotal / quantidadeBase).toFixed(4),
      );
      resolvedCustoStatus = "informado";
    } else if (parsedCustoUnitario !== null) {
      resolvedCustoUnitario = parsedCustoUnitario;
      resolvedCustoTotal = parseFloat(
        (parsedCustoUnitario * quantidadeBase).toFixed(2),
      );
      resolvedCustoStatus = "informado";
    }
  }

  const resolvedOrigemCusto =
    resolvedCustoStatus === "informado"
      ? origemCusto === "ausente"
        ? "manual"
        : origemCusto
      : "ausente";

  return {
    hasCustoTotal,
    hasCustoUnitario,
    resolvedCustoTotal,
    resolvedCustoUnitario,
    resolvedCustoStatus,
    resolvedOrigemCusto,
  };
}
