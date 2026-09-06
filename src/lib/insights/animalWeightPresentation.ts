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
