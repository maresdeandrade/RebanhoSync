import { describe, expect, it } from "vitest";

import {
  buildSanitaryExceptionsReadModel,
  type SanitaryExceptionAgendaItem,
  type SanitaryExceptionEvent,
  type SanitaryExceptionEventDetail,
  type SanitaryExceptionInventoryLot,
  type SanitaryExceptionInventoryMovement,
} from "@/lib/sanitario/reconciliation/sanitaryExceptions";

const detectedAt = "2026-06-01T12:00:00.000Z";

const event = (
  override: Partial<SanitaryExceptionEvent> = {},
): SanitaryExceptionEvent => ({
  id: "evt-1",
  dominio: "sanitario",
  occurred_at: "2026-05-30T10:00:00.000Z",
  animal_id: "animal-1",
  lote_id: "lote-rebanho-1",
  source_task_id: null,
  payload: {},
  deleted_at: null,
  ...override,
});

const detail = (
  override: Partial<SanitaryExceptionEventDetail> = {},
): SanitaryExceptionEventDetail => ({
  evento_id: "evt-1",
  tipo: "medicamento",
  produto: "Produto estruturado",
  produto_veterinario_id: "produto-1",
  produto_nome_snapshot: "Produto estruturado",
  estoque_lote_id: "estoque-lote-1",
  validade_produto: "2026-12-31",
  dose_quantidade: 10,
  dose_unidade: "ml",
  via_aplicacao: "subcutanea",
  carencia_carne_dias: null,
  carencia_leite_dias: null,
  carencia_carne_ate: null,
  carencia_leite_ate: null,
  custo_unitario_snapshot: 2,
  custo_total_snapshot: 20,
  payload: {},
  deleted_at: null,
  ...override,
});

const movement = (
  override: Partial<SanitaryExceptionInventoryMovement> = {},
): SanitaryExceptionInventoryMovement => ({
  id: "mov-1",
  insumo_lote_id: "estoque-lote-1",
  tipo: "consumo_sanitario",
  quantidade_base: 10,
  occurred_at: "2026-05-30T10:00:00.000Z",
  source_evento_id: "evt-1",
  source_evento_dominio: "sanitario",
  animal_id: "animal-1",
  rebanho_lote_id: "lote-rebanho-1",
  custo_unitario_snapshot: 2,
  custo_total_snapshot: 20,
  deleted_at: null,
  ...override,
});

const lot = (
  override: Partial<SanitaryExceptionInventoryLot> = {},
): SanitaryExceptionInventoryLot => ({
  id: "estoque-lote-1",
  validade: "2026-12-31",
  custo_unitario: 2,
  deleted_at: null,
  ...override,
});

const correctiveAgenda = (
  override: Partial<SanitaryExceptionAgendaItem> = {},
): SanitaryExceptionAgendaItem => ({
  id: "agenda-1",
  dominio: "conformidade",
  tipo: "biosseguranca_acao_corretiva",
  status: "agendado",
  data_prevista: "2026-06-10",
  animal_id: "animal-1",
  lote_id: null,
  source_ref: null,
  source_evento_id: "bio-1",
  payload: {},
  deleted_at: null,
  ...override,
});

