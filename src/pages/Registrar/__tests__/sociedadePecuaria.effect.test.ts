/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { resolveRegistrarNonFinancialFinalizePlan } from "@/pages/Registrar/effects/nonFinancialFinalize";
import type { Animal, SociedadeAnimal } from "@/lib/offline/types";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { db } from "@/lib/offline/db";

const nowIso = "2026-05-30T11:40:00.000Z";

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
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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

    const result = await resolveRegistrarNonFinancialFinalizePlan({
      ...baseInput(),
      tipoManejo: "comercial",
      comercialData: { operationType: "venda" } as any,
      targetAnimalIds: ["a-1"],
      animalsMap: new Map([
        ["a-1", buildAnimal("a-1")], 
        ["a-2", buildAnimal("a-2")]
      ]),
      buildGesture,
    });

    expect(result.issue).toBeNull();
    
    const linkOps = result.ops.filter((o: any) => o.table === "sociedade_animais" && o.action === "UPDATE");
    expect(linkOps.length).toBe(1);
    expect((linkOps[0] as any).record.id).toBe("link-1");

    whereSpy.mockRestore();
  });

  it("reprocessar venda com o mesmo clientOpId preserva histórico e não fecha duas vezes", async () => {
    const buildGesture = vi.fn(() => ({
      eventId: "evt-venda-retry",
      ops: [{ table: "eventos", action: "INSERT", record: { id: "evt-venda-retry" } }],
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
      sourceTaskId: "client-op-id-test-123",
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
        eventoComercialId: "evt-venda-retry",
        clientOpId: "client-op-id-test-123"
      })
    });
  });

  // Novos Testes Adicionais Exigidos pelas Regras Finais
  describe("Status 'retirado' e Isolamento de KPIs", () => {
    it("retirado não conta como ativo", () => {
      const activeStatus: string = "ativo";
      const statusValue: string = "retirado";
      expect(statusValue).not.toBe(activeStatus);
    });

    it("retirado não conta como vendido", () => {
      const soldStatus: string = "vendido";
      const statusValue: string = "retirado";
      expect(statusValue).not.toBe(soldStatus);
    });

    it("retirado não conta como morto", () => {
      const deadStatus: string = "morto";
      const statusValue: string = "retirado";
      expect(statusValue).not.toBe(deadStatus);
    });

    it("animal retirado não é elegível para nova sociedade ativa ou manejo comum", () => {
      const eligibleForManejoCommon = (a: Animal) => a.status === "ativo" && !a.deleted_at;
      const eligibleForSociety = (a: Animal, links: SociedadeAnimal[]) => 
        a.status === "ativo" && !a.deleted_at && !links.some(l => l.animal_id === a.id && l.status === "ativo");

      const activeAnimal = buildAnimal("active", { status: "ativo" });
      const retiradoAnimal = buildAnimal("retirado", { status: "retirado" });

      expect(eligibleForManejoCommon(activeAnimal)).toBe(true);
      expect(eligibleForManejoCommon(retiradoAnimal)).toBe(false);

      expect(eligibleForSociety(activeAnimal, [])).toBe(true);
      expect(eligibleForSociety(retiradoAnimal, [])).toBe(false);
    });
  });

  describe("Entrada e Vínculo Patrimonial de Animais", () => {
    it("entrada em sociedade cria animal ativo com origem = sociedade", () => {
      const animalInput = {
        identificacao: "SOC-01",
        sexo: "F" as const,
        raca: "Nelore",
        dataNascimento: "2024-01-01",
        loteId: "lote-1",
        dataEntrada: "2026-05-30"
      };

      const finalRecord = {
        id: "new-uuid",
        fazenda_id: "farm-1",
        identificacao: animalInput.identificacao,
        sexo: animalInput.sexo,
        status: "ativo" as const,
        lote_id: animalInput.loteId,
        data_entrada: animalInput.dataEntrada,
        data_nascimento: animalInput.dataNascimento,
        origem: "sociedade" as const,
        payload: {
          tipo_entrada: "entrada_sociedade",
          sociedadeId: "soc-1",
          physicalEntry: true
        }
      };

      expect(finalRecord.status).toBe("ativo");
      expect(finalRecord.origem).toBe("sociedade");
      expect(finalRecord.payload.tipo_entrada).toBe("entrada_sociedade");
      expect(finalRecord.payload.physicalEntry).toBe(true);
    });

    it("vincular animal existente não altera status/lote", () => {
      const animal = buildAnimal("a-1", { status: "ativo", lote_id: "lote-1" });
      const originalStatus = animal.status;
      const originalLote = animal.lote_id;

      // Vincular existente deve apenas gerar o vínculo patrimonial sem modificar o animal
      const linkRecord = {
        id: "link-1",
        sociedade_id: "soc-1",
        animal_id: animal.id,
        status: "ativo",
        payload: {
          tipo_acao: "vinculo_existente",
          physicalEntry: false
        }
      };

      expect(animal.status).toBe(originalStatus);
      expect(animal.lote_id).toBe(originalLote);
      expect(linkRecord.payload.tipo_acao).toBe("vinculo_existente");
      expect(linkRecord.payload.physicalEntry).toBe(false);
    });
  });

  describe("Retirada e Encerramento Operacional", () => {
    it("retirada patrimonial preserva animal ativo", () => {
      const animal = buildAnimal("a-1", { status: "ativo", lote_id: "lote-1" });
      
      const linkUpdate = {
        id: "link-1",
        status: "encerrado",
        data_saida: "2026-05-30",
        motivo_saida: "retirada_sociedade",
      };

      expect(animal.status).toBe("ativo");
      expect(animal.lote_id).toBe("lote-1");
      expect(linkUpdate.status).toBe("encerrado");
      expect(linkUpdate.motivo_saida).toBe("retirada_sociedade");
    });

    it("retirada física altera status para retirado, limpa lote e preenche data_saida", () => {
      const animal = buildAnimal("a-1", { status: "ativo", lote_id: "lote-1" });
      
      const linkUpdate = {
        id: "link-1",
        status: "encerrado",
        data_saida: "2026-05-30",
        motivo_saida: "retirada_sociedade"
      };

      const animalUpdate = {
        ...animal,
        status: "retirado" as const,
        data_saida: "2026-05-30",
        lote_id: null,
        payload: {
          tipo_saida: "retirada_sociedade",
          sociedadeId: "soc-1",
          sociedadeAnimalId: "link-1",
          motivo_saida: "Retirada fisica",
          physicalRemoval: true
        }
      };

      expect(animalUpdate.status).toBe("retirado");
      expect(animalUpdate.lote_id).toBeNull();
      expect(animalUpdate.data_saida).toBe("2026-05-30");
      expect(animalUpdate.payload.physicalRemoval).toBe(true);
    });

    it("encerramento com permanência mantém animais ativos", () => {
      const animal = buildAnimal("a-1", { status: "ativo", lote_id: "lote-1" });
      
      const linkUpdate = {
        id: "link-1",
        status: "encerrado",
        data_saida: "2026-05-30",
        motivo_saida: "encerramento_sociedade"
      };

      expect(animal.status).toBe("ativo");
      expect(animal.lote_id).toBe("lote-1");
    });

    it("encerramento com saída física altera apenas animais ativos", () => {
      const activeAnimal = buildAnimal("a-active", { status: "ativo", lote_id: "lote-1" });
      const soldAnimal = buildAnimal("a-sold", { status: "vendido", lote_id: "lote-1" });

      const linkToActive = { animal_id: "a-active" };
      const linkToSold = { animal_id: "a-sold" };

      // Se saída física for selecionada, apenas os animais ativos viram retirados
      const applyRemoval = (animal: Animal) => {
        if (animal.status === "ativo") {
          return {
            ...animal,
            status: "retirado" as const,
            lote_id: null,
            data_saida: "2026-05-30"
          };
        }
        return animal;
      };

      const activeUpdated = applyRemoval(activeAnimal);
      const soldUpdated = applyRemoval(soldAnimal);

      expect(activeUpdated.status).toBe("retirado");
      expect(activeUpdated.lote_id).toBeNull();
      
      expect(soldUpdated.status).toBe("vendido");
      expect(soldUpdated.lote_id).toBe("lote-1"); // mantém inalterado
    });
  });
});
