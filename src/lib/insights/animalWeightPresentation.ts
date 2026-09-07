import { calculateQualifiedGmd } from "./gmdCalculation";
import { selectFactualGmdInterval } from "./gmdIntervalContract";
import { selectLatestObservedWeight } from "./latestObservedWeight";
import {
  selectObservedWeightEvidence,
  type SelectObservedWeightEvidenceInput,
} from "./observedWeightEvidence";

/** Composes factual weight contracts without inferring current weight or operational authority. */
export function selectAnimalWeightPresentation(input: SelectObservedWeightEvidenceInput) {
  const evidence = selectObservedWeightEvidence(input);
  return {
    evidence,
    latestObservedWeight: selectLatestObservedWeight(input),
    gmd: calculateQualifiedGmd(selectFactualGmdInterval(input)),
    observations:
      evidence.status === "available" && evidence.conflicts.length === 0
        ? evidence.observations
        : [],
  };
}

export type AnimalWeightPresentation = ReturnType<
  typeof selectAnimalWeightPresentation
>;

export function buildAnimalWeightHistory(
  presentation: AnimalWeightPresentation | null | undefined,
) {
  return (presentation?.observations ?? []).map((observation) => ({
    id: observation.eventId,
    data: observation.measuredAt.slice(0, 10),
    dataLabel: new Date(observation.measuredAt).toLocaleDateString("pt-BR"),
    measuredAt: observation.measuredAt,
    pesoKg: observation.weightKg,
  }));
}

export function buildAnimalWeightSummary(
  presentation: AnimalWeightPresentation | null | undefined,
) {
  const history = buildAnimalWeightHistory(presentation);
  if (history.length === 0) return null;

  const qualifiedGmd =
    presentation?.gmd.status === "CALCULATED" ? presentation.gmd : null;

  return {
    primeiro: history[0],
    ultimo: history[history.length - 1],
    variacaoKg: qualifiedGmd?.weightDeltaKg ?? null,
    ganhoMedioDiaKg: qualifiedGmd?.gmdKgPerDay ?? null,
    totalPesagens: history.length,
    gmdStatus: presentation?.gmd.status ?? "NOT_CALCULATED",
  };
}
