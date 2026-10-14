import type { OperationalSummaryReport } from "./operationalSummary";

export const OPERATIONAL_REPORT_SOURCE_NOTES = [
  "Historico: event_eventos + detail tables no periodo selecionado.",
  "Estado atual: state_* como read model atual, sem historico completo.",
  "Agenda: pendencia/intencao futura, nao fato executado.",
  "Completude historica por fazenda, dominio e periodo depende de evidencia tecnica de cobertura; watermark isolado nao basta.",
] as const;

export const OPERATIONAL_REPORT_LIMITATIONS = [
  "Relatorio derivado/read-only; dados parciais nao autorizam decisao critica.",
  "Zero local sem prova de cobertura nao e tratado como zero historico factual.",
  "Custo operacional parcial nao e DRE, ROI, margem ou custo por arroba.",
  "Pesagens indicam peso medio e ultima pesagem no periodo; nao afirmam GMD ou desempenho de lote/pasto sem permanencia comprovada.",
  "Saldo operacional e leitura parcial, nao conclusao financeira.",
] as const;

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const LONG_DATETIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function safeDateLabel(dateKey: string): string {
  return SHORT_DATE_FORMATTER.format(new Date(`${dateKey}T00:00:00`));
}

function safeDateTimeLabel(iso: string): string {
  return LONG_DATETIME_FORMATTER.format(new Date(iso));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toCsvCell(value: string | number | null): string {
  const text = value == null ? "" : String(value);
  if (text.includes(";") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

export function buildOperationalSummaryCsv(
  report: OperationalSummaryReport,
  farmName: string,
): string {
  const lines: string[] = [];
  const pushRow = (...cells: Array<string | number | null>) => {
    lines.push(cells.map(toCsvCell).join(";"));
  };

  pushRow("secao", "campo", "valor");
  pushRow("meta", "fazenda", farmName);
  pushRow(
    "meta",
    "periodo",
    `${report.range.label} (${report.range.from} a ${report.range.to})`,
  );
  pushRow("meta", "gerado_em", report.generatedAt);
  OPERATIONAL_REPORT_SOURCE_NOTES.forEach((note) => {
    pushRow("meta_fonte", "fonte", note);
  });
  OPERATIONAL_REPORT_LIMITATIONS.forEach((limitation) => {
    pushRow("meta_limitacao", "limitacao", limitation);
  });
  for (const [key, metric] of Object.entries(report.metrics)) {
    pushRow("metric", key, metric.value);
    pushRow("metric_status", key, metric.status);
    pushRow(
      "metric_sources",
      key,
      metric.sources
        .map((source) => `${source.role}:${source.name}`)
        .join(", "),
    );
    pushRow(
      "metric_coverage",
      key,
      metric.coverage
        ? `${metric.coverage.kind}:${metric.coverage.state}`
        : "unknown",
    );
    pushRow(
      "metric_scope",
      key,
      metric.coverage
        ? `${metric.coverage.scope.fazendaId}:${metric.coverage.scope.domain ?? "operacional"}`
        : null,
    );
    pushRow(
      "metric_period",
      key,
      metric.period ? `${metric.period.from} a ${metric.period.to}` : null,
    );
    pushRow(
      "metric_timezone",
      key,
      metric.period
        ? `${metric.period.timezoneSource}:${metric.period.timezone ?? "nao-informado"}`
        : null,
    );
    metric.limitations.forEach((limitation) => {
      pushRow("metric_limitation", key, limitation);
    });
  }
  pushRow("resumo", "animais_ativos", report.summary.animaisAtivos);
  pushRow("resumo", "lotes_ativos", report.summary.lotesAtivos);
  pushRow("resumo", "pastos_ativos", report.summary.pastosAtivos);
  pushRow("resumo", "agenda_aberta", report.summary.agendaAberta);
  pushRow("resumo", "agenda_hoje", report.summary.agendaHoje);
  pushRow("resumo", "agenda_atrasada", report.summary.agendaAtrasada);
  pushRow("resumo", "eventos_no_periodo", report.summary.eventosPeriodo);
  pushRow("resumo", "pendencias_sync", report.summary.pendenciasSync);
  pushRow("resumo", "erros_sync", report.summary.errosSync);
  pushRow("financeiro_observado", "receita_observada", report.financeiro.entradas?.toFixed(2) ?? "indisponivel");
  pushRow("financeiro_observado", "custo_observado", report.financeiro.saidas?.toFixed(2) ?? "indisponivel");
  pushRow("financeiro_observado", "resultado_observado", report.financeiro.saldo?.toFixed(2) ?? "indisponivel");
  pushRow("financeiro_observado", "status", report.financeiro.observedEconomicResult.status);
  pushRow("financeiro_observado", "coverage", report.financeiro.observedEconomicResult.coverage.status);
  pushRow("financeiro_observado", "interpretation", "OBSERVED_SCOPE_ONLY");
  pushRow("financeiro_observado", "completeAccounting", "false");
  pushRow("financeiro_observado", "profit", "NOT_DEMONSTRATED");
  report.financeiro.observedEconomicResult.limitations.forEach((item) => pushRow("financeiro_observado", "limitation", item));
  report.financeiro.observedEconomicResult.coverage.conflicts.forEach((item) => pushRow("financeiro_observado", "conflict", `${item.code}: ${item.description}`));
  pushRow("financeiro", "transacoes", report.financeiro.transacoes);
  pushRow("comercial", "operacoes", report.comercial.operations);
  pushRow("comercial", "cabecas", report.comercial.cabecasNegociadas);
  pushRow(
    "comercial",
    "valor_bruto",
    report.comercial.totalBruto == null
      ? null
      : report.comercial.totalBruto.toFixed(2),
  );
  pushRow(
    "comercial",
    "valor_liquido",
    report.comercial.totalLiquido == null
      ? null
      : report.comercial.totalLiquido.toFixed(2),
  );
  pushRow(
    "comercial",
    "peso_comercial_kg",
    report.comercial.pesoComercialKg == null
      ? null
      : report.comercial.pesoComercialKg.toFixed(2),
  );
  pushRow(
    "comercial",
    "preco_medio_cabeca_liquido",
    report.comercial.precoMedioCabecaLiquido == null
      ? null
      : report.comercial.precoMedioCabecaLiquido.toFixed(2),
  );
  pushRow(
    "comercial",
    "preco_medio_arroba_liquido",
    report.comercial.precoMedioArrobaLiquido == null
      ? null
      : report.comercial.precoMedioArrobaLiquido.toFixed(2),
  );
  pushRow("comercial", "receita", report.comercial.totalReceita.toFixed(2));
  pushRow("comercial", "custo", report.comercial.totalCusto.toFixed(2));
  pushRow("reproducao", "matrizes", report.reproducao.matrizes);
  pushRow("reproducao", "servicos", report.reproducao.servicos);
  pushRow("reproducao", "diagnosticos", report.reproducao.diagnosticos);
  pushRow("reproducao", "prenhas_atuais", report.reproducao.prenhasAtuais);
  pushRow("reproducao", "partos", report.reproducao.partos);
  pushRow("reproducao", "abortos_perdas", report.reproducao.abortosPerdas);
  pushRow("reproducao", "nascimentos", report.reproducao.nascimentos);
  for (const item of report.comercial.byCounterparty) {
    pushRow(
      "comercial_contraparte",
      item.label,
      `${item.eventCount} operacao(oes) | valor ${item.totalCost.toFixed(2)}`,
    );
  }
  for (const item of report.comercial.bySociedade) {
    pushRow(
      "comercial_sociedade",
      item.label,
      `${item.eventCount} operacao(oes) | valor ${item.totalCost.toFixed(2)}`,
    );
  }
  pushRow("pesagem", "total_pesagens", report.pesagem.totalPesagens);
  pushRow(
    "pesagem",
    "peso_medio_kg",
    report.pesagem.pesoMedioKg == null
      ? ""
      : report.pesagem.pesoMedioKg.toFixed(2),
  );
  pushRow(
    "pesagem",
    "ultimo_peso_kg",
    report.pesagem.ultimoPesoKg == null
      ? ""
      : report.pesagem.ultimoPesoKg.toFixed(2),
  );
  pushRow("pesagem", "ultima_pesagem_em", report.pesagem.ultimaPesagemEm);
  pushRow(
    "conformidade",
    "pendencias_abertas",
    report.regulatoryCompliance.openCount,
  );
  pushRow(
    "conformidade",
    "bloqueios",
    report.regulatoryCompliance.blockingCount,
  );
  pushRow(
    "conformidade",
    "feed_ban_aberto",
    report.regulatoryCompliance.feedBanOpenCount,
  );
  pushRow(
    "conformidade",
    "checklists_criticos",
    report.regulatoryCompliance.criticalChecklistCount,
  );
  pushRow(
    "conformidade",
    "bloqueios_nutricao",
    report.regulatoryCompliance.nutritionBlockers,
  );
  pushRow(
    "conformidade",
    "bloqueios_movimentacao",
    report.regulatoryCompliance.movementBlockers,
  );
  pushRow(
    "conformidade",
    "bloqueios_venda",
    report.regulatoryCompliance.saleBlockers,
  );
  pushRow("biosseguranca", "ocorrencias", report.biosecurityOccurrences.total);
  pushRow(
    "biosseguranca",
    "ocorrencias_abertas",
    report.biosecurityOccurrences.openCount,
  );
  pushRow(
    "biosseguranca",
    "ocorrencias_com_pendencia",
    report.biosecurityOccurrences.pendingCount,
  );
  pushRow(
    "biosseguranca",
    "suspeitas_notificaveis_abertas",
    report.biosecurityOccurrences.notifiableOpenCount,
  );
  for (const item of report.biosecurityOccurrences.byTipoOcorrencia) {
    pushRow("biosseguranca_tipo", item.key, item.count);
  }
  for (const item of report.biosecurityOccurrences.byGravidade) {
    pushRow("biosseguranca_gravidade", item.key, item.count);
  }
  for (const item of report.biosecurityOccurrences.byEscopo) {
    pushRow("biosseguranca_escopo", item.key, item.count);
  }
  pushRow("sanitario_excecoes", "abertas", report.sanitaryExceptions.totalOpen);
  pushRow(
    "sanitario_excecoes",
    "resolvidas",
    report.sanitaryExceptions.totalResolved,
  );
  pushRow(
    "sanitario_excecoes",
    "ignoradas",
    report.sanitaryExceptions.totalIgnored,
  );
  pushRow(
    "sanitario_excecoes",
    "estoque_inconsistente",
    report.sanitaryExceptions.inconsistentStockCount,
  );
  pushRow(
    "sanitario_excecoes",
    "custo_ausente",
    report.sanitaryExceptions.missingCostCount,
  );
  pushRow(
    "sanitario_excecoes",
    "tempo_medio_resolucao_dias",
    report.sanitaryExceptions.averageResolutionDays ?? 0,
  );
  for (const item of report.sanitaryExceptions.byType) {
    pushRow("sanitario_excecao_tipo", item.key, item.count);
  }
  for (const item of report.sanitaryExceptions.bySeverity) {
    pushRow("sanitario_excecao_gravidade", item.key, item.count);
  }
  pushRow("estoque", "insumos_ativos", report.inventory.itensAtivos);
  pushRow("estoque", "lotes_ativos", report.inventory.lotesAtivos);
  pushRow("estoque", "saldo_total", report.inventory.saldoTotal.toFixed(3));
  pushRow(
    "estoque",
    "entradas_periodo",
    report.inventory.entradasPeriodo.toFixed(3),
  );
  pushRow(
    "estoque",
    "saidas_periodo",
    report.inventory.saidasPeriodo.toFixed(3),
  );
  pushRow(
    "estoque",
    "ressuprimento_parametrizado",
    report.inventory.resupplyConfiguredItems,
  );
  pushRow(
    "estoque",
    "ressuprimento_atencao",
    report.inventory.resupplyWarningItems,
  );
  pushRow(
    "estoque",
    "ressuprimento_critico",
    report.inventory.resupplyCriticalItems,
  );
  pushRow(
    "estoque",
    "alertas_reposicao",
    report.inventory.replenishmentAlerts.length,
  );
  pushRow(
    "estoque_custo_parcial",
    "entradas_custo_conhecido",
    report.inventory.partialCost.entradasKnownCost.toFixed(2),
  );
  pushRow(
    "estoque_custo_parcial",
    "entradas_quantidade_custo_conhecido",
    report.inventory.partialCost.entradasKnownQuantity.toFixed(3),
  );
  pushRow(
    "estoque_custo_parcial",
    "entradas_quantidade_custo_ausente",
    report.inventory.partialCost.entradasMissingCostQuantity.toFixed(3),
  );
  pushRow(
    "estoque_custo_parcial",
    "saidas_custo_conhecido",
    report.inventory.partialCost.saidasKnownCost.toFixed(2),
  );
  pushRow(
    "estoque_custo_parcial",
    "saidas_quantidade_custo_conhecido",
    report.inventory.partialCost.saidasKnownQuantity.toFixed(3),
  );
  pushRow(
    "estoque_custo_parcial",
    "saidas_quantidade_custo_ausente",
    report.inventory.partialCost.saidasMissingCostQuantity.toFixed(3),
  );
  pushRow(
    "estoque_custo_parcial",
    "saldo_economico_conhecido",
    report.inventory.partialCost.saldoKnownCost.toFixed(2),
  );
  pushRow(
    "estoque_custo_parcial",
    "saldo_quantidade_custo_ausente",
    report.inventory.partialCost.saldoMissingCostQuantity.toFixed(3),
  );
  pushRow(
    "estoque",
    "fase3_eventos_sanitarios",
    report.inventory.sanitaryPhase3Prerequisites.sanitaryEvents,
  );
  pushRow(
    "estoque",
    "fase3_eventos_com_produto_catalogado",
    report.inventory.sanitaryPhase3Prerequisites.catalogLinkedEvents,
  );
  pushRow(
    "estoque",
    "fase3_produtos_mapeados",
    report.inventory.sanitaryPhase3Prerequisites.reliablyMappedCatalogProducts,
  );
  pushRow(
    "estoque",
    "fase3_produtos_com_lote_ativo",
    report.inventory.sanitaryPhase3Prerequisites.activeLotMappedCatalogProducts,
  );
  pushRow(
    "estoque",
    "fase3_produtos_com_apresentacao_compativel",
    report.inventory.sanitaryPhase3Prerequisites
      .presentationMappedCatalogProducts,
  );
  pushRow(
    "estoque",
    "fase3_produtos_sem_mapeamento_confiavel",
    report.inventory.sanitaryPhase3Prerequisites.unmappedCatalogProducts,
  );
  pushRow(
    "estoque",
    "fase3_eventos_com_consumo_assistido",
    report.inventory.sanitaryPhase3Prerequisites.assistedConsumptionEvents,
  );
  pushRow(
    "estoque",
    "fase3_cobertura_consumo_assistido_pct",
    report.inventory.sanitaryPhase3Prerequisites.assistedConsumptionCoveragePct,
  );
  pushRow(
    "sanitario_rastreabilidade",
    "custo_total",
    report.inventory.sanitaryTraceability.totalCost.toFixed(2),
  );
  pushRow(
    "sanitario_rastreabilidade",
    "eventos_com_produto_estruturado",
    report.inventory.sanitaryTraceability.eventsWithStructuredProduct,
  );
  pushRow(
    "sanitario_rastreabilidade",
    "eventos_com_lote_estoque",
    report.inventory.sanitaryTraceability.eventsWithStockLot,
  );
  pushRow(
    "sanitario_rastreabilidade",
    "eventos_sem_rastreabilidade_completa",
    report.inventory.sanitaryTraceability.eventsWithoutCompleteTraceability,
  );
  pushRow(
    "sanitario_rastreabilidade",
    "produtos_sem_lote_estoque",
    report.inventory.sanitaryTraceability.productsWithoutStockLot,
  );
  pushRow(
    "sanitario_rastreabilidade",
    "eventos_sem_custo",
    report.inventory.sanitaryTraceability.missingCostEvents,
  );
  pushRow(
    "sanitario_rastreabilidade",
    "eventos_com_estoque_inconsistente",
    report.inventory.sanitaryTraceability.stockInconsistencyEvents,
  );

  for (const item of report.inventory.sanitaryTraceability.byProduct) {
    pushRow(
      "sanitario_custo_produto",
      item.label,
      `${item.eventCount} evento(s) | custo ${item.totalCost.toFixed(2)}`,
    );
  }

  for (const item of report.inventory.sanitaryTraceability.byAnimal) {
    pushRow(
      "sanitario_custo_animal",
      item.label,
      `${item.eventCount} evento(s) | custo ${item.totalCost.toFixed(2)}`,
    );
  }

  for (const item of report.inventory.sanitaryTraceability.byLote) {
    pushRow(
      "sanitario_custo_lote_pecuario",
      item.label,
      `${item.eventCount} evento(s) | custo ${item.totalCost.toFixed(2)}`,
    );
  }

  for (const item of report.inventory.sanitaryTraceability.byStockLot) {
    pushRow(
      "sanitario_custo_lote_estoque",
      item.label,
      `${item.eventCount} evento(s) | custo ${item.totalCost.toFixed(2)}`,
    );
  }

  for (const item of report.inventory.sanitaryTraceability.byProtocol) {
    pushRow(
      "sanitario_custo_protocolo",
      item.label,
      `${item.eventCount} evento(s) | custo ${item.totalCost.toFixed(2)}`,
    );
  }

  for (const item of report.inventory.categorias) {
    pushRow(
      "estoque_categoria",
      item.categoria,
      `${item.itens} item(ns) | ${item.lotes} lote(s) | saldo ${item.saldo.toFixed(3)} | +${item.entradas.toFixed(3)} | -${item.saidas.toFixed(3)} | ressuprir ${item.resupplyWarningCount} | critico ${item.resupplyCriticalCount}`,
    );
  }

  for (const item of report.inventory.items) {
    pushRow(
      "estoque_item",
      item.insumo,
      `${item.categoria} | ${item.tipo} | lote ${item.lote} | ${item.apresentacao} | saldo ${item.saldo.toFixed(3)} ${item.unidadeBase} | +${item.entradas.toFixed(3)} | -${item.saidas.toFixed(3)} | ${item.status} | ressuprimento ${item.resupplyStatus} | minimo ${item.minimumStockBase == null ? "" : item.minimumStockBase.toFixed(3)} | ponto ${item.reorderPointBase == null ? "" : item.reorderPointBase.toFixed(3)} | gap ${item.resupplyGap == null ? "" : item.resupplyGap.toFixed(3)}${item.local ? ` | ${item.local}` : ""}`,
    );
  }

  for (const item of report.inventory.replenishmentAlerts) {
    pushRow(
      "estoque_alerta_reposicao",
      item.insumo,
      `${item.severity} | saldo ${item.currentBalanceBase.toFixed(3)} ${item.unidadeBase} | demanda ${item.futureDemandBase == null ? "" : item.futureDemandBase.toFixed(3)} | projetado ${item.projectedBalanceBase == null ? "" : item.projectedBalanceBase.toFixed(3)} | minimo ${item.minimumStockBase == null ? "" : item.minimumStockBase.toFixed(3)} | ponto ${item.reorderPointBase == null ? "" : item.reorderPointBase.toFixed(3)} | ${item.reasons.join(" + ")}`,
    );
  }

  pushRow(
    "estoque_demanda_futura",
    "horizonte_dias",
    report.inventory.futureDemand.horizonDays,
  );
  pushRow(
    "estoque_demanda_futura",
    "status",
    report.inventory.futureDemand.status,
  );
  pushRow(
    "estoque_demanda_futura",
    "agendas_sem_produto",
    report.inventory.futureDemand.missingProductCount,
  );
  pushRow(
    "estoque_demanda_futura",
    "agendas_sem_quantidade",
    report.inventory.futureDemand.missingQuantityCount,
  );

  for (const item of report.inventory.futureDemand.groups) {
    pushRow(
      "estoque_demanda_item",
      item.productName,
      `${item.agendaItemCount} agenda(s) | ${item.animalCount} animal(is) | demanda ${item.estimatedQuantity == null ? "sem quantidade" : item.estimatedQuantity.toFixed(3)} ${item.productUnit} | saldo ${item.availableBalance.toFixed(3)} | gap ${item.balanceGap == null ? "sem quantidade" : item.balanceGap.toFixed(3)}`,
    );
  }

  for (const item of report.regulatoryCompliance.subareas) {
    pushRow(
      "conformidade_subarea",
      item.label,
      `${item.openCount} pendencia(s) | ${item.blockerCount} bloqueio(s) | ${item.warningCount} revisao(oes) | ${item.recommendation}`,
    );
  }

  for (const item of report.regulatoryCompliance.impacts) {
    pushRow(
      "conformidade_impacto",
      item.label,
      `${item.totalCount} alerta(s) | ${item.blockerCount} bloqueio(s) | ${item.warningCount} revisao(oes) | ${item.message}`,
    );
  }

  for (const item of report.manejoByDomain) {
    pushRow("manejo", item.label, item.value);
  }

  for (const item of report.regulatoryCompliance.topItems) {
    pushRow(
      "conformidade_item",
      item.label,
      `${item.statusLabel} | ${item.detail} | ${item.recommendation}`,
    );
  }

  for (const item of report.agendaAttention) {
    pushRow(
      "agenda",
      item.data,
      `${item.titulo} | ${item.contexto}${item.operationalClassLabel ? ` | ${item.operationalClassLabel}` : ""}${item.scheduleLabel ? ` | ${item.scheduleLabel}` : ""}${item.scheduleModeLabel ? ` | ${item.scheduleModeLabel}` : ""}${item.scheduleAnchorLabel ? ` | ${item.scheduleAnchorLabel}` : ""} | ${item.status}${item.priorityLabel ? ` | ${item.priorityLabel}` : ""}`,
    );
  }

  for (const item of report.recentEvents) {
    pushRow("evento", item.data, `${item.dominio} | ${item.contexto}`);
  }

  return lines.join("\r\n");
}

export function buildOperationalSummaryPrintHtml(
  report: OperationalSummaryReport,
  farmName: string,
): string {
  const metricCards = [
    ["Animais ativos", String(report.summary.animaisAtivos)],
    ["Agenda aberta", String(report.summary.agendaAberta)],
    [
      "Saldo no periodo",
      report.financeiro.saldo == null ? "Indisponivel" : report.financeiro.saldo.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
    ],
    ["Sync pendente", String(report.summary.pendenciasSync)],
  ]
    .map(
      ([label, value]) => `
        <div class="metric-card">
          <span class="metric-label">${escapeHtml(label)}</span>
          <strong class="metric-value">${escapeHtml(value)}</strong>
        </div>
      `,
    )
    .join("");
  const sourceNoteRows = OPERATIONAL_REPORT_SOURCE_NOTES.map(
    (note) => `<li>${escapeHtml(note)}</li>`,
  ).join("");
  const limitationRows = OPERATIONAL_REPORT_LIMITATIONS.map(
    (limitation) => `<li>${escapeHtml(limitation)}</li>`,
  ).join("");
  const metricRows = Object.entries(report.metrics)
    .map(
      ([key, metric]) => `
      <tr>
        <td>${escapeHtml(key)}</td>
        <td>${metric.value == null ? "—" : metric.value}</td>
        <td>${escapeHtml(metric.status)}</td>
        <td>${escapeHtml(metric.coverage?.state ?? "unknown")}</td>
        <td>${escapeHtml(metric.period?.timezoneSource ?? "sem-periodo")}</td>
        <td>${escapeHtml(metric.sources.map((source) => source.name).join(", "))}</td>
      </tr>
    `,
    )
    .join("");

  const manejoRows = report.manejoByDomain
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td>${item.value}</td>
        </tr>
      `,
    )
    .join("");

  const inventoryRows =
    report.inventory.items.length > 0
      ? report.inventory.items
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.categoria)}</td>
                <td>${escapeHtml(item.insumo)}</td>
                <td>${escapeHtml(item.lote)}</td>
                <td>${item.saldo.toLocaleString("pt-BR")} ${escapeHtml(item.unidadeBase)}</td>
                <td>+${item.entradas.toLocaleString("pt-BR")} / -${item.saidas.toLocaleString("pt-BR")} | ${escapeHtml(item.resupplyStatus)}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="5">Sem itens de estoque cadastrados.</td>
          </tr>
        `;

  const futureDemandRows =
    report.inventory.futureDemand.groups.length > 0
      ? report.inventory.futureDemand.groups
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.productName)}</td>
                <td>${item.agendaItemCount} agenda(s) / ${item.animalCount} animal(is)</td>
                <td>${item.estimatedQuantity == null ? "Sem quantidade" : `${item.estimatedQuantity.toLocaleString("pt-BR")} ${escapeHtml(item.productUnit)}`}</td>
                <td>${item.availableBalance.toLocaleString("pt-BR")} ${escapeHtml(item.productUnit)}</td>
                <td>${item.balanceGap == null ? "Sem quantidade" : item.balanceGap.toLocaleString("pt-BR")}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="5">Sem demanda futura calculavel nos proximos ${report.inventory.futureDemand.horizonDays} dias.</td>
          </tr>
        `;

  const replenishmentAlertRows =
    report.inventory.replenishmentAlerts.length > 0
      ? report.inventory.replenishmentAlerts
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.insumo)}</td>
                <td>${escapeHtml(item.severity === "critical" ? "Critico" : "Atencao")}</td>
                <td>${item.currentBalanceBase.toLocaleString("pt-BR")} ${escapeHtml(item.unidadeBase)}</td>
                <td>${item.futureDemandBase == null ? "Sem demanda" : `${item.futureDemandBase.toLocaleString("pt-BR")} ${escapeHtml(item.unidadeBase)}`}</td>
                <td>${escapeHtml(item.reasons.join(" + "))}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="5">Sem alerta operacional de reposicao.</td>
          </tr>
        `;

  const agendaRows =
    report.agendaAttention.length > 0
      ? report.agendaAttention
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(safeDateLabel(item.data))}</td>
                <td>${escapeHtml(item.titulo)}</td>
                <td>${escapeHtml(
                  [
                    item.contexto,
                    item.operationalClassLabel,
                    item.scheduleLabel,
                    item.scheduleModeLabel,
                    item.scheduleAnchorLabel,
                  ]
                    .filter(Boolean)
                    .join(" | "),
                )}</td>
                <td>${escapeHtml(item.priorityLabel ? `${item.status} | ${item.priorityLabel}` : item.status)}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="4">Nenhuma tarefa aberta na agenda.</td>
          </tr>
        `;

  const complianceRows =
    report.regulatoryCompliance.topItems.length > 0
      ? report.regulatoryCompliance.topItems
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.label)}</td>
                <td>${escapeHtml(item.statusLabel)}</td>
                <td>${escapeHtml(item.detail)}</td>
                <td>${escapeHtml(item.recommendation)}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="4">Sem pendencias regulatorias abertas no periodo.</td>
          </tr>
        `;

  const biosecurityRows =
    report.biosecurityOccurrences.byTipoOcorrencia.length > 0
      ? report.biosecurityOccurrences.byTipoOcorrencia
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.key)}</td>
                <td>${item.count}</td>
                <td>${escapeHtml(
                  report.biosecurityOccurrences.byGravidade
                    .map((group) => `${group.key}: ${group.count}`)
                    .join(" | "),
                )}</td>
                <td>${escapeHtml(
                  report.biosecurityOccurrences.byEscopo
                    .map((group) => `${group.key}: ${group.count}`)
                    .join(" | "),
                )}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="4">Sem ocorrencia real de biosseguranca ou suspeita notificavel no periodo.</td>
          </tr>
        `;

  const complianceSubareaRows =
    report.regulatoryCompliance.subareas.length > 0
      ? report.regulatoryCompliance.subareas
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.label)}</td>
                <td>${item.openCount}</td>
                <td>${item.blockerCount}</td>
                <td>${escapeHtml(item.recommendation)}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="4">Sem recortes analiticos abertos por subarea.</td>
          </tr>
        `;

  const complianceImpactRows =
    report.regulatoryCompliance.impacts.length > 0
      ? report.regulatoryCompliance.impacts
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.label)}</td>
                <td>${item.totalCount}</td>
                <td>${item.blockerCount}</td>
                <td>${escapeHtml(item.message)}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="4">Sem impactos operacionais abertos.</td>
          </tr>
        `;

  const eventRows =
    report.recentEvents.length > 0
      ? report.recentEvents
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(safeDateLabel(item.data))}</td>
                <td>${escapeHtml(item.dominio)}</td>
                <td>${escapeHtml(item.contexto)}</td>
              </tr>
            `,
          )
          .join("")
      : `
          <tr>
            <td colspan="3">Nenhum evento registrado no periodo.</td>
          </tr>
        `;

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Resumo operacional - ${escapeHtml(farmName)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #0f172a;
            margin: 32px;
          }
          h1, h2 {
            margin: 0 0 12px;
          }
          p {
            margin: 0 0 8px;
          }
          .meta {
            color: #475569;
            margin-bottom: 24px;
          }
          .metrics {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
            margin: 20px 0 28px;
          }
          .metric-card {
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: 12px 16px;
          }
          .metric-label {
            display: block;
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            margin-bottom: 6px;
          }
          .metric-value {
            font-size: 22px;
          }
          section {
            margin-bottom: 24px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border-bottom: 1px solid #e2e8f0;
            text-align: left;
            padding: 10px 8px;
            font-size: 14px;
          }
          th {
            color: #475569;
          }
          .finance-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
          }
          .finance-card {
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: 12px 16px;
          }
          @media print {
            body {
              margin: 18px;
            }
          }
        </style>
      </head>
      <body>
        <h1>Resumo operacional</h1>
        <p><strong>${escapeHtml(farmName)}</strong></p>
        <p class="meta">
          ${escapeHtml(report.range.label)} | ${escapeHtml(safeDateLabel(report.range.from))} a ${escapeHtml(safeDateLabel(report.range.to))}<br />
          Gerado em ${escapeHtml(safeDateTimeLabel(report.generatedAt))}
        </p>

        <div class="metrics">${metricCards}</div>

        <section>
          <h2>Fontes e limitacoes</h2>
          <p class="meta">Leitura operacional derivada, read-only e limitada ao periodo selecionado.</p>
          <ul>${sourceNoteRows}${limitationRows}</ul>
        </section>

        <section>
          <h2>Métricas e cobertura</h2>
          <table>
            <thead>
              <tr>
                <th>Métrica</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Cobertura</th>
                <th>Timezone</th>
                <th>Fonte</th>
              </tr>
            </thead>
            <tbody>${metricRows}</tbody>
          </table>
        </section>

        <section>
          <h2>Manejos no periodo</h2>
          <table>
            <thead>
              <tr>
                <th>Dominio</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${manejoRows}</tbody>
          </table>
        </section>

        <section>
          <h2>Resultado economico observado</h2>
          <div class="finance-grid">
            <div class="finance-card">
              <span class="metric-label">Receita observada</span>
              <strong>${escapeHtml(
                report.financeiro.entradas == null ? "Indisponivel" : report.financeiro.entradas.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }),
              )}</strong>
            </div>
            <div class="finance-card">
              <span class="metric-label">Custo observado</span>
              <strong>${escapeHtml(
                report.financeiro.saidas == null ? "Indisponivel" : report.financeiro.saidas.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }),
              )}</strong>
            </div>
            <div class="finance-card">
              <span class="metric-label">Resultado observado</span>
              <strong>${escapeHtml(
                report.financeiro.saldo == null ? "Indisponivel" : report.financeiro.saldo.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }),
              )}</strong>
            </div>
          </div>
          <p class="meta" style="margin-top: 12px;">
            Status: ${escapeHtml(report.financeiro.observedEconomicResult.status)} | coverage: ${escapeHtml(report.financeiro.observedEconomicResult.coverage.status)} |
            interpretation=OBSERVED_SCOPE_ONLY | completeAccounting=false | profit=NOT_DEMONSTRATED. Ausencia nao e zero. Pesagens: ${report.pesagem.totalPesagens}.
          </p>
        </section>

        <section>
          <h2>Estoque operacional</h2>
          <p class="meta">
            ${report.inventory.itensAtivos} insumo(s) ativo(s) |
            ${report.inventory.lotesAtivos} lote(s) ativo(s) |
            +${report.inventory.entradasPeriodo.toLocaleString("pt-BR")} /
            -${report.inventory.saidasPeriodo.toLocaleString("pt-BR")} no periodo
            | ${report.inventory.resupplyWarningItems} ressuprimento(s) |
            ${report.inventory.resupplyCriticalItems} critico(s)
          </p>
          <p class="meta">
            Custo parcial derivado: entradas ${report.inventory.partialCost.entradasKnownCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} |
            saidas ${report.inventory.partialCost.saidasKnownCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} |
            saldo conhecido ${report.inventory.partialCost.saldoKnownCost.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} |
            custo ausente: ${report.inventory.partialCost.entradasMissingCostMovements + report.inventory.partialCost.saidasMissingCostMovements} movimentacao(oes),
            ${report.inventory.partialCost.activeLotsWithMissingCost} lote(s)
          </p>
          <table>
            <thead>
              <tr>
                <th>Categoria</th>
                <th>Insumo</th>
                <th>Lote</th>
                <th>Saldo</th>
                <th>+/- periodo</th>
              </tr>
            </thead>
            <tbody>${inventoryRows}</tbody>
          </table>
          <h3>Demanda futura por agenda valida</h3>
          <p class="meta">
            Horizonte: ${report.inventory.futureDemand.horizonDays} dias |
            Status: ${escapeHtml(report.inventory.futureDemand.status)} |
            ${report.inventory.futureDemand.missingProductCount} agenda(s) sem produto |
            ${report.inventory.futureDemand.missingQuantityCount} agenda(s) sem quantidade
          </p>
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Origem</th>
                <th>Demanda</th>
                <th>Saldo</th>
                <th>Gap</th>
              </tr>
            </thead>
            <tbody>${futureDemandRows}</tbody>
          </table>
          <h3>Alertas de reposicao</h3>
          <table>
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Severidade</th>
                <th>Saldo atual</th>
                <th>Demanda futura</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>${replenishmentAlertRows}</tbody>
          </table>
        </section>

        <section>
          <h2>Conformidade regulatoria</h2>
          <p class="meta">
            ${report.regulatoryCompliance.openCount} pendencia(s) aberta(s) |
            ${report.regulatoryCompliance.blockingCount} bloqueio(s) |
            ${report.regulatoryCompliance.saleBlockers} bloqueio(s) para venda/transito
          </p>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Status</th>
                <th>Contexto</th>
                <th>Recomendacao</th>
              </tr>
            </thead>
            <tbody>${complianceRows}</tbody>
          </table>
        </section>

        <section>
          <h2>Biosseguranca e ocorrencias sanitarias</h2>
          <p class="meta">
            Fonte: ${escapeHtml(report.biosecurityOccurrences.source)} |
            ${report.biosecurityOccurrences.openCount} ocorrencia(s) aberta(s) |
            ${report.biosecurityOccurrences.pendingCount} pendencia(s) especifica(s) |
            ${report.biosecurityOccurrences.notifiableOpenCount} suspeita(s) notificavel(is) aberta(s)
          </p>
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Ocorrencias</th>
                <th>Gravidade</th>
                <th>Escopo</th>
              </tr>
            </thead>
            <tbody>${biosecurityRows}</tbody>
          </table>
        </section>

        <section>
          <h2>Recortes regulatorios por subarea</h2>
          <table>
            <thead>
              <tr>
                <th>Subarea</th>
                <th>Pendencias</th>
                <th>Bloqueios</th>
                <th>Recomendacao</th>
              </tr>
            </thead>
            <tbody>${complianceSubareaRows}</tbody>
          </table>
        </section>

        <section>
          <h2>Impacto operacional da conformidade</h2>
          <table>
            <thead>
              <tr>
                <th>Impacto</th>
                <th>Alertas</th>
                <th>Bloqueios</th>
                <th>Mensagem</th>
              </tr>
            </thead>
            <tbody>${complianceImpactRows}</tbody>
          </table>
        </section>

        <section>
          <h2>Agenda que exige atencao</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tarefa</th>
                <th>Contexto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${agendaRows}</tbody>
          </table>
        </section>

        <section>
          <h2>Eventos recentes</h2>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Dominio</th>
                <th>Contexto</th>
              </tr>
            </thead>
            <tbody>${eventRows}</tbody>
          </table>
        </section>
      </body>
    </html>
  `;
}
