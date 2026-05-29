import { describe, expect, it } from "vitest";
import { sortLotsFEFO, findSuggestedLot, validateLotEligibility } from "../eligibility";
import type { InsumoLote, InsumoLoteStatusEnum } from "@/lib/offline/types";

describe("eligibility", () => {
  const createMockLote = (id: string, validade: string | null, status = "ativo", saldo = 100): InsumoLote => ({
    id,
    fazenda_id: "farm-1",
    insumo_id: "insumo-1",
    apresentacao_id: null,
    identificacao_lote: `L-${id}`,
    validade,
    fabricante: null,
    local_armazenamento: null,
    quantidade_inicial_base: 500,
    saldo_atual_base: saldo,
    unidade_base: "ml",
    status: status as InsumoLoteStatusEnum,
    payload: {},
    client_id: "client-1",
    client_op_id: `op-${id}`,
    client_tx_id: null,
    client_recorded_at: "",
    server_received_at: "",
    created_at: "",
    updated_at: "",
    deleted_at: null,
  });

  it("ordena lotes usando a politica FEFO", () => {
    const lote1 = createMockLote("lote-1", "2026-12-31");
    const lote2 = createMockLote("lote-2", "2026-06-30"); // Vence antes
    const lote3 = createMockLote("lote-3", null); // Sem validade vai para o final
    const lote4 = createMockLote("lote-4", "2026-06-30"); // Desempate por identificacao (L-lote-2 vs L-lote-4)
    const loteInativo = createMockLote("lote-inativo", "2025-01-01", "bloqueado"); // Inativo e ignorado
    const loteEsgotado = createMockLote("lote-esgotado", "2025-01-01", "ativo", 0); // Saldo zero e ignorado

    const lots = [lote1, lote2, lote3, lote4, loteInativo, loteEsgotado];
    const sorted = sortLotsFEFO(lots);

    expect(sorted).toHaveLength(4);
    expect(sorted[0].id).toBe("lote-2"); // Menor data de validade
    expect(sorted[1].id).toBe("lote-4"); // Empate por validade, desempate alfabetico
    expect(sorted[2].id).toBe("lote-1");
    expect(sorted[3].id).toBe("lote-3"); // Sem validade no final
  });

  it("sugere o lote correto usando findSuggestedLot", () => {
    const lote1 = createMockLote("lote-1", "2027-01-01");
    const lote2 = createMockLote("lote-2", "2026-01-01");

    const suggested = findSuggestedLot([lote1, lote2]);
    expect(suggested?.id).toBe("lote-2");
  });

  it("valida a elegibilidade do lote com saldo e data de vencimento", () => {
    const lote = createMockLote("lote-valido", "2026-12-31", "ativo", 50);

    // Caso 1: Tudo ok
    const resOk = validateLotEligibility(lote, 10, "2026-05-28");
    expect(resOk.eligible).toBe(true);
    expect(resOk.warning).toBeUndefined();
    expect(resOk.error).toBeUndefined();

    // Caso 2: Saldo insuficiente
    const resSaldo = validateLotEligibility(lote, 60, "2026-05-28");
    expect(resSaldo.eligible).toBe(false);
    expect(resSaldo.error).toContain("Saldo insuficiente");

    // Caso 3: Lote vencido
    const resVencido = validateLotEligibility(lote, 10, "2027-01-01");
    expect(resVencido.eligible).toBe(true); // Ainda elegivel (so warning)
    expect(resVencido.warning).toContain("Lote vencido");
    expect(resVencido.error).toBeUndefined();
  });
});
