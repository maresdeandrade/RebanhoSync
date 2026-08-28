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

const STATUS_PRIORITY: Record<
  DecisionRecommendation<unknown>["status"],
  number
> = {
  ambiguous: 0,
  not_permitted: 1,
  unknown: 2,
  partial: 3,
  confirmed: 4,
};

const RECOMMENDATION_GROUPS = [
  {
    id: "operational-review",
    title: "Revisao operacional",
    description: "Pendencias e evidencias que pedem revisao humana.",
    decisionIds: ["overdue_agenda_review", "weight_data_quality"],
  },
  {
    id: "coverage-and-flow",
    title: "Cobertura e fluxo",
    description: "Leituras historicas, cobertura e limites do periodo.",
    decisionIds: ["operational_history_review", "herd_flow_review"],
  },
] as const;

function getSummary(recommendation: DecisionRecommendation<unknown>): string {
  const data = recommendation.data;
  if (data && typeof data === "object" && "summary" in data) {
    const summary = (data as { summary?: unknown }).summary;
    if (typeof summary === "string") return summary;
  }
  return recommendation.statusReason;
}

function orderedRecommendations(
  recommendations: readonly DecisionRecommendation<unknown>[],
): DecisionRecommendation<unknown>[] {
  return recommendations.slice().sort((left, right) => {
    const statusDifference =
      STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status];
    return statusDifference || left.id.localeCompare(right.id);
  });
}

function uniqueValues(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

function EvidenceSourcesAndScope({
  recommendation,
}: {
  recommendation: DecisionRecommendation<unknown>;
}) {
  const primarySourceNames = recommendation.evidence.primarySources
    .map((source) => source.name)
    .join(" + ");
  const auxiliarySourceNames = uniqueValues(
    recommendation.evidence.auxiliarySources.map((source) => source.name),
  );

  return (
    <>
      <p>
        <span className="font-medium text-foreground">Escopo:</span>{" "}
        {recommendation.scope.fazendaId}
        {recommendation.scope.entityId
          ? ` / ${recommendation.scope.entityType}:${recommendation.scope.entityId}`
          : ""}
      </p>
      <p>
        <span className="font-medium text-foreground">Fontes primarias:</span>{" "}
        {primarySourceNames}
      </p>
      {auxiliarySourceNames.length > 0 ? (
        <p>
          <span className="font-medium text-foreground">
            Fontes auxiliares:
          </span>{" "}
          {auxiliarySourceNames.join(" + ")}
        </p>
      ) : null}
    </>
  );
}

function EvidenceContract({
  recommendation,
}: {
  recommendation: DecisionRecommendation<unknown>;
}) {
  const convergence = recommendation.evidence.convergence
    .map((entry) => `${entry.source}: ${entry.mode}`)
    .join("; ");
  const fieldsPresent = uniqueValues(
    recommendation.evidence.primarySources.flatMap(
      (source) => source.fieldsPresent,
    ),
  );
  const fieldsMissing = uniqueValues(
    recommendation.evidence.primarySources.flatMap(
      (source) => source.fieldsMissing,
    ),
  );

  return (
    <>
      <p>
        <span className="font-medium text-foreground">Convergencia:</span>{" "}
        {convergence}
      </p>
      <p>
        <span className="font-medium text-foreground">Cutoff:</span>{" "}
        {recommendation.period.cutoffAt} (
        {recommendation.period.timezone ?? "timezone ausente"})
      </p>
      <p>
        <span className="font-medium text-foreground">Cobertura:</span>{" "}
        {recommendation.evidence.coverage.join(", ") || "nao demonstrada"}
      </p>
      <p>
        <span className="font-medium text-foreground">Campos presentes:</span>{" "}
        {fieldsPresent.join(", ") || "nenhum comprovado"}
      </p>
      <p>
        <span className="font-medium text-foreground">Campos ausentes:</span>{" "}
        {fieldsMissing.join(", ") || "nenhum no recorte"}
      </p>
    </>
  );
}

function EvidenceNotes({
  recommendation,
}: {
  recommendation: DecisionRecommendation<unknown>;
}) {
  const visibleLimitations = recommendation.evidence.limitations.slice(0, 2);
  const additionalLimitations = recommendation.evidence.limitations.slice(2);

  return (
    <>
      {recommendation.evidence.conflicts.length > 0 ? (
        <p>
          <span className="font-medium text-foreground">Conflitos:</span>{" "}
          {recommendation.evidence.conflicts
            .map((conflict) => conflict.description)
            .join(" ")}
        </p>
      ) : null}
      {visibleLimitations.length > 0 ? (
        <p>
          <span className="font-medium text-foreground">Limitacoes:</span>{" "}
          {visibleLimitations.join(" ")}
        </p>
      ) : null}
      {additionalLimitations.length > 0 ? (
        <details>
          <summary className="cursor-pointer font-medium text-foreground">
            Outras limitacoes ({additionalLimitations.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            {additionalLimitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

function RecommendationCard({
  recommendation,
}: {
  recommendation: DecisionRecommendation<unknown>;
}) {
  const presentation = STATUS_PRESENTATION[recommendation.status];

  return (
    <Card className="shadow-none">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="max-w-2xl text-base leading-6">
            {recommendation.question}
          </CardTitle>
          <StatusBadge tone={presentation.tone}>
            {presentation.label}
          </StatusBadge>
        </div>
        <p className="text-sm font-medium">{getSummary(recommendation)}</p>
        <p className="text-xs leading-5 text-muted-foreground">
          {recommendation.statusReason}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <div className="rounded-md border bg-muted/20 p-3 leading-5">
          <EvidenceSourcesAndScope recommendation={recommendation} />
          <EvidenceContract recommendation={recommendation} />
        </div>
        <EvidenceNotes recommendation={recommendation} />
        <p>
          <span className="font-medium text-foreground">Nao autoriza:</span>{" "}
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
}

export function DecisionRecommendationsPanel({ recommendations = [] }: Props) {
  const ordered = orderedRecommendations(recommendations);
  const knownDecisionIds = new Set<string>(
    RECOMMENDATION_GROUPS.flatMap((group) => group.decisionIds),
  );
  const groups = [
    ...RECOMMENDATION_GROUPS.map((group) => ({
      ...group,
      recommendations: ordered.filter((recommendation) =>
        (group.decisionIds as readonly string[]).includes(
          recommendation.decisionId,
        ),
      ),
    })),
    {
      id: "other-recommendations",
      title: "Outras leituras",
      description: "Recomendacoes adicionais da superficie atual.",
      decisionIds: [] as readonly string[],
      recommendations: ordered.filter(
        (recommendation) => !knownDecisionIds.has(recommendation.decisionId),
      ),
    },
  ].filter((group) => group.recommendations.length > 0);

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

      <div className="space-y-6">
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={`${group.id}-title`}>
            <div className="mb-3 space-y-1">
              <h3 id={`${group.id}-title`} className="text-sm font-semibold">
                {group.title}
              </h3>
              <p className="text-xs text-muted-foreground">
                {group.description}
              </p>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {group.recommendations.map((recommendation) => (
                <RecommendationCard
                  key={recommendation.id}
                  recommendation={recommendation}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
