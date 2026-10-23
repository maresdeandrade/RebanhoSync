import type {
  Animal,
  Lote,
  Pasto,
  AgendaItem,
  Evento,
  EventoSanitario,
} from "@/lib/offline/types";
import {
  createMetricPeriod,
  createMetricResult,
  type MetricResult,
  type MetricStatus,
} from "./metricContract";
import type {
  OperationalSummaryInput,
  OperationalMetricKey,
  ReportRange,
} from "./operationalSummaryTypes";
import type { resolveMetricTimezone } from "./operationalSummaryCalendar";
import type {
  buildFinancialReport,
  buildCommercialReport,
} from "./financialCommercialReport";
import type {
  buildReproductionReport,
  buildWeightReport,
} from "./reproductionWeightReport";
import type { buildInventoryStock } from "./inventoryReportStock";
import type { buildInventoryDemand } from "./inventoryReportDemand";
import { getInventoryMovementSignal } from "./inventoryReportStock";
import { readStringPayload } from "./reportPayload";
type Finance = ReturnType<typeof buildFinancialReport>;
type Commercial = ReturnType<typeof buildCommercialReport>;
type Reproduction = ReturnType<typeof buildReproductionReport>;
type Weights = ReturnType<typeof buildWeightReport>;
type Stock = ReturnType<typeof buildInventoryStock>;
type Supply = ReturnType<typeof buildInventoryDemand>;
type Period = ReturnType<typeof createMetricPeriod>;
type Metrics<K extends OperationalMetricKey> = Pick<
  Record<OperationalMetricKey, MetricResult<number>>,
  K
>;

function makeMetric<T>(input: {
  value: T | null;
  status: MetricStatus;
  sources: Array<{ name: string; role: "primary" | "auxiliary" }>;
  limitations?: string[];
  period?: ReturnType<typeof createMetricPeriod>;
}): MetricResult<T> {
  return createMetricResult(input);
}

function prepareHerdEvidence(
  eventos: Evento[],
  commercial: Pick<
    Commercial,
    "commercialEvents" | "commercialDetailsComplete"
  >,
  reproduction: Pick<Reproduction, "knownBirthCount" | "birthsComplete">,
) {
  const { commercialEvents, commercialDetailsComplete } = commercial;
  const { knownBirthCount, birthsComplete } = reproduction;
  const purchaseEntryCount = commercialEvents
    .filter(({ detalhe }) => detalhe.operation_type === "compra")
    .reduce((total, { detalhe }) => total + detalhe.quantidade_animais, 0);
  const saleExitCount = commercialEvents
    .filter(({ detalhe }) => detalhe.operation_type === "venda")
    .reduce((total, { detalhe }) => total + detalhe.quantidade_animais, 0);
  const deathEvents = eventos.filter((event) => event.dominio === "obito");
  const deathExitCount = deathEvents.filter(
    (event) => event.animal_id !== null,
  ).length;
  const deathEventsWithoutAnimal = deathEvents.length - deathExitCount;
  const herdEntryCount = purchaseEntryCount + knownBirthCount;
  const herdExitCount = saleExitCount + deathExitCount;
  const herdEntryStatus: MetricStatus =
    commercialDetailsComplete && birthsComplete ? "complete" : "partial";
  const herdExitStatus: MetricStatus =
    commercialDetailsComplete && deathEventsWithoutAnimal === 0
      ? "complete"
      : "partial";
  const { historicalCategoryValue, historicalCategoryStatus } =
    prepareHistoricalCategoryEvidence(eventos);
  return {
    herdEntryCount,
    herdExitCount,
    herdEntryStatus,
    herdExitStatus,
    historicalCategoryValue,
    historicalCategoryStatus,
  };
}

function prepareHistoricalCategoryEvidence(eventos: Evento[]) {
  const historicalCategoryLabels = new Set<string>();
  for (const event of eventos) {
    const category =
      readStringPayload(event.payload, "categoria_zootecnica") ??
      readStringPayload(event.payload, "categoria_zootecnica_nome") ??
      readStringPayload(event.payload, "categoria");
    if (category) historicalCategoryLabels.add(category);
  }
  const historicalCategoryValue =
    historicalCategoryLabels.size > 0 ? historicalCategoryLabels.size : null;
  const historicalCategoryStatus: MetricStatus =
    historicalCategoryValue === null ? "unavailable" : "partial";
  return {
    historicalCategoryValue,
    historicalCategoryStatus,
  };
}

