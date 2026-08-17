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
  it("bloqueia avanço no modo existente sem alvo", () => {
    expect(
      canAdvanceFromSelectStep({
        targetMode: "existing",
        hasExistingTarget: false,
      }),
    ).toBe(false);
  });

  it("permite avançar no modo sem alvo", () => {
    expect(
      canAdvanceFromSelectStep({
        targetMode: "none",
        hasExistingTarget: false,
      }),
    ).toBe(true);
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
        targetMode: "existing",
        hasExistingTarget: true,
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