describe("buildSanitaryExceptionsReadModel", () => {
  it("retorna lista vazia para entrada vazia", () => {
    expect(
      buildSanitaryExceptionsReadModel({
        detectedAt,
      }),
    ).toEqual([]);
  });

  it("nao cria excecao quando evento, detalhe, lote e baixa estao completos", () => {
    expect(
      buildSanitaryExceptionsReadModel({
        eventos: [event()],
        eventosSanitario: [detail()],
        insumoMovimentacoes: [movement()],
        estoqueLotes: [lot()],
        detectedAt,
      }),
    ).toEqual([]);
  });

  it("identifica dados parciais de rastreabilidade sem inferir por agenda ou protocolo", () => {
    const exceptions = buildSanitaryExceptionsReadModel({
      eventos: [event()],
      eventosSanitario: [
        detail({
          produto: "Texto livre",
          produto_veterinario_id: null,
          produto_nome_snapshot: null,
          estoque_lote_id: null,
          dose_quantidade: null,
          dose_unidade: null,
          via_aplicacao: null,
          custo_unitario_snapshot: null,
          custo_total_snapshot: null,
          carencia_carne_dias: 30,
          carencia_carne_ate: null,
        }),
      ],
      agendaItens: [
        correctiveAgenda({
          id: "agenda-solta",
          tipo: "vacina",
          source_evento_id: null,
        }),
      ],
      detectedAt,
    });

    expect(exceptions.map((exception) => exception.code)).toEqual([
      "evento_sanitario_sem_produto",
      "evento_sanitario_sem_lote_estoque",
      "evento_sanitario_sem_custo",
      "evento_sanitario_sem_dose",
      "evento_sanitario_sem_via",
      "carencia_incompleta",
    ]);
    expect(
      exceptions.find((exception) => exception.code === "evento_sanitario_sem_dose")
        ?.limitations,
    ).toContain("Nao foi inferida dose por protocolo, agenda ou produto.");
  });

  it("identifica lote vencido na data do evento por snapshot ou lote carregado", () => {
    const exceptions = buildSanitaryExceptionsReadModel({
      eventos: [event()],
      eventosSanitario: [detail({ validade_produto: "2027-01-01" })],
      insumoMovimentacoes: [movement()],
      estoqueLotes: [lot({ validade: "2026-05-01" })],
      detectedAt,
    });

    expect(exceptions.map((exception) => exception.code)).toEqual([
      "estoque_lote_vencido_na_data_evento",
    ]);
  });

  it("identifica baixa ausente quando evento sanitario tem lote de estoque", () => {
    const exceptions = buildSanitaryExceptionsReadModel({
      eventos: [event()],
      eventosSanitario: [detail()],
      insumoMovimentacoes: [],
      detectedAt,
    });

    expect(exceptions.map((exception) => exception.code)).toEqual([
      "estoque_movimentacao_ausente",
    ]);
    expect(exceptions[0]).toMatchObject({
      source: "insumo_movimentacoes",
      evento_id: "evt-1",
      source_evento_id: "evt-1",
    });
  });

  it("identifica duplicidade e custo inconsistente em movimentacoes vinculadas", () => {
    const exceptions = buildSanitaryExceptionsReadModel({
      eventos: [event()],
      eventosSanitario: [detail()],
      insumoMovimentacoes: [
        movement({ id: "mov-1", custo_total_snapshot: 21 }),
        movement({ id: "mov-2", custo_total_snapshot: 20 }),
      ],
      detectedAt,
    });

    expect(exceptions.map((exception) => exception.code)).toEqual([
      "estoque_movimentacao_duplicada",
      "custo_inconsistente",
    ]);
  });

  it("trata detalhe sanitario sem evento base como fonte incompleta, nao como fato completo", () => {
    const exceptions = buildSanitaryExceptionsReadModel({
      eventos: [],
      eventosSanitario: [detail()],
      detectedAt,
    });

    expect(exceptions).toMatchObject([
      {
        code: "evento_sanitario_sem_produto",
        source: "eventos_sanitario",
        limitations: [
          "Sem o evento base carregado, a reconciliacao nao deve inferir animal, lote, data ou execucao.",
        ],
      },
    ]);
  });

  it("identifica ocorrencia real aberta e pendencia corretiva vinculada por source_evento_id", () => {
    const bioEvent = event({
      id: "bio-1",
      dominio: "conformidade",
      payload: {
        biosseguranca_ocorrencia: {
          schema_version: 1,
          categoria_ocorrencia: "biosseguranca",
          tipo_ocorrencia: "falha_epi",
          tipos_ocorrencia: ["falha_epi"],
          escopo_tipo: "animal",
          escopos_tipo: ["animal"],
          animal_id: "animal-1",
          gravidade: "alta",
          acao_imediata: "Isolamento e EPI reforcado.",
          gera_pendencia: true,
          prazo_correcao: "2026-06-10",
          status: "aberta",
        },
      },
    });

    const exceptions = buildSanitaryExceptionsReadModel({
      eventos: [bioEvent],
      agendaItens: [correctiveAgenda()],
      detectedAt,
    });

    expect(exceptions.map((exception) => exception.code)).toEqual([
      "ocorrencia_biosseguranca_aberta",
      "ocorrencia_com_pendencia_aberta",
    ]);
    expect(exceptions.every((exception) => exception.evento_id === "bio-1")).toBe(true);
  });

  it("identifica suspeita notificavel aberta sem criar pendencia geral", () => {
    const suspicionEvent = event({
      id: "alert-1",
      dominio: "alerta_sanitario",
      lote_id: "lote-1",
      payload: {
        biosseguranca_ocorrencia: {
          schema_version: 1,
          categoria_ocorrencia: "suspeita_doenca_notificavel",
          tipo_ocorrencia: "suspeita_doenca_notificavel",
          tipos_ocorrencia: [],
          escopo_tipo: "lote",
          escopos_tipo: ["lote"],
          animal_id: null,
          lote_id: "lote-1",
          gravidade: "alta",
          acao_imediata: "Lote isolado.",
          gera_pendencia: false,
          prazo_correcao: null,
          status: "aberta",
        },
      },
    });

    const exceptions = buildSanitaryExceptionsReadModel({
      eventos: [suspicionEvent],
      agendaItens: [
        correctiveAgenda({
          id: "agenda-geral",
          tipo: "sanitario_notificacao_pendente",
          source_evento_id: null,
          lote_id: "lote-1",
        }),
      ],
      detectedAt,
    });

    expect(exceptions.map((exception) => exception.code)).toEqual([
      "suspeita_notificavel_aberta",
    ]);
    expect(exceptions[0]).toMatchObject({
      source: "eventos.payload.biosseguranca_ocorrencia",
      lote_id: "lote-1",
    });
  });

  it("identifica somente pendencia corretiva vencida especifica vinculada por source_evento_id", () => {
    const bioEvent = event({
      id: "bio-1",
      dominio: "conformidade",
      payload: {
        biosseguranca_ocorrencia: {
          schema_version: 1,
          categoria_ocorrencia: "biosseguranca",
          tipo_ocorrencia: "falha_limpeza_desinfeccao",
          tipos_ocorrencia: ["falha_limpeza_desinfeccao"],
          escopo_tipo: "fazenda",
          escopos_tipo: ["fazenda"],
          gravidade: "moderada",
          acao_imediata: "Area sinalizada.",
          gera_pendencia: true,
          prazo_correcao: "2026-05-31",
          status: "aberta",
        },
      },
    });

    const exceptions = buildSanitaryExceptionsReadModel({
      eventos: [bioEvent],
      agendaItens: [
        correctiveAgenda({
          data_prevista: "2026-05-31",
        }),
        correctiveAgenda({
          id: "agenda-geral",
          data_prevista: "2026-05-01",
          source_evento_id: null,
        }),
      ],
      detectedAt,
    });

    expect(exceptions.map((exception) => exception.code)).toEqual([
      "ocorrencia_biosseguranca_aberta",
      "ocorrencia_com_pendencia_aberta",
      "pendencia_corretiva_vencida",
    ]);
    expect(
      exceptions.filter((exception) => exception.code === "pendencia_corretiva_vencida"),
    ).toHaveLength(1);
  });

  it("mantem id deterministico e permite marcar excecao como ignored por id recebido", () => {
    const firstRun = buildSanitaryExceptionsReadModel({
      eventos: [event()],
      eventosSanitario: [detail({ estoque_lote_id: null })],
      detectedAt,
    });

    const secondRun = buildSanitaryExceptionsReadModel({
      eventos: [event()],
      eventosSanitario: [detail({ estoque_lote_id: null })],
      detectedAt,
      ignoredExceptionIds: [firstRun[0].id],
    });

    expect(secondRun[0]).toMatchObject({
      id: firstRun[0].id,
      status: "ignored",
    });
  });
});
