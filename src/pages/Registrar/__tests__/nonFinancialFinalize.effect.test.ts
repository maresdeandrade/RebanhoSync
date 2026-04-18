import { describe, expect, it } from "vitest";
import type { Animal } from "@/lib/offline/types";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { resolveRegistrarNonFinancialFinalizePlan } from "@/pages/Registrar/effects/nonFinancialFinalize";

const nowIso = "2026-01-01T00:00:00.000Z";

const buildAnimal = (id: string, overrides: Partial<Animal> = {}): Animal => ({
  id,
  fazenda_id: "farm-1",
  lote_id: "lote-1",
  origem: "nascimento",
  identificacao: `BR-${id}`,
  sexo: "F",
  status: "ativo",
  categoria: "vaca",
  data_nascimento: "2023-01-01",
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
  ...overrides,
});

function baseInput() {
  return {
    fazendaId: "farm-1",
    occurredAt: nowIso,
    sourceTaskId: null,
    targetAnimalIds: [null] as Array<string | null>,
    animalsMap: new Map<string, Animal>(),
    selectedLoteIsSemLote: false,
    selectedLoteIdNormalized: "lote-1" as string | null,
    createdAnimalIds: [] as string[],
    transitChecklistPayload: {},
    sanitaryProductName: "Vacina A",
    sanitaryProductSelection: null,
    sanitaryProductMetadata: {},
    protocoloItem: null,
    sanitarioData: { tipo: "vacinacao" as const },
    pesagemData: {} as Record<string, string>,
    movimentacaoData: { toLoteId: "lote-2" },
    nutricaoData: { alimentoNome: "Silagem", quantidadeKg: "20" },
    financeiroData: {
      natureza: "venda" as const,
      valorTotal: "100",
      contraparteId: "none",
    },
    financeiroTipo: "venda" as const,
    reproducaoData: { tipo: "cobertura", machoId: null },
    farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    parseUserWeight: (value: string) => Number.parseFloat(value),
  };
}

describe("resolveRegistrarNonFinancialFinalizePlan", () => {
  it("monta plano para manejo sanitario com builder de gesture injetado", async () => {
    const result = await resolveRegistrarNonFinancialFinalizePlan({
      ...baseInput(),
      tipoManejo: "sanitario",
      buildGesture: () => ({
        eventId: "evt-1",
        ops: [{ table: "eventos", action: "INSERT", record: { id: "evt-1" } }],
      }),
    });

    expect(result.issue).toBeNull();
    expect(result.linkedEventId).toBe("evt-1");
    expect(result.ops.length).toBe(1);
  });

  it("retorna issue no fallback de reproducao quando dados estao invalidos", async () => {
    const result = await resolveRegistrarNonFinancialFinalizePlan({
      ...baseInput(),
      tipoManejo: "reproducao",
      targetAnimalIds: [null],
      reproducaoData: { tipo: "cobertura", machoId: null },
    });

    expect(result.issue).toBeTruthy();
    expect(result.ops).toEqual([]);
  });

  it("retorna issue quando reproducao eh solicitada para animal inelegivel", async () => {
    const animal = buildAnimal("a-1", { sexo: "M" });
    const result = await resolveRegistrarNonFinancialFinalizePlan({
      ...baseInput(),
      tipoManejo: "reproducao",
      targetAnimalIds: ["a-1"],
      animalsMap: new Map([["a-1", animal]]),
      reproducaoData: { tipo: "cobertura", machoId: "macho-1" },
    });

    expect(result.issue).toBeTruthy();
    expect(result.ops).toEqual([]);
  });
});
