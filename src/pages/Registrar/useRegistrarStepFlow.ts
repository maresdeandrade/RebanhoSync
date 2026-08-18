import { useCallback, useState } from "react";
import type { RegistrarTargetMode } from "@/pages/Registrar/helpers/commercialForm";

export enum RegistrationStep {
  SELECT_ANIMALS = 1,
  CHOOSE_ACTION = 2,
  CONFIRM = 3,
}

export const REGISTRATION_STEPS = [
  RegistrationStep.SELECT_ANIMALS,
  RegistrationStep.CHOOSE_ACTION,
  RegistrationStep.CONFIRM,
] as const;

export const STEP_LABEL: Record<RegistrationStep, string> = {
  [RegistrationStep.SELECT_ANIMALS]: "Definir contexto",
  [RegistrationStep.CHOOSE_ACTION]: "Escolher ação",
  [RegistrationStep.CONFIRM]: "Registrar",
};

export function canAdvanceFromSelectStep(input: {
  targetMode: RegistrarTargetMode | null;
  hasExistingTarget: boolean;
}) {
  return (
    input.targetMode === "none" ||
    (input.targetMode === "existing" && input.hasExistingTarget)
  );
}

export function canAdvanceFromChooseActionStep(input: {
  hasTipoManejo: boolean;
  canAdvanceToConfirm: boolean;
}) {
  return input.hasTipoManejo && input.canAdvanceToConfirm;
}

export function useRegistrarStepFlow(input: {
  targetMode: RegistrarTargetMode | null;
  hasExistingTarget: boolean;
  hasTipoManejo: boolean;
  canAdvanceToConfirm: boolean;
}) {
  const [step, setStep] = useState<RegistrationStep>(
    RegistrationStep.SELECT_ANIMALS,
  );

  const goToSelectAnimals = useCallback(() => {
    setStep(RegistrationStep.SELECT_ANIMALS);
  }, []);

  const goToChooseAction = useCallback(() => {
    setStep(RegistrationStep.CHOOSE_ACTION);
  }, []);

  const goToConfirm = useCallback(() => {
    if (
      !canAdvanceFromChooseActionStep({
        hasTipoManejo: input.hasTipoManejo,
        canAdvanceToConfirm: input.canAdvanceToConfirm,
      })
    ) {
      return false;
    }
    setStep(RegistrationStep.CONFIRM);
    return true;
  }, [input.canAdvanceToConfirm, input.hasTipoManejo]);

  const advanceFromSelect = useCallback(() => {
    if (
      !canAdvanceFromSelectStep({
        targetMode: input.targetMode,
        hasExistingTarget: input.hasExistingTarget,
      })
    ) {
      return false;
    }
    setStep(RegistrationStep.CHOOSE_ACTION);
    return true;
  }, [input.hasExistingTarget, input.targetMode]);

  return {
    step,
    setStep,
    advanceFromSelect,
    goToSelectAnimals,
    goToChooseAction,
    goToConfirm,
  };
}
