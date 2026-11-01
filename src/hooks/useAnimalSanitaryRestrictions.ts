import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useRef } from "react";
import { db } from "@/lib/offline/db";
import type { SanitarioCaso } from "@/lib/offline/types";
import { listAnimalSanitaryRestrictions, type SanitaryRestrictionAnimal, type SanitaryCaseCoverage } from "@/lib/sanitario/compliance/animalRestrictions";

export function useAnimalSanitaryRestrictions<T extends SanitaryRestrictionAnimal>(
  farmId: string | null | undefined, animals: readonly T[],
) {
  const lastKnown = useRef<{ farmId: typeof farmId; cases: SanitarioCaso[] } | undefined>(undefined);
  const snapshot = useLiveQuery(async () => {
    try {
      return { farmId, cases: farmId ? await db.state_sanitario_casos.where("fazenda_id").equals(farmId).toArray() : [] };
    } catch {
      // This auxiliary read must not erase known signals or prevent factual registration.
      // Actual writes keep their own integrity/error handling in the existing writers.
      return { farmId, cases: undefined };
    }
  }, [farmId]);
  useEffect(() => {
    if (lastKnown.current?.farmId !== farmId) lastKnown.current = undefined;
    if (snapshot !== undefined && snapshot.farmId === farmId && snapshot.cases !== undefined) lastKnown.current = snapshot;
  }, [farmId, snapshot]);
  // useLiveQuery may retain the previous result during a farm switch.
  const currentCases = snapshot?.farmId === farmId ? snapshot?.cases : undefined;
  // Keep already observed evidence for display only, explicitly marked unavailable.
  // This transient snapshot is never used by a writer or retained across farms.
  const cases = currentCases ?? (lastKnown.current?.farmId === farmId ? lastKnown.current?.cases : undefined);
  const coverage: SanitaryCaseCoverage = !farmId || (snapshot !== undefined && snapshot.farmId === farmId && snapshot.cases === undefined)
    ? "unavailable" : currentCases === undefined ? "loading" : "local";
  return {
    restrictions: listAnimalSanitaryRestrictions(farmId, animals, cases),
    cases,
    coverage,
    isLoading: coverage === "loading",
    isUnavailable: coverage === "unavailable",
  };
}
