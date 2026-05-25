import type { Evento, EventoSanitario } from "@/lib/offline/types";

export type SanitaryInventoryConsumptionDecision =
  | "eligible_manual_consumption_source"
  | "needs_catalog_product_reference"
  | "blocked_not_confirmed_event"
  | "blocked_not_sanitary_event"
  | "blocked_no_product"
  | "blocked_deleted_event";

export type SanitaryInventoryConsumptionSource = Pick<
  Evento,
  "id" | "dominio" | "deleted_at" | "payload"
> & {
  occurred_at?: string | null;
};

export type SanitaryInventoryConsumptionDetail = Pick<
  EventoSanitario,
  "evento_id" | "tipo" | "produto" | "payload"
>;

export type EvaluateSanitaryInventoryConsumptionInput = {
  event?: SanitaryInventoryConsumptionSource | null;
  sanitaryDetail?: SanitaryInventoryConsumptionDetail | null;
};

export type SanitaryInventoryConsumptionReadiness = {
  decision: SanitaryInventoryConsumptionDecision;
  canCreateManualMovement: boolean;
  productName: string | null;
  catalogProductId: string | null;
  requiresInventoryLot: boolean;
  createsStockMutation: false;
  reason: string;
};

function readNonEmptyString(
  payload: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const value = payload?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function resolveProductName(
  detail: SanitaryInventoryConsumptionDetail | null,
): string | null {
  const fromCatalog = readNonEmptyString(detail?.payload, "produto_nome_catalogo");
  const fromTyped = typeof detail?.produto === "string" ? detail.produto.trim() : "";
  const fromLabel = readNonEmptyString(detail?.payload, "produto_rotulo_informado");

  return fromCatalog ?? (fromTyped || null) ?? fromLabel;
}

export function evaluateSanitaryInventoryConsumptionReadiness(
  input: EvaluateSanitaryInventoryConsumptionInput,
): SanitaryInventoryConsumptionReadiness {
  const event = input.event ?? null;
  const detail = input.sanitaryDetail ?? null;

  if (!event?.id || !detail?.evento_id || event.id !== detail.evento_id) {
    return {
      decision: "blocked_not_confirmed_event",
      canCreateManualMovement: false,
      productName: null,
      catalogProductId: null,
      requiresInventoryLot: false,
      createsStockMutation: false,
      reason:
        "Consumo de estoque exige evento sanitario confirmado e detalhe sanitario vinculado.",
    };
  }

  if (event.dominio !== "sanitario") {
    return {
      decision: "blocked_not_sanitary_event",
      canCreateManualMovement: false,
      productName: null,
      catalogProductId: null,
      requiresInventoryLot: false,
      createsStockMutation: false,
      reason: "Somente evento sanitario confirmado pode originar consumo sanitario.",
    };
  }

  if (event.deleted_at) {
    return {
      decision: "blocked_deleted_event",
      canCreateManualMovement: false,
      productName: null,
      catalogProductId: null,
      requiresInventoryLot: false,
      createsStockMutation: false,
      reason: "Evento sanitario removido nao pode originar consumo de estoque.",
    };
  }

  const catalogProductId =
    readNonEmptyString(detail.payload, "produto_veterinario_id") ??
    readNonEmptyString(event.payload, "produto_veterinario_id");
  const productName = resolveProductName(detail);

  if (!productName) {
    return {
      decision: "blocked_no_product",
      canCreateManualMovement: false,
      productName: null,
      catalogProductId: null,
      requiresInventoryLot: false,
      createsStockMutation: false,
      reason: "Consumo sanitario exige produto registrado no evento.",
    };
  }

  if (!catalogProductId) {
    return {
      decision: "needs_catalog_product_reference",
      canCreateManualMovement: false,
      productName,
      catalogProductId: null,
      requiresInventoryLot: true,
      createsStockMutation: false,
      reason:
        "Produto em texto livre precisa ser conciliado ao catalogo antes de movimentar estoque.",
    };
  }

  return {
    decision: "eligible_manual_consumption_source",
    canCreateManualMovement: true,
    productName,
    catalogProductId,
    requiresInventoryLot: true,
    createsStockMutation: false,
    reason:
      "Evento sanitario confirmado pode originar baixa manual futura, sem mutacao automatica de estoque.",
  };
}
