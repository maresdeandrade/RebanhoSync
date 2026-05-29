import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CircleSlash,
  Layers,
  Signal,
  Syringe,
  Scale,
  TrendingUp,
  Gauge,
  ShieldCheck,
  Beef,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  OperationalInsightCard,
  OperationalInsightsViewModel,
  OperationalSignal,
} from "@/features/operationalInsights/operationalInsightsAdapter";
import type { HomeIndicatorsResult } from "@/features/operationalInsights/operationalHomeIndicatorsAdapter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

type InsightCardTone = "default" | "info" | "success" | "warning" | "danger";

type InsightSummary = {
  value: string | number;
  detail: string;
  rows: string[];
};

const cardToneStyles: Record<InsightCardTone, string> = {
  default: "border-border/70",
  info: "border-info/15 bg-info-muted/40",
  success: "border-success/15 bg-success-muted/50",
  warning: "border-warning/20 bg-warning-muted/55",
  danger: "border-destructive/15 bg-destructive/5",
};

const iconToneStyles: Record<InsightCardTone, string> = {
  default: "text-muted-foreground",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

const severityTone: Record<string, StatusTone> = {
  info: "info",
  warning: "warning",
  critical: "danger",
};

function getStatusLabel(status: string): string {
  switch (status) {
    case "blocked":
      return "Bloqueado";
    case "empty":
      return "Vazio";
    case "partial":
      return "Parcial";
    case "complete":
      return "Completo";
    default:
      return status;
  }
}

function getStatusDescription(status: string): string {
  switch (status) {
    case "blocked":
      return "Fonte obrigatoria ausente.";
    case "empty":
      return "Fonte carregada, sem itens.";
    case "partial":
      return "Fonte carregada com limitacao.";
    case "complete":
      return "Fonte carregada, leitura completa.";
    default:
      return "Estado da resposta.";
  }
}

function getStatusTone(status: string): StatusTone {
  switch (status) {
    case "blocked":
      return "danger";
    case "partial":
      return "warning";
    case "empty":
      return "neutral";
    case "complete":
      return "success";
    default:
      return "neutral";
  }
}

function hasPositiveValue(summary: InsightSummary): boolean {
  return typeof summary.value === "number" && summary.value > 0;
}

function getCardTone(
  card: OperationalInsightCard<unknown>,
  summary: InsightSummary,
): InsightCardTone {
  const status = card.insight.resultStatus;

  if (status === "blocked") return "danger";
  if (card.id === "agendaNeeds.overdue" && hasPositiveValue(summary)) return "danger";
  if (card.id === "agendaNeeds.dueToday" && hasPositiveValue(summary)) return "warning";
  if (status === "partial") return "warning";
  if (status === "complete") return "success";
  return "default";
}

function getStatusCardTone(status: string): InsightCardTone {
  if (status === "blocked") return "danger";
  if (status === "partial") return "warning";
  if (status === "complete") return "success";
  return "default";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readCountRows(
  groups: unknown,
  keyName: string,
  limit = 3,
): string[] {
  if (!Array.isArray(groups)) return [];

  return groups.slice(0, limit).flatMap((group) => {
    if (!isRecord(group)) return [];
    const label = typeof group[keyName] === "string" ? group[keyName] : null;
    const count = readNumber(group.count);
    return label && count !== null ? [`${label}: ${count}`] : [];
  });
}

function summarizeAgendaCard(card: OperationalInsightCard<unknown>): InsightSummary {
  const data = card.insight.answerability === "answerable" ? card.insight.data : null;
  const count = Array.isArray(data) ? data.length : 0;

  return {
    value: card.insight.answerability === "blocked" ? "-" : count,
    detail: count === 1 ? "item de agenda" : "itens de agenda",
    rows: [],
  };
}

function summarizeSanitarySupply(card: OperationalInsightCard<unknown>): InsightSummary {
  if (card.insight.answerability === "blocked" || !isRecord(card.insight.data)) {
    return { value: "-", detail: "insumos sanitarios", rows: [] };
  }

  const groups = Array.isArray(card.insight.data.groups) ? card.insight.data.groups : [];
  const totalAgendaItems = groups.reduce((total, group) => {
    if (!isRecord(group)) return total;
    return total + (readNumber(group.agendaItemCount) ?? 0);
  }, 0);
  const incomplete = Array.isArray(card.insight.data.incompleteAgendaItemIds)
    ? card.insight.data.incompleteAgendaItemIds.length
    : 0;

  return {
    value: totalAgendaItems,
    detail:
      incomplete > 0
        ? `${groups.length} grupo(s), ${incomplete} sem produto`
        : `${groups.length} grupo(s) por produto`,
    rows: groups.slice(0, 3).flatMap((group) => {
      if (!isRecord(group)) return [];
      const product =
        typeof group.productName === "string"
          ? group.productName
          : typeof group.productKey === "string"
            ? group.productKey
            : null;
      const agendaItemCount = readNumber(group.agendaItemCount);
      return product && agendaItemCount !== null
        ? [`${product}: ${agendaItemCount}`]
        : [];
    }),
  };
}

function summarizeHerdStage(card: OperationalInsightCard<unknown>): InsightSummary {
  if (card.insight.answerability === "blocked" || !isRecord(card.insight.data)) {
    return { value: "-", detail: "animais no estado atual", rows: [] };
  }

  const totalAnimals = readNumber(card.insight.data.totalAnimals) ?? 0;

  return {
    value: totalAnimals,
    detail: "animais no estado atual",
    rows: readCountRows(card.insight.data.byStage, "stage"),
  };
}

function summarizeMonthlyKpis(card: OperationalInsightCard<unknown>): InsightSummary {
  if (card.insight.answerability === "blocked" || !isRecord(card.insight.data)) {
    return { value: "-", detail: "eventos no mes", rows: [] };
  }

  const totalEvents = readNumber(card.insight.data.totalEvents) ?? 0;
  const uniqueAnimalCount = readNumber(card.insight.data.uniqueAnimalCount) ?? 0;

  return {
    value: totalEvents,
    detail: `${uniqueAnimalCount} animal(is) com evento`,
    rows: readCountRows(card.insight.data.byDomain, "domain"),
  };
}

function summarizeCard(card: OperationalInsightCard<unknown>): InsightSummary {
  if (card.id === "sanitarySupplyNeeds") return summarizeSanitarySupply(card);
  if (card.id === "herdStageSummary") return summarizeHerdStage(card);
  if (card.id === "monthlyOperationalKpis") return summarizeMonthlyKpis(card);
  return summarizeAgendaCard(card);
}

function getCardIcon(card: OperationalInsightCard<unknown>) {
  if (card.id === "sanitarySupplyNeeds") return <Syringe className="h-4 w-4" />;
  if (card.id === "herdStageSummary") return <Layers className="h-4 w-4" />;
  if (card.id === "monthlyOperationalKpis") return <BarChart3 className="h-4 w-4" />;
  if (card.insight.resultStatus === "blocked") return <CircleSlash className="h-4 w-4" />;
  if (card.id === "agendaNeeds.overdue") return <AlertTriangle className="h-4 w-4" />;
  return <CalendarClock className="h-4 w-4" />;
}

function SourceLine({ primarySource }: { primarySource: string | null }) {
  return (
    <p className="truncate text-xs text-muted-foreground">
      {primarySource ? `Fonte: ${primarySource}` : "Fonte ausente"}
    </p>
  );
}

function LimitationsList({ limitations }: { limitations: readonly string[] }) {
  if (limitations.length === 0) return null;

  const visibleLimitations = limitations.slice(0, 2);
  const hiddenCount = limitations.length - visibleLimitations.length;

  return (
    <div className="rounded-md border border-border/70 bg-muted/25 px-3 py-2 text-xs leading-5 text-muted-foreground">
      <span className="font-medium text-foreground">Limites: </span>
      {visibleLimitations.join(" ")}
      {hiddenCount > 0 ? ` +${hiddenCount} limite(s).` : null}
    </div>
  );
}

function InsightSectionCard({ card }: { card: OperationalInsightCard<unknown> }) {
  const insight = card.insight;
  const summary = summarizeCard(card);
  const limitations = insight.source.limitations;
  const tone = getCardTone(card, summary);

  return (
    <Card className={`shadow-none ${cardToneStyles[tone]}`}>
      <CardHeader className="space-y-3 p-4 pb-3 sm:p-4 sm:pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <CardDescription className="text-xs font-medium uppercase tracking-[0.12em]">
              {card.title}
            </CardDescription>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <CardTitle className="text-3xl tabular-nums tracking-normal">
                {summary.value}
              </CardTitle>
              <span className="text-sm text-muted-foreground">{summary.detail}</span>
            </div>
          </div>
          <div className={iconToneStyles[tone]}>{getCardIcon(card)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge tone={getStatusTone(insight.resultStatus)}>
            {getStatusLabel(insight.resultStatus)}
          </StatusBadge>
          <span className="text-xs text-muted-foreground">
            {getStatusDescription(insight.resultStatus)}
          </span>
        </div>
        <SourceLine primarySource={insight.source.primarySource} />
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 sm:px-4 sm:pb-4">
        {insight.answerability === "blocked" ? (
          <div className="rounded-md border border-destructive/15 bg-destructive/5 p-3 text-sm text-destructive">
            <p className="font-medium">Leitura bloqueada</p>
            <p className="mt-1">{insight.source.block.reason}</p>
            {insight.source.block.requiredSources.length > 0 ? (
              <p className="mt-1 text-xs">
                Fonte requerida: {insight.source.block.requiredSources.join(", ")}
              </p>
            ) : null}
          </div>
        ) : insight.resultStatus === "partial" && insight.partialReason ? (
          <div className="rounded-md border border-warning/20 bg-warning-muted/55 p-3 text-sm text-warning">
            <p className="font-medium">Leitura parcial</p>
            <p className="mt-1">{insight.partialReason}</p>
          </div>
        ) : null}

        {summary.rows.length > 0 ? (
          <div className="space-y-1 text-sm text-muted-foreground">
            {summary.rows.map((row) => (
              <div key={row} className="flex items-center justify-between gap-3">
                <span>{row}</span>
              </div>
            ))}
          </div>
        ) : null}

        <LimitationsList limitations={limitations} />
      </CardContent>
    </Card>
  );
}

function SignalRow({ signal }: { signal: OperationalSignal }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/25 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={severityTone[signal.severity ?? "info"] ?? "neutral"}>
            {signal.code}
          </StatusBadge>
          <span className="text-sm font-medium">{signal.label}</span>
        </div>
        {typeof signal.count === "number" ? (
          <span className="text-sm text-muted-foreground">{signal.count}</span>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Fonte {signal.primarySource}.
      </p>
    </div>
  );
}

function SignalsCard({ viewModel }: { viewModel: OperationalInsightsViewModel }) {
  const { tagSignals } = viewModel;
  const tone = getStatusCardTone(tagSignals.resultStatus);

  return (
    <Card className={`shadow-none ${cardToneStyles[tone]}`}>
      <CardHeader className="space-y-3 p-4 pb-3 sm:p-4 sm:pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardDescription className="text-xs font-medium uppercase tracking-[0.12em]">
              {tagSignals.title}
            </CardDescription>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <CardTitle className="text-3xl tabular-nums tracking-normal">
                {tagSignals.signals.length}
              </CardTitle>
              <span className="text-sm text-muted-foreground">sinais visuais</span>
            </div>
          </div>
          <div className={iconToneStyles[tone]}>
            <Signal className="h-4 w-4" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusBadge tone={getStatusTone(tagSignals.resultStatus)}>
            {getStatusLabel(tagSignals.resultStatus)}
          </StatusBadge>
          <span className="text-xs text-muted-foreground">
            {getStatusDescription(tagSignals.resultStatus)}
          </span>
          {tagSignals.skippedBlockedInsightIds.length > 0 ? (
            <StatusBadge tone="warning">
              {tagSignals.skippedBlockedInsightIds.length} bloqueado(s)
            </StatusBadge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 sm:px-4 sm:pb-4">
        <p className="text-xs text-muted-foreground">
          Sinais auxiliares; nao persistem tags.
        </p>
        {tagSignals.signals.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
            Nenhum sinal auxiliar emitido pelas fontes carregadas.
          </div>
        ) : (
          tagSignals.signals.map((signal) => (
            <SignalRow key={`${signal.code}:${signal.sourceInsightQuestion}`} signal={signal} />
          ))
        )}

        <LimitationsList limitations={tagSignals.limitations} />
      </CardContent>
    </Card>
  );
}

export function OperationalInsightsPanel({
  viewModel,
  homeIndicators,
}: {
  viewModel: OperationalInsightsViewModel;
  homeIndicators?: HomeIndicatorsResult;
}) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Central Operacional
          </p>
          <h2 className="text-xl font-semibold tracking-normal">
            Leitura passiva da operação
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="neutral">Referencia {viewModel.referenceDate}</StatusBadge>
          <StatusBadge tone="neutral">Mes {viewModel.monthlyPeriod.start.slice(0, 7)}</StatusBadge>
        </div>
      </div>

      {homeIndicators && (
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
              Indicadores Fácticos Operacionais
            </h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Card 1: Agenda Operacional */}
            <Card className={`shadow-none transition-all duration-300 hover:scale-[1.01] hover:shadow-md ${cardToneStyles[getStatusCardTone(homeIndicators.agenda.status)]}`}>
              <CardHeader className="space-y-3 p-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <CardDescription className="text-xs font-medium uppercase tracking-[0.12em]">
                      Agenda de Manejo
                    </CardDescription>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <CardTitle className="text-3xl tabular-nums tracking-normal">
                        {homeIndicators.agenda.totalOpen}
                      </CardTitle>
                      <span className="text-sm text-muted-foreground">itens em aberto</span>
                    </div>
                  </div>
                  <div className={iconToneStyles[getStatusCardTone(homeIndicators.agenda.status)]}>
                    <CalendarClock className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusBadge tone={getStatusTone(homeIndicators.agenda.status)}>
                    {getStatusLabel(homeIndicators.agenda.status)}
                  </StatusBadge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  Fonte: state_agenda_itens
                </p>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4 text-sm">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md bg-background/50 p-2 border border-border/40">
                    <span className="block font-semibold text-destructive">{homeIndicators.agenda.overdue}</span>
                    <span className="text-[10px] text-muted-foreground">Atrasados</span>
                  </div>
                  <div className="rounded-md bg-background/50 p-2 border border-border/40">
                    <span className="block font-semibold text-warning">{homeIndicators.agenda.dueToday}</span>
                    <span className="text-[10px] text-muted-foreground">Hoje</span>
                  </div>
                  <div className="rounded-md bg-background/50 p-2 border border-border/40">
                    <span className="block font-semibold text-info">{homeIndicators.agenda.upcoming}</span>
                    <span className="text-[10px] text-muted-foreground">Próximos</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Escore de Condição Corporal (ECC) */}
            <Card className={`shadow-none transition-all duration-300 hover:scale-[1.01] hover:shadow-md ${cardToneStyles[getStatusCardTone(homeIndicators.ecc.status)]}`}>
              <CardHeader className="space-y-3 p-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <CardDescription className="text-xs font-medium uppercase tracking-[0.12em]">
                      Escore Corporal (ECC)
                    </CardDescription>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <CardTitle className="text-3xl tabular-nums tracking-normal">
                        {homeIndicators.ecc.eccMedioGlobal > 0 ? homeIndicators.ecc.eccMedioGlobal.toFixed(2) : "-"}
                      </CardTitle>
                      <span className="text-sm text-muted-foreground">ECC Médio Global</span>
                    </div>
                  </div>
                  <div className={iconToneStyles[getStatusCardTone(homeIndicators.ecc.status)]}>
                    <Beef className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusBadge tone={getStatusTone(homeIndicators.ecc.status)}>
                    {getStatusLabel(homeIndicators.ecc.status)}
                  </StatusBadge>
                  <span className="text-xs text-muted-foreground">
                    Cobertura: {homeIndicators.ecc.coberturaAtiva.percentage}% ({homeIndicators.ecc.coberturaAtiva.evaluated}/{homeIndicators.ecc.coberturaAtiva.total})
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  Fonte: event_eventos_ecc
                </p>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4 text-sm">
                {homeIndicators.ecc.lotesComMenorCobertura.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">Lotes com menor cobertura:</p>
                    <div className="space-y-1 text-xs">
                      {homeIndicators.ecc.lotesComMenorCobertura.slice(0, 2).map(l => (
                        <div key={l.loteId} className="flex justify-between items-center text-muted-foreground">
                          <span className="truncate max-w-[120px] font-medium">{l.nome}</span>
                          <span>{l.percentage}% cob. ({l.eccMedio > 0 ? `Med: ${l.eccMedio.toFixed(1)}` : 'Sem méd.'})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {homeIndicators.ecc.animaisSemEccCount > 0 && (
                  <Accordion type="single" collapsible className="w-full border-t border-border/40 mt-1">
                    <AccordionItem value="sem-ecc" className="border-0">
                      <AccordionTrigger className="p-0 py-2 text-xs text-muted-foreground hover:no-underline">
                        Ver {homeIndicators.ecc.animaisSemEccCount} animal(is) sem ECC factual registrado
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 text-xs">
                        <ul className="max-h-24 overflow-y-auto space-y-1 pr-1 border rounded bg-background/40 p-1.5">
                          {homeIndicators.ecc.animaisSemEccList.map(a => (
                            <li key={a.id} className="flex justify-between py-0.5 border-b border-border/20 last:border-0 font-mono text-[11px]">
                              <span>{a.identificacao}</span>
                              <span className="text-[9px] text-muted-foreground/80 uppercase">Sem registro</span>
                            </li>
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </CardContent>
            </Card>

            {/* Card 3: Desempenho (GMD) */}
            <Card className={`shadow-none transition-all duration-300 hover:scale-[1.01] hover:shadow-md ${cardToneStyles[getStatusCardTone(homeIndicators.gmd.status)]}`}>
              <CardHeader className="space-y-3 p-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <CardDescription className="text-xs font-medium uppercase tracking-[0.12em]">
                      Desempenho de Ganho (GMD)
                    </CardDescription>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <CardTitle className="text-3xl tabular-nums tracking-normal">
                        {homeIndicators.gmd.lotesComGmd.length}
                      </CardTitle>
                      <span className="text-sm text-muted-foreground">lotes com GMD calculável</span>
                    </div>
                  </div>
                  <div className={iconToneStyles[getStatusCardTone(homeIndicators.gmd.status)]}>
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusBadge tone={getStatusTone(homeIndicators.gmd.status)}>
                    {getStatusLabel(homeIndicators.gmd.status)}
                  </StatusBadge>
                  {homeIndicators.gmd.animaisComApenasUmaPesagemCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {homeIndicators.gmd.animaisComApenasUmaPesagemCount} animal(is) com pesagem única
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  Fonte: event_eventos_pesagem
                </p>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4 text-sm">
                {homeIndicators.gmd.lotesComGmd.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">GMD por lote:</p>
                    <div className="space-y-1 text-xs">
                      {homeIndicators.gmd.lotesComGmd.slice(0, 3).map(l => (
                        <div key={l.loteId} className="flex justify-between items-center text-muted-foreground">
                          <span className="truncate max-w-[120px] font-medium">{l.nome}</span>
                          <span className="font-mono text-success font-semibold">+{l.gmdMedio.toFixed(2)} kg/dia ({l.animaisCount} an.)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded bg-muted/40 p-2 text-xs text-muted-foreground border border-border/30">
                    Nenhum lote possui pesagens suficientes (&ge; 2 pesagens) para cálculo de ganho diário.
                  </div>
                )}

                {homeIndicators.gmd.lotesSemPesagemSuficiente.length > 0 && (
                  <div className="space-y-1 border-t border-border/40 pt-2">
                    <p className="text-[11px] font-semibold text-muted-foreground">Lotes sem dados suficientes:</p>
                    <div className="space-y-0.5 text-[11px] text-muted-foreground">
                      {homeIndicators.gmd.lotesSemPesagemSuficiente.slice(0, 2).map(l => (
                        <div key={l.loteId} className="flex justify-between truncate">
                          <span>{l.nome}</span>
                          <span className="text-[10px] italic">Dados insuficientes</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card 4: Tempo de Lotação */}
            <Card className={`shadow-none transition-all duration-300 hover:scale-[1.01] hover:shadow-md ${cardToneStyles[getStatusCardTone(homeIndicators.lotacao.status)]}`}>
              <CardHeader className="space-y-3 p-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <CardDescription className="text-xs font-medium uppercase tracking-[0.12em]">
                      Tempo de Lotação
                    </CardDescription>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <CardTitle className="text-3xl tabular-nums tracking-normal">
                        {homeIndicators.lotacao.lotePermanencia.length}
                      </CardTitle>
                      <span className="text-sm text-muted-foreground">lotes monitorados</span>
                    </div>
                  </div>
                  <div className={iconToneStyles[getStatusCardTone(homeIndicators.lotacao.status)]}>
                    <Gauge className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusBadge tone={getStatusTone(homeIndicators.lotacao.status)}>
                    {getStatusLabel(homeIndicators.lotacao.status)}
                  </StatusBadge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  Fonte: event_eventos_movimentacao
                </p>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4 text-sm">
                {homeIndicators.lotacao.lotePermanencia.length > 0 ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">Permanência média por lote:</p>
                    <div className="space-y-1 text-xs">
                      {homeIndicators.lotacao.lotePermanencia.slice(0, 3).map(p => (
                        <div key={p.loteId} className="space-y-0.5">
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span className="truncate max-w-[120px] font-medium">{p.nome}</span>
                            <span className="font-mono font-semibold">{p.permanenciaMediaDias} dias</span>
                          </div>
                          {p.isPartial && (
                            <p className="text-[10px] text-amber-600 font-medium leading-none">
                              ⚠ Entrada inicial ausente (calculado a partir de {p.ultimaMovimentacao || 'sem data'})
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded bg-muted/40 p-2 text-xs text-muted-foreground border border-border/30">
                    Nenhuma movimentação registrada.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card 5: Manejo Sanitário */}
            <Card className={`shadow-none transition-all duration-300 hover:scale-[1.01] hover:shadow-md ${cardToneStyles[getStatusCardTone(homeIndicators.sanitario.status)]}`}>
              <CardHeader className="space-y-3 p-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <CardDescription className="text-xs font-medium uppercase tracking-[0.12em]">
                      Manejo Sanitário
                    </CardDescription>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <CardTitle className="text-3xl tabular-nums tracking-normal">
                        {homeIndicators.sanitario.totalOpen}
                      </CardTitle>
                      <span className="text-sm text-muted-foreground">itens pendentes</span>
                    </div>
                  </div>
                  <div className={iconToneStyles[getStatusCardTone(homeIndicators.sanitario.status)]}>
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusBadge tone={getStatusTone(homeIndicators.sanitario.status)}>
                    {getStatusLabel(homeIndicators.sanitario.status)}
                  </StatusBadge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  Fonte: state_agenda_itens
                </p>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4 text-sm">
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-md bg-background/50 p-2 border border-border/40">
                    <span className="block font-semibold text-destructive">{homeIndicators.sanitario.overdue}</span>
                    <span className="text-[10px] text-muted-foreground">Atrasados</span>
                  </div>
                  <div className="rounded-md bg-background/50 p-2 border border-border/40">
                    <span className="block font-semibold text-warning">{homeIndicators.sanitario.dueToday}</span>
                    <span className="text-[10px] text-muted-foreground">Hoje</span>
                  </div>
                  <div className="rounded-md bg-background/50 p-2 border border-border/40">
                    <span className="block font-semibold text-info">{homeIndicators.sanitario.upcoming}</span>
                    <span className="text-[10px] text-muted-foreground">Próximos</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 6: Peso Atual Confiável */}
            <Card className={`shadow-none transition-all duration-300 hover:scale-[1.01] hover:shadow-md ${cardToneStyles[getStatusCardTone(homeIndicators.pesoConfiavel.status)]}`}>
              <CardHeader className="space-y-3 p-4 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <CardDescription className="text-xs font-medium uppercase tracking-[0.12em]">
                      {homeIndicators.pesoConfiavel.label}
                    </CardDescription>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <CardTitle className="text-3xl tabular-nums tracking-normal">
                        {homeIndicators.pesoConfiavel.pesoMedioGlobal > 0 ? `${homeIndicators.pesoConfiavel.pesoMedioGlobal.toFixed(1)}` : "-"}
                      </CardTitle>
                      <span className="text-sm text-muted-foreground">kg (Peso Médio Global)</span>
                    </div>
                  </div>
                  <div className={iconToneStyles[getStatusCardTone(homeIndicators.pesoConfiavel.status)]}>
                    <Scale className="h-5 w-5" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusBadge tone={getStatusTone(homeIndicators.pesoConfiavel.status)}>
                    {getStatusLabel(homeIndicators.pesoConfiavel.status)}
                  </StatusBadge>
                  <span className="text-xs text-muted-foreground">
                    Cobertura: {homeIndicators.pesoConfiavel.coberturaAtiva.percentage}%
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  Fonte: event_eventos_pesagem
                </p>
              </CardHeader>
              <CardContent className="space-y-3 px-4 pb-4 text-sm">
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Animais com peso confiável:</span>
                    <span className="font-semibold text-foreground">{homeIndicators.pesoConfiavel.animaisConfiaveisCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Animais com peso desatualizado:</span>
                    <span className="font-semibold text-foreground">{homeIndicators.pesoConfiavel.animaisDesatualizadosCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Animais sem nenhuma pesagem:</span>
                    <span className="font-semibold text-foreground">{homeIndicators.pesoConfiavel.animaisSemPesagemCount}</span>
                  </div>
                </div>

                {homeIndicators.pesoConfiavel.lotesBaixaCobertura.length > 0 && (
                  <div className="space-y-1 border-t border-border/40 pt-2 mt-1">
                    <p className="text-[11px] font-semibold text-muted-foreground">Lotes com baixa cobertura (&lt;80%):</p>
                    <div className="space-y-0.5 text-[11px] text-muted-foreground">
                      {homeIndicators.pesoConfiavel.lotesBaixaCobertura.slice(0, 3).map(l => (
                        <div key={l.loteId} className="flex justify-between">
                          <span className="truncate max-w-[120px]">{l.nome}</span>
                          <span className="text-destructive font-medium">{l.percentage}% cob.</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div className="border-b pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
          Sinais e Alertas Auxiliares
        </h3>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <InsightSectionCard card={viewModel.agendaNeeds.overdue} />
        <InsightSectionCard card={viewModel.agendaNeeds.dueToday} />
        <InsightSectionCard card={viewModel.agendaNeeds.allOpen} />
        <InsightSectionCard card={viewModel.sanitarySupplyNeeds} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <InsightSectionCard card={viewModel.herdStageSummary} />
        <InsightSectionCard card={viewModel.monthlyOperationalKpis} />
        <SignalsCard viewModel={viewModel} />
      </div>
    </section>
  );
}
