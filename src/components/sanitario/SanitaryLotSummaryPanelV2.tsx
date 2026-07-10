import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, ShieldCheck } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SanitaryPrecheckPanelV2 } from "@/components/sanitario/SanitaryPrecheckPanelV2";
import {
  precheckSanitaryProtocolsForLotV2,
  type SanitaryExecutedHistoryV2,
  type SanitaryPrecheckAnimalResumoV2,
  type SanitaryPrecheckLoteResumoV2,
  type SanitaryProtocolPrecheckResultV2,
} from "@/lib/sanitario/checks/sanitaryProtocolPrecheckV2";
import { formatSanitaryPrecheckStatusV2 } from "@/lib/sanitario/checks/sanitaryPrecheckPresentationV2";
import type { SanitaryProtocolCatalogReadModelV2 } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import { cn } from "@/lib/utils";

type SanitaryLotFutureAgendaV2 = {
  id: string;
  label: string;
  dateLabel: string;
  detailLabel?: string | null;
};

export type SanitaryLotSummaryPanelV2Props = {
  lote: SanitaryPrecheckLoteResumoV2 | null;
  loteId: string;
  loteLabel: string;
  animals?: SanitaryPrecheckAnimalResumoV2[] | null;
  catalog: SanitaryProtocolCatalogReadModelV2 | null | undefined;
  executedHistory?: SanitaryExecutedHistoryV2[];
  futureAgenda: SanitaryLotFutureAgendaV2[];
  isLoading?: boolean;
  today?: string;
  className?: string;
};

const PENDENCY_PRIORITY: Record<string, number> = {
  documentary: 5,
  overdue: 4,
  partial_history: 3,
  insufficient_data: 2,
};

function hasLocalCatalog(catalog: SanitaryProtocolCatalogReadModelV2 | null | undefined) {
  return Boolean(catalog && catalog.protocols.length > 0 && catalog.items.length > 0);
}

function isActionWindow(result: SanitaryProtocolPrecheckResultV2) {
  return (
    result.status === "in_action_window" ||
    result.status === "near_deadline" ||
    result.status === "eligible_soon"
  );
}

function primaryReason(result: SanitaryProtocolPrecheckResultV2) {
  return (
    result.documentaryPendingReasons[0] ??
    result.reasons[0] ??
    result.blockers[0] ??
    result.warnings[0] ??
    "Sem motivo resumido informado."
  );
}

function buildMainPendencies(results: SanitaryProtocolPrecheckResultV2[]) {
  return results
    .filter(
      (result) =>
        result.documentaryPending ||
        result.status === "overdue" ||
        result.missingExecutedHistory ||
        result.status === "insufficient_data",
    )
    .map((result) => ({
      result,
      priority: result.documentaryPending
        ? PENDENCY_PRIORITY.documentary
        : result.status === "overdue"
          ? PENDENCY_PRIORITY.overdue
          : result.missingExecutedHistory
            ? PENDENCY_PRIORITY.partial_history
            : PENDENCY_PRIORITY.insufficient_data,
    }))
    .sort((left, right) => {
      const priorityDiff = right.priority - left.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return left.result.protocolName.localeCompare(right.result.protocolName, "pt-BR");
    })
    .slice(0, 5)
    .map(({ result }) => result);
}

export function SanitaryLotSummaryPanelV2({
  lote,
  loteId,
  loteLabel,
  animals,
  catalog,
  executedHistory,
  futureAgenda,
  isLoading = false,
  today = new Date().toISOString().slice(0, 10),
  className,
}: SanitaryLotSummaryPanelV2Props) {
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const precheck = useMemo(() => {
    if (!lote || !animals?.length || !catalog || !hasLocalCatalog(catalog)) return null;
    return precheckSanitaryProtocolsForLotV2({
      scope: "lote",
      lote,
      animals,
      catalog,
      executedHistory,
      today,
    });
  }, [animals, catalog, executedHistory, lote, today]);
  const results = precheck?.results ?? [];
  const summary = {
    inWindow: results.filter(isActionWindow).length,
    overdue: results.filter((result) => result.status === "overdue").length,
    documentary: results.filter((result) => result.documentaryPending).length,
    insufficient: results.filter((result) => result.status === "insufficient_data").length,
    futureAgenda: futureAgenda.length,
  };
  const mainPendencies = buildMainPendencies(results);
  const centralHref = `/protocolos-sanitarios?tab=janelas&loteId=${encodeURIComponent(loteId)}`;

  return (
    <div className={cn("space-y-4", className)}>
      <Card className="shadow-none">
        <CardHeader className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Resumo sanitário do lote
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Visão contextual de {loteLabel}. Planejamento completo fica na Central Sanitária.
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link to={centralHref}>Abrir Central Sanitária filtrada para este lote</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-5">
          {[
            ["Em janela", summary.inWindow],
            ["Atrasadas", summary.overdue],
            ["Pendências documentais", summary.documentary],
            ["Dados insuficientes", summary.insufficient],
            ["Agenda futura", summary.futureAgenda],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border/70 bg-muted/10 p-3">
              <p className="text-xs uppercase text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Pendências principais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando sanidade local...</p>
          ) : null}
          {!isLoading && !animals?.length ? (
            <p className="text-sm text-muted-foreground">Lote sem animais para avaliar.</p>
          ) : null}
          {!isLoading && animals?.length && !hasLocalCatalog(catalog) ? (
            <p className="text-sm text-muted-foreground">
              Catálogo sanitário local ainda não sincronizado.
            </p>
          ) : null}
          {!isLoading && hasLocalCatalog(catalog) && mainPendencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma pendência crítica resumida para este lote.
            </p>
          ) : null}
          {mainPendencies.map((result) => (
            <div
              key={`${result.protocolId}:${result.itemKey}`}
              className="rounded-lg border border-border/70 bg-background p-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium">
                    {result.protocolName} · {result.itemLabel}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {primaryReason(result)}
                  </p>
                </div>
                <Badge variant={result.documentaryPending ? "default" : "secondary"}>
                  {result.documentaryPending
                    ? "Pendência documental"
                    : result.missingExecutedHistory
                      ? "Histórico parcial"
                      : formatSanitaryPrecheckStatusV2(result.status)}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-primary" />
                Agenda futura
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Agenda é intenção futura; não comprova execução.
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link to={centralHref}>Abrir Central</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {futureAgenda.length} agenda(s) sanitária(s) futura(s) neste contexto.
          </p>
          {futureAgenda.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma agenda sanitária futura para este lote.
            </p>
          ) : (
            futureAgenda.slice(0, 3).map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-border/70 bg-muted/10 p-3"
              >
                <p className="font-medium">{entry.label}</p>
                <p className="text-sm text-muted-foreground">
                  {entry.dateLabel}
                  {entry.detailLabel ? ` · ${entry.detailLabel}` : ""}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Accordion
        type="single"
        collapsible
        value={technicalOpen ? "technical" : ""}
        onValueChange={(value) => setTechnicalOpen(value === "technical")}
        className="rounded-lg border border-border/70 px-4"
      >
        <AccordionItem value="technical" className="border-0">
          <AccordionTrigger>Ver detalhes técnicos da pré-checagem</AccordionTrigger>
          <AccordionContent>
            {technicalOpen ? (
              <SanitaryPrecheckPanelV2
                scope="lote"
                lote={lote}
                animals={animals}
                catalog={catalog}
                executedHistory={executedHistory}
                isLoading={isLoading}
                today={today}
              />
            ) : null}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
