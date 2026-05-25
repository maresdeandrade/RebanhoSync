import type {
  Evento,
  EventoNutricao,
  EventoPastoAvaliacao,
  InsumoLote,
  InsumoMovimentacao,
  InsumoMovimentacaoTipoEnum,
  InsumoUnidadeBaseEnum,
} from "@/lib/offline/types";

export type InventoryConsumptionDecision =
  | "eligible_manual_consumption_source"
  | "needs_presentation_conversion"
  | "blocked_not_confirmed_event"
  | "blocked_wrong_domain"
  | "blocked_deleted_event"
  | "blocked_no_quantity";

export type NutritionalInventoryConsumptionReadiness = {
  decision: InventoryConsumptionDecision;
  canCreateManualMovement: boolean;
  sourceEventoDominio: "nutricao" | "pastagem" | null;
  sourceEventoId: string | null;
  quantityBase: number | null;
  unidadeBase: InsumoUnidadeBaseEnum | null;
  requiresInventoryLot: boolean;
  createsStockMutation: false;
  reason: string;
};

export function convertPresentationQuantityToBase(input: {
  presentationQuantity: number;
  presentationBaseQuantity: number;
}): number {
  if (!Number.isFinite(input.presentationQuantity) || input.presentationQuantity <= 0) {
    throw new Error("Quantidade de apresentacao deve ser maior que zero.");
  }

  if (
    !Number.isFinite(input.presentationBaseQuantity) ||
    input.presentationBaseQuantity <= 0
  ) {
    throw new Error("Quantidade base da apresentacao deve ser maior que zero.");
  }

  return input.presentationQuantity * input.presentationBaseQuantity;
}

export function getInventoryMovementDelta(
  tipo: InsumoMovimentacaoTipoEnum,
  quantidadeBase: number,
): number {
  if (!Number.isFinite(quantidadeBase) || quantidadeBase <= 0) {
    throw new Error("Quantidade de movimentacao deve ser maior que zero.");
  }

  if (
    tipo === "entrada" ||
    tipo === "ajuste_positivo" ||
    tipo === "transferencia_entrada"
  ) {
    return quantidadeBase;
  }

  return -quantidadeBase;
}

export function projectInventoryLotBalance(input: {
  saldoAtualBase: number;
  movements: Pick<InsumoMovimentacao, "tipo" | "quantidade_base">[];
}): number {
  return input.movements.reduce(
    (saldo, movement) =>
      saldo + getInventoryMovementDelta(movement.tipo, movement.quantidade_base),
    input.saldoAtualBase,
  );
}

export function evaluateInventoryLotConsumption(input: {
  lot?: Pick<InsumoLote, "id" | "saldo_atual_base" | "unidade_base" | "status" | "deleted_at"> | null;
  quantidadeBase: number;
  unidadeBase: InsumoUnidadeBaseEnum;
}):
  | { canConsume: true; projectedBalance: number; reason: string }
  | { canConsume: false; projectedBalance: number | null; reason: string } {
  const lot = input.lot ?? null;

  if (!lot?.id || lot.deleted_at) {
    return {
      canConsume: false,
      projectedBalance: null,
      reason: "Consumo exige lote de estoque ativo.",
    };
  }

  if (lot.status !== "ativo") {
    return {
      canConsume: false,
      projectedBalance: lot.saldo_atual_base,
      reason: "Lote de estoque precisa estar ativo para consumo.",
    };
  }

  if (lot.unidade_base !== input.unidadeBase) {
    return {
      canConsume: false,
      projectedBalance: lot.saldo_atual_base,
      reason: "Unidade do consumo precisa coincidir com a unidade base do lote.",
    };
  }

  const projectedBalance = lot.saldo_atual_base - input.quantidadeBase;
  if (!Number.isFinite(input.quantidadeBase) || input.quantidadeBase <= 0) {
    return {
      canConsume: false,
      projectedBalance: lot.saldo_atual_base,
      reason: "Quantidade de consumo deve ser maior que zero.",
    };
  }

  if (projectedBalance < 0) {
    return {
      canConsume: false,
      projectedBalance,
      reason: "Saldo insuficiente para consumo do lote selecionado.",
    };
  }

  return {
    canConsume: true,
    projectedBalance,
    reason: "Lote possui saldo suficiente para baixa manual.",
  };
}

