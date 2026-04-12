import { describe, expect, it } from "vitest";
import type {
  AgendaItem,
  Animal,
  CatalogoProtocoloOficial,
  CatalogoProtocoloOficialItem,
  Evento,
  EventoFinanceiro,
  EventoPesagem,
  FazendaSanidadeConfig,
  Gesture,
  Lote,
  Pasto,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
  Rejection,
} from "@/lib/offline/types";
import {
  buildOperationalSummary,
  buildOperationalSummaryCsv,
  resolveReportRange,
} from "../operationalSummary";

const baseAnimal = {
  fazenda_id: "farm-1",
  lote_id: null,
  data_nascimento: null,
  data_entrada: null,
  data_saida: null,
  pai_id: null,
  mae_id: null,
  nome: null,
  rfid: null,
  origem: null,
  raca: null,
  papel_macho: null,
  habilitado_monta: false,
  observacoes: null,
  payload: {},
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: "2026-03-20T10:00:00.000Z",
  server_received_at: "2026-03-20T10:00:00.000Z",
  created_at: "2026-03-20T10:00:00.000Z",
  updated_at: "2026-03-20T10:00:00.000Z",
  deleted_at: null,
} satisfies Omit<Animal, "id" | "identificacao" | "sexo" | "status">;

const baseLote = {
  fazenda_id: "farm-1",
  status: "ativo",
  pasto_id: null,
  touro_id: null,
  observacoes: null,
  payload: {},
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: "2026-03-20T10:00:00.000Z",
  server_received_at: "2026-03-20T10:00:00.000Z",
  created_at: "2026-03-20T10:00:00.000Z",
  updated_at: "2026-03-20T10:00:00.000Z",
  deleted_at: null,
} satisfies Omit<Lote, "id" | "nome">;

const basePasto = {
  fazenda_id: "farm-1",
  area_ha: 12,
  capacidade_ua: 18,
  tipo_pasto: "cultivado",
  infraestrutura: {},
  observacoes: null,
  payload: {},
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: "2026-03-20T10:00:00.000Z",
  server_received_at: "2026-03-20T10:00:00.000Z",
  created_at: "2026-03-20T10:00:00.000Z",
  updated_at: "2026-03-20T10:00:00.000Z",
  deleted_at: null,
} satisfies Omit<Pasto, "id" | "nome">;

const baseAgenda = {
  fazenda_id: "farm-1",
  dominio: "sanitario",
  status: "agendado",
  animal_id: null,
  lote_id: null,
  dedup_key: null,
  source_kind: "manual",
  source_ref: null,
  source_client_op_id: null,
  source_tx_id: null,
  source_evento_id: null,
  protocol_item_version_id: null,
  interval_days_applied: null,
  payload: {},
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: "2026-03-20T10:00:00.000Z",
  server_received_at: "2026-03-20T10:00:00.000Z",
  created_at: "2026-03-20T10:00:00.000Z",
  updated_at: "2026-03-20T10:00:00.000Z",
  deleted_at: null,
} satisfies Omit<AgendaItem, "id" | "tipo" | "data_prevista">;

const baseEvento = {
  fazenda_id: "farm-1",
  animal_id: null,
  lote_id: null,
  source_task_id: null,
  source_tx_id: null,
  source_client_op_id: null,
  corrige_evento_id: null,
  observacoes: null,
  payload: {},
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: "2026-03-20T10:00:00.000Z",
  server_received_at: "2026-03-20T10:00:00.000Z",
  created_at: "2026-03-20T10:00:00.000Z",
  updated_at: "2026-03-20T10:00:00.000Z",
  deleted_at: null,
} satisfies Omit<Evento, "id" | "dominio" | "occurred_at">;

const baseGesture = {
  fazenda_id: "farm-1",
  client_id: "client-1",
  created_at: "2026-03-20T10:00:00.000Z",
} satisfies Omit<Gesture, "client_tx_id" | "status">;

describe("resolveReportRange", () => {
  it("builds current month range", () => {
    const range = resolveReportRange("mes_atual", new Date("2026-03-29T12:00:00.000Z"));

    expect(range).toMatchObject({
      from: "2026-03-01",
      to: "2026-03-29",
      label: "Mes atual",
      filenameTag: "2026-03",
    });
  });
});