function prepareFinanceEvidence(
  input: Pick<
    OperationalSummaryInput,
    "historicalCoverage" | "financeTransactions"
  >,
  eventos: Evento[],
  finance: Finance,
) {
  const { financeEvents, activeFinanceTransactions, observedEconomicResult } =
    finance;
  const financeEventCount = eventos.filter(
    (event) => !event.deleted_at && event.dominio === "financeiro",
  ).length;
  const financeDetailsComplete = financeEventCount === financeEvents.length;
  const financeEvidenceCount =
    financeEventCount + activeFinanceTransactions.length;

  const explicitFinanceCoverage = input.historicalCoverage?.financeiro_entradas;
  const isFinanceExplicitlyVerified =
    explicitFinanceCoverage?.state === "verified";

  const financeMetricStatus: MetricStatus =
    financeEvidenceCount === 0 && !isFinanceExplicitlyVerified
      ? "unavailable"
      : financeDetailsComplete
        ? "complete"
        : "partial";
  const { financeSources, financeMetricLimitations } =
    prepareFinanceLedgerEvidence(input, financeDetailsComplete);
  const {
    observedFinanceMetricStatus,
    observedFinanceSources,
    observedFinanceLimitations,
  } = prepareObservedFinanceEvidence(observedEconomicResult);
  return {
    financeMetricStatus,
    financeSources,
    financeMetricLimitations,
    observedFinanceMetricStatus,
    observedFinanceSources,
    observedFinanceLimitations,
  };
}

function prepareFinanceLedgerEvidence(
  input: Pick<OperationalSummaryInput, "financeTransactions">,
  financeDetailsComplete: boolean,
) {
  const financeSources = input.financeTransactions
    ? [
        { name: "state_finance_transactions", role: "primary" as const },
        { name: "event_eventos_financeiro", role: "auxiliary" as const },
      ]
    : [
        { name: "event_eventos", role: "primary" as const },
        { name: "event_eventos_financeiro", role: "auxiliary" as const },
      ];
  const financeMetricLimitations = [
    "Caixa realizado exige status realizado, paid_at preenchido e paid_at dentro do periodo.",
    "Eventos financeiros e lançamentos vinculados são deduplicados por identidade explícita.",
    ...(input.financeTransactions
      ? []
      : ["Ledger gerencial não foi carregado nesta leitura."]),
    ...(financeDetailsComplete
      ? []
      : ["Existem Eventos financeiros sem detalhe carregado."]),
  ];
  return { financeSources, financeMetricLimitations };
}

function prepareObservedFinanceEvidence(
  observedEconomicResult: Finance["observedEconomicResult"],
) {
  const observedFinanceMetricStatus: MetricStatus =
    observedEconomicResult.status === "NOT_CALCULATED"
      ? "unavailable"
      : observedEconomicResult.coverage.status === "PARTIAL"
        ? "partial"
        : "complete";
  const observedFinanceSources = [
    { name: "state_finance_transactions", role: "primary" as const },
    { name: "state_finance_categories", role: "auxiliary" as const },
    { name: "event_eventos_comercial", role: "auxiliary" as const },
  ];
  const observedFinanceLimitations = [
    ...observedEconomicResult.limitations,
    "Resultado observado restrito ao recorte conhecido; completeAccounting=false e profit=NOT_DEMONSTRATED.",
    ...(observedEconomicResult.status === "NOT_CALCULATED"
      ? [`Indisponivel: ${observedEconomicResult.reason}.`]
      : []),
  ];
  return {
    observedFinanceMetricStatus,
    observedFinanceSources,
    observedFinanceLimitations,
  };
}

function prepareSanitaryInventoryEvidence(
  input: Pick<OperationalSummaryInput, "eventosSanitario" | "insumoLotes">,
  eventos: Evento[],
  sanitaryDetailByEventId: ReadonlyMap<string, EventoSanitario>,
  supply: Pick<Supply, "futureSupplyNeeds" | "futureDemandGroups">,
) {
  const { futureSupplyNeeds, futureDemandGroups } = supply;
  const sanitaryExecutionEvents = eventos.filter(
    (event) => !event.deleted_at && event.dominio === "sanitario",
  );
  const sanitaryDetailsLoaded = input.eventosSanitario !== undefined;
  const sanitaryDetailsComplete = sanitaryDetailsLoaded
    ? sanitaryExecutionEvents.every((event) =>
        sanitaryDetailByEventId.has(event.id),
      )
    : sanitaryExecutionEvents.length === 0;
  const inventoryLoaded = input.insumoLotes !== undefined;
  const futureDemandMetricStatus: MetricStatus =
    futureSupplyNeeds.answerability === "blocked"
      ? "unavailable"
      : futureSupplyNeeds.resultStatus === "partial"
        ? "partial"
        : "complete";
  const futureDemandMetricValue =
    futureSupplyNeeds.answerability === "answerable"
      ? futureDemandGroups.reduce(
          (total, group) => total + (group.estimatedQuantity ?? 0),
          0,
        )
      : null;
  return {
    sanitaryExecutionEvents,
    sanitaryDetailsLoaded,
    sanitaryDetailsComplete,
    inventoryLoaded,
    futureDemandMetricStatus,
    futureDemandMetricValue,
  };
}

