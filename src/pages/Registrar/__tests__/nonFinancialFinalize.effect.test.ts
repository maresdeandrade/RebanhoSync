import { describe, expect, it, vi } from "vitest";
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
    const buildGesture = vi.fn(() => ({
      eventId: "evt-1",
      ops: [{ table: "eventos", action: "INSERT", record: { id: "evt-1" } }],
    }));
    const result = await resolveRegistrarNonFinancialFinalizePlan({
      ...baseInput(),
      tipoManejo: "sanitario",
      targetAnimalIds: ["a-1"],
      animalsMap: new Map([["a-1", buildAnimal("a-1")]]),
      sanitarioCasoId: "caso-1",
      buildGesture,
      resolveManualSanitaryAgendaCompletionOps: vi.fn(async () => []),
    });

    expect(result.issue).toBeNull();
    expect(result.linkedEventId).toBe("evt-1");
    expect(result.ops.length).toBe(1);
    expect(buildGesture).toHaveBeenCalledWith(
      expect.objectContaining({
        dominio: "sanitario",
        sanitarioCaso: { action: "link", id: "caso-1" },
      }),
    );
  });

  it("abre caso clinico junto do manejo sanitario quando solicitado", async () => {
    const buildGesture = vi.fn(() => ({
      eventId: "evt-1",
      ops: [{ table: "eventos", action: "INSERT", record: { id: "evt-1" } }],
    }));

    const result = await resolveRegistrarNonFinancialFinalizePlan({
      ...baseInput(),
      tipoManejo: "sanitario",
      targetAnimalIds: ["a-1"],
      animalsMap: new Map([["a-1", buildAnimal("a-1")]]),
      abrirCasoClinico: true,
      buildGesture,
      resolveManualSanitaryAgendaCompletionOps: vi.fn(async () => []),
    });

    expect(result.issue).toBeNull();
    expect(buildGesture).toHaveBeenCalledWith(
      expect.objectContaining({
        dominio: "sanitario",
        sanitarioCaso: expect.objectContaining({
          action: "open",
          tipo: "clinico",
          status: "em_acompanhamento",
        }),
      }),
    );
  });

  it("bloqueia vinculo de caso clinico existente para multiplos animais", async () => {
    const result = await resolveRegistrarNonFinancialFinalizePlan({
      ...baseInput(),
      tipoManejo: "sanitario",
      targetAnimalIds: ["a-1", "a-2"],
      sanitarioCasoId: "caso-1",
    });

    expect(result.issue).toContain("apenas um animal");
    expect(result.ops).toEqual([]);
  });

  it("conclui pendencia sanitaria correspondente quando registro manual bate com agenda aberta", async () => {
    const animal = buildAnimal("a-1");
    const resolveManualSanitaryAgendaCompletionOps = vi.fn(async () => [
      {
        table: "agenda_itens",
        action: "UPDATE" as const,
        record: {
          id: "agenda-1",
          status: "concluido",
          source_evento_id: "evt-manual-1",
        },
      },
    ]);

    const result = await resolveRegistrarNonFinancialFinalizePlan({
      ...baseInput(),
      tipoManejo: "sanitario",
      targetAnimalIds: ["a-1"],
      animalsMap: new Map([["a-1", animal]]),
      protocoloItem: {
        id: "item-1",
        fazenda_id: "farm-1",
        protocolo_id: "protocolo-1",
        protocol_item_id: "version-1",
        version: 1,
        tipo: "vacinacao",
        produto: "Vacina Raiva Herbivoros",
        intervalo_dias: 365,
        dose_num: 1,
        gera_agenda: true,
        dedup_template: null,
        payload: {},
        client_id: "client-1",
        client_op_id: "op-item-1",
        client_tx_id: null,
        client_recorded_at: nowIso,
        server_received_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
        deleted_at: null,
      },
      sanitaryProductName: "Vacina Raiva Herbivoros",
      buildGesture: () => ({
        eventId: "evt-manual-1",
        ops: [
          {
            table: "eventos",
            action: "INSERT",
            record: { id: "evt-manual-1" },
          },
        ],
      }),
      resolveManualSanitaryAgendaCompletionOps,
    });

    expect(result.issue).toBeNull();
    expect(resolveManualSanitaryAgendaCompletionOps).toHaveBeenCalledWith({
      fazendaId: "farm-1",
      linkedEventId: "evt-manual-1",
      animalId: "a-1",
      sanitarioTipo: "vacinacao",
      sanitaryProductName: "Vacina Raiva Herbivoros",
      protocoloItem: expect.objectContaining({ id: "item-1" }),
    });
    expect(result.ops).toEqual([
      { table: "eventos", action: "INSERT", record: { id: "evt-manual-1" } },
      {
        table: "agenda_itens",
        action: "UPDATE",
        record: {
          id: "agenda-1",
          status: "concluido",
          source_evento_id: "evt-manual-1",
        },
      },
    ]);
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
