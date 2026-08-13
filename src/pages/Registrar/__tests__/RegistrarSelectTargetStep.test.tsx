/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RegistrarSelectTargetStep } from "../components/RegistrarSelectTargetStep";

describe("Registrar commercial operation-first step", () => {
  it("asks operation and scope before target and lets individual purchase continue without an animal", () => {
    const apply = vi.fn();
    const next = vi.fn();
    render(
      <RegistrarSelectTargetStep
        quickAction="compra"
        onApplyQuickAction={apply}
        onClearQuickAction={vi.fn()}
        selectedLoteId=""
        onSelectedLoteIdChange={vi.fn()}
        semLoteOption="__sem_lote__"
        lotes={[]}
        selectedAnimaisCount={0}
        selectedVisibleCount={0}
        filteredAnimaisNoLote={[]}
        visibleAnimalIds={[]}
        selectedAnimais={[]}
        animalSearch=""
        onAnimalSearchChange={vi.fn()}
        onSelectVisible={vi.fn()}
        onClearSelection={vi.fn()}
        onToggleAnimalSelection={vi.fn()}
        animaisNoLoteCount={0}
        requiresAnimalsForQuickAction={false}
        quickActionLabel="Compra"
        commercialOperationType="compra"
        commercialScope="animal"
        onCommercialScopeChange={vi.fn()}
        canAdvanceWithoutTarget
        onNext={next}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText("Operação comercial")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Individual" })).toBeTruthy();
    const continueButton = screen.getByRole("button", {
      name: /Continuar para Compra/i,
    });
    expect((continueButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(continueButton);
    expect(next).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "venda" }));
    expect(apply).toHaveBeenCalledWith("venda");
  });
});