function prepareCommercialEvidence(commercial: Commercial) {
  const {
    commercialDetailsComplete,
    commercialGrossComplete,
    commercialNetComplete,
    commercialWeightComplete,
    commercialArrobasComplete,
    commercialNetValue,
    commercialHeads,
    commercialArrobas,
  } = commercial;
  const commercialStatus = resolveCommercialCompleteness(
    commercialDetailsComplete,
    commercialGrossComplete,
    commercialNetComplete,
    commercialWeightComplete,
    commercialArrobasComplete,
  );
  const commercialPriceHeadStatus: MetricStatus =
    commercialStatus === "partial"
      ? "partial"
      : commercialNetValue != null && commercialHeads > 0
        ? "complete"
        : "unavailable";
  const commercialPriceArrobaStatus: MetricStatus =
    commercialStatus === "partial"
      ? "partial"
      : commercialNetValue != null &&
          commercialArrobasComplete &&
          commercialArrobas > 0
        ? "complete"
        : "unavailable";
  return {
    commercialStatus,
    commercialPriceHeadStatus,
    commercialPriceArrobaStatus,
  };
}

function resolveCommercialCompleteness(
  commercialDetailsComplete: boolean,
  commercialGrossComplete: boolean,
  commercialNetComplete: boolean,
  commercialWeightComplete: boolean,
  commercialArrobasComplete: boolean,
): "complete" | "partial" {
  return !commercialDetailsComplete ||
    !commercialGrossComplete ||
    !commercialNetComplete ||
    !commercialWeightComplete ||
    !commercialArrobasComplete
    ? "partial"
    : "complete";
}

function buildHerdMetrics(
  animals: readonly Animal[],
  lotes: readonly Lote[],
  pastos: readonly Pasto[],
  agendaAberta: readonly AgendaItem[],
  eventos: readonly Evento[],
  historicalPeriod: Period,
  evidence: ReturnType<typeof prepareHerdEvidence>,
): Metrics<
  | "rebanho_animais_ativos"
  | "rebanho_lotes_ativos"
  | "rebanho_pastos_ativos"
  | "rebanho_entradas"
  | "rebanho_saidas"
  | "rebanho_categorias_historicas"
  | "agenda_aberta"
  | "eventos_periodo"
> {
  const {
    herdEntryCount,
    herdExitCount,
    herdEntryStatus,
    herdExitStatus,
    historicalCategoryValue,
    historicalCategoryStatus,
  } = evidence;
  return {
    rebanho_animais_ativos: makeMetric<number>({
      value: animals.length,
      status: "complete",
      sources: [{ name: "state_animais", role: "primary" }],
      limitations: [
        "Estado atual; nao representa historico completo de entradas e saidas.",
      ],
    }),
    rebanho_lotes_ativos: makeMetric<number>({
      value: lotes.length,
      status: "complete",
      sources: [{ name: "state_lotes", role: "primary" }],
      limitations: ["Estado atual; nao representa historico de lotacao."],
    }),
    rebanho_pastos_ativos: makeMetric<number>({
      value: pastos.length,
      status: "complete",
      sources: [{ name: "state_pastos", role: "primary" }],
    }),
    rebanho_entradas: makeMetric<number>({
      value: herdEntryCount,
      status: herdEntryStatus,
      sources: [
        { name: "event_eventos", role: "primary" },
        { name: "event_eventos_comercial", role: "auxiliary" },
        { name: "event_eventos_reproducao", role: "auxiliary" },
      ],
      limitations: [
        "Entradas incluem compras factuais e numero_crias factual de partos; transferencias externas nao sao inferidas de estado atual.",
        ...(herdEntryStatus === "partial"
          ? [
              "Ha entrada factual sem detalhe suficiente para fechar o total do periodo.",
            ]
          : []),
      ],
      period: historicalPeriod,
    }),
    rebanho_saidas: makeMetric<number>({
      value: herdExitCount,
      status: herdExitStatus,
      sources: [
        { name: "event_eventos", role: "primary" },
        { name: "event_eventos_comercial", role: "auxiliary" },
      ],
      limitations: [
        "Saidas incluem vendas factuais e obitos com animal vinculado; transferencias externas e descarte sem Evento nao sao fabricados.",
        ...(herdExitStatus === "partial"
          ? [
              "Ha saida factual sem detalhe ou vinculo suficiente para fechar o total do periodo.",
            ]
          : []),
      ],
      period: historicalPeriod,
    }),
    rebanho_categorias_historicas: makeMetric<number>({
      value: historicalCategoryValue,
      status: historicalCategoryStatus,
      sources: [{ name: "event_eventos", role: "primary" }],
      limitations: [
        "Categorias historicas somente contam observacoes categoriais explicitas no payload de Eventos; state_animais e classificacao atual nao reconstruem historico.",
        "O contrato atual nao define um detalhe factual tipado para transicoes de categoria.",
      ],
      period: historicalPeriod,
    }),
    agenda_aberta: makeMetric<number>({
      value: agendaAberta.length,
      status: "complete",
      sources: [{ name: "state_agenda_itens", role: "primary" }],
      limitations: ["Agenda e planejamento futuro; nao comprova execucao."],
    }),
    eventos_periodo: makeMetric<number>({
      value: eventos.length,
      status: "complete",
      sources: [{ name: "event_eventos", role: "primary" }],
      period: historicalPeriod,
    }),
  };
}

