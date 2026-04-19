/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  canAdvanceFromChooseActionStep,
  canAdvanceFromSelectStep,
  RegistrationStep,
  useRegistrarStepFlow,
} from "@/pages/Registrar/useRegistrarStepFlow";

describe("registrar step-flow", () => {
  it("bloqueia avanço da etapa de seleção sem lote", () => {
    expect(
      canAdvanceFromSelectStep({
        selectedLoteId: "",
        requiresAnimalsForQuickAction: false,
      }),
    ).toBe(false);
  });

  it("bloqueia avanço da etapa de ação sem manejo válido", () => {
    expect(
      canAdvanceFromChooseActionStep({
        hasTipoManejo: false,
        canAdvanceToConfirm: true,
      }),
    ).toBe(false);
  });

  it("não avança para confirmação quando guard de etapa falha", () => {
    const { result } = renderHook(() =>
      useRegistrarStepFlow({
        selectedLoteId: "lote-1",
        requiresAnimalsForQuickAction: false,
        hasTipoManejo: false,
        canAdvanceToConfirm: true,
      }),
    );

    let didAdvance = false;
    act(() => {
      didAdvance = result.current.goToConfirm();
    });

    expect(didAdvance).toBe(false);
    expect(result.current.step).toBe(RegistrationStep.SELECT_ANIMALS);
  });
});
