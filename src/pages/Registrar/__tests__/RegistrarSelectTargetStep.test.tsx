/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RegistrarSelectTargetStep } from "../components/RegistrarSelectTargetStep";

describe("Registrar target-context step", () => {
  const baseProps = {
    selectedLoteId: "",
    onSelectedLoteIdChange: vi.fn(),
    semLoteOption: "__sem_lote__",
    lotes: [] as Array<{ id: string; nome: string }>,
    selectedAnimaisCount: 0,
    selectedVisibleCount: 0,
    filteredAnimaisNoLote: [],
    visibleAnimalIds: [],
    selectedAnimais: [],
    animalSearch: "",
    onAnimalSearchChange: vi.fn(),
    onSelectVisible: vi.fn(),
    onClearSelection: vi.fn(),
    onToggleAnimalSelection: vi.fn(),
    animaisNoLoteCount: 0,
    onBack: vi.fn(),
  };

  it("pergunta somente o contexto e avança sem alvo", () => {
    const next = vi.fn();
    render(
      <RegistrarSelectTargetStep
        {...baseProps}
        targetMode="none"
        onTargetModeChange={vi.fn()}
        onNext={next}
      />,
    );

    expect(screen.queryByRole("button", { name: "Compra" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Venda" })).toBeNull();
    expect(screen.queryByText("Escopo da Operação")).toBeNull();
    const continueButton = screen.getByRole("button", {
      name: /Escolher manejo/i,
    });
    expect((continueButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(continueButton);
    expect(next).toHaveBeenCalledOnce();
  });

  it("exige alvo quando o contexto usa animais ou lote existentes", () => {
    const next = vi.fn();
    const { rerender } = render(
      <RegistrarSelectTargetStep
        {...baseProps}
        targetMode="existing"
        onTargetModeChange={vi.fn()}
        onNext={next}
      />,
    );

    expect(
      (
        screen.getByRole("button", {
          name: /Escolher manejo/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    rerender(
      <RegistrarSelectTargetStep
        {...baseProps}
        targetMode="existing"
        selectedLoteId="lote-1"
        onTargetModeChange={vi.fn()}
        onNext={next}
      />,
    );
    expect(
      (
        screen.getByRole("button", {
          name: /Escolher manejo/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });
});