function buildFinanceMetrics(
  financeiro: Finance["financeiro"],
  historicalPeriod: Period,
  evidence: ReturnType<typeof prepareFinanceEvidence>,
): Metrics<
  | "financeiro_entradas"
  | "financeiro_saidas"
  | "financeiro_saldo"
  | "financeiro_transacoes"
  | "financeiro_entradas_competencia"
  | "financeiro_saidas_competencia"
  | "financeiro_previstos_receber"
  | "financeiro_previstos_pagar"
  | "financeiro_vencidos_receber"
  | "financeiro_vencidos_pagar"
> {
  const {
    financeMetricStatus,
    financeSources,
    financeMetricLimitations,
    observedFinanceMetricStatus,
    observedFinanceSources,
    observedFinanceLimitations,
  } = evidence;
  return {
    financeiro_entradas: makeMetric<number>({
      value: financeiro.entradas,
      status: observedFinanceMetricStatus,
      sources: observedFinanceSources,
      limitations: observedFinanceLimitations,
      period: historicalPeriod,
    }),
    financeiro_saidas: makeMetric<number>({
      value: financeiro.saidas,
      status: observedFinanceMetricStatus,
      sources: observedFinanceSources,
      limitations: observedFinanceLimitations,
      period: historicalPeriod,
    }),
    financeiro_saldo: makeMetric<number>({
      value: financeiro.saldo,
      status: observedFinanceMetricStatus,
      sources: observedFinanceSources,
      limitations: observedFinanceLimitations,
      period: historicalPeriod,
    }),
    financeiro_transacoes: makeMetric<number>({
      value:
        observedFinanceMetricStatus === "unavailable"
          ? null
          : financeiro.transacoes,
      status: observedFinanceMetricStatus,
      sources: observedFinanceSources,
      limitations: observedFinanceLimitations,
      period: historicalPeriod,
    }),
    financeiro_entradas_competencia: makeMetric<number>({
      value:
        financeMetricStatus === "unavailable"
          ? null
          : financeiro.entradasCompetencia,
      status: financeMetricStatus,
      sources: financeSources,
      limitations: [
        ...financeMetricLimitations,
        "Competência usa competence_date; não é caixa realizado.",
      ],
      period: historicalPeriod,
    }),
    financeiro_saidas_competencia: makeMetric<number>({
      value:
        financeMetricStatus === "unavailable"
          ? null
          : financeiro.saidasCompetencia,
      status: financeMetricStatus,
      sources: financeSources,
      limitations: [
        ...financeMetricLimitations,
        "Competência usa competence_date; não é caixa realizado.",
      ],
      period: historicalPeriod,
    }),
    financeiro_previstos_receber: makeMetric<number>({
      value:
        financeMetricStatus === "unavailable"
          ? null
          : financeiro.previstosAReceber,
      status: financeMetricStatus,
      sources: financeSources,
      limitations: [
        ...financeMetricLimitations,
        "Previsão usa due_date e status previsto; não comprova recebimento.",
      ],
      period: historicalPeriod,
    }),
    financeiro_previstos_pagar: makeMetric<number>({
      value:
        financeMetricStatus === "unavailable"
          ? null
          : financeiro.previstosAPagar,
      status: financeMetricStatus,
      sources: financeSources,
      limitations: [
        ...financeMetricLimitations,
        "Previsão usa due_date e status previsto; não comprova pagamento.",
      ],
      period: historicalPeriod,
    }),
    financeiro_vencidos_receber: makeMetric<number>({
      value:
        financeMetricStatus === "unavailable"
          ? null
          : financeiro.vencidosAReceber,
      status: financeMetricStatus,
      sources: financeSources,
      limitations: [
        ...financeMetricLimitations,
        "Vencido é previsto com due_date anterior ao fim do periodo.",
      ],
      period: historicalPeriod,
    }),
    financeiro_vencidos_pagar: makeMetric<number>({
      value:
        financeMetricStatus === "unavailable"
          ? null
          : financeiro.vencidosAPagar,
      status: financeMetricStatus,
      sources: financeSources,
      limitations: [
        ...financeMetricLimitations,
        "Vencido é previsto com due_date anterior ao fim do periodo.",
      ],
      period: historicalPeriod,
    }),
  };
}

