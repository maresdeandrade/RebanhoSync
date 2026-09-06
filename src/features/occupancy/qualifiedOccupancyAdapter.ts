import type { OccupancyAggregate } from "@/lib/occupancy/occupancyAggregation";

export interface QualifiedDurationPresentation {
  meanDurationDays: number | null;
  maxDurationDays: number | null;
  status: {
    status: "empty" | "partial" | "complete";
    reason: string;
    source: string;
    limitation?: string;
  };
}

const SOURCE = "Historical occupancy read models + qualified duration";

export function presentQualifiedOccupancyDuration(
  aggregate: OccupancyAggregate | null | undefined,
): QualifiedDurationPresentation {
  if (!aggregate) {
    return {
      meanDurationDays: null,
      maxDurationDays: null,
      status: {
        status: "empty",
        reason: "Duração histórica qualificada indisponível",
        source: SOURCE,
        limitation:
          "Nenhum agregado canônico foi demonstrado para este lote ou pasto; o valor legado não é usado como fallback.",
      },
    };
  }

  if (aggregate.knownIntervals === 0) {
    return {
      meanDurationDays: null,
      maxDurationDays: null,
      status: {
        status:
          aggregate.coverage === "PARTIAL" ||
          aggregate.coverage === "CONFLICTED"
            ? "partial"
            : "empty",
        reason: "Sem intervalo com boundaries suficientes para calcular duração",
        source: SOURCE,
        limitation:
          aggregate.coverage === "CONFLICTED"
            ? "Conflitos factuais impedem demonstrar a duração; ausência não é tratada como zero."
            : "Início, fim ou referência temporal permanecem desconhecidos; ausência não é tratada como zero.",
      },
    };
  }

  const partial = aggregate.coverage !== "COMPLETE";
  const limitationParts: string[] = [];
  if (aggregate.unknownIntervals > 0) {
    limitationParts.push(
      `${aggregate.unknownIntervals} intervalo(s) sem duração demonstrável`,
    );
  }
  if (aggregate.conflicts.length > 0) {
    limitationParts.push(
      `${aggregate.conflicts.length} conflito(s) factual(is) preservado(s)`,
    );
  }

  return {
    meanDurationDays: aggregate.meanKnownDurationDays,
    maxDurationDays: aggregate.maxKnownDurationDays,
    status: {
      status: partial ? "partial" : "complete",
      reason: partial
        ? "Duração calculada somente sobre intervalos factualmente conhecidos"
        : "Duração calculada sobre intervalos factuais completos",
      source: SOURCE,
      limitation:
        limitationParts.length > 0
          ? `${limitationParts.join("; ")}. Coverage: ${aggregate.coverage}.`
          : undefined,
    },
  };
}
