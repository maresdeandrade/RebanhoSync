import { useMemo } from "react";

import {
  buildOperationalInsights,
  type BuildOperationalInsightsInput,
  type OperationalInsightsViewModel,
} from "@/features/operationalInsights/operationalInsightsAdapter";

export function useOperationalInsights(
  input: BuildOperationalInsightsInput,
): OperationalInsightsViewModel {
  return useMemo(() => buildOperationalInsights(input), [input]);
}
