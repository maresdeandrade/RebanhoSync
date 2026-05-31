import { describe, expect, it } from "vitest";
import type {
  AgendaItem,
  Animal,
  CatalogoProtocoloOficial,
  CatalogoProtocoloOficialItem,
  Evento,
  EventoComercial,
  EventoFinanceiro,
  EventoPesagem,
  EventoSanitario,
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
        logical_item_key: "logical-aftosa-1",
        item_code: "aftosa-1",
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
	            mode: "campanha",
	            anchor: "sem_ancora",
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
    expect(report.agendaAttention[0]?.scheduleAnchorLabel).toBe("Sem ancora");
    expect(report.agendaAttention[0]?.operationalClassLabel).toBe("Protocolo operacional");
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

  it("groups structured sanitary cost by product, animal and livestock lot", () => {
    const range = resolveReportRange("30d", new Date("2026-05-31T12:00:00.000Z"));
    const eventos: Evento[] = [
      {
        ...baseEvento,
        id: "evt-1",
        dominio: "sanitario",
        occurred_at: "2026-05-20T12:00:00.000Z",
        animal_id: "animal-1",
        lote_id: "lote-1",
      },
    ];
    const eventosSanitario = [
      {
        evento_id: "evt-1",
        fazenda_id: "farm-1",
        tipo: "vacinacao",
        produto: "Vacina A",
        produto_veterinario_id: "prod-1",
        produto_nome_snapshot: "Vacina A",
        estoque_lote_id: "stock-lot-1",
        estoque_lote_codigo_snapshot: "L-2026",
        validade_produto: "2026-12-31",
        dose_quantidade: 2,
        dose_unidade: "mL",
        via_aplicacao: "SC",
        custo_total_snapshot: 9,
        protocol_item_version_id: "protocol-item-1",
        protocol_item_version: 1,
        protocol_item_snapshot: { item_code: "vacina-a-d1" },
        payload: {},
        client_id: "client-1",
        client_op_id: "op-1",
        client_tx_id: null,
        client_recorded_at: "2026-05-20T12:00:00.000Z",
        server_received_at: "2026-05-20T12:00:00.000Z",
        created_at: "2026-05-20T12:00:00.000Z",
        updated_at: "2026-05-20T12:00:00.000Z",
        deleted_at: null,
      },
    ] satisfies EventoSanitario[];

    const report = buildOperationalSummary(
      {
        animals: [
          { ...baseAnimal, id: "animal-1", identificacao: "BR-001", sexo: "F", status: "ativo" },
        ],
        lotes: [{ ...baseLote, id: "lote-1", nome: "Lote 1" }],
        pastos: [],
        agenda: [],
        eventos,
        eventosSanitario,
        eventosPesagem: [],
        eventosFinanceiro: [],
        gestures: [],
        rejections: [],
        protocoloItensSanitarios: [
          {
            id: "protocol-item-1",
            fazenda_id: "farm-1",
            protocolo_id: "protocol-1",
            logical_item_key: "logical-vacina-a",
            item_code: "vacina-a-d1",
            version: 1,
            tipo: "vacinacao",
            produto: "Vacina A",
            intervalo_dias: null,
            dose_num: 2,
            gera_agenda: true,
            dedup_template: null,
            payload: {},
            client_id: "client-1",
            client_op_id: "op-1",
            client_tx_id: null,
            client_recorded_at: "2026-05-20T12:00:00.000Z",
            server_received_at: "2026-05-20T12:00:00.000Z",
            created_at: "2026-05-20T12:00:00.000Z",
            updated_at: "2026-05-20T12:00:00.000Z",
            deleted_at: null,
          },
        ],
      },
      range,
      new Date("2026-05-31T12:00:00.000Z"),
    );

    expect(report.inventory.sanitaryTraceability.totalCost).toBe(9);
    expect(report.inventory.sanitaryTraceability.byProduct[0]).toMatchObject({
      key: "prod-1",
      totalCost: 9,
    });
    expect(report.inventory.sanitaryTraceability.byAnimal[0]).toMatchObject({
      key: "animal-1",
      label: "BR-001",
      totalCost: 9,
    });
    expect(report.inventory.sanitaryTraceability.byLote[0]).toMatchObject({
      key: "lote-1",
      label: "Lote 1",
      totalCost: 9,
    });
    expect(report.inventory.sanitaryTraceability.byStockLot[0]).toMatchObject({
      key: "stock-lot-1",
      label: "L-2026",
      totalCost: 9,
    });
    expect(report.inventory.sanitaryTraceability.byProtocol[0]).toMatchObject({
      key: "protocol-item-1",
      label: "vacina-a-d1 / v1",
      totalCost: 9,
    });
    expect(report.inventory.sanitaryTraceability.eventsWithoutCompleteTraceability).toBe(0);
    expect(report.inventory.sanitaryTraceability.productsWithoutStockLot).toBe(0);
    expect(report.inventory.sanitaryTraceability.missingCostEvents).toBe(0);
    expect(report.inventory.sanitaryTraceability.stockInconsistencyEvents).toBe(0);
  });

  it("identifies sanitary events without stock lot, cost and complete traceability", () => {
    const range = resolveReportRange("30d", new Date("2026-05-31T12:00:00.000Z"));
    const eventos: Evento[] = [
      {
        ...baseEvento,
        id: "evt-missing",
        dominio: "sanitario",
        occurred_at: "2026-05-20T12:00:00.000Z",
        animal_id: "animal-1",
        lote_id: "lote-1",
      },
      {
        ...baseEvento,
        id: "evt-expired-lot",
        dominio: "sanitario",
        occurred_at: "2026-05-20T12:00:00.000Z",
        animal_id: "animal-1",
        lote_id: "lote-1",
      },
    ];
    const eventosSanitario = [
      {
        evento_id: "evt-missing",
        fazenda_id: "farm-1",
        tipo: "medicacao",
        produto: "Produto manual",
        produto_nome_snapshot: "Produto manual",
        dose_quantidade: null,
        dose_unidade: null,
        via_aplicacao: null,
        custo_total_snapshot: null,
        payload: {},
        client_id: "client-1",
        client_op_id: "op-1",
        client_tx_id: null,
        client_recorded_at: "2026-05-20T12:00:00.000Z",
        server_received_at: "2026-05-20T12:00:00.000Z",
        created_at: "2026-05-20T12:00:00.000Z",
        updated_at: "2026-05-20T12:00:00.000Z",
        deleted_at: null,
      },
      {
        evento_id: "evt-expired-lot",
        fazenda_id: "farm-1",
        tipo: "vacinacao",
        produto: "Vacina B",
        produto_veterinario_id: "prod-2",
        produto_nome_snapshot: "Vacina B",
        estoque_lote_id: "stock-lot-expired",
        estoque_lote_codigo_snapshot: "L-OLD",
        validade_produto: "2026-05-01",
        dose_quantidade: 1,
        dose_unidade: "mL",
        via_aplicacao: "IM",
        custo_total_snapshot: 5,
        payload: {},
        client_id: "client-1",
        client_op_id: "op-2",
        client_tx_id: null,
        client_recorded_at: "2026-05-20T12:00:00.000Z",
        server_received_at: "2026-05-20T12:00:00.000Z",
        created_at: "2026-05-20T12:00:00.000Z",
        updated_at: "2026-05-20T12:00:00.000Z",
        deleted_at: null,
      },
    ] satisfies EventoSanitario[];

    const report = buildOperationalSummary(
      {
        animals: [
          { ...baseAnimal, id: "animal-1", identificacao: "BR-001", sexo: "F", status: "ativo" },
        ],
        lotes: [{ ...baseLote, id: "lote-1", nome: "Lote 1" }],
        pastos: [],
        agenda: [],
        eventos,
        eventosSanitario,
        eventosPesagem: [],
        eventosFinanceiro: [],
        gestures: [],
        rejections: [],
      },
      range,
      new Date("2026-05-31T12:00:00.000Z"),
    );

    expect(report.inventory.sanitaryTraceability.eventsWithoutCompleteTraceability).toBe(1);
    expect(report.inventory.sanitaryTraceability.productsWithoutStockLot).toBe(1);
    expect(report.inventory.sanitaryTraceability.missingCostEvents).toBe(1);
    expect(report.inventory.sanitaryTraceability.stockInconsistencyEvents).toBe(1);
  });

  it("groups commercial revenue by operation, counterparty, animal, lot and society", () => {
    const range = resolveReportRange("30d", new Date("2026-05-31T12:00:00.000Z"));
    const eventos: Evento[] = [
      {
        ...baseEvento,
        id: "evt-comercial-1",
        dominio: "comercial",
        occurred_at: "2026-05-30T12:00:00.000Z",
        animal_id: "animal-1",
        lote_id: "lote-1",
      },
    ];
    const eventosComercial: EventoComercial[] = [
      {
        evento_id: "evt-comercial-1",
        fazenda_id: "farm-1",
        operation_type: "venda",
        scope: "animal",
        occurred_at: "2026-05-30T12:00:00.000Z",
        quantidade_animais: 1,
        peso_vivo_total: 420,
        peso_medio_derivado: 420,
        valor_bruto: 4500,
        frete: 100,
        comissao: 0,
        descontos: 0,
        taxas_impostos: 0,
        valor_liquido_derivado: 4400,
        contraparte_id: "cp-1",
        contraparte_nome: "Comprador A",
        animal_ids: ["animal-1"],
        lote_id: "lote-1",
        finance_transaction_id: null,
        sociedade_snapshot: [
          {
            sociedadeId: "soc-1",
            contraparteNome: "Socio A",
            percentualFazenda: 60,
            percentualParceiro: 40,
          },
        ],
        snapshot: {},
        calculation_status: "complete",
        issues: [],
        limitations: [],
        observacoes: null,
        client_id: "client-1",
        client_op_id: "op-1",
        client_tx_id: null,
        client_recorded_at: "2026-05-30T12:00:00.000Z",
        server_received_at: "2026-05-30T12:00:00.000Z",
        created_at: "2026-05-30T12:00:00.000Z",
        updated_at: "2026-05-30T12:00:00.000Z",
        deleted_at: null,
      },
    ];

    const report = buildOperationalSummary(
      {
        animals: [
          { ...baseAnimal, id: "animal-1", identificacao: "BR-001", sexo: "F", status: "vendido" },
        ],
        lotes: [{ ...baseLote, id: "lote-1", nome: "Lote 1" }],
        pastos: [],
        agenda: [],
        eventos,
        eventosComercial,
        eventosPesagem: [],
        eventosFinanceiro: [],
        gestures: [],
        rejections: [],
      },
      range,
      new Date("2026-05-31T12:00:00.000Z"),
    );

    expect(report.comercial.totalReceita).toBe(4400);
    expect(report.comercial.byOperation[0]).toMatchObject({ key: "venda" });
    expect(report.comercial.byCounterparty[0]).toMatchObject({
      key: "cp-1",
      label: "Comprador A",
      totalCost: 4400,
    });
    expect(report.comercial.byAnimal[0]).toMatchObject({
      key: "animal-1",
      label: "BR-001",
    });
    expect(report.comercial.byLote[0]).toMatchObject({
      key: "lote-1",
      label: "Lote 1",
    });
    expect(report.comercial.bySociedade[0]).toMatchObject({
      key: "soc-1",
      label: "Socio A",
    });
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