describe("buildOperationalSummary", () => {
  it("aggregates rebanho, agenda, sync, manejo, financeiro and pesagem", () => {
    const range = resolveReportRange("30d", new Date("2026-03-29T12:00:00.000Z"));

    const animals: Animal[] = [
      {
        ...baseAnimal,
        id: "animal-1",
        identificacao: "BR-001",
        sexo: "F",
        status: "ativo",
      },
      {
        ...baseAnimal,
        id: "animal-2",
        identificacao: "BR-002",
        sexo: "M",
        status: "vendido",
      },
    ];
    const lotes: Lote[] = [{ ...baseLote, id: "lote-1", nome: "Matrizes" }];
    const pastos: Pasto[] = [{ ...basePasto, id: "pasto-1", nome: "Piquete 1" }];
    const protocolosSanitarios: ProtocoloSanitario[] = [
      {
        id: "protocol-1",
        fazenda_id: "farm-1",
        nome: "Calendario oficial",
        descricao: null,
        ativo: true,
        payload: {},
        client_id: "client-1",
        client_op_id: "op-1",
        client_tx_id: null,
        client_recorded_at: "2026-03-20T10:00:00.000Z",
        server_received_at: "2026-03-20T10:00:00.000Z",
        created_at: "2026-03-20T10:00:00.000Z",
        updated_at: "2026-03-20T10:00:00.000Z",
        deleted_at: null,
      },
    ];
    const protocoloItensSanitarios: ProtocoloSanitarioItem[] = [
      {
        id: "protocol-item-1",
        fazenda_id: "farm-1",
        protocolo_id: "protocol-1",
        protocol_item_id: "aftosa-1",
        version: 1,
        tipo: "vermifugacao",
        produto: "Endectocida",
        intervalo_dias: 180,
        dose_num: 1,
        gera_agenda: true,
        dedup_template: null,
        payload: {
          obrigatorio: true,
          calendario_base: {
            version: 1,
            mode: "campaign",
            anchor: "calendar_month",
            label: "Campanha oficial de novembro",
            months: [11],
            interval_days: 180,
          },
        },
        client_id: "client-1",
        client_op_id: "op-1",
        client_tx_id: null,
        client_recorded_at: "2026-03-20T10:00:00.000Z",
        server_received_at: "2026-03-20T10:00:00.000Z",
        created_at: "2026-03-20T10:00:00.000Z",
        updated_at: "2026-03-20T10:00:00.000Z",
        deleted_at: null,
      },
    ];
    const agenda: AgendaItem[] = [
      {
        ...baseAgenda,
        id: "agenda-1",
        tipo: "vacinacao_aftosa",
        data_prevista: "2026-03-29",
        animal_id: "animal-1",
      },
      {
        ...baseAgenda,
        id: "agenda-2",
        tipo: "vermifugacao",
        data_prevista: "2026-03-10",
        lote_id: "lote-1",
        source_ref: {
          protocolo_id: "protocol-1",
        },
        protocol_item_version_id: "protocol-item-1",
      },
    ];
    const eventos: Evento[] = [
      {
        ...baseEvento,
        id: "evento-1",
        dominio: "sanitario",
        occurred_at: "2026-03-28T08:00:00.000Z",
        animal_id: "animal-1",
      },
      {
        ...baseEvento,
        id: "evento-2",
        dominio: "pesagem",
        occurred_at: "2026-03-27T08:00:00.000Z",
        animal_id: "animal-1",
      },
      {
        ...baseEvento,
        id: "evento-3",
        dominio: "financeiro",
        occurred_at: "2026-03-26T08:00:00.000Z",
        lote_id: "lote-1",
      },
    ];
    const eventosPesagem: EventoPesagem[] = [
      {
        evento_id: "evento-2",
        fazenda_id: "farm-1",
        peso_kg: 420,
        payload: {},
        client_id: "client-1",
        client_op_id: "op-1",
        client_tx_id: null,
        client_recorded_at: "2026-03-27T08:00:00.000Z",
        server_received_at: "2026-03-27T08:00:00.000Z",
        created_at: "2026-03-27T08:00:00.000Z",
        updated_at: "2026-03-27T08:00:00.000Z",
        deleted_at: null,
      },
    ];
    const eventosFinanceiro: EventoFinanceiro[] = [
      {
        evento_id: "evento-3",
        fazenda_id: "farm-1",
        tipo: "venda",
        valor_total: 3500,
        contraparte_id: null,
        payload: {},
        client_id: "client-1",
        client_op_id: "op-1",
        client_tx_id: null,
        client_recorded_at: "2026-03-26T08:00:00.000Z",
        server_received_at: "2026-03-26T08:00:00.000Z",
        created_at: "2026-03-26T08:00:00.000Z",
        updated_at: "2026-03-26T08:00:00.000Z",
        deleted_at: null,
      },
    ];
    const gestures: Gesture[] = [
      { ...baseGesture, client_tx_id: "tx-1", status: "PENDING" },
      { ...baseGesture, client_tx_id: "tx-2", status: "DONE" },
    ];
    const rejections: Rejection[] = [
      {
        id: 1,
        client_tx_id: "tx-3",
        client_op_id: "op-3",
        fazenda_id: "farm-1",
        table: "eventos_movimentacao",
        action: "INSERT",
        reason_code: "ANTI_TELEPORTE",
        reason_message: "Movimentacao inconsistente",
        created_at: "2026-03-25T08:00:00.000Z",
      },
    ];
    const fazendaSanidadeConfig: FazendaSanidadeConfig = {
      fazenda_id: "farm-1",
      uf: "SP",
      aptidao: "all",
      sistema: "all",
      zona_raiva_risco: "medio",
      pressao_carrapato: "medio",
      pressao_helmintos: "medio",
      modo_calendario: "minimo_legal",
      payload: {
        activated_template_slugs: ["feed-ban-ruminantes"],
        overlay_runtime: {
          items: {
            "feed-ban": {
              template_slug: "feed-ban-ruminantes",
              template_name: "Feed-ban",
              item_code: "feed-ban",
              item_label: "Feed-ban de ruminantes",
              subarea: "feed_ban",
              compliance_kind: "feed_ban",
              status: "pendente",
              checked_at: "2026-03-29T10:00:00.000Z",
              responsible: "Equipe",
              notes: null,
              source_evento_id: "event-feed-ban",
              answers: {},
            },
          },
        },
      },
      client_id: "client-1",
      client_op_id: "op-1",
      client_tx_id: null,
      client_recorded_at: "2026-03-29T10:00:00.000Z",
      server_received_at: "2026-03-29T10:00:00.000Z",
      created_at: "2026-03-29T10:00:00.000Z",
      updated_at: "2026-03-29T10:00:00.000Z",
      deleted_at: null,
    };
    const catalogoProtocolosOficiais: CatalogoProtocoloOficial[] = [
      {
        id: "template-feed-ban",
        slug: "feed-ban-ruminantes",
        nome: "Feed-ban",
        versao: 1,
        escopo: "federal",
        uf: null,
        aptidao: "all",
        sistema: "all",
        status_legal: "obrigatorio",
        base_legal_json: {},
        payload: {},
        created_at: "2026-03-29T10:00:00.000Z",
        updated_at: "2026-03-29T10:00:00.000Z",
      },
    ];
    const catalogoProtocolosOficiaisItens: CatalogoProtocoloOficialItem[] = [
      {
        id: "item-feed-ban",
        template_id: "template-feed-ban",
        area: "nutricao",
        codigo: "feed-ban",
        categoria_animal: "all",
        gatilho_tipo: "uso_produto",
        gatilho_json: {},
        frequencia_json: {},
        requires_vet: false,
        requires_gta: false,
        carencia_regra_json: {},
        gera_agenda: false,
        payload: {
          label: "Feed-ban de ruminantes",
          subarea: "feed_ban",
        },
        created_at: "2026-03-29T10:00:00.000Z",
        updated_at: "2026-03-29T10:00:00.000Z",
      },
    ];

    const report = buildOperationalSummary(
      {
        animals,
        lotes,
        pastos,
        agenda,
        protocolosSanitarios,
        protocoloItensSanitarios,
        fazendaSanidadeConfig,
        catalogoProtocolosOficiais,
        catalogoProtocolosOficiaisItens,
        eventos,
        eventosPesagem,
        eventosFinanceiro,
        gestures,
        rejections,
      },
      range,
      new Date("2026-03-29T12:00:00.000Z"),
    );

    expect(report.summary).toMatchObject({
      animaisAtivos: 1,
      lotesAtivos: 1,
      pastosAtivos: 1,
      agendaAberta: 2,
      agendaHoje: 1,
      agendaAtrasada: 1,
      eventosPeriodo: 3,
      pendenciasSync: 1,
      errosSync: 1,
    });
    expect(report.financeiro).toMatchObject({
      entradas: 3500,
      saidas: 0,
      saldo: 3500,
      transacoes: 1,
      compras: 0,
      vendas: 1,
    });
    expect(report.pesagem).toMatchObject({
      totalPesagens: 1,
      pesoMedioKg: 420,
      ultimoPesoKg: 420,
      ultimaPesagemEm: "2026-03-27",
    });
    expect(report.manejoByDomain.find((item) => item.label === "Sanitario")?.value).toBe(1);
    expect(report.agendaAttention[0]?.status).toBe("atrasado");
    expect(report.agendaAttention[0]?.priorityLabel).toBe("Critico 19d");
    expect(report.agendaAttention[0]?.titulo).toBe("Calendario oficial: Endectocida");
    expect(report.agendaAttention[0]?.scheduleLabel).toBe("Campanha oficial de novembro");
    expect(report.agendaAttention[0]?.scheduleModeLabel).toBe("Campanha");
    expect(report.agendaAttention[0]?.scheduleAnchorLabel).toBe("Calendario");
    expect(report.regulatoryCompliance).toMatchObject({
      openCount: 1,
      blockingCount: 1,
      feedBanOpenCount: 1,
      nutritionBlockers: 1,
      saleBlockers: 0,
    });
    expect(report.regulatoryCompliance.subareas).toEqual([
      expect.objectContaining({
        key: "feed_ban",
        openCount: 1,
        blockerCount: 1,
      }),
    ]);
    expect(report.regulatoryCompliance.impacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "nutrition",
          blockerCount: 1,
        }),
        expect.objectContaining({
          key: "sale",
          blockerCount: 0,
        }),
      ]),
    );
    expect(report.recentEvents[0]?.dominio).toBe("Sanitario");
  });
});

