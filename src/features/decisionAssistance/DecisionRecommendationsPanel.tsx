import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DecisionRecommendation } from "@/lib/insights/decisionRecommendations";

type Props = {
  recommendations?: readonly DecisionRecommendation<unknown>[];
};

const STATUS_PRESENTATION = {
  confirmed: { label: "Evidencia completa", tone: "success" as const },
  partial: { label: "Evidencia parcial", tone: "warning" as const },
  unknown: { label: "Evidencia desconhecida", tone: "neutral" as const },
  ambiguous: { label: "Evidencia conflitante", tone: "danger" as const },
  not_permitted: { label: "Conclusao nao permitida", tone: "danger" as const },
};

function getSummary(recommendation: DecisionRecommendation<unknown>): string {
  const data = recommendation.data;
  if (data && typeof data === "object" && "summary" in data) {
    const summary = (data as { summary?: unknown }).summary;
    if (typeof summary === "string") return summary;
  }
  return recommendation.statusReason;
}

export function DecisionRecommendationsPanel({ recommendations = [] }: Props) {
  return (
    <section className="space-y-4" aria-labelledby="decision-assistance-title">
      <div className="space-y-1 border-b pb-3">
        <h2 id="decision-assistance-title" className="text-lg font-semibold">
          Decisao assistida
        </h2>
        <p className="text-sm text-muted-foreground">
          Recomendacoes derivadas e explicaveis. Nao sao fatos, autorizacoes ou
          execucoes.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {recommendations.map((recommendation) => {
          const presentation = STATUS_PRESENTATION[recommendation.status];
          const sourceNames = recommendation.evidence.primarySources
            .map((source) => source.name)
            .join(" + ");
          const convergence = recommendation.evidence.convergence
            .map((entry) => `${entry.source}: ${entry.mode}`)
            .join("; ");
          const fieldsPresent = Array.from(
            new Set(
              recommendation.evidence.primarySources.flatMap(
                (source) => source.fieldsPresent,
              ),
            ),
          );
          const fieldsMissing = Array.from(
            new Set(
              recommendation.evidence.primarySources.flatMap(
                (source) => source.fieldsMissing,
              ),
            ),
          );

          return (
            <Card key={recommendation.id} className="shadow-none">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CardTitle className="max-w-2xl text-base leading-6">
                    {recommendation.question}
                  </CardTitle>
                  <StatusBadge tone={presentation.tone}>
                    {presentation.label}
                  </StatusBadge>
                </div>
                <p className="text-sm font-medium">
                  {getSummary(recommendation)}
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {recommendation.statusReason}
                </p>
              </CardHeader>
              <CardContent className="space-y-3 text-xs text-muted-foreground">
                <div className="rounded-md border bg-muted/20 p-3 leading-5">
                  <p>
                    <span className="font-medium text-foreground">Escopo:</span>{" "}
                    {recommendation.scope.fazendaId}
                    {recommendation.scope.entityId
                      ? ` / ${recommendation.scope.entityType}:${recommendation.scope.entityId}`
                      : ""}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Fontes:</span>{" "}
                    {sourceNames}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">
                      Convergencia:
                    </span>{" "}
                    {convergence}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Cutoff:</span>{" "}
                    {recommendation.period.cutoffAt} (
                    {recommendation.period.timezone ?? "timezone ausente"})
                  </p>
                  <p>
                    <span className="font-medium text-foreground">
                      Cobertura:
                    </span>{" "}
                    {recommendation.evidence.coverage.join(", ") ||
                      "nao demonstrada"}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">
                      Campos presentes:
                    </span>{" "}
                    {fieldsPresent.join(", ") || "nenhum comprovado"}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">
                      Campos ausentes:
                    </span>{" "}
                    {fieldsMissing.join(", ") || "nenhum no recorte"}
                  </p>
                </div>

                {recommendation.evidence.conflicts.length > 0 ? (
                  <p>
                    <span className="font-medium text-foreground">Conflitos:</span>{" "}
                    {recommendation.evidence.conflicts
                      .map((conflict) => conflict.description)
                      .join(" ")}
                  </p>
                ) : null}

                {recommendation.evidence.limitations.length > 0 ? (
                  <p>
                    <span className="font-medium text-foreground">
                      Limitacoes:
                    </span>{" "}
                    {recommendation.evidence.limitations.slice(0, 2).join(" ")}
                  </p>
                ) : null}

                <p>
                  <span className="font-medium text-foreground">
                    Nao autoriza:
                  </span>{" "}
                  {recommendation.prohibitedActions.join("; ")}.
                </p>

                {recommendation.suggestedAction ? (
                  <Button asChild variant="outline" size="sm">
                    <Link to={recommendation.suggestedAction.href}>
                      {recommendation.suggestedAction.label}
                    </Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
