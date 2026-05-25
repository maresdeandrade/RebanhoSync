import { describe, expect, it } from "vitest";

import {
  evaluateSanitaryInventoryConsumptionReadiness,
  type SanitaryInventoryConsumptionDetail,
  type SanitaryInventoryConsumptionSource,
} from "@/lib/sanitario/compliance/inventoryConsumption";

const confirmedSanitaryEvent: SanitaryInventoryConsumptionSource = {
  id: "evt-1",
  dominio: "sanitario",
  deleted_at: null,
  occurred_at: "2026-05-25T10:00:00.000Z",
  payload: {},
};

const catalogedSanitaryDetail: SanitaryInventoryConsumptionDetail = {
  evento_id: "evt-1",
  tipo: "medicamento",
  produto: "Antibiotico Intramamario",
  payload: {
    produto_veterinario_id: "prod-1",
    produto_nome_catalogo: "Antibiotico Intramamario",
    produto_categoria: "medicamento",
  },
};

describe("evaluateSanitaryInventoryConsumptionReadiness", () => {
  it("permite apenas origem manual futura a partir de evento sanitario confirmado e produto catalogado", () => {
    const result = evaluateSanitaryInventoryConsumptionReadiness({
      event: confirmedSanitaryEvent,
      sanitaryDetail: catalogedSanitaryDetail,
    });

    expect(result).toEqual({
      decision: "eligible_manual_consumption_source",
      canCreateManualMovement: true,
      productName: "Antibiotico Intramamario",
      catalogProductId: "prod-1",
      requiresInventoryLot: true,
      createsStockMutation: false,
      reason:
        "Evento sanitario confirmado pode originar baixa manual futura, sem mutacao automatica de estoque.",
    });
  });

  it("bloqueia protocolo, agenda ou detalhe solto sem evento confirmado", () => {
    const result = evaluateSanitaryInventoryConsumptionReadiness({
      event: null,
      sanitaryDetail: catalogedSanitaryDetail,
    });

    expect(result).toMatchObject({
      decision: "blocked_not_confirmed_event",
      canCreateManualMovement: false,
      createsStockMutation: false,
    });
  });

  it("bloqueia evento de outro dominio", () => {
    const result = evaluateSanitaryInventoryConsumptionReadiness({
      event: {
        ...confirmedSanitaryEvent,
        dominio: "nutricao",
      },
      sanitaryDetail: catalogedSanitaryDetail,
    });

    expect(result).toMatchObject({
      decision: "blocked_not_sanitary_event",
      canCreateManualMovement: false,
      createsStockMutation: false,
    });
  });

  it("exige conciliacao quando produto veio como texto livre", () => {
    const result = evaluateSanitaryInventoryConsumptionReadiness({
      event: confirmedSanitaryEvent,
      sanitaryDetail: {
        ...catalogedSanitaryDetail,
        produto: "Produto digitado",
        payload: {
          produto_origem: "texto_livre",
        },
      },
    });

    expect(result).toMatchObject({
      decision: "needs_catalog_product_reference",
      canCreateManualMovement: false,
      productName: "Produto digitado",
      catalogProductId: null,
      requiresInventoryLot: true,
      createsStockMutation: false,
    });
  });

  it("bloqueia evento removido", () => {
    const result = evaluateSanitaryInventoryConsumptionReadiness({
      event: {
        ...confirmedSanitaryEvent,
        deleted_at: "2026-05-25T11:00:00.000Z",
      },
      sanitaryDetail: catalogedSanitaryDetail,
    });

    expect(result).toMatchObject({
      decision: "blocked_deleted_event",
      canCreateManualMovement: false,
      createsStockMutation: false,
    });
  });
});