describe("buildOperationalSummaryCsv", () => {
  it("serializes report sections for spreadsheet export", () => {
    const range = resolveReportRange("7d", new Date("2026-03-29T12:00:00.000Z"));
    const fazendaSanidadeConfig: FazendaSanidadeConfig = {
      fazenda_id: "farm-1",
      uf: "SP",
      aptidao: "all",
      sistema: "all",
      zona_raiva_risco: "medio",
      pressao_carrapato: "medio",
      pressao_helmintos: "medio",
      modo_calendario: "minimo_legal",
      payload: {
        activated_template_slugs: ["feed-ban-ruminantes"],
        overlay_runtime: {
          items: {
            "feed-ban": {
              template_slug: "feed-ban-ruminantes",
              template_name: "Feed-ban",
              item_code: "feed-ban",
              item_label: "Feed-ban de ruminantes",
              subarea: "feed_ban",
              compliance_kind: "feed_ban",
              status: "pendente",
              checked_at: "2026-03-29T10:00:00.000Z",
              responsible: "Equipe",
              notes: null,
              source_evento_id: "event-feed-ban",
              answers: {},
            },
          },
        },
      },
      client_id: "client-1",
      client_op_id: "op-1",
      client_tx_id: null,
      client_recorded_at: "2026-03-29T10:00:00.000Z",
      server_received_at: "2026-03-29T10:00:00.000Z",
      created_at: "2026-03-29T10:00:00.000Z",
      updated_at: "2026-03-29T10:00:00.000Z",
      deleted_at: null,
    };
    const catalogoProtocolosOficiais: CatalogoProtocoloOficial[] = [
      {
        id: "template-feed-ban",
        slug: "feed-ban-ruminantes",
        nome: "Feed-ban",
        versao: 1,
        escopo: "federal",
        uf: null,
        aptidao: "all",
        sistema: "all",
        status_legal: "obrigatorio",
        base_legal_json: {},
        payload: {},
        created_at: "2026-03-29T10:00:00.000Z",
        updated_at: "2026-03-29T10:00:00.000Z",
      },
    ];
    const catalogoProtocolosOficiaisItens: CatalogoProtocoloOficialItem[] = [
      {
        id: "item-feed-ban",
        template_id: "template-feed-ban",
        area: "nutricao",
        codigo: "feed-ban",
        categoria_animal: "all",
        gatilho_tipo: "uso_produto",
        gatilho_json: {},
        frequencia_json: {},
        requires_vet: false,
        requires_gta: false,
        carencia_regra_json: {},
        gera_agenda: false,
        payload: {
          label: "Feed-ban de ruminantes",
          subarea: "feed_ban",
        },
        created_at: "2026-03-29T10:00:00.000Z",
        updated_at: "2026-03-29T10:00:00.000Z",
      },
    ];
    const report = buildOperationalSummary(
      {
        animals: [],
        lotes: [],
        pastos: [],
        agenda: [],
        protocolosSanitarios: [],
        protocoloItensSanitarios: [],
        fazendaSanidadeConfig,
        catalogoProtocolosOficiais,
        catalogoProtocolosOficiaisItens,
        eventos: [],
        eventosPesagem: [],
        eventosFinanceiro: [],
        gestures: [],
        rejections: [],
      },
      range,
      new Date("2026-03-29T12:00:00.000Z"),
    );

    const csv = buildOperationalSummaryCsv(report, "Fazenda Teste");

    expect(csv).toContain("meta;fazenda;Fazenda Teste");
    expect(csv).toContain("resumo;animais_ativos;0");
    expect(csv).toContain("financeiro;saldo;0.00");
    expect(csv).toContain("conformidade_subarea");
    expect(csv).toContain("conformidade_impacto");
    expect(csv).not.toContain("undefined");
  });
});
