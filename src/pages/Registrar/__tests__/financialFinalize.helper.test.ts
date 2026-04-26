import { describe, expect, it } from "vitest";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import type { Animal } from "@/lib/offline/types";
import { resolveRegistrarFinancialFinalizePlan } from "@/pages/Registrar/helpers/financialFinalize";

const nowIso = "2026-01-01T00:00:00.000Z";

const buildAnimal = (
  id: string,
  identificacao: string,
  loteId: string | null,
): Animal => ({
  id,
  fazenda_id: "farm-1",
  lote_id: loteId,
  origem: "nascimento",
  identificacao,
  sexo: "M",
  status: "ativo",
  categoria: "bezerro",
  data_nascimento: "2025-01-01",
  peso_kg: null,
  mae_id: null,
  pai_id: null,
  observacoes: null,
  criado_em_fazenda: true,
  payload: {},
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: nowIso,
  server_received_at: nowIso,
  created_at: nowIso,
  updated_at: nowIso,
  deleted_at: null,
});

describe("resolveRegistrarFinancialFinalizePlan", () => {
  it("retorna issue para natureza de sociedade em fluxo nao-sociedade", () => {
    const result = resolveRegistrarFinancialFinalizePlan({
      tipoManejo: "financeiro",
      isFinanceiroSociedade: false,
      natureza: "sociedade_entrada",
      fazendaId: "farm-1",
      occurredAt: nowIso,
      selectedAnimalIds: [],
      animalsMap: new Map<string, Animal>(),
      selectedLoteIdNormalized: "lote-1",
      contraparteId: "none",
      sourceTaskId: null,
      compraNovosAnimais: [],
      modoPeso: "nenhum",
      modoPreco: "por_lote",
      valorTotalInformado: 100,
      valorUnitario: 0,
      pesoLote: 0,
      transitChecklistPayload: {},
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
      parseUserWeight: () => null,
    });

    expect(result.issue).toBeTruthy();
    expect(result.ops).toEqual([]);
  });

  it("monta plano financeiro de compra com ops e ids criados", () => {
    const result = resolveRegistrarFinancialFinalizePlan({
      tipoManejo: "financeiro",
      isFinanceiroSociedade: false,
      natureza: "compra",
      fazendaId: "farm-1",
      occurredAt: nowIso,
      selectedAnimalIds: ["a-1"],
      animalsMap: new Map([["a-1", buildAnimal("a-1", "BR-001", "lote-1")]]),
      selectedLoteIdNormalized: "lote-1",
      contraparteId: "none",
      sourceTaskId: null,
      compraNovosAnimais: [
        {
          localId: "tmp-1",
          identificacao: " BR-200 ",
          sexo: "F",
          dataNascimento: "2025-02-01",
          pesoKg: "220,5",
          raca: "nelore",
        },
      ],
      modoPeso: "individual",
      modoPreco: "por_lote",
      valorTotalInformado: 1200,
      valorUnitario: 0,
      pesoLote: 0,
      transitChecklistPayload: {},
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
      parseUserWeight: (value) => Number.parseFloat(value.replace(",", ".")),
    });

    expect(result.issue).toBeNull();
    expect(result.linkedEventId).toBeTruthy();
    expect(result.ops.length).toBeGreaterThan(0);
    expect(result.createdAnimalIds.length).toBe(1);
  });
});