function buildCommercialMetrics(
  commercial: Commercial,
  historicalPeriod: Period,
  evidence: ReturnType<typeof prepareCommercialEvidence>,
): Metrics<
  | "comercial_operacoes"
  | "comercial_cabecas"
  | "comercial_valor_bruto"
  | "comercial_valor_liquido"
  | "comercial_preco_medio_cabeca"
  | "comercial_preco_medio_arroba"
  | "comercial_peso_kg"
> {
  const { comercial, commercialDetailsComplete } = commercial;
  const {
    commercialStatus,
    commercialPriceHeadStatus,
    commercialPriceArrobaStatus,
  } = evidence;
  return {
    comercial_operacoes: makeMetric<number>({
      value: comercial.operations,
      status: commercialDetailsComplete ? "complete" : "partial",
      sources: [
        { name: "event_eventos", role: "primary" },
        { name: "event_eventos_comercial", role: "auxiliary" },
      ],
      limitations: commercialDetailsComplete
        ? []
        : [
            "Existem Eventos comerciais factuais v2 sem detalhe comercial utilizavel carregado; a contagem representa somente operacoes agregadas.",
          ],
      period: historicalPeriod,
    }),
    comercial_cabecas: makeMetric<number>({
      value: commercialDetailsComplete ? comercial.cabecasNegociadas : null,
      status: commercialDetailsComplete ? "complete" : "partial",
      sources: [{ name: "event_eventos_comercial", role: "primary" }],
      period: historicalPeriod,
    }),
    comercial_valor_bruto: makeMetric<number>({
      value: comercial.totalBruto,
      status: commercialStatus,
      sources: [{ name: "event_eventos_comercial", role: "primary" }],
      limitations:
        commercialStatus === "partial"
          ? ["Valor bruto ausente em parte dos snapshots comerciais."]
          : [],
      period: historicalPeriod,
    }),
    comercial_valor_liquido: makeMetric<number>({
      value: comercial.totalLiquido,
      status: commercialStatus,
      sources: [{ name: "event_eventos_comercial", role: "primary" }],
      limitations:
        commercialStatus === "partial"
          ? ["Valor liquido ausente em parte dos snapshots comerciais."]
          : [],
      period: historicalPeriod,
    }),
    comercial_preco_medio_cabeca: makeMetric<number>({
      value: comercial.precoMedioCabecaLiquido,
      status: commercialPriceHeadStatus,
      sources: [{ name: "event_eventos_comercial", role: "primary" }],
      limitations: [
        "Preco medio por cabeca usa valor liquido explicito dividido pelas cabecas negociadas.",
      ],
      period: historicalPeriod,
    }),
    comercial_preco_medio_arroba: makeMetric<number>({
      value: comercial.precoMedioArrobaLiquido,
      status: commercialPriceArrobaStatus,
      sources: [{ name: "event_eventos_comercial", role: "primary" }],
      limitations: [
        "R$/@ exige total_arrobas presente no snapshot comercial; simulacao nao entra.",
      ],
      period: historicalPeriod,
    }),
    comercial_peso_kg: makeMetric<number>({
      value: comercial.pesoComercialKg,
      status: commercialStatus,
      sources: [{ name: "event_eventos_comercial", role: "primary" }],
      limitations: [
        "Peso comercial nao e pesagem zootecnica e nao substitui peso atual confiavel.",
      ],
      period: historicalPeriod,
    }),
  };
}