export function evaluateInventoryLotManualMovement(input: {
  lot?: Pick<InsumoLote, "id" | "saldo_atual_base" | "unidade_base" | "status" | "deleted_at"> | null;
  tipo: Extract<
    InsumoMovimentacaoTipoEnum,
    "entrada" | "ajuste_positivo" | "ajuste_negativo"
  >;
  quantidadeBase: number;
  unidadeBase: InsumoUnidadeBaseEnum;
}):
  | { canRegister: true; projectedBalance: number; reason: string }
  | { canRegister: false; projectedBalance: number | null; reason: string } {
  const lot = input.lot ?? null;

  if (!lot?.id || lot.deleted_at) {
    return {
      canRegister: false,
      projectedBalance: null,
      reason: "Movimentacao exige lote de estoque ativo.",
    };
  }

  if (lot.status !== "ativo") {
    return {
      canRegister: false,
      projectedBalance: lot.saldo_atual_base,
      reason: "Lote de estoque precisa estar ativo para entrada ou ajuste.",
    };
  }

  if (lot.unidade_base !== input.unidadeBase) {
    return {
      canRegister: false,
      projectedBalance: lot.saldo_atual_base,
      reason: "Unidade da movimentacao precisa coincidir com a unidade base do lote.",
    };
  }

  if (!Number.isFinite(input.quantidadeBase) || input.quantidadeBase <= 0) {
    return {
      canRegister: false,
      projectedBalance: lot.saldo_atual_base,
      reason: "Quantidade da movimentacao deve ser maior que zero.",
    };
  }

  const projectedBalance =
    lot.saldo_atual_base +
    getInventoryMovementDelta(input.tipo, input.quantidadeBase);

  if (projectedBalance < 0) {
    return {
      canRegister: false,
      projectedBalance,
      reason: "Ajuste negativo deixaria saldo do lote abaixo de zero.",
    };
  }

  return {
    canRegister: true,
    projectedBalance,
    reason: "Movimentacao auditavel pode ser registrada.",
  };
}

export function evaluateNutritionalInventoryConsumptionReadiness(input: {
  event?: Pick<Evento, "id" | "dominio" | "deleted_at"> | null;
  nutricaoDetail?: Pick<EventoNutricao, "evento_id" | "quantidade_kg"> | null;
  pastoDetail?: Pick<
    EventoPastoAvaliacao,
    "evento_id" | "suplemento_quantidade" | "suplemento_unidade"
  > | null;
}): NutritionalInventoryConsumptionReadiness {
  const event = input.event ?? null;

  if (!event?.id) {
    return blockedNutritional("blocked_not_confirmed_event", "Consumo nutricional exige evento confirmado.");
  }

  if (event.deleted_at) {
    return blockedNutritional("blocked_deleted_event", "Evento removido nao pode originar consumo de estoque.");
  }

  if (event.dominio === "nutricao") {
    const detail = input.nutricaoDetail ?? null;
    if (detail?.evento_id !== event.id) {
      return blockedNutritional("blocked_not_confirmed_event", "Detalhe de nutricao precisa estar vinculado ao evento.");
    }

    if (!detail.quantidade_kg || detail.quantidade_kg <= 0) {
      return blockedNutritional("blocked_no_quantity", "Consumo nutricional exige quantidade em kg maior que zero.");
    }

    return {
      decision: "eligible_manual_consumption_source",
      canCreateManualMovement: true,
      sourceEventoDominio: "nutricao",
      sourceEventoId: event.id,
      quantityBase: detail.quantidade_kg,
      unidadeBase: "kg",
      requiresInventoryLot: true,
      createsStockMutation: false,
      reason: "Evento de nutricao pode originar baixa manual em kg.",
    };
  }

  if (event.dominio === "pastagem") {
    const detail = input.pastoDetail ?? null;
    if (detail?.evento_id !== event.id) {
      return blockedNutritional("blocked_not_confirmed_event", "Detalhe de ronda de pasto precisa estar vinculado ao evento.");
    }

    if (!detail.suplemento_quantidade || detail.suplemento_quantidade <= 0) {
      return blockedNutritional("blocked_no_quantity", "Ronda de pasto exige suplemento com quantidade maior que zero.");
    }

    if (detail.suplemento_unidade === "sacos") {
      return {
        decision: "needs_presentation_conversion",
        canCreateManualMovement: false,
        sourceEventoDominio: "pastagem",
        sourceEventoId: event.id,
        quantityBase: null,
        unidadeBase: null,
        requiresInventoryLot: true,
        createsStockMutation: false,
        reason: "Suplemento em sacos exige apresentacao para converter em unidade base.",
      };
    }

    return {
      decision: "eligible_manual_consumption_source",
      canCreateManualMovement: true,
      sourceEventoDominio: "pastagem",
      sourceEventoId: event.id,
      quantityBase: detail.suplemento_quantidade,
      unidadeBase: "kg",
      requiresInventoryLot: true,
      createsStockMutation: false,
      reason: "Ronda de pasto com suplemento em kg pode originar baixa manual.",
    };
  }

  return blockedNutritional("blocked_wrong_domain", "Somente eventos de nutricao ou pastagem podem originar consumo nutricional.");
}

function blockedNutritional(
  decision: Exclude<
    InventoryConsumptionDecision,
    "eligible_manual_consumption_source" | "needs_presentation_conversion"
  >,
  reason: string,
): NutritionalInventoryConsumptionReadiness {
  return {
    decision,
    canCreateManualMovement: false,
    sourceEventoDominio: null,
    sourceEventoId: null,
    quantityBase: null,
    unidadeBase: null,
    requiresInventoryLot: false,
    createsStockMutation: false,
    reason,
  };
}
