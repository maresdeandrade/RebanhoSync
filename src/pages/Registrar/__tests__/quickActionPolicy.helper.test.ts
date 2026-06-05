/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import {
  REGISTRAR_QUICK_ACTIONS,
  isQuickActionKey,
  requiresAnimalsForQuickAction,
  resolveQuickActionDecision,
  useRegistrarQuickActionPolicy,
} from "@/pages/Registrar/useRegistrarQuickActionPolicy";

describe("quick action policy", () => {
  it("reconhece apenas keys válidas", () => {
    expect(isQuickActionKey("vacinacao")).toBe(true);
    expect(isQuickActionKey("compra")).toBe(true);
    expect(isQuickActionKey("foo")).toBe(false);
  });

  it("mapeia ações sanitárias e financeiras para domínio/efeitos", () => {
    expect(resolveQuickActionDecision("vacinacao")).toEqual({
      tipoManejo: "sanitario",
      sanitaryQuickAction: "vacinacao",
      financeiroNatureza: null,
    });
    expect(resolveQuickActionDecision("compra")).toEqual({
      tipoManejo: "financeiro",
      sanitaryQuickAction: null,
      financeiroNatureza: "compra",
    });
  });

  it("aplica guard de seleção obrigatória por quick action", () => {
    expect(
      requiresAnimalsForQuickAction({
        quickAction: "venda",
        selectedAnimalCount: 0,
      }),
    ).toBe(true);
    expect(
      requiresAnimalsForQuickAction({
        quickAction: "compra",
        selectedAnimalCount: 0,
      }),
    ).toBe(false);
  });

  it("descreve venda como registro manual sem aptidao comercial", () => {
    const venda = REGISTRAR_QUICK_ACTIONS.find(
      (action) => action.key === "venda",
    );

    expect(venda?.label).toBe("Venda manual");
    expect(venda?.helper).toMatch(/Registra operacao informada pelo usuario/i);
    expect(venda?.helper).toMatch(/nao valida aptidao comercial/i);
  });

  it("hook executa efeitos corretos ao aplicar quick action", () => {
    const applySanitaryQuickAction = vi.fn();
    const setTipoManejo = vi.fn();
    const updateFinanceiroNatureza = vi.fn();

    const { result } = renderHook(() =>
      useRegistrarQuickActionPolicy({
        applySanitaryQuickAction,
        setTipoManejo,
        updateFinanceiroNatureza,
      }),
    );

    act(() => {
      result.current.applyQuickAction("vacinacao");
    });
    expect(setTipoManejo).toHaveBeenCalledWith("sanitario");
    expect(applySanitaryQuickAction).toHaveBeenCalledWith("vacinacao");

    act(() => {
      result.current.applyQuickAction("venda");
    });
    expect(setTipoManejo).toHaveBeenCalledWith("financeiro");
    expect(updateFinanceiroNatureza).toHaveBeenCalledWith("venda");
  });
});
