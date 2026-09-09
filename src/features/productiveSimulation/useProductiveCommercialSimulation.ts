import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { Animal } from "@/lib/offline/types";
import { useAnimalWeightPresentation } from "@/hooks/useAnimalWeightPresentation";
import {
  calculateProductiveCommercialSimulation,
  type ProductiveCommercialSimulationResult,
  type ProductiveCommercialSimulationAssumptionsInput,
} from "@/lib/simulation/productiveCommercialSimulation";
import type { CommercialArrobaBasis } from "@/lib/comercial/commercialPricing";

export interface UseProductiveCommercialSimulationProps {
  animal: Pick<Animal, "id" | "brinco" | "nome" | "fazenda_id" | "deleted_at">;
  fazendaId: string;
}

function parseInputNumber(val: string): number {
  const norm = val.trim().replace(",", ".");
  return norm === "" ? NaN : Number(norm);
}

function parseOptionalInputNumber(val: string): number | null {
  const norm = val.trim().replace(",", ".");
  if (norm === "") return null;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

function resolveInitialAssumedGmd(factualGmdKgDay: number | null | undefined): string {
  if (factualGmdKgDay != null && Number.isFinite(factualGmdKgDay) && factualGmdKgDay > 0) {
    return factualGmdKgDay.toFixed(2);
  }
  return "";
}

interface RawSimulationInputs {
  targetWeightInput: string;
  assumedGmdInput: string;
  pricePerArrobaInput: string;
  arrobaBasis: CommercialArrobaBasis;
  carcassYieldInput: string;
  sellNowCarcassWeightInput: string;
  targetCarcassWeightInput: string;
  dailyCostInput: string;
  additionalCostInput: string;
}

function buildAssumptions(inputs: RawSimulationInputs): ProductiveCommercialSimulationAssumptionsInput {
  return {
    targetWeightKg: parseInputNumber(inputs.targetWeightInput),
    assumedGmdKgDay: parseInputNumber(inputs.assumedGmdInput),
    pricePerArroba: parseInputNumber(inputs.pricePerArrobaInput),
    arrobaBasis: inputs.arrobaBasis,
    carcassYieldPercent: parseOptionalInputNumber(inputs.carcassYieldInput),
    sellNowCarcassWeightKg: parseOptionalInputNumber(inputs.sellNowCarcassWeightInput),
    targetCarcassWeightKg: parseOptionalInputNumber(inputs.targetCarcassWeightInput),
    dailyIncrementalCost: parseOptionalInputNumber(inputs.dailyCostInput),
    additionalIncrementalCosts: parseOptionalInputNumber(inputs.additionalCostInput),
  };
}

function resolveLatestWeightValue(presentation: ReturnType<typeof useAnimalWeightPresentation>) {
  if (presentation?.latestObservedWeight?.status === "available") {
    return presentation.latestObservedWeight.value;
  }
  return null;
}

function resolveGmdValue(presentation: ReturnType<typeof useAnimalWeightPresentation>) {
  if (presentation?.gmd?.status === "CALCULATED") {
    return presentation.gmd.gmdKgPerDay;
  }
  return null;
}

function resolvePresentationEvidence(presentation: ReturnType<typeof useAnimalWeightPresentation>) {
  const latest = resolveLatestWeightValue(presentation);
  const isConflict = presentation?.latestObservedWeight?.status === "conflict";
  const gmdVal = resolveGmdValue(presentation);
  return {
    observedWeightKg: latest?.weight ?? null,
    observedAt: latest?.measuredAt ?? null,
    factualGmdKgDay: gmdVal,
    isWeightConflict: Boolean(isConflict),
  };
}

export function useProductiveCommercialSimulation({
  animal,
  fazendaId,
}: UseProductiveCommercialSimulationProps) {
  const weightPresentation = useAnimalWeightPresentation(animal, fazendaId);
  const { observedWeightKg, observedAt, factualGmdKgDay, isWeightConflict } =
    resolvePresentationEvidence(weightPresentation);

  const userTouchedAssumedGmdRef = useRef<boolean>(false);

  const [targetWeightInput, setTargetWeightInput] = useState<string>("");
  const [assumedGmdInput, setAssumedGmdInput] = useState<string>(() =>
    resolveInitialAssumedGmd(factualGmdKgDay),
  );
  const [pricePerArrobaInput, setPricePerArrobaInput] = useState<string>("");
  const [arrobaBasis, setArrobaBasis] = useState<CommercialArrobaBasis>("live_weight_yield");
  const [carcassYieldInput, setCarcassYieldInput] = useState<string>("");
  const [sellNowCarcassWeightInput, setSellNowCarcassWeightInput] = useState<string>("");
  const [targetCarcassWeightInput, setTargetCarcassWeightInput] = useState<string>("");
  const [dailyCostInput, setDailyCostInput] = useState<string>("");
  const [additionalCostInput, setAdditionalCostInput] = useState<string>("");

  const handleAssumedGmdChange = useCallback((val: string) => {
    userTouchedAssumedGmdRef.current = true;
    setAssumedGmdInput(val);
  }, []);

  useEffect(() => {
    if (
      !userTouchedAssumedGmdRef.current &&
      factualGmdKgDay != null &&
      Number.isFinite(factualGmdKgDay) &&
      factualGmdKgDay > 0
    ) {
      setAssumedGmdInput((current) => {
        if (!userTouchedAssumedGmdRef.current && current === "") {
          return factualGmdKgDay.toFixed(2);
        }
        return current;
      });
    }
  }, [factualGmdKgDay]);

  const inputs: RawSimulationInputs = useMemo(
    () => ({
      targetWeightInput,
      assumedGmdInput,
      pricePerArrobaInput,
      arrobaBasis,
      carcassYieldInput,
      sellNowCarcassWeightInput,
      targetCarcassWeightInput,
      dailyCostInput,
      additionalCostInput,
    }),
    [
      targetWeightInput,
      assumedGmdInput,
      pricePerArrobaInput,
      arrobaBasis,
      carcassYieldInput,
      sellNowCarcassWeightInput,
      targetCarcassWeightInput,
      dailyCostInput,
      additionalCostInput,
    ],
  );

  const simulation: ProductiveCommercialSimulationResult = useMemo(() => {
    return calculateProductiveCommercialSimulation({
      factual: {
        animalId: animal.id,
        fazendaId,
        observedWeightKg: observedWeightKg ?? 0,
        observedAt: observedAt ?? "",
        factualGmdKgDay,
        weightConflict: isWeightConflict,
      },
      assumptions: buildAssumptions(inputs),
    });
  }, [
    animal.id,
    fazendaId,
    observedWeightKg,
    observedAt,
    factualGmdKgDay,
    isWeightConflict,
    inputs,
  ]);

  return {
    observedWeightKg,
    observedAt,
    factualGmdKgDay,
    inputs,
    setters: {
      setTargetWeightInput,
      setAssumedGmdInput: handleAssumedGmdChange,
      setPricePerArrobaInput,
      setArrobaBasis,
      setCarcassYieldInput,
      setSellNowCarcassWeightInput,
      setTargetCarcassWeightInput,
      setDailyCostInput,
      setAdditionalCostInput,
    },
    simulation,
  };
}
