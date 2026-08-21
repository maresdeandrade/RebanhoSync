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
  FinanceTransaction,
  EventoReproducao,
  EventoSanitario,
  FazendaSanidadeConfig,
  Gesture,
  Insumo,
  InsumoLote,
  InsumoMovimentacao,
  Lote,
  Pasto,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
  Rejection,
} from "@/lib/offline/types";
import {
  buildOperationalSummary,
  buildOperationalSummaryCsv,
  buildOperationalSummaryPrintHtml,
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
    const range = resolveReportRange(
      "mes_atual",
      new Date("2026-03-29T12:00:00.000Z"),
    );

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
    const range = resolveReportRange(
      "30d",
      new Date("2026-03-29T12:00:00.000Z"),
    );

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
    const pastos: Pasto[] = [
      { ...basePasto, id: "pasto-1", nome: "Piquete 1" },
    ];
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
        fazendaId: "farm-1",
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
    expect(
      report.manejoByDomain.find((item) => item.label === "Sanitario")?.value,
    ).toBe(1);
    expect(report.agendaAttention[0]?.status).toBe("atrasado");
    expect(report.agendaAttention[0]?.priorityLabel).toBe("Critico 19d");
    expect(report.agendaAttention[0]?.titulo).toBe(
      "Calendario oficial: Endectocida",
    );
    expect(report.agendaAttention[0]?.scheduleLabel).toBe(
      "Campanha oficial de novembro",
    );
    expect(report.agendaAttention[0]?.scheduleModeLabel).toBe("Campanha");
    expect(report.agendaAttention[0]?.scheduleAnchorLabel).toBe("Sem ancora");
    expect(report.agendaAttention[0]?.operationalClassLabel).toBe(
      "Protocolo operacional",
    );
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

  it("builds partial inventory cost read model without inferring absent movement cost", () => {
    const range = resolveReportRange(
      "30d",
      new Date("2026-06-04T12:00:00.000Z"),
    );
    const baseInsumo = {
      fazenda_id: "farm-1",
      tipo: "sanitario",
      categoria: "vacina",
      produto_veterinario_id: null,
      unidade_base: "dose",
      ativo: true,
      payload: {},
      client_id: "client-1",
      client_op_id: "op-1",
      client_tx_id: null,
      client_recorded_at: "2026-06-01T10:00:00.000Z",
      server_received_at: "2026-06-01T10:00:00.000Z",
      created_at: "2026-06-01T10:00:00.000Z",
      updated_at: "2026-06-01T10:00:00.000Z",
      deleted_at: null,
    } satisfies Omit<Insumo, "id" | "nome">;
    const baseInsumoLote = {
      fazenda_id: "farm-1",
      apresentacao_id: null,
      validade: null,
      fabricante: null,
      local_armazenamento: null,
      quantidade_inicial_base: 200,
      unidade_base: "dose",
      status: "ativo",
      payload: {},
      client_id: "client-1",
      client_op_id: "op-1",
      client_tx_id: null,
      client_recorded_at: "2026-06-01T10:00:00.000Z",
      server_received_at: "2026-06-01T10:00:00.000Z",
      created_at: "2026-06-01T10:00:00.000Z",
      updated_at: "2026-06-01T10:00:00.000Z",
      deleted_at: null,
    } satisfies Omit<
      InsumoLote,
      | "id"
      | "insumo_id"
      | "identificacao_lote"
      | "saldo_atual_base"
      | "custo_total"
      | "custo_unitario"
    >;
    const baseMovement = {
      fazenda_id: "farm-1",
      insumo_id: "insumo-known",
      insumo_lote_id: "lot-known",
      unidade_base: "dose",
      source_evento_id: null,
      source_evento_dominio: null,
      animal_id: null,
      rebanho_lote_id: null,
      pasto_id: null,
      observacoes: null,
      payload: {},
      client_id: "client-1",
      client_op_id: "op-1",
      client_tx_id: null,
      client_recorded_at: "2026-06-01T10:00:00.000Z",
      server_received_at: "2026-06-01T10:00:00.000Z",
      created_at: "2026-06-01T10:00:00.000Z",
      updated_at: "2026-06-01T10:00:00.000Z",
      deleted_at: null,
    } satisfies Omit<
      InsumoMovimentacao,
      | "id"
      | "tipo"
      | "quantidade_base"
      | "occurred_at"
      | "custo_unitario_snapshot"
      | "custo_total_snapshot"
    >;

    const report = buildOperationalSummary(
      {
        fazendaId: "farm-1",
        animals: [],
        lotes: [],
        pastos: [],
        agenda: [],
        eventos: [],
        eventosPesagem: [],
        eventosFinanceiro: [],
        gestures: [],
        rejections: [],
        insumos: [
          { ...baseInsumo, id: "insumo-known", nome: "Vacina A" },
          { ...baseInsumo, id: "insumo-zero", nome: "Mineral cortesia" },
          { ...baseInsumo, id: "insumo-missing", nome: "Produto sem custo" },
        ],
        insumoLotes: [
          {
            ...baseInsumoLote,
            id: "lot-known",
            insumo_id: "insumo-known",
            identificacao_lote: "Lote conhecido",
            saldo_atual_base: 50,
            custo_total: 800,
            custo_unitario: 4,
          },
          {
            ...baseInsumoLote,
            id: "lot-zero",
            insumo_id: "insumo-zero",
            identificacao_lote: "Lote custo zero",
            saldo_atual_base: 7,
            custo_total: 0,
            custo_unitario: 0,
          },
          {
            ...baseInsumoLote,
            id: "lot-missing",
            insumo_id: "insumo-missing",
            identificacao_lote: "Lote sem custo",
            saldo_atual_base: 5,
            custo_total: null,
            custo_unitario: null,
          },
        ],
        insumoMovimentacoes: [
          {
            ...baseMovement,
            id: "mov-entry-known",
            tipo: "entrada",
            quantidade_base: 200,
            occurred_at: "2026-06-01T10:00:00.000Z",
            custo_unitario_snapshot: 4,
            custo_total_snapshot: 800,
          },
          {
            ...baseMovement,
            id: "mov-exit-known",
            tipo: "consumo_sanitario",
            quantidade_base: 150,
            occurred_at: "2026-06-02T10:00:00.000Z",
            custo_unitario_snapshot: 4,
            custo_total_snapshot: 600,
          },
          {
            ...baseMovement,
            id: "mov-entry-zero",
            insumo_id: "insumo-zero",
            insumo_lote_id: "lot-zero",
            tipo: "entrada",
            quantidade_base: 10,
            occurred_at: "2026-06-02T10:00:00.000Z",
            custo_unitario_snapshot: 0,
            custo_total_snapshot: 0,
          },
          {
            ...baseMovement,
            id: "mov-exit-null",
            tipo: "consumo_nutricao",
            quantidade_base: 4,
            occurred_at: "2026-06-03T10:00:00.000Z",
            custo_unitario_snapshot: null,
            custo_total_snapshot: null,
          },
          {
            ...baseMovement,
            id: "mov-entry-undefined",
            tipo: "entrada",
            quantidade_base: 3,
            occurred_at: "2026-06-03T10:00:00.000Z",
          },
        ],
      },
      range,
      new Date("2026-06-04T12:00:00.000Z"),
    );

    expect(report.inventory.partialCost).toMatchObject({
      entradasKnownCost: 800,
      entradasKnownQuantity: 210,
      entradasMissingCostQuantity: 3,
      entradasMissingCostMovements: 1,
      saidasKnownCost: 600,
      saidasKnownQuantity: 150,
      saidasMissingCostQuantity: 4,
      saidasMissingCostMovements: 1,
      saldoKnownCost: 200,
      saldoKnownQuantity: 57,
      saldoMissingCostQuantity: 5,
      activeLotsWithKnownCost: 2,
      activeLotsWithMissingCost: 1,
    });
    expect(buildOperationalSummaryCsv(report, "Fazenda")).toContain(
      "estoque_custo_parcial;entradas_custo_conhecido;800.00",
    );
    expect(buildOperationalSummaryCsv(report, "Fazenda")).toContain(
      "estoque_custo_parcial;saldo_quantidade_custo_ausente;5.000",
    );
  });

  it("groups structured sanitary cost by product, animal and livestock lot", () => {
    const range = resolveReportRange(
      "30d",
      new Date("2026-05-31T12:00:00.000Z"),
    );
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
        fazendaId: "farm-1",
        animals: [
          {
            ...baseAnimal,
            id: "animal-1",
            identificacao: "BR-001",
            sexo: "F",
            status: "ativo",
          },
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
    expect(
      report.inventory.sanitaryTraceability.eventsWithoutCompleteTraceability,
    ).toBe(0);
    expect(report.inventory.sanitaryTraceability.productsWithoutStockLot).toBe(
      0,
    );
    expect(report.inventory.sanitaryTraceability.missingCostEvents).toBe(0);
    expect(report.inventory.sanitaryTraceability.stockInconsistencyEvents).toBe(
      0,
    );
  });

  it("adds biosecurity occurrence grouping from real event payloads", () => {
    const range = resolveReportRange(
      "30d",
      new Date("2026-05-31T12:00:00.000Z"),
    );
    const eventos: Evento[] = [
      {
        ...baseEvento,
        id: "bio-evt-1",
        dominio: "conformidade",
        occurred_at: "2026-05-30T12:00:00.000Z",
        animal_id: "animal-1",
        lote_id: "lote-1",
        payload: {
          biosseguranca_ocorrencia: {
            schema_version: 1,
            categoria_ocorrencia: "biosseguranca",
            tipo_ocorrencia: "falha_epi",
            tipos_ocorrencia: ["falha_epi"],
            escopo_tipo: "animal",
            escopos_tipo: ["animal", "lote"],
            animal_id: "animal-1",
            animal_ids: ["animal-1"],
            lote_id: "lote-1",
            local_id: null,
            evento_id: null,
            agenda_item_id: null,
            gravidade: "alta",
            descricao: "Falha de EPI",
            outro_relato: null,
            acao_imediata: "Equipe orientada",
            gera_pendencia: true,
            prazo_correcao: "2026-06-01",
            status: "aberta",
          },
        },
      },
    ];
    const agenda: AgendaItem[] = [
      {
        ...baseAgenda,
        id: "bio-agenda-1",
        dominio: "conformidade",
        tipo: "biosseguranca_acao_corretiva",
        data_prevista: "2026-06-01",
        animal_id: "animal-1",
        lote_id: "lote-1",
        source_evento_id: "bio-evt-1",
      },
    ];

    const report = buildOperationalSummary(
      {
        fazendaId: "farm-1",
        animals: [],
        lotes: [],
        pastos: [],
        agenda,
        eventos,
        eventosPesagem: [],
        eventosFinanceiro: [],
        gestures: [],
        rejections: [],
      },
      range,
      new Date("2026-05-31T12:00:00.000Z"),
    );

    expect(report.biosecurityOccurrences).toMatchObject({
      total: 1,
      openCount: 1,
      pendingCount: 1,
      byTipoOcorrencia: [{ key: "falha_epi", count: 1 }],
      byGravidade: [{ key: "alta", count: 1 }],
      byEscopo: [
        { key: "animal", count: 1 },
        { key: "lote", count: 1 },
      ],
      pendingAgendaItemIds: ["bio-agenda-1"],
    });

    expect(buildOperationalSummaryCsv(report, "Fazenda")).toContain(
      "biosseguranca;ocorrencias_com_pendencia;1",
    );
  });

  it("identifies sanitary events without stock lot, cost and complete traceability", () => {
    const range = resolveReportRange(
      "30d",
      new Date("2026-05-31T12:00:00.000Z"),
    );
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
        fazendaId: "farm-1",
        animals: [
          {
            ...baseAnimal,
            id: "animal-1",
            identificacao: "BR-001",
            sexo: "F",
            status: "ativo",
          },
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

    expect(
      report.inventory.sanitaryTraceability.eventsWithoutCompleteTraceability,
    ).toBe(1);
    expect(report.inventory.sanitaryTraceability.productsWithoutStockLot).toBe(
      1,
    );
    expect(report.inventory.sanitaryTraceability.missingCostEvents).toBe(1);
    expect(report.inventory.sanitaryTraceability.stockInconsistencyEvents).toBe(
      1,
    );
  });

  it("groups commercial revenue by operation, counterparty, animal, lot and society", () => {
    const range = resolveReportRange(
      "30d",
      new Date("2026-05-31T12:00:00.000Z"),
    );
    const eventos: Evento[] = [
      {
        ...baseEvento,
        id: "evt-comercial-1",
        dominio: "comercial",
        occurred_at: "2026-05-30T12:00:00.000Z",
        animal_id: "animal-1",
        lote_id: "lote-1",
        payload: { kind: "commercial_operation_v2" },
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
        fazendaId: "farm-1",
        animals: [
          {
            ...baseAnimal,
            id: "animal-1",
            identificacao: "BR-001",
            sexo: "F",
            status: "vendido",
          },
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
    const range = resolveReportRange(
      "7d",
      new Date("2026-03-29T12:00:00.000Z"),
    );
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
        fazendaId: "farm-1",
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
    expect(csv).toContain(
      "meta_fonte;fonte;Historico: event_eventos + detail tables no periodo selecionado.",
    );
    expect(csv).toContain(
      "meta_fonte;fonte;Estado atual: state_* como read model atual, sem historico completo.",
    );
    expect(csv).toContain(
      "meta_fonte;fonte;Agenda: pendencia/intencao futura, nao fato executado.",
    );
    expect(csv).toContain(
      "meta_limitacao;limitacao;Custo operacional parcial nao e DRE, ROI, margem ou custo por arroba.",
    );
    expect(csv).toContain(
      "nao afirmam GMD ou desempenho de lote/pasto sem permanencia comprovada",
    );
    expect(csv).toContain("metric_coverage");
    expect(csv).toContain("metric_timezone");
    expect(csv).toContain("metric_period");
    expect(csv).toContain("conformidade_subarea");
    expect(csv).toContain("conformidade_impacto");
    expect(csv).not.toContain("undefined");

    const html = buildOperationalSummaryPrintHtml(report, "Fazenda Teste");
    expect(html).toContain("Fontes e limitacoes");
    expect(html).toContain("Cobertura");
    expect(html).toContain("Timezone");
    expect(html).toContain(
      "Agenda: pendencia/intencao futura, nao fato executado.",
    );
    expect(html).toContain(
      "Custo operacional parcial nao e DRE, ROI, margem ou custo por arroba.",
    );
    expect(html).toContain(
      "nao afirmam GMD ou desempenho de lote/pasto sem permanencia comprovada",
    );
  });
});

describe("Fase 15 incremental metrics", () => {
  const range = resolveReportRange("30d", new Date("2026-03-29T12:00:00.000Z"));

  it("filters every farm-scoped source before calculating metrics", () => {
    const report = buildOperationalSummary(
      {
        fazendaId: "farm-1",
        animals: [
          {
            ...baseAnimal,
            id: "animal-1",
            identificacao: "BR-001",
            sexo: "F",
            status: "ativo",
          },
          {
            ...baseAnimal,
            fazenda_id: "farm-2",
            id: "animal-2",
            identificacao: "BR-002",
            sexo: "F",
            status: "ativo",
          },
        ],
        lotes: [],
        pastos: [],
        agenda: [],
        eventos: [
          {
            ...baseEvento,
            id: "event-1",
            dominio: "sanitario",
            occurred_at: "2026-03-10T12:00:00.000Z",
          },
          {
            ...baseEvento,
            fazenda_id: "farm-2",
            id: "event-2",
            dominio: "sanitario",
            occurred_at: "2026-03-10T12:00:00.000Z",
          },
        ],
        eventosPesagem: [],
        eventosFinanceiro: [],
        gestures: [],
        rejections: [],
      },
      range,
    );

    expect(report.summary.animaisAtivos).toBe(1);
    expect(report.summary.eventosPeriodo).toBe(1);
    expect(report.metrics.rebanho_animais_ativos.value).toBe(1);
    expect(report.metrics.eventos_periodo.sources).toEqual([
      { name: "event_eventos", role: "primary" },
    ]);
  });

  it("reports canonical reproduction KPIs from event details and projection", () => {
    const serviceAnimal1 = {
      ...baseEvento,
      id: "repro-service-1",
      dominio: "reproducao",
      occurred_at: "2026-03-01T12:00:00.000Z",
      animal_id: "animal-1",
    } satisfies Evento;
    const diagnosisAnimal1 = {
      ...baseEvento,
      id: "repro-diagnosis-1",
      dominio: "reproducao",
      occurred_at: "2026-03-10T12:00:00.000Z",
      animal_id: "animal-1",
    } satisfies Evento;
    const serviceAnimal2 = {
      ...baseEvento,
      id: "repro-service-2",
      dominio: "reproducao",
      occurred_at: "2026-03-02T12:00:00.000Z",
      animal_id: "animal-2",
    } satisfies Evento;
    const birthAnimal2 = {
      ...baseEvento,
      id: "repro-birth-2",
      dominio: "reproducao",
      occurred_at: "2026-03-20T12:00:00.000Z",
      animal_id: "animal-2",
    } satisfies Evento;
    const detail = (
      evento_id: string,
      tipo: EventoReproducao["tipo"],
      payload: Record<string, unknown>,
    ): EventoReproducao => ({
      evento_id,
      fazenda_id: "farm-1",
      tipo,
      macho_id: null,
      payload,
      client_id: "client-1",
      client_op_id: `op-${evento_id}`,
      client_tx_id: null,
      client_recorded_at: "2026-03-20T10:00:00.000Z",
      server_received_at: "2026-03-20T10:00:00.000Z",
      created_at: "2026-03-20T10:00:00.000Z",
      updated_at: "2026-03-20T10:00:00.000Z",
      deleted_at: null,
    });

    const report = buildOperationalSummary(
      {
        fazendaId: "farm-1",
        animals: [
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
            sexo: "F",
            status: "ativo",
          },
        ],
        lotes: [],
        pastos: [],
        agenda: [],
        eventos: [
          serviceAnimal1,
          diagnosisAnimal1,
          serviceAnimal2,
          birthAnimal2,
        ],
        eventosReproducao: [
          detail("repro-service-1", "cobertura", { schema_version: 1 }),
          detail("repro-diagnosis-1", "diagnostico", {
            schema_version: 1,
            resultado: "positivo",
            episode_evento_id: "repro-service-1",
          }),
          detail("repro-service-2", "cobertura", { schema_version: 1 }),
          detail("repro-birth-2", "parto", {
            schema_version: 1,
            data_parto_real: "2026-03-20",
            numero_crias: 2,
            episode_evento_id: "repro-service-2",
          }),
        ],
        eventosPesagem: [],
        eventosFinanceiro: [],
        gestures: [],
        rejections: [],
      },
      range,
      new Date("2026-03-29T12:00:00.000Z"),
    );

    expect(report.reproducao).toMatchObject({
      matrizes: 2,
      servicos: 2,
      diagnosticos: 1,
      prenhasAtuais: 1,
      partos: 1,
      abortosPerdas: 0,
      nascimentos: 2,
    });
    expect(report.metrics.repro_prenhas_atuais.status).toBe("partial");
    expect(report.metrics.repro_nascimentos).toMatchObject({
      value: 2,
      status: "partial",
      sources: [{ name: "event_eventos_reproducao", role: "primary" }],
    });
  });

  it("uses the explicitly supplied analytical agenda for future demand", () => {
    const report = buildOperationalSummary(
      {
        fazendaId: "farm-1",
        animals: [],
        lotes: [],
        pastos: [],
        agenda: [
          {
            ...baseAgenda,
            id: "legacy-1",
            tipo: "vacinacao",
            data_prevista: "2026-03-29",
            payload: { produto_nome_catalogo: "Legacy" },
          },
        ],
        eventos: [],
        eventosPesagem: [],
        eventosFinanceiro: [],
        gestures: [],
        rejections: [],
        futureSanitaryAgendaItems: [
          {
            id: "sanitario-v2:agenda-1",
            status: "agendado",
            dueDate: "2026-03-29",
            domain: "sanitario",
            productId: "product-1",
            productName: "Vacina A",
            productUnit: "dose",
            quantityPerAnimal: 2,
            animalCount: 1,
          },
        ],
      },
      range,
      new Date("2026-03-29T12:00:00.000Z"),
    );

    expect(report.inventory.futureDemand.source).toBe(
      "state_agenda_itens + ops_sanitario_agenda_v2",
    );
    expect(report.inventory.futureDemand.groups[0]).toMatchObject({
      productName: "Vacina A",
      estimatedQuantity: 2,
    });
    expect(report.inventory.futureDemand.status).toBe("complete");
    expect(report.inventory.futureDemand.groups).toHaveLength(1);
  });

  it("degrades composed future demand when legacy and v2 may overlap", () => {
    const report = buildOperationalSummary(
      {
        fazendaId: "farm-1",
        animals: [],
        lotes: [],
        pastos: [],
        agenda: [],
        eventos: [],
        eventosPesagem: [],
        eventosFinanceiro: [],
        gestures: [],
        rejections: [],
        futureSanitaryAgendaItems: [
          {
            id: "legacy-1",
            status: "agendado",
            dueDate: "2026-03-29",
            domain: "sanitario",
            productId: "product-1",
            productName: "Vacina A",
            productUnit: "dose",
            quantityPerAnimal: 1,
            animalCount: 1,
            possibleSourceOverlap: true,
          },
          {
            id: "sanitario-v2:agenda-1",
            status: "agendado",
            dueDate: "2026-03-29",
            domain: "sanitario",
            productId: "product-1",
            productName: "Vacina A",
            productUnit: "dose",
            quantityPerAnimal: 1,
            animalCount: 1,
            possibleSourceOverlap: true,
          },
        ],
      },
      range,
      new Date("2026-03-29T12:00:00.000Z"),
    );

    expect(report.inventory.futureDemand.status).toBe("partial");
    expect(report.inventory.futureDemand.groups[0].agendaItemCount).toBe(2);
    expect(report.inventory.futureDemand.limitations).toContain(
      "Fontes legacy e Agenda Sanitária v2 coexistem sem vínculo suficiente para excluir possível sobreposição.",
    );
  });

  it("keeps the legacy fallback when the analytical agenda is undefined", () => {
    const report = buildOperationalSummary(
      {
        fazendaId: "farm-1",
        animals: [],
        lotes: [],
        pastos: [],
        agenda: [
          {
            ...baseAgenda,
            id: "legacy-1",
            tipo: "vacinacao",
            data_prevista: "2026-03-29",
            payload: { produto_nome_catalogo: "Legacy", quantityPerAnimal: 1 },
          },
        ],
        eventos: [],
        eventosPesagem: [],
        eventosFinanceiro: [],
        gestures: [],
        rejections: [],
      },
      range,
      new Date("2026-03-29T12:00:00.000Z"),
    );

    expect(report.inventory.futureDemand.source).toBe("state_agenda_itens");
    expect(report.inventory.futureDemand.groups[0]?.productName).toBe("Legacy");
  });

  it("keeps raw Agenda Sanitária v2 callers compatible through the selector", () => {
    const report = buildOperationalSummary(
      {
        fazendaId: "farm-1",
        animals: [
          {
            ...baseAnimal,
            id: "animal-1",
            identificacao: "BR-001",
            sexo: "F",
            status: "ativo",
          },
        ],
        lotes: [],
        pastos: [],
        agenda: [],
        eventos: [],
        eventosPesagem: [],
        eventosFinanceiro: [],
        gestures: [],
        rejections: [],
        sanitarioAgendaV2: [
          {
            id: "agenda-v2-1",
            fazenda_id: "farm-1",
            status: "programada",
            dedup_key: "farm-1:agenda-v2-1",
            client_id: "client-1",
            client_op_id: "op-agenda-v2-1",
            client_tx_id: null,
            client_recorded_at: "2026-03-20T10:00:00.000Z",
            server_received_at: "2026-03-20T10:00:00.000Z",
            source_demand_key: null,
            preview_group_id: null,
            protocolo_id: null,
            protocol_item_version_id: null,
            protocol_item_snapshot: {},
            janela_inicio: "2026-03-29",
            janela_fim: null,
            data_programada: "2026-03-29",
            lote_id: null,
            produto_veterinario_id: "product-1",
            produto_snapshot: {
              productName: "Vacina A",
              productUnit: "dose",
              quantityPerAnimal: 2,
            },
            produto_classe: null,
            acao_sanitaria: "vacinacao",
            execution_evento_id: null,
            metadata: { target: { scope: "animal", id: "animal-1" } },
            created_at: "2026-03-20T10:00:00.000Z",
            updated_at: "2026-03-20T10:00:00.000Z",
            deleted_at: null,
          },
        ],
        sanitarioAgendaAnimaisV2: [],
      },
      range,
      new Date("2026-03-29T12:00:00.000Z"),
    );

    expect(report.inventory.futureDemand.status).toBe("complete");
    expect(report.inventory.futureDemand.groups[0]).toMatchObject({
      productName: "Vacina A",
      estimatedQuantity: 2,
    });
  });

  it("does not fall back to legacy when the analytical agenda is an empty array", () => {
    const report = buildOperationalSummary(
      {
        fazendaId: "farm-1",
        animals: [],
        lotes: [],
        pastos: [],
        agenda: [
          {
            ...baseAgenda,
            id: "legacy-1",
            tipo: "vacinacao",
            data_prevista: "2026-03-29",
            payload: { produto_nome_catalogo: "Legacy" },
          },
        ],
        eventos: [],
        eventosPesagem: [],
        eventosFinanceiro: [],
        gestures: [],
        rejections: [],
        futureSanitaryAgendaItems: [],
      },
      range,
      new Date("2026-03-29T12:00:00.000Z"),
    );

    expect(report.inventory.futureDemand.status).toBe("empty");
    expect(report.inventory.futureDemand.groups).toEqual([]);
  });
});

describe("Fase 15.2 — fechamento semantico", () => {
  const semanticRange = resolveReportRange(
    "30d",
    new Date("2026-03-29T12:00:00.000Z"),
    "America/Sao_Paulo",
  );

  function buildSemanticReport(
    overrides: Partial<Parameters<typeof buildOperationalSummary>[0]> = {},
    range = semanticRange,
  ) {
    return buildOperationalSummary(
      {
        fazendaId: "farm-1",
        farmTimezone: "America/Sao_Paulo",
        animals: [],
        lotes: [],
        pastos: [],
        agenda: [],
        eventos: [],
        eventosPesagem: [],
        eventosFinanceiro: [],
        gestures: [],
        rejections: [],
        ...overrides,
      },
      range,
      new Date("2026-03-29T12:00:00.000Z"),
    );
  }

  function makeCommercialDetail(
    eventoId: string,
    operationType: "compra" | "venda",
    animalIds: string[],
    snapshot: Record<string, unknown> = {},
  ): EventoComercial {
    return {
      evento_id: eventoId,
      fazenda_id: "farm-1",
      operation_type: operationType,
      scope: "animal",
      occurred_at: "2026-03-25T12:00:00.000Z",
      quantidade_animais: animalIds.length,
      peso_vivo_total: 400,
      peso_medio_derivado: 400 / animalIds.length,
      valor_bruto: 1000,
      frete: 0,
      comissao: 0,
      descontos: 0,
      taxas_impostos: 0,
      valor_liquido_derivado: 1000,
      contraparte_id: null,
      contraparte_nome: null,
      animal_ids: animalIds,
      lote_id: null,
      finance_transaction_id: null,
      titularidade_snapshot: null,
      sociedade_snapshot: null,
      commercial_signals: null,
      valor_por_animal: null,
      snapshot,
      calculation_status: "complete",
      issues: [],
      limitations: [],
      observacoes: null,
      client_id: "client-1",
      client_op_id: `op-${eventoId}`,
      client_tx_id: null,
      client_recorded_at: "2026-03-25T12:00:00.000Z",
      server_received_at: "2026-03-25T12:00:00.000Z",
      created_at: "2026-03-25T12:00:00.000Z",
      updated_at: "2026-03-25T12:00:00.000Z",
      deleted_at: null,
    };
  }

  it("distinguishes covered real zero from local zero without coverage", () => {
    const covered = buildSemanticReport({
      historicalCoverage: {
        comercial_operacoes: {
          state: "verified",
          evidence: ["pull baseline completo por fazenda e periodo"],
        },
      },
    });
    expect(covered.metrics.comercial_operacoes).toMatchObject({
      value: 0,
      status: "complete",
      coverage: { state: "verified" },
    });

    const uncovered = buildSemanticReport();
    expect(uncovered.metrics.comercial_operacoes).toMatchObject({
      value: null,
      status: "unavailable",
      coverage: { state: "unknown" },
    });
  });

  it("downgrades historical values when a local operation is pending", () => {
    const event: Evento = {
      ...baseEvento,
      id: "evt-pendente",
      dominio: "obito",
      occurred_at: "2026-03-25T12:00:00.000Z",
      animal_id: "animal-1",
    };
    const report = buildSemanticReport({
      eventos: [event],
      gestures: [
        { ...baseGesture, client_tx_id: "tx-pendente", status: "PENDING" },
      ],
    });

    expect(report.metrics.eventos_periodo).toMatchObject({
      value: 1,
      status: "partial",
      coverage: { state: "partial", pendingLocalOperations: 1 },
    });
  });

  it("keeps two farms isolated and does not infer historical categories from state_animais", () => {
    const otherFarmEvent: Evento = {
      ...baseEvento,
      id: "evt-outra-fazenda",
      fazenda_id: "farm-2",
      dominio: "obito",
      occurred_at: "2026-03-25T12:00:00.000Z",
      animal_id: "animal-2",
    };
    const report = buildSemanticReport({
      animals: [
        {
          ...baseAnimal,
          id: "animal-1",
          identificacao: "BR-001",
          sexo: "F",
          status: "ativo",
          payload: { taxonomy_facts: { categoria: "vaca" } },
        },
      ],
      eventos: [otherFarmEvent],
    });

    expect(report.summary.eventosPeriodo).toBe(0);
    expect(report.metrics.rebanho_categorias_historicas).toMatchObject({
      value: null,
      status: "unavailable",
    });
  });

  it("uses the farm timezone for date boundaries and declares runtime fallback when absent", () => {
    const boundaryEvent: Evento = {
      ...baseEvento,
      id: "evt-boundary",
      dominio: "obito",
      occurred_at: "2026-03-01T02:30:00.000Z",
      animal_id: "animal-1",
    };
    const februaryRange = resolveReportRange(
      "mes_atual",
      new Date("2026-03-01T01:00:00.000Z"),
      "America/Sao_Paulo",
    );
    const farmTimezoneReport = buildSemanticReport(
      { eventos: [boundaryEvent] },
      { ...februaryRange, preset: "mes_atual", filenameTag: "2026-02" },
    );
    expect(farmTimezoneReport.summary.eventosPeriodo).toBe(1);
    expect(farmTimezoneReport.metrics.eventos_periodo.period).toMatchObject({
      timezone: "America/Sao_Paulo",
      timezoneSource: "farm",
      boundary: "inclusive",
    });

    const runtimeReport = buildSemanticReport({ farmTimezone: null });
    expect(runtimeReport.metrics.eventos_periodo.period).toMatchObject({
      timezone: null,
      timezoneSource: "runtime",
    });
    expect(runtimeReport.metrics.eventos_periodo.limitations).toContain(
      "Timezone da fazenda nao foi carregado; fronteiras usam o timezone de runtime disponivel e nao representam necessariamente o calendario da fazenda.",
    );
  });

  it("counts factual purchase and sale animals, excludes explicit simulation and keeps missing history fail-safe", () => {
    const purchaseEvent: Evento = {
      ...baseEvento,
      id: "evt-compra-factual",
      dominio: "comercial",
      occurred_at: "2026-03-25T12:00:00.000Z",
      payload: { kind: "commercial_operation_v2" },
    };
    const saleEvent: Evento = {
      ...baseEvento,
      id: "evt-venda-factual",
      dominio: "comercial",
      occurred_at: "2026-03-26T12:00:00.000Z",
      payload: { kind: "commercial_operation_v2" },
    };
    const simulationEvent: Evento = {
      ...baseEvento,
      id: "evt-simulacao",
      dominio: "comercial",
      occurred_at: "2026-03-27T12:00:00.000Z",
      payload: { kind: "commercial_simulation" },
    };
    const legacyEventWithDetail: Evento = {
      ...baseEvento,
      id: "evt-comercial-legado",
      dominio: "comercial",
      occurred_at: "2026-03-28T12:00:00.000Z",
      payload: {},
    };
    const conflictingFlagEvent: Evento = {
      ...baseEvento,
      id: "evt-v2-flag-conflitante",
      dominio: "comercial",
      occurred_at: "2026-03-28T13:00:00.000Z",
      payload: { kind: "commercial_operation_v2", is_simulation: true },
    };
    const conflictingSnapshotEvent: Evento = {
      ...baseEvento,
      id: "evt-v2-snapshot-conflitante",
      dominio: "comercial",
      occurred_at: "2026-03-28T14:00:00.000Z",
      payload: { kind: "commercial_operation_v2" },
    };
    const missingDetailEvent: Evento = {
      ...baseEvento,
      id: "evt-v2-sem-detalhe",
      dominio: "comercial",
      occurred_at: "2026-03-28T15:00:00.000Z",
      payload: { kind: "commercial_operation_v2" },
    };
    const report = buildSemanticReport({
      eventos: [
        purchaseEvent,
        saleEvent,
        simulationEvent,
        legacyEventWithDetail,
        conflictingFlagEvent,
        conflictingSnapshotEvent,
        missingDetailEvent,
      ],
      eventosComercial: [
        makeCommercialDetail("evt-compra-factual", "compra", ["animal-1"]),
        makeCommercialDetail("evt-venda-factual", "venda", ["animal-2"]),
        makeCommercialDetail("evt-simulacao", "venda", ["animal-3"]),
        makeCommercialDetail("evt-comercial-legado", "venda", ["animal-4"]),
        makeCommercialDetail("evt-v2-flag-conflitante", "venda", ["animal-5"]),
        makeCommercialDetail(
          "evt-v2-snapshot-conflitante",
          "venda",
          ["animal-6"],
          { operation_kind: "commercial_simulation" },
        ),
      ],
    });

    expect(report.comercial.operations).toBe(2);
    expect(report.metrics.comercial_operacoes).toMatchObject({
      value: 2,
      status: "partial",
    });
    expect(report.metrics.comercial_operacoes.limitations).toContain(
      "Existem Eventos comerciais factuais v2 sem detalhe comercial utilizavel carregado; a contagem representa somente operacoes agregadas.",
    );
    expect(report.metrics.rebanho_entradas).toMatchObject({
      value: 1,
      status: "partial",
    });
    expect(report.metrics.rebanho_saidas).toMatchObject({
      value: 1,
      status: "partial",
    });
  });
});

describe("Phase 16 finance event and ledger semantics", () => {
  const range = resolveReportRange("30d", new Date("2026-03-29T12:00:00.000Z"));

  function buildMinimalReport(input: {
    eventos: Evento[];
    eventosFinanceiro: EventoFinanceiro[];
    eventosComercial?: EventoComercial[];
    financeTransactions?: FinanceTransaction[];
    historicalCoverage?: Record<string, { state: "complete" | "partial" | "verified" }>;
    gestures?: Gesture[];
    rejections?: Rejection[];
  }) {
    return buildOperationalSummary(
      {
        fazendaId: "farm-1",
        animals: [],
        lotes: [],
        pastos: [],
        agenda: [],
        eventos: input.eventos,
        eventosPesagem: [],
        eventosFinanceiro: input.eventosFinanceiro,
        eventosComercial: input.eventosComercial,
        financeTransactions: input.financeTransactions,
        historicalCoverage: input.historicalCoverage as Record<
          OperationalMetricKey,
          OperationalSummaryHistoricalCoverage
        >,
        gestures: input.gestures ?? [],
        rejections: input.rejections ?? [],
      },
      range,
      new Date("2026-03-29T12:00:00.000Z"),
    );
  }

  it("keeps commercial v2 outside cash and exposes a linked forecast as a forecast", () => {
    const event = {
      ...baseEvento,
      id: "commercial-forecast-event",
      dominio: "comercial",
      occurred_at: "2026-03-15T12:00:00.000Z",
      payload: { kind: "commercial_operation_v2" },
    } as Evento;
    const detail = {
      evento_id: event.id,
      fazenda_id: "farm-1",
      operation_type: "venda",
      scope: "animal",
      occurred_at: event.occurred_at,
      quantidade_animais: 1,
      valor_bruto: 1000,
      valor_liquido_derivado: 1000,
      finance_transaction_id: "tx-forecast",
      snapshot: {},
      calculation_status: "complete",
      issues: [],
      limitations: [],
      deleted_at: null,
    } as unknown as EventoComercial;
    const transaction = {
      id: "tx-forecast",
      fazenda_id: "farm-1",
      occurred_at: "2026-03-15T12:00:00.000Z",
      competence_date: "2026-03-01",
      due_date: "2026-03-20",
      paid_at: null,
      direction: "entrada",
      status: "previsto",
      valor_total: 1000,
      source_event_id: null,
      deleted_at: null,
    } as unknown as FinanceTransaction;

    const report = buildMinimalReport({
      eventos: [event],
      eventosFinanceiro: [],
      eventosComercial: [detail],
      financeTransactions: [transaction],
    });

    expect(report.financeiro.entradas).toBe(0);
    expect(report.financeiro.previstosAReceber).toBe(1000);
    expect(report.comercial.operations).toBe(1);
    expect(report.comercial.totalLiquido).toBe(1000);
  });

  it("counts a linked financial event and ledger transaction only once", () => {
    const event = {
      ...baseEvento,
      id: "financial-linked-event",
      dominio: "financeiro",
      occurred_at: "2026-03-15T12:00:00.000Z",
    } as Evento;
    const detail = {
      evento_id: event.id,
      fazenda_id: "farm-1",
      tipo: "venda",
      valor_total: 3500,
      contraparte_id: null,
      payload: {},
      deleted_at: null,
    } as unknown as EventoFinanceiro;
    const transaction = {
      id: "tx-linked",
      fazenda_id: "farm-1",
      occurred_at: "2026-03-15T12:00:00.000Z",
      competence_date: "2026-03-01",
      due_date: "2026-03-20",
      paid_at: "2026-03-15T12:00:00.000Z",
      direction: "entrada",
      status: "realizado",
      valor_total: 3500,
      source_event_id: event.id,
      deleted_at: null,
    } as unknown as FinanceTransaction;

    const report = buildMinimalReport({
      eventos: [event],
      eventosFinanceiro: [detail],
      financeTransactions: [transaction],
    });

    expect(report.financeiro.entradas).toBe(3500);
    expect(report.financeiro.saldo).toBe(3500);
    expect(report.financeiro.transacoes).toBe(1);
  });

  describe("Fase 16 - KPI Coverage", () => {
    it("does not treat loaded ledger as complete historical coverage automatically", () => {
    const transaction = {
      id: "tx-linked",
      fazenda_id: "farm-1",
      occurred_at: "2026-03-15T12:00:00.000Z",
      competence_date: "2026-03-01",
      due_date: "2026-03-20",
      paid_at: "2026-03-15T12:00:00.000Z",
      direction: "entrada",
      status: "realizado",
      valor_total: 3500,
      source_event_id: null,
      deleted_at: null,
    } as unknown as FinanceTransaction;

    const report = buildMinimalReport({
      eventos: [],
      eventosFinanceiro: [],
      financeTransactions: [transaction],
      historicalCoverage: {}, // Explicitly empty/missing
    });

    expect(report.metrics.financeiro_entradas.status).toBe("partial");
    expect(report.metrics.financeiro_entradas.limitations).toContain(
      "Valor representa o conjunto local observado, mas a cobertura historica completa nao foi comprovada.",
    );
  });

  it("treats zero local without explicit coverage as unavailable", () => {
    const report = buildMinimalReport({
      eventos: [],
      eventosFinanceiro: [],
      financeTransactions: [],
      historicalCoverage: {}, // Explicitly empty/missing
    });

    expect(report.metrics.financeiro_entradas.status).toBe("unavailable");
    expect(report.metrics.financeiro_entradas.value).toBeNull();
    expect(report.metrics.financeiro_entradas.limitations).toContain(
      "Zero local nao e tratado como zero factual porque a cobertura historica completa nao foi comprovada.",
    );
  });

  it("treats zero local with explicit verified coverage as true zero", () => {
    const report = buildMinimalReport({
      eventos: [],
      eventosFinanceiro: [],
      financeTransactions: [],
      historicalCoverage: {
        financeiro_entradas: { state: "verified", evidence: [] },
      } as unknown as Record<OperationalMetricKey, OperationalSummaryHistoricalCoverage>,
    });

    expect(report.metrics.financeiro_entradas.status).toBe("complete");
    expect(report.metrics.financeiro_entradas.value).toBe(0);
  });
  });
});
