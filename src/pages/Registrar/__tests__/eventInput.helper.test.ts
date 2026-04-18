import { describe, expect, it } from "vitest";
import type { ProtocoloSanitarioItem } from "@/lib/offline/types";
import {
  buildRegistrarFallbackReproductionEventInput,
  buildRegistrarEventInput,
} from "@/pages/Registrar/helpers/eventInput";

describe("buildRegistrarEventInput", () => {
  const base = {
    fazendaId: "farm-1",
    occurredAt: "2026-04-16T00:00:00.000Z",
    sourceTaskId: null,
    animalId: "animal-1",
    targetLoteId: "lote-1",
  };

  it("monta evento sanitário com referência de protocolo", () => {
    const protocoloItem = {
      id: "item-1",
      intervalo_dias: 30,
      dose_num: 1,
      gera_agenda: true,
    } as ProtocoloSanitarioItem;

    const input = buildRegistrarEventInput({
      ...base,
      tipoManejo: "sanitario",
      sanitario: {
        tipo: "vacinacao",
        produto: "Vacina X",
        protocoloItem,
        produtoRef: null,
        payload: { origem: "teste" },
      },
    });

    expect(input).toMatchObject({
      dominio: "sanitario",
      tipo: "vacinacao",
      produto: "Vacina X",
      protocoloItem: {
        id: "item-1",
        intervalDays: 30,
        doseNum: 1,
        geraAgenda: true,
      },
    });
  });

  it("monta evento de movimentação com payload de trânsito", () => {
    const input = buildRegistrarEventInput({
      ...base,
      tipoManejo: "movimentacao",
      movimentacao: { toLoteId: "lote-2" },
      transitChecklistPayload: { transito_sanitario: { enabled: true } },
    });

    expect(input).toMatchObject({
      dominio: "movimentacao",
      fromLoteId: "lote-1",
      toLoteId: "lote-2",
      payload: { transito_sanitario: { enabled: true } },
    });
  });

  it("monta evento financeiro de venda com flags de atualização do animal", () => {
    const input = buildRegistrarEventInput({
      ...base,
      tipoManejo: "financeiro",
      financeiro: {
        natureza: "venda",
        tipo: "venda",
        valorTotal: 5000,
        contraparteId: "cp-1",
      },
    });

    expect(input).toMatchObject({
      dominio: "financeiro",
      tipo: "venda",
      valorTotal: 5000,
      contraparteId: "cp-1",
      applyAnimalStateUpdate: true,
      clearAnimalLoteOnSale: true,
      payload: { kind: "venda_animal", origem: "registrar_manejo" },
    });
  });

  it("usa animal criado para compra sem seleção de animal (sem lote)", () => {
    const input = buildRegistrarEventInput({
      ...base,
      animalId: null,
      tipoManejo: "financeiro",
      selectedLoteIsSemLote: true,
      createdAnimalIds: ["novo-1"],
      financeiro: {
        natureza: "compra",
        tipo: "compra",
        valorTotal: 1000,
        contraparteId: null,
      },
    });

    expect(input).toMatchObject({
      dominio: "financeiro",
      animalId: "novo-1",
      payload: {
        kind: "compra_lote_com_animais",
        origem: "registrar_manejo",
      },
    });
  });

  it("monta fallback de reprodução com contrato v1 do payload", () => {
    const input = buildRegistrarFallbackReproductionEventInput({
      fazendaId: "farm-1",
      occurredAt: "2026-04-16T00:00:00.000Z",
      sourceTaskId: "agenda-1",
      animalId: "animal-1",
      reproducaoData: {
        tipo: "diagnostico",
        resultadoDiagnostico: "positivo",
        dataPrevistaParto: "2026-12-10",
        episodeEventoId: "evt-1",
        episodeLinkMethod: "manual",
      },
    });

    expect(input).toMatchObject({
      dominio: "reproducao",
      tipo: "diagnostico",
      animalId: "animal-1",
      payloadData: {
        schema_version: 1,
        resultado: "positivo",
        data_prevista_parto: "2026-12-10",
        episode_evento_id: "evt-1",
        episode_link_method: "manual",
      },
    });
  });
});
