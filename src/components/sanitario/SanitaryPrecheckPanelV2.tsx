import { Link } from "react-router-dom";
import { AlertTriangle, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SanitaryManualPreviewV2 } from "@/components/sanitario/SanitaryManualPreviewV2";
import type { SanitaryEligibilityStatus } from "@/lib/sanitario/eligibility/sanitaryEligibility";
import {
  precheckSanitaryProtocolsForAnimalV2,
  precheckSanitaryProtocolsForLotV2,
  type SanitaryPrecheckAnimalResumoV2,
  type SanitaryPrecheckLoteResumoV2,
  type SanitaryProtocolPrecheckResultV2,
} from "@/lib/sanitario/checks/sanitaryProtocolPrecheckV2";
import { formatSanitaryPrecheckStatusV2 } from "@/lib/sanitario/checks/sanitaryPrecheckPresentationV2";
import type { SanitaryProtocolCatalogReadModelV2 } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<SanitaryEligibilityStatus, string> = {
  not_applicable: "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
  insufficient_data: "border-amber-200 bg-amber-50 text-amber-900",
  not_yet_eligible: "border-sky-200 bg-sky-50 text-sky-900",
  eligible_soon: "border-sky-200 bg-sky-50 text-sky-900",
  in_action_window: "border-blue-200 bg-blue-50 text-blue-900",
  near_deadline: "border-amber-200 bg-amber-50 text-amber-900",
  overdue: "border-rose-200 bg-rose-50 text-rose-900",
  completed: "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
};

const STATUS_ORDER: Record<SanitaryEligibilityStatus, number> = {
  overdue: 8,
  near_deadline: 7,
  in_action_window: 6,
  eligible_soon: 5,
  insufficient_data: 4,
  not_yet_eligible: 3,
  completed: 2,
  not_applicable: 1,
};

export type SanitaryPrecheckPanelV2Props = {
  scope?: "animal";
  animal: SanitaryPrecheckAnimalResumoV2 | null;
  catalog: SanitaryProtocolCatalogReadModelV2 | null | undefined;
  isLoading?: boolean;
  today?: string;
  className?: string;
} | {
  scope: "lote";
  lote: SanitaryPrecheckLoteResumoV2 | null;
  animals?: SanitaryPrecheckAnimalResumoV2[] | null;
  catalog: SanitaryProtocolCatalogReadModelV2 | null | undefined;
  isLoading?: boolean;
  today?: string;
  className?: string;
};

function hasLocalCatalog(catalog: SanitaryProtocolCatalogReadModelV2) {
  return catalog.protocols.length > 0 && catalog.items.length > 0;
}

function getPrimaryReason(result: SanitaryProtocolPrecheckResultV2) {
  return (
    result.blockers[0] ??
    result.reasons[0] ??
    result.warnings[0] ??
    "Sem motivo resumido informado."
  );
}

function sortResults(results: SanitaryProtocolPrecheckResultV2[]) {
  return [...results].sort((left, right) => {
    const statusDiff = STATUS_ORDER[right.status] - STATUS_ORDER[left.status];
    if (statusDiff !== 0) return statusDiff;
    return left.protocolName.localeCompare(right.protocolName);
  });
}

function statusBadgeClass(status: SanitaryEligibilityStatus) {
  return cn("w-fit border font-semibold", STATUS_STYLES[status]);
}

export function SanitaryPrecheckPanelV2({
  scope = "animal",
  catalog,
  isLoading = false,
  today = new Date().toISOString().slice(0, 10),
  className,
  ...props
}: SanitaryPrecheckPanelV2Props) {
  const animal = scope === "animal" ? props.animal : null;
  const lote = scope === "lote" ? props.lote : null;
  const lotAnimals = scope === "lote" ? props.animals : null;
  const precheck =
    catalog && hasLocalCatalog(catalog)
      ? scope === "lote" && lote && lotAnimals && lotAnimals.length > 0
        ? precheckSanitaryProtocolsForLotV2({
            scope: "lote",
            lote,
            animals: lotAnimals,
            catalog,
            today,
          })
        : scope === "animal" && animal
          ? precheckSanitaryProtocolsForAnimalV2({
              scope: "animal",
              animal,
              catalog,
              today,
            })
          : null
      : null;
  const results = precheck ? sortResults(precheck.results) : [];

  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader className="space-y-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Pré-checagem sanitária
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Consulta baseada no catálogo sanitário v2 local. Não cria agenda
              nem evento.
            </p>
          </div>
          <Badge variant="outline">Somente leitura</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
            Carregando catálogo sanitário local...
          </div>
        ) : null}

        {!isLoading && scope === "animal" && !animal ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Dados insuficientes</p>
            <p className="mt-1">Animal indisponível para pré-checagem.</p>
          </div>
        ) : null}

        {!isLoading &&
        scope === "lote" &&
        (!lote || !lotAnimals || lotAnimals.length === 0) ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Dados insuficientes</p>
            <p className="mt-1">Dados insuficientes para avaliar o lote.</p>
          </div>
        ) : null}

        {!isLoading &&
        ((scope === "animal" && animal) || (scope === "lote" && lote)) &&
        catalog &&
        !hasLocalCatalog(catalog) ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">
              Catálogo sanitário local ainda não sincronizado
            </p>
            <p className="mt-1">
              Sincronize o catálogo antes de consultar a pré-checagem.
            </p>
            <Link
              to="/protocolos-sanitarios/catalogo-v2"
              className="mt-3 inline-flex text-sm font-semibold underline-offset-4 hover:underline"
            >
              Ver catálogo sanitário v2
            </Link>
          </div>
        ) : null}

        {!isLoading && results.length > 0 ? (
          <SanitaryManualPreviewV2
            precheck={precheck}
            manualAgendaTarget={
              scope === "lote" && lote
                ? {
                    fazendaId: lote.fazendaId,
                    animalIds: lotAnimals?.map((entry) => entry.id),
                  }
                : animal
                  ? { fazendaId: animal.fazendaId, animalIds: [animal.id] }
                  : undefined
            }
          />
        ) : null}

        {!isLoading && results.length > 0 ? (
          <div className="grid gap-3">
            {results.map((result) => (
              <article
                key={`${result.protocolId}:${result.itemKey}`}
                className="rounded-lg border border-border/70 bg-background p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      {result.protocolName} · {result.itemLabel}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getPrimaryReason(result)}
                    </p>
                  </div>
                  <Badge className={statusBadgeClass(result.status)}>
                    {formatSanitaryPrecheckStatusV2(result.status)}
                  </Badge>
                </div>

                {result.blockers.length > 0 || result.warnings.length > 0 ? (
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                    {result.blockers.slice(0, 2).map((blocker) => (
                      <p
                        key={blocker}
                        className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-900"
                      >
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{blocker}</span>
                      </p>
                    ))}
                    {result.warnings.slice(0, 2).map((warning) => (
                      <p
                        key={warning}
                        className="rounded-md border border-border/70 bg-muted/20 p-2"
                      >
                        {warning}
                      </p>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        {!isLoading && precheck && results.length === 0 ? (
          <div className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
            Nenhum item do catálogo local aplicável à pré-checagem deste
            {scope === "lote" ? " lote." : " animal."}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
