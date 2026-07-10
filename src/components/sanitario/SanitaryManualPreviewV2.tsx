import { useState } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  ChevronDown,
  ClipboardList,
  HelpCircle,
  ShieldAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SanitaryManualAgendaConfirmV2,
  type SanitaryManualAgendaTargetV2,
} from "@/components/sanitario/SanitaryManualAgendaConfirmV2";
import type {
  CreateManualSanitaryAgendaInputV2,
  ManualSanitaryAgendaResultV2,
} from "@/lib/sanitario/agenda/sanitaryManualAgendaV2";
import type {
  SanitaryProtocolPrecheckResultV2,
  SanitaryProtocolPrecheckV2,
} from "@/lib/sanitario/checks/sanitaryProtocolPrecheckV2";
import { formatSanitaryPrecheckStatusV2 } from "@/lib/sanitario/checks/sanitaryPrecheckPresentationV2";
import { cn } from "@/lib/utils";

type PreviewSectionKey =
  | "candidates"
  | "overdue"
  | "pending"
  | "blocked"
  | "notApplicable";

type PreviewSection = {
  key: PreviewSectionKey;
  title: string;
  description: string;
  emptyLabel: string;
  icon: typeof ClipboardList;
  items: SanitaryProtocolPrecheckResultV2[];
};

export type SanitaryManualPreviewV2Props = {
  precheck: SanitaryProtocolPrecheckV2 | null;
  manualAgendaTarget?: SanitaryManualAgendaTargetV2;
  createAgenda?: (
    input: CreateManualSanitaryAgendaInputV2,
  ) => Promise<ManualSanitaryAgendaResultV2>;
  clientOpIdFactory?: () => string;
  className?: string;
};

function isCandidate(result: SanitaryProtocolPrecheckResultV2) {
  return (
    result.status === "in_action_window" ||
    result.status === "near_deadline" ||
    result.status === "eligible_soon"
  );
}

function getSectionKey(result: SanitaryProtocolPrecheckResultV2): PreviewSectionKey {
  if (result.blockers.length > 0) return "blocked";
  if (result.status === "overdue") return "overdue";
  if (result.status === "insufficient_data") return "pending";
  if (isCandidate(result)) return "candidates";
  return "notApplicable";
}

function buildSections(results: SanitaryProtocolPrecheckResultV2[]): PreviewSection[] {
  const grouped = results.reduce<Record<PreviewSectionKey, SanitaryProtocolPrecheckResultV2[]>>(
    (acc, result) => {
      const sectionKey = getSectionKey(result);
      acc[sectionKey] = [...acc[sectionKey], result];
      return acc;
    },
    {
      candidates: [],
      overdue: [],
      pending: [],
      blocked: [],
      notApplicable: [],
    },
  );

  return [
    {
      key: "candidates",
      title: "Candidatas",
      description: "Itens em janela ou próximos para avaliação manual.",
      emptyLabel: "Nenhuma candidata no momento.",
      icon: ClipboardList,
      items: grouped.candidates,
    },
    {
      key: "overdue",
      title: "Atrasadas",
      description: "Itens fora do prazo para revisão manual prioritária.",
      emptyLabel: "Nenhum item atrasado.",
      icon: AlertTriangle,
      items: grouped.overdue,
    },
    {
      key: "pending",
      title: "Pendências de dados",
      description: "Itens que precisam de dado explícito antes de qualquer decisão.",
      emptyLabel: "Nenhuma pendência de dados.",
      icon: HelpCircle,
      items: grouped.pending,
    },
    {
      key: "blocked",
      title: "Bloqueadas",
      description: "Itens bloqueados pelo catálogo ou por limitação técnica.",
      emptyLabel: "Nenhum bloqueio informado.",
      icon: ShieldAlert,
      items: grouped.blocked,
    },
    {
      key: "notApplicable",
      title: "Não aplicáveis",
      description: "Itens fora do alvo informado.",
      emptyLabel: "Nenhum item não aplicável.",
      icon: AlertTriangle,
      items: grouped.notApplicable,
    },
  ];
}

