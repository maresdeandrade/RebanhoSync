import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CircleSlash,
  Layers,
  Signal,
  Syringe,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  OperationalInsightCard,
  OperationalInsightsViewModel,
  OperationalSignal,
} from "@/features/operationalInsights/operationalInsightsAdapter";

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

function getCardTone(status: string): InsightCardTone {
  switch (status) {
    case "blocked":
      return "danger";
    case "partial":
      return "warning";
    case "empty":
      return "default";
    case "complete":
      return "success";
    default:
      return "default";
  }
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

function InsightSectionCard({ card }: { card: OperationalInsightCard<unknown> }) {
  const insight = card.insight;
  const summary = summarizeCard(card);
  const limitations = insight.source.limitations;

  return (
    <Card className={`shadow-none ${cardToneStyles[getCardTone(insight.resultStatus)]}`}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardDescription>{card.title}</CardDescription>
            <CardTitle className="text-2xl">{summary.value}</CardTitle>
          </div>
          <div className="text-muted-foreground">{getCardIcon(card)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={getStatusTone(insight.resultStatus)}>
            {getStatusLabel(insight.resultStatus)}
          </StatusBadge>
          <StatusBadge tone="neutral">
            {insight.source.primarySource ?? "sem fonte primaria"}
          </StatusBadge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{summary.detail}</p>

        {insight.answerability === "blocked" ? (
          <div className="rounded-md border border-destructive/15 bg-destructive/5 p-3 text-sm text-destructive">
            {insight.source.block.reason}
            {insight.source.block.requiredSources.length > 0 ? (
              <p className="mt-1 text-xs">
                Fonte requerida: {insight.source.block.requiredSources.join(", ")}
              </p>
            ) : null}
          </div>
        ) : insight.resultStatus === "partial" && insight.partialReason ? (
          <div className="rounded-md border border-warning/20 bg-warning-muted/55 p-3 text-sm text-warning">
            {insight.partialReason}
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

        {limitations.length > 0 ? (
          <div className="space-y-1 border-t border-border/70 pt-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Limitacoes
            </p>
            <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
              {limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SignalRow({ signal }: { signal: OperationalSignal }) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/35 p-3">
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
        Fonte {signal.primarySource}; sinal auxiliar nao persistido.
      </p>
    </div>
  );
}

function SignalsCard({ viewModel }: { viewModel: OperationalInsightsViewModel }) {
  const { tagSignals } = viewModel;

  return (
    <Card className={`shadow-none ${cardToneStyles[getCardTone(tagSignals.resultStatus)]}`}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardDescription>{tagSignals.title}</CardDescription>
            <CardTitle className="text-2xl">{tagSignals.signals.length}</CardTitle>
          </div>
          <div className="text-muted-foreground">
            <Signal className="h-4 w-4" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={getStatusTone(tagSignals.resultStatus)}>
            {getStatusLabel(tagSignals.resultStatus)}
          </StatusBadge>
          {tagSignals.skippedBlockedInsightIds.length > 0 ? (
            <StatusBadge tone="warning">
              {tagSignals.skippedBlockedInsightIds.length} bloqueado(s)
            </StatusBadge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {tagSignals.signals.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
            Nenhum sinal auxiliar emitido pelas fontes carregadas.
          </div>
        ) : (
          tagSignals.signals.map((signal) => (
            <SignalRow key={`${signal.code}:${signal.sourceInsightQuestion}`} signal={signal} />
          ))
        )}

        {tagSignals.limitations.length > 0 ? (
          <div className="space-y-1 border-t border-border/70 pt-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Limitacoes
            </p>
            <ul className="space-y-1 text-xs leading-5 text-muted-foreground">
              {tagSignals.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function OperationalInsightsPanel({
  viewModel,
}: {
  viewModel: OperationalInsightsViewModel;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Central Operacional
          </p>
          <h2 className="text-xl font-semibold tracking-normal">
            Leitura passiva da operacao
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="neutral">Referencia {viewModel.referenceDate}</StatusBadge>
          <StatusBadge tone="neutral">Mes {viewModel.monthlyPeriod.start.slice(0, 7)}</StatusBadge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <InsightSectionCard card={viewModel.agendaNeeds.allOpen} />
        <InsightSectionCard card={viewModel.agendaNeeds.dueToday} />
        <InsightSectionCard card={viewModel.agendaNeeds.overdue} />
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