function buildAnimalMetrics(
  weights: Weights,
  reproduction: Reproduction,
  weightDetailsComplete: boolean,
  historicalPeriod: Period,
): Metrics<
  | "pesagem_eventos"
  | "pesagem_media_kg"
  | "pesagem_ultimo_kg"
  | "repro_matrizes"
  | "repro_servicos"
  | "repro_diagnosticos"
  | "repro_prenhas_atuais"
  | "repro_partos"
  | "repro_abortos"
  | "repro_nascimentos"
> {
  const { pesagens, totalPeso, ultimaPesagem } = weights;
  const {
    reproductiveSummary,
    reproductionLoaded,
    reproductiveCoverageStatus,
    partoEventsInPeriod,
    birthsComplete,
  } = reproduction;
  return {
    pesagem_eventos: makeMetric<number>({
      value: pesagens.length,
      status: weightDetailsComplete ? "complete" : "partial",
      sources: [
        { name: "event_eventos", role: "primary" },
        { name: "event_eventos_pesagem", role: "auxiliary" },
      ],
      period: historicalPeriod,
    }),
    ...buildAverageWeightMetric(
      pesagens,
      totalPeso,
      weightDetailsComplete,
      historicalPeriod,
    ),
    ...buildLastWeightMetric(
      ultimaPesagem,
      weightDetailsComplete,
      historicalPeriod,
    ),
    ...buildReproductiveActivityMetrics(
      reproductiveSummary,
      reproductionLoaded,
      reproductiveCoverageStatus,
      historicalPeriod,
    ),
    ...buildReproductiveOutcomeMetrics(
      reproductiveSummary,
      reproductionLoaded,
      reproductiveCoverageStatus,
      partoEventsInPeriod,
      birthsComplete,
      historicalPeriod,
    ),
  };
}

function buildAverageWeightMetric(
  pesagens: Weights["pesagens"],
  totalPeso: Weights["totalPeso"],
  weightDetailsComplete: boolean,
  historicalPeriod: Period,
): Metrics<"pesagem_media_kg"> {
  return {
    pesagem_media_kg: makeMetric<number>({
      value:
        pesagens.length > 0 && weightDetailsComplete
          ? totalPeso / pesagens.length
          : null,
      status:
        weightDetailsComplete && pesagens.length > 0
          ? "complete"
          : weightDetailsComplete
            ? "unavailable"
            : "partial",
      sources: [{ name: "event_eventos_pesagem", role: "primary" }],
      limitations: [
        "Sem pesagem factual no periodo, peso medio permanece indisponivel; ausencia nao e zero.",
      ],
      period: historicalPeriod,
    }),
  };
}

function buildLastWeightMetric(
  ultimaPesagem: Weights["ultimaPesagem"],
  weightDetailsComplete: boolean,
  historicalPeriod: Period,
): Metrics<"pesagem_ultimo_kg"> {
  return {
    pesagem_ultimo_kg: makeMetric<number>({
      value: weightDetailsComplete
        ? (ultimaPesagem?.detalhe.peso_kg ?? null)
        : null,
      status:
        weightDetailsComplete && ultimaPesagem
          ? "complete"
          : weightDetailsComplete
            ? "unavailable"
            : "partial",
      sources: [{ name: "event_eventos_pesagem", role: "primary" }],
      limitations: [
        "Ultima pesagem no periodo nao afirma peso atual confiavel.",
      ],
      period: historicalPeriod,
    }),
  };
}

function buildReproductiveActivityMetrics(
  reproductiveSummary: Reproduction["reproductiveSummary"],
  reproductionLoaded: boolean,
  reproductiveCoverageStatus: Reproduction["reproductiveCoverageStatus"],
  historicalPeriod: Period,
): Metrics<
  | "repro_matrizes"
  | "repro_servicos"
  | "repro_diagnosticos"
  | "repro_prenhas_atuais"
