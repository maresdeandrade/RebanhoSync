export type InventoryResupplyStatus = "unconfigured" | "ok" | "warning" | "critical";

export interface InventoryResupplyPolicy {
  minimumStockBase: number | null;
  reorderPointBase: number | null;
}

export interface InventoryResupplyEvaluation {
  status: InventoryResupplyStatus;
  minimumStockBase: number | null;
  reorderPointBase: number | null;
  gapToMinimum: number | null;
  gapToReorderPoint: number | null;
}

export type InventoryReplenishmentAlertSeverity = "warning" | "critical";

export interface InventoryReplenishmentAlertInput {
  currentBalanceBase: number;
  futureDemandBase: number | null;
  policy: InventoryResupplyPolicy;
}

export interface InventoryReplenishmentAlertEvaluation {
  severity: InventoryReplenishmentAlertSeverity | null;
  currentStatus: InventoryResupplyStatus;
  projectedBalanceBase: number | null;
  currentGapBase: number | null;
  projectedGapBase: number | null;
  reasons: string[];
}

const POLICY_KEY = "inventory_policy";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizePositiveNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
}

export function parseInventoryResupplyPolicy(
  payload: Record<string, unknown> | null | undefined,
): InventoryResupplyPolicy {
  const policy = asRecord(payload?.[POLICY_KEY]);

  return {
    minimumStockBase: normalizePositiveNumber(policy?.estoque_minimo_base),
    reorderPointBase: normalizePositiveNumber(policy?.ponto_ressuprimento_base),
  };
}

export function buildInventoryResupplyPayload(
  currentPayload: Record<string, unknown>,
  policy: InventoryResupplyPolicy,
): Record<string, unknown> {
  const nextPayload = { ...currentPayload };
  const minimumStockBase = normalizePositiveNumber(policy.minimumStockBase);
  const reorderPointBase = normalizePositiveNumber(policy.reorderPointBase);

  if (!minimumStockBase && !reorderPointBase) {
    delete nextPayload[POLICY_KEY];
    return nextPayload;
  }

  nextPayload[POLICY_KEY] = {
    estoque_minimo_base: minimumStockBase,
    ponto_ressuprimento_base: reorderPointBase,
  };

  return nextPayload;
}

export function evaluateInventoryResupply(
  saldoBase: number,
  policy: InventoryResupplyPolicy,
): InventoryResupplyEvaluation {
  const minimumStockBase = normalizePositiveNumber(policy.minimumStockBase);
  const reorderPointBase = normalizePositiveNumber(policy.reorderPointBase);

  if (!minimumStockBase && !reorderPointBase) {
    return {
      status: "unconfigured",
      minimumStockBase: null,
      reorderPointBase: null,
      gapToMinimum: null,
      gapToReorderPoint: null,
    };
  }

  const gapToMinimum =
    minimumStockBase == null ? null : Math.max(minimumStockBase - saldoBase, 0);
  const gapToReorderPoint =
    reorderPointBase == null ? null : Math.max(reorderPointBase - saldoBase, 0);

  return {
    status:
      gapToMinimum != null && gapToMinimum > 0
        ? "critical"
        : gapToReorderPoint != null && gapToReorderPoint > 0
          ? "warning"
          : "ok",
    minimumStockBase,
    reorderPointBase,
    gapToMinimum,
    gapToReorderPoint,
  };
}

export function evaluateInventoryReplenishmentAlert(
  input: InventoryReplenishmentAlertInput,
): InventoryReplenishmentAlertEvaluation {
  const current = evaluateInventoryResupply(input.currentBalanceBase, input.policy);
  const projectedBalanceBase =
    input.futureDemandBase == null
      ? null
      : input.currentBalanceBase - input.futureDemandBase;
  const projected =
    projectedBalanceBase == null
      ? null
      : evaluateInventoryResupply(projectedBalanceBase, input.policy);
  const reasons: string[] = [];

  if (current.status === "critical") {
    reasons.push("saldo atual abaixo do estoque minimo");
  } else if (current.status === "warning") {
    reasons.push("saldo atual abaixo do ponto de ressuprimento");
  }

  if (projected?.status === "critical") {
    reasons.push("demanda futura projeta saldo abaixo do estoque minimo");
  } else if (projected?.status === "warning") {
    reasons.push("demanda futura projeta saldo abaixo do ponto de ressuprimento");
  }

  const severity =
    current.status === "critical" || projected?.status === "critical"
      ? "critical"
      : current.status === "warning" || projected?.status === "warning"
        ? "warning"
        : null;

  return {
    severity,
    currentStatus: current.status,
    projectedBalanceBase,
    currentGapBase:
      current.status === "critical"
        ? current.gapToMinimum
        : current.status === "warning"
          ? current.gapToReorderPoint
          : 0,
    projectedGapBase:
      projected?.status === "critical"
        ? projected.gapToMinimum
        : projected?.status === "warning"
          ? projected.gapToReorderPoint
          : projected
            ? 0
            : null,
    reasons,
  };
}
