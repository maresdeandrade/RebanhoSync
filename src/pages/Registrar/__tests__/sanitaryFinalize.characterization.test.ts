import { describe, expect, it, vi } from "vitest";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { resolveRegistrarNonFinancialFinalizePlan } from "@/pages/Registrar/effects/nonFinancialFinalize";
import type { Animal } from "@/lib/offline/types";

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

describe("Caracterizacao - Risco J: Rastreabilidade no Evento Sanitario", () => {
  it("CONFIRMADO: buildEventGesture grava rastreabilidade sanitaria em colunas estruturadas e mantem snapshot no payload", () => {
    // 1. Prepara dados de entrada do evento sanitario contendo rastreabilidade estrita (lote, dose, carencias, etc.)
    const eventInput = {
      fazendaId: "farm-123",
      dominio: "sanitario" as const,
      tipo: "vacinacao" as const,
      produto: "Vacina Febre Aftosa",
      occurredAt: nowIso,
      animalId: "animal-123",
      loteId: "lote-abc",
      sourceTaskId: "task-999",
      observacoes: "Aplicado com sucesso",
      
      // Dados de rastreabilidade
      produtoRef: {
        id: "prod-aftosa-uuid",
        nome: "Vacina Febre Aftosa Catalogada",
        categoria: "vacina",
        origem: "catalogo_oficial",
      },
      insumoRef: {
        id: "insumo-123",
        nome: "Aftosa Insumo",
        tipo: "vacinacao",
        carencia_carne_dias: 30,
        carencia_leite_dias: 3,
      } as unknown as Record<string, unknown>,
      loteRef: {
        id: "lote-insumo-456",
        fabricante: "BioVet",
        validade: "2027-12-31",
        custo_unitario: 5.5,
        unidade_base: "ml",
      } as unknown as Record<string, unknown>,
      dose: 2.0,
      doseUnidade: "ml",
      quantidadeConsumida: 2.0,
      quantidadeUnidade: "ml",
      viaAplicacao: "subcutanea",
    };

    // 2. Executa a construcao do gesture
    const { ops } = buildEventGesture(eventInput);

    // 3. Analisa as operacoes geradas
    const evSanitarioOp = ops.find(op => op.table === "eventos_sanitario");
    expect(evSanitarioOp).toBeDefined();
    
    const record = evSanitarioOp!.record;
    
    expect(record.produto_veterinario_id).toBe("prod-aftosa-uuid");
    expect(record.estoque_lote_id).toBe("lote-insumo-456");
    expect(record.lote_fabricante).toBe("BioVet");
    expect(record.validade_produto).toBe("2027-12-31");
    expect(record.dose_quantidade).toBe(2);
    expect(record.dose_unidade).toBe("ml");
    expect(record.via_aplicacao).toBe("subcutanea");
    expect(record.carencia_carne_dias).toBe(30);

    // Verificamos que os snapshots residem na chave payload
    expect(record.payload).toBeDefined();
    expect(record.payload.produto_veterinario_id).toBe("prod-aftosa-uuid");
    expect(record.payload.produto_nome_catalogo).toBe("Vacina Febre Aftosa Catalogada");
    
    // insumo_snapshot eh estruturado dinamicamente
    expect(record.payload.insumo_snapshot).toBeDefined();
    expect(record.payload.insumo_snapshot.insumo_id).toBe("insumo-123");
    expect(record.payload.insumo_snapshot.insumo_lote_id).toBe("lote-insumo-456");
    expect(record.payload.insumo_snapshot.fabricante_snapshot).toBe("BioVet");
    expect(record.payload.insumo_snapshot.carencia_carne_dias_snapshot).toBe(30);
    expect(record.payload.insumo_snapshot.carencia_leite_dias_snapshot).toBe(3);
    expect(record.payload.insumo_snapshot.dose_aplicada).toBe(2.0);
    expect(record.payload.insumo_snapshot.dose_unidade).toBe("ml");
    expect(record.payload.insumo_snapshot.via_aplicacao).toBe("subcutanea");
  });

  it("CONFIRMADO: O clinical_case_id eh mapeado na coluna estruturada sanitario_caso_id da tabela BASE eventos, nao na tabela eventos_sanitario", async () => {
    const buildGesture = vi.fn((input) => {
      return {
        eventId: "evt-123",
        ops: buildEventGesture(input).ops,
      };
    });

    const animal = buildAnimal("animal-123");
    const map = new Map([["animal-123", animal]]);

    const result = await resolveRegistrarNonFinancialFinalizePlan({
      tipoManejo: "sanitario",
      fazendaId: "farm-1",
      occurredAt: nowIso,
      sourceTaskId: null,
      targetAnimalIds: ["animal-123"],
      animalsMap: map,
      selectedLoteIsSemLote: false,
      selectedLoteIdNormalized: "lote-1",
      createdAnimalIds: [],
      transitChecklistPayload: {},
      sanitaryProductName: "Tratamento Mastite",
      sanitaryProductSelection: null,
      sanitaryProductMetadata: {},
      protocoloItem: null,
      sanitarioData: { tipo: "medicamento" },
      pesagemData: {},
      eccData: {},
      eccObservacoes: {},
      movimentacaoData: { toLoteId: "lote-2" },
      nutricaoData: { alimentoNome: "Silagem", quantidadeKg: "20" },
      financeiroData: { natureza: "venda", valorTotal: "100", contraparteId: "none" },
      financeiroTipo: "venda",
      reproducaoData: { tipo: "cobertura", machoId: null },
      farmLifecycleConfig: {
        schema_version: 1,
        stages: []
      } as unknown as Record<string, unknown>,
      parseUserWeight: (v) => Number(v),
      
      // Vinculo de caso clinico estruturado
      sanitarioCasoId: "caso-clinico-uuid-999",
      buildGesture,
      resolveManualSanitaryAgendaCompletionOps: vi.fn(async () => []),
    });

    expect(result.issue).toBeNull();

    const eventosOp = result.ops.find(op => op.table === "eventos");
    expect(eventosOp).toBeDefined();
    
    // CONFIRMACAO CONCRETA:
    // O caso clinico eh gravado na coluna estruturada da tabela eventos, nao eventos_sanitario!
    expect(eventosOp!.record.sanitario_caso_id).toBe("caso-clinico-uuid-999");

    const eventosSanitarioOp = result.ops.find(op => op.table === "eventos_sanitario");
    expect(eventosSanitarioOp).toBeDefined();
    expect(eventosSanitarioOp!.record.sanitario_caso_id).toBeUndefined(); // Nao existe na tabela detalhe
  });
});