> {
  return {
    repro_matrizes: makeMetric<number>({
      value: reproductiveSummary.matrizes,
      status: "complete",
      sources: [{ name: "state_animais", role: "primary" }],
      limitations: [
        "Matriz e definida aqui como femea ativa, conforme o dashboard reprodutivo existente.",
      ],
    }),
    repro_servicos: makeMetric<number>({
      value: reproductionLoaded ? reproductiveSummary.servicos : null,
      status: reproductiveCoverageStatus,
      sources: [{ name: "event_eventos_reproducao", role: "primary" }],
      limitations: reproductionLoaded
        ? []
        : ["Detalhes reprodutivos nao foram carregados para esta consulta."],
      period: historicalPeriod,
    }),
    repro_diagnosticos: makeMetric<number>({
      value: reproductionLoaded ? reproductiveSummary.diagnosticos : null,
      status: reproductiveCoverageStatus,
      sources: [{ name: "event_eventos_reproducao", role: "primary" }],
      limitations: reproductionLoaded
        ? []
        : ["Detalhes reprodutivos nao foram carregados para esta consulta."],
      period: historicalPeriod,
    }),
    repro_prenhas_atuais: makeMetric<number>({
      value: reproductionLoaded ? reproductiveSummary.prenhasAtuais : null,
      status: reproductiveCoverageStatus,
      sources: [
        { name: "event_eventos_reproducao", role: "primary" },
        { name: "state_animais", role: "auxiliary" },
      ],
      limitations: [
        "Prenhez atual e projeção reconstruida do historico factual; nao usa Agenda nem taxonomy_facts.",
      ],
    }),
  };
}

function buildReproductiveOutcomeMetrics(
  reproductiveSummary: Reproduction["reproductiveSummary"],
  reproductionLoaded: boolean,
  reproductiveCoverageStatus: Reproduction["reproductiveCoverageStatus"],
  partoEventsInPeriod: Reproduction["partoEventsInPeriod"],
  birthsComplete: boolean,
  historicalPeriod: Period,
): Metrics<"repro_partos" | "repro_abortos" | "repro_nascimentos"> {
  return {
    repro_partos: makeMetric<number>({
      value: reproductionLoaded ? reproductiveSummary.partos : null,
      status: reproductiveCoverageStatus,
      sources: [{ name: "event_eventos_reproducao", role: "primary" }],
      period: historicalPeriod,
    }),
    repro_abortos: makeMetric<number>({
      value: reproductionLoaded ? reproductiveSummary.abortosPerdas : null,
      status: reproductiveCoverageStatus,
      sources: [{ name: "event_eventos_reproducao", role: "primary" }],
      period: historicalPeriod,
    }),
    repro_nascimentos: makeMetric<number>({
      value: reproductionLoaded ? reproductiveSummary.nascimentos : null,
      status:
        !reproductionLoaded || reproductiveCoverageStatus === "partial"
          ? reproductiveCoverageStatus
          : partoEventsInPeriod.length === 0 || birthsComplete
            ? "complete"
            : "partial",
      sources: [{ name: "event_eventos_reproducao", role: "primary" }],
      limitations: [
        "Nascimento exige numero_crias factual no detalhe do Evento de parto; ausencia nao vira zero.",
      ],
      period: historicalPeriod,
    }),
  };
}

function buildSanitaryInventoryMetrics(
  stock: Pick<Stock, "inventoryItems" | "inventoryMovements">,
  supply: Pick<Supply, "futureDemandSource" | "futureDemandLimitations">,
  historicalPeriod: Period,
  evidence: ReturnType<typeof prepareSanitaryInventoryEvidence>,
): Metrics<
  | "sanitario_execucoes"
  | "estoque_saldo_atual"
  | "estoque_entradas"
  | "estoque_saidas"
  | "estoque_demanda_futura"
> {
  const { inventoryItems, inventoryMovements } = stock;
  const { futureDemandSource, futureDemandLimitations } = supply;
  const {
    sanitaryExecutionEvents,
    sanitaryDetailsLoaded,
    sanitaryDetailsComplete,
    inventoryLoaded,
    futureDemandMetricStatus,
    futureDemandMetricValue,
  } = evidence;
  return {
    sanitario_execucoes: makeMetric<number>({
      value: sanitaryDetailsComplete ? sanitaryExecutionEvents.length : null,
      status:
        sanitaryDetailsComplete && sanitaryDetailsLoaded
          ? "complete"
          : sanitaryExecutionEvents.length === 0
            ? "complete"
            : "partial",
      sources: [
        { name: "event_eventos", role: "primary" },
        { name: "event_eventos_sanitario", role: "auxiliary" },
      ],
      limitations: [
        "Agenda Sanitária v2, closure e Protocolo nao sao contabilizados como execucao.",
      ],
      period: historicalPeriod,
    }),
    estoque_saldo_atual: makeMetric<number>({
      value: inventoryLoaded
        ? inventoryItems.reduce((total, item) => total + item.saldo, 0)
        : null,
      status: inventoryLoaded ? "complete" : "unavailable",
      sources: [{ name: "state_insumo_lotes", role: "primary" }],
      limitations: [
        "Saldo atual e read model; custo ausente permanece parcial no bloco de custo.",
      ],
    }),
    ...buildInventoryFlowMetrics(
      inventoryMovements,
      inventoryLoaded,
      historicalPeriod,
    ),
    estoque_demanda_futura: makeMetric<number>({
      value: futureDemandMetricValue,
      status: futureDemandMetricStatus,
      sources: [{ name: futureDemandSource, role: "primary" }],
      limitations: futureDemandLimitations,
    }),
  };
}

