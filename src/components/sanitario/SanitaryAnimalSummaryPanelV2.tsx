import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, ClipboardCheck, ShieldCheck } from "lucide-react";

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
  precheckSanitaryProtocolsForAnimalV2,
  type SanitaryExecutedHistoryEventV2,
  type SanitaryExecutedHistoryV2,
  type SanitaryPrecheckAnimalResumoV2,
  type SanitaryProtocolPrecheckResultV2,
} from "@/lib/sanitario/checks/sanitaryProtocolPrecheckV2";
import { formatSanitaryPrecheckStatusV2 } from "@/lib/sanitario/checks/sanitaryPrecheckPresentationV2";
import type { SanitaryProtocolCatalogReadModelV2 } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import { formatSanitaryProtocolItemLabelV2 } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import { cn } from "@/lib/utils";

type SanitaryAnimalFutureAgendaV2 = {
  id: string;
  label: string;
  dateLabel: string;
  detailLabel?: string | null;
};

export type SanitaryAnimalSummaryPanelV2Props = {
  animal: SanitaryPrecheckAnimalResumoV2 | null;
  animalId: string;
  lotId?: string | null;
  catalog: SanitaryProtocolCatalogReadModelV2 | null | undefined;
  executedHistory?: SanitaryExecutedHistoryV2[];
  externalDocumentedHistory: SanitaryExecutedHistoryEventV2[];
  declaredHistory: SanitaryExecutedHistoryEventV2[];
  futureAgenda: SanitaryAnimalFutureAgendaV2[];
  isLoading?: boolean;
  today?: string;
  onRegisterEntryHistory: () => void;
  className?: string;
};

const STATUS_PRIORITY: Record<string, number> = {
  documentary: 4,
  overdue: 3,
  insufficient_data: 2,
};

function hasLocalCatalog(catalog: SanitaryProtocolCatalogReadModelV2 | null | undefined) {
  return Boolean(catalog && catalog.protocols.length > 0 && catalog.items.length > 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
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
        (result.status === "insufficient_data" && result.status !== "not_applicable"),
    )
    .map((result) => ({
      result,
      priority: result.documentaryPending
        ? STATUS_PRIORITY.documentary
        : result.status === "overdue"
          ? STATUS_PRIORITY.overdue
          : STATUS_PRIORITY.insufficient_data,
    }))
    .sort((left, right) => {
      const priorityDiff = right.priority - left.priority;
      if (priorityDiff !== 0) return priorityDiff;
      return left.result.protocolName.localeCompare(right.result.protocolName, "pt-BR");
    })
    .slice(0, 3)
    .map(({ result }) => result);
}

function HistoryList({
  title,
  emptyLabel,
  events,
  declared = false,
}: {
  title: string;
  emptyLabel: string;
  events: SanitaryExecutedHistoryEventV2[];
  declared?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
      <p className="text-sm font-semibold">{title}</p>
      {events.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {events.slice(0, 3).map((event) => (
            <div key={event.eventId} className="text-sm">
              <p className="font-medium">
                {event.itemKey
                  ? formatSanitaryProtocolItemLabelV2(event.itemKey)
                  : "Item sanitário"}
              </p>
              <p className="text-muted-foreground">
                {declared
                  ? "Declaração sem documento pode não liberar pendências críticas."
                  : `${formatDate(event.executedAt)}${event.dateApproximate ? " · data aproximada" : ""}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExecutedHistoryList({ events }: { events: SanitaryExecutedHistoryEventV2[] }) {
  return (
    <div className="space-y-3">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum evento sanitário executado para este animal.
        </p>
      ) : (
        events.slice(0, 5).map((event) => (
          <div key={event.eventId} className="rounded-lg border border-border/70 bg-muted/10 p-3">
            <p className="font-medium">
              {event.itemKey
                ? formatSanitaryProtocolItemLabelV2(event.itemKey)
                : "Item sanitário"}
            </p>
            <p className="text-sm text-muted-foreground">
              {formatDate(event.executedAt)}
              {event.productName ? ` · ${event.productName}` : ""}
              {event.doseQuantity && event.doseUnit ? ` · ${event.doseQuantity} ${event.doseUnit}` : ""}
              {event.route ? ` · ${event.route}` : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              {event.responsibleName ?? "Responsável não informado"} · origem: {event.originLabel ?? "evento sanitário"} · estoque: {event.stockStatus === "with_movement" ? "com baixa" : "sem baixa"} · carência: {event.withdrawalStatus === "generated" ? "gerada" : event.withdrawalStatus === "without_rule" ? "sem regra" : "não aplicável"}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

export function SanitaryAnimalSummaryPanelV2({
  animal,
  animalId,
  lotId,
  catalog,
  executedHistory,
  externalDocumentedHistory,
  declaredHistory,
  futureAgenda,
  isLoading = false,
  today = new Date().toISOString().slice(0, 10),
  onRegisterEntryHistory,
  className,
}: SanitaryAnimalSummaryPanelV2Props) {
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const precheck = useMemo(() => {
    if (!animal || !catalog || !hasLocalCatalog(catalog)) return null;
    return precheckSanitaryProtocolsForAnimalV2({
      scope: "animal",
      animal,
      catalog,
      executedHistory,
      today,
    });
  }, [animal, catalog, executedHistory, today]);
  const results = precheck?.results ?? [];
  const summary = {
    inWindow: results.filter(isActionWindow).length,
    overdue: results.filter((result) => result.status === "overdue").length,
    documentary: results.filter((result) => result.documentaryPending).length,
    insufficient: results.filter((result) => result.status === "insufficient_data").length,
    futureAgenda: futureAgenda.length,
  };
  const mainPendencies = buildMainPendencies(results);
  const executedEvents = (executedHistory ?? [])
    .find((entry) => entry.animalId === animalId)
    ?.events ?? [];
  const centralHref = `/protocolos-sanitarios?tab=janelas&animalId=${encodeURIComponent(animalId)}${
    lotId ? `&loteId=${encodeURIComponent(lotId)}` : ""
  }`;

  return (
    <div className={cn("space-y-4", className)}>
      <Card className="shadow-none">
        <CardHeader className="space-y-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Histórico sanitário executado
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Eventos factuais confirmados. Agenda futura não aparece nesta lista.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <ExecutedHistoryList events={executedEvents} />
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Resumo sanitário
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Visão contextual do animal. Planejamento completo fica na Central Sanitária.
              </p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link to={centralHref}>Abrir Central Sanitária filtrada para este animal</Link>
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
          {!isLoading && !hasLocalCatalog(catalog) ? (
            <p className="text-sm text-muted-foreground">
              Catálogo sanitário local ainda não sincronizado.
            </p>
          ) : null}
          {!isLoading && hasLocalCatalog(catalog) && mainPendencies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma pendência crítica resumida para este animal.
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
                <ClipboardCheck className="h-4 w-4 text-primary" />
                Histórico de entrada
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Histórico anterior não é execução local e não movimenta estoque.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={onRegisterEntryHistory}>
              Registrar histórico anterior
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <HistoryList
            title="Histórico externo documentado"
            emptyLabel="Nenhum histórico externo documentado registrado."
            events={externalDocumentedHistory}
          />
          <HistoryList
            title="Declarações"
            emptyLabel="Nenhuma declaração sanitária registrada."
            events={declaredHistory}
            declared
          />
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
          {futureAgenda.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma agenda sanitária futura para este animal.
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
                animal={animal}
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
