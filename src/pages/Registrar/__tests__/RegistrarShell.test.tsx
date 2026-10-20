/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RegistrarStepIndicator } from "../components/RegistrarStepIndicator";
import { RegistrarStickyActionBar } from "../components/RegistrarStickyActionBar";
import { RegistrarContextSummary } from "../components/RegistrarContextSummary";

describe("Registrar shell acessível", () => {
  it("identifica etapa atual e etapas concluídas sem depender de cor", () => {
    render(
      <RegistrarStepIndicator
        step={2}
        registrationSteps={[1, 2, 3]}
        stepLabels={{
          1: "Definir contexto",
          2: "Escolher ação",
          3: "Registrar",
        }}
      />,
    );
    const steps = within(
      screen.getByRole("list", { name: "Progresso do registro" }),
    ).getAllByRole("listitem");
    expect(steps[0]).toHaveTextContent("Etapa 1 concluída");
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(steps[2]).not.toHaveAttribute("aria-current");
  });

  it("bloqueia confirmação e retorno enquanto o salvamento está em andamento", () => {
    const finalize = vi.fn();
    const back = vi.fn();
    render(
      <RegistrarStickyActionBar
        step={3}
        isFinalizing
        canAdvanceToConfirm
        tipoManejo="pesagem"
        sourceTaskId="agenda-1"
        actionStepIssues={[]}
        onBack={back}
        onNext={vi.fn()}
        onFinalize={finalize}
      />,
    );
    const save = screen.getByRole("button", { name: "Registrando..." });
    expect(save).toBeDisabled();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
    fireEvent.click(save);
    fireEvent.click(save);
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(finalize).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
    expect(
      screen.getByRole("group", { name: "Ações do registro" }),
    ).toHaveAttribute("aria-busy", "true");
  });

  it("mantém identificadores técnicos ocultos até a solicitação explícita", () => {
    const toggle = vi.fn();
    const props = {
      hasRegistrarDisplayContext: true,
      registrarContextRecords: {},
      registrarDisplayContext: [
        {
          kind: "animal",
          id: "animal-context-id",
          title: "Animal",
          description: "Animal: Matriz 12",
          found: true,
        },
      ],
      setShowTechDetails: toggle,
    };
    const { rerender } = render(
      <RegistrarContextSummary {...props} showTechDetails={false} />,
    );
    expect(screen.queryByText("ID: animal-context-id")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Ver detalhes técnicos" }),
    );
    expect(toggle).toHaveBeenCalledWith(true);
    rerender(<RegistrarContextSummary {...props} showTechDetails />);
    expect(screen.getByText("ID: animal-context-id")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Ocultar detalhes técnicos" }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});
