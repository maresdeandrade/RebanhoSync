import { useCallback, useState } from "react";

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
  [RegistrationStep.SELECT_ANIMALS]: "Selecionar alvo",
  [RegistrationStep.CHOOSE_ACTION]: "Escolher ação",
  [RegistrationStep.CONFIRM]: "Registrar",
};

export function canAdvanceFromSelectStep(input: {
  selectedLoteId: string;
  requiresAnimalsForQuickAction: boolean;
}) {
  return (
    input.selectedLoteId.trim().length > 0 && !input.requiresAnimalsForQuickAction
  );
}

export function canAdvanceFromChooseActionStep(input: {
  hasTipoManejo: boolean;
  canAdvanceToConfirm: boolean;
}) {
  return input.hasTipoManejo && input.canAdvanceToConfirm;
}

export function useRegistrarStepFlow(input: {
  selectedLoteId: string;
  requiresAnimalsForQuickAction: boolean;
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
        selectedLoteId: input.selectedLoteId,
        requiresAnimalsForQuickAction: input.requiresAnimalsForQuickAction,
      })
    ) {
      return false;
    }
    setStep(RegistrationStep.CHOOSE_ACTION);
    return true;
  }, [input.requiresAnimalsForQuickAction, input.selectedLoteId]);

  return {
    step,
    setStep,
    advanceFromSelect,
    goToSelectAnimals,
    goToChooseAction,
    goToConfirm,
  };
}