function buildInventoryFlowMetrics(
  inventoryMovements: Stock["inventoryMovements"],
  inventoryLoaded: boolean,
  historicalPeriod: Period,
): Metrics<"estoque_entradas" | "estoque_saidas"> {
  return {
    estoque_entradas: makeMetric<number>({
      value: inventoryLoaded
        ? inventoryMovements.reduce(
            (total, movement) =>
              total +
              (getInventoryMovementSignal(movement.tipo) === "entrada"
                ? movement.quantidade_base
                : 0),
            0,
          )
        : null,
      status: inventoryLoaded ? "complete" : "unavailable",
      sources: [{ name: "state_insumo_movimentacoes", role: "primary" }],
      period: historicalPeriod,
    }),
    estoque_saidas: makeMetric<number>({
      value: inventoryLoaded
        ? inventoryMovements.reduce(
            (total, movement) =>
              total +
              (getInventoryMovementSignal(movement.tipo) === "saida"
                ? movement.quantidade_base
                : 0),
            0,
          )
        : null,
      status: inventoryLoaded ? "complete" : "unavailable",
      sources: [{ name: "state_insumo_movimentacoes", role: "primary" }],
      period: historicalPeriod,
    }),
  };
}

export interface OperationalMetricsInput {
  input: Pick<
    OperationalSummaryInput,
    | "historicalCoverage"
    | "financeTransactions"
    | "eventosSanitario"
    | "insumoLotes"
  >;
  eventos: Evento[];
  animals: Animal[];
  lotes: Lote[];
  pastos: Pasto[];
  agendaAberta: AgendaItem[];
  metricTimezone: ReturnType<typeof resolveMetricTimezone>;
  range: ReportRange;
  sanitaryDetailByEventId: ReadonlyMap<string, EventoSanitario>;
  stock: Pick<Stock, "inventoryItems" | "inventoryMovements">;
  supply: Pick<
    Supply,
    | "futureSupplyNeeds"
    | "futureDemandGroups"
    | "futureDemandSource"
    | "futureDemandLimitations"
  >;
  finance: Finance;
  commercial: Commercial;
  weights: Weights;
  reproduction: Reproduction;
}
export function buildOperationalMetrics({
  input,
  eventos,
  animals,
  lotes,
  pastos,
  agendaAberta,
  metricTimezone,
  range,
  sanitaryDetailByEventId,
  stock,
  supply,
  finance,
  commercial,
  weights,
  reproduction,
}: OperationalMetricsInput): Record<
  OperationalMetricKey,
  MetricResult<number>
> {
  const historicalPeriod = createMetricPeriod(range.from, range.to, {
    timezone: metricTimezone.timezone,
    timezoneSource: metricTimezone.source,
  });
  const herdEvidence = prepareHerdEvidence(eventos, commercial, reproduction);
  const financeEvidence = prepareFinanceEvidence(input, eventos, finance);
  const weightEventCount = eventos.filter(
    (event) => !event.deleted_at && event.dominio === "pesagem",
  ).length;
  const weightDetailsComplete = weightEventCount === weights.pesagens.length;
  const sanitaryInventoryEvidence = prepareSanitaryInventoryEvidence(
    input,
    eventos,
    sanitaryDetailByEventId,
    supply,
  );
  const commercialEvidence = prepareCommercialEvidence(commercial);
  return {
    ...buildHerdMetrics(
      animals,
      lotes,
      pastos,
      agendaAberta,
      eventos,
      historicalPeriod,
      herdEvidence,
    ),
    ...buildFinanceMetrics(
      finance.financeiro,
      historicalPeriod,
      financeEvidence,
    ),
    ...buildCommercialMetrics(commercial, historicalPeriod, commercialEvidence),
    ...buildAnimalMetrics(
      weights,
      reproduction,
      weightDetailsComplete,
      historicalPeriod,
    ),
    ...buildSanitaryInventoryMetrics(
      stock,
      supply,
      historicalPeriod,
      sanitaryInventoryEvidence,
    ),
  };
}