function buildProtocolGroups(results: SanitaryProtocolPrecheckResultV2[]) {
  const groups = new Map<string, SanitaryProtocolPrecheckResultV2[]>();
  for (const result of results) {
    const key = result.protocolName;
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }
  return Array.from(groups.entries()).sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

function getMainText(result: SanitaryProtocolPrecheckResultV2) {
  return (
    result.blockers[0] ??
    result.reasons[0] ??
    result.warnings[0] ??
    "Sem motivo resumido informado."
  );
}

function getVisibleWarnings(result: SanitaryProtocolPrecheckResultV2) {
  const mainText = getMainText(result);
  return result.warnings.filter((warning) => warning !== mainText).slice(0, 2);
}

function canPlanManualAgenda(item: SanitaryProtocolPrecheckResultV2) {
  return (
    item.blockers.length === 0 &&
    !item.missingExecutedHistory &&
    (isCandidate(item) || item.status === "overdue")
  );
}

function PreviewResultCard({
  item,
  canPlanAgenda,
  onPlanAgenda,
}: {
  item: SanitaryProtocolPrecheckResultV2;
  canPlanAgenda: boolean;
  onPlanAgenda: (item: SanitaryProtocolPrecheckResultV2) => void;
}) {
  const [planningExpanded, setPlanningExpanded] = useState(false);
  const mainText = getMainText(item);
  const visibleWarnings = getVisibleWarnings(item);

  return (
    <article
      key={`${item.protocolId}:${item.itemKey}`}
      className="rounded-md border border-border/70 p-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{item.itemLabel}</p>
          <p className="mt-1 text-xs text-muted-foreground">{mainText}</p>
        </div>
        <Badge variant="outline">
          {formatSanitaryPrecheckStatusV2(item.status)}
        </Badge>
      </div>

      {visibleWarnings.length > 0 ? (
        <div className="mt-2 grid gap-1">
          {visibleWarnings.map((warning) => (
            <p
              key={warning}
              className="rounded-md bg-muted/30 p-2 text-xs text-muted-foreground"
            >
              {warning}
            </p>
          ))}
        </div>
      ) : null}

      {canPlanAgenda ? (
        <div className="mt-2 text-xs">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-expanded={planningExpanded}
            onClick={() => setPlanningExpanded((current) => !current)}
          >
            <ChevronDown className="h-4 w-4" />
            Ver opções de planejamento
          </Button>
          {planningExpanded ? (
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onPlanAgenda(item)}
              >
                <CalendarPlus className="h-4 w-4" />
                Planejar agenda
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function targetLabel(scope: SanitaryProtocolPrecheckV2["scope"]) {
  return scope === "lote" ? "Lote" : "Animal";
}

export function SanitaryManualPreviewV2({
  precheck,
  manualAgendaTarget,
  createAgenda,
  clientOpIdFactory,
  className,
}: SanitaryManualPreviewV2Props) {
  const [selectedItem, setSelectedItem] =
    useState<SanitaryProtocolPrecheckResultV2 | null>(null);

  if (!precheck || precheck.results.length === 0) return null;

  const sections = buildSections(precheck.results);
  const canCreateManualAgenda = Boolean(manualAgendaTarget?.fazendaId);

  return (
    <>
      <Card className={cn("border-border/70 bg-muted/10 shadow-none", className)}>
        <CardHeader className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-primary" />
                Preview manual sanitário
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Proposta visual para revisão manual. Não cria agenda, evento,
                estoque, carência ativa ou liberação operacional.
              </p>
            </div>
            <Badge variant="outline">{targetLabel(precheck.scope)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          {sections.map((section) => {
            const Icon = section.icon;
            const protocolGroups = buildProtocolGroups(section.items);
            const collapsedByDefault =
              precheck.scope === "lote" &&
              (section.key === "blocked" || section.key === "notApplicable");

            return (
              <details
                key={section.key}
                open={collapsedByDefault ? undefined : true}
                className="rounded-lg border border-border/70 bg-background p-3"
                aria-label={section.title}
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Icon className="h-4 w-4 text-primary" />
                      {section.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                  <Badge variant="secondary">{section.items.length}</Badge>
                </summary>

                <div className="mt-3">
                  {protocolGroups.length === 0 ? (
                    <p className="rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">
                      {section.emptyLabel}
                    </p>
                  ) : (
                    <div className="grid gap-3">
                      {protocolGroups.map(([protocolName, items]) => (
                        <div key={protocolName} className="grid gap-2">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">
                            {protocolName}
                          </p>
                          {items.map((item) => (
                            <PreviewResultCard
                              key={`${item.protocolId}:${item.itemKey}`}
                              item={item}
                              canPlanAgenda={
                                canCreateManualAgenda && canPlanManualAgenda(item)
                              }
                              onPlanAgenda={setSelectedItem}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </CardContent>
      </Card>

      {manualAgendaTarget ? (
        <SanitaryManualAgendaConfirmV2
          open={Boolean(selectedItem)}
          onOpenChange={(open) => {
            if (!open) setSelectedItem(null);
          }}
          precheck={precheck}
          item={selectedItem}
          target={manualAgendaTarget}
          createAgenda={createAgenda}
          clientOpIdFactory={clientOpIdFactory}
        />
      ) : null}
    </>
  );
}
