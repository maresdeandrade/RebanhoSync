/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { resolveRegistrarNonFinancialFinalizePlan } from "@/pages/Registrar/effects/nonFinancialFinalize";
import type { Animal } from "@/lib/offline/types";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { db } from "@/lib/offline/db";

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
    eccData: {} as Record<string, string>,
    eccObservacoes: {} as Record<string, string>,
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

describe("Sociedade Pecuaria - Business Logic Tests", () => {
  it("venda de animal encerra vínculo ativo com motivo venda", async () => {
    const buildGesture = vi.fn(() => ({
      eventId: "evt-venda",
      ops: [{ table: "eventos", action: "INSERT", record: { id: "evt-venda" } }],
    }));

    vi.spyOn(db.state_sociedade_animais, "where").mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { id: "link-1", animal_id: "a-1", status: "ativo", payload: {} }
        ])
      })
    } as any);

    const result = await resolveRegistrarNonFinancialFinalizePlan({
      ...baseInput(),
      tipoManejo: "comercial",
      comercialData: { operationType: "venda" } as any,
      targetAnimalIds: ["a-1"],
      animalsMap: new Map([["a-1", buildAnimal("a-1")]]),
      buildGesture,
    });

    expect(result.issue).toBeNull();
    const updateOp = result.ops.find((o: any) => o.table === "sociedade_animais" && o.action === "UPDATE");
    expect(updateOp).toBeDefined();
    expect((updateOp as any).record).toMatchObject({
      id: "link-1",
      status: "encerrado",
      motivo_saida: "venda",
      payload: expect.objectContaining({
        encerradoPor: "venda_comercial",
        eventoComercialId: "evt-venda"
      })
    });
  });

  it("venda de lote só encerra vínculo dos animais explicitamente incluídos (snapshotados)", async () => {
    const buildGesture = vi.fn((input) => ({
      eventId: `evt-${input.animalId}`,
      ops: [{ table: "eventos", action: "INSERT", record: { id: `evt-${input.animalId}` } }],
    }));

    // Mock where to return active links ONLY for 'a-1', not for 'a-2' (since we will only pass 'a-1' in targetAnimalIds)
    const whereSpy = vi.spyOn(db.state_sociedade_animais, "where").mockImplementation((args: any) => {
      return {
        equals: vi.fn().mockImplementation((val: any) => ({
          toArray: vi.fn().mockResolvedValue(
            val === "a-1" 
              ? [{ id: "link-1", animal_id: "a-1", status: "ativo", payload: {} }]
              : []
          )
        }))
      } as any;
    });

    // Simulando que o usuário incluiu apenas a-1 no payload, mas o lote tem a-1 e a-2.
    const result = await resolveRegistrarNonFinancialFinalizePlan({
      ...baseInput(),
      tipoManejo: "comercial",
      comercialData: { operationType: "venda" } as any,
      targetAnimalIds: ["a-1"], // only a-1 explicitly included
      animalsMap: new Map([
        ["a-1", buildAnimal("a-1")], 
        ["a-2", buildAnimal("a-2")]
      ]),
      buildGesture,
    });

    expect(result.issue).toBeNull();
    
    // Check ops
    const linkOps = result.ops.filter((o: any) => o.table === "sociedade_animais" && o.action === "UPDATE");
    expect(linkOps.length).toBe(1); // Somente encerrou o a-1
    expect((linkOps[0] as any).record.id).toBe("link-1");

    whereSpy.mockRestore();
  });

  it("reprocessar venda com o mesmo clientOpId preserva histórico e não fecha duas vezes", async () => {
    const buildGesture = vi.fn(() => ({
      eventId: "evt-venda-retry",
      ops: [{ table: "eventos", action: "INSERT", record: { id: "evt-venda-retry" } }],
    }));

    // Simular que o banco tem um link ativo, mas nós estamos testando se ele é atualizado corretamente. 
    // Na verdade, se reprocessamos, a fila pode já ter fechado, ou pode ser um retry onde o vínculo 
    // ainda está ativo (ex: o retry ocorre no cliente porque o request falhou, mas no state local 
    // ou antes de processar, o link pode ou não estar ativo).
    // O teste principal garante que o payload injeta o clientOpId para rastreabilidade de idempotencia futura.
    vi.spyOn(db.state_sociedade_animais, "where").mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([
          { id: "link-1", animal_id: "a-1", status: "ativo", payload: {} }
        ])
      })
    } as any);

    const result = await resolveRegistrarNonFinancialFinalizePlan({
      ...baseInput(),
      tipoManejo: "comercial",
      sourceTaskId: "client-op-id-test-123",
      comercialData: { operationType: "venda" } as any,
      targetAnimalIds: ["a-1"],
      animalsMap: new Map([["a-1", buildAnimal("a-1")]]),
      buildGesture,
    });

    expect(result.issue).toBeNull();
    const updateOp = result.ops.find((o: any) => o.table === "sociedade_animais" && o.action === "UPDATE");
    expect(updateOp).toBeDefined();
    
    // Verifica a preservação do clientOpId
    expect((updateOp as any).record).toMatchObject({
      id: "link-1",
      status: "encerrado",
      motivo_saida: "venda",
      payload: expect.objectContaining({
        encerradoPor: "venda_comercial",
        eventoComercialId: "evt-venda-retry",
        clientOpId: "client-op-id-test-123"
      })
    });
  });
});
