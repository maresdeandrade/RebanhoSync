/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { SanitaryLocalAgendaPanelV2 } from "@/components/sanitario/SanitaryLocalAgendaPanelV2";

const items = [
  {
    id: "agenda-1",
    fazendaId: "farm-1",
    plannedFor: "2026-07-01",
    status: "programada" as const,
    protocolId: "protocol-1",
    itemKey: "dose-anual",
    protocolLabel: "Brucelose B19",
    itemLabel: "Dose anual",
    productRequirementKind: "product_class_group",
    productClass: null,
    productClassLabel: null,
    productClassGroupId: "group-1",
    productClassGroupName: "Antiparasitários",
    plannedProductId: null,
    plannedProductName: null,
    suggestedDose: null,
    suggestedDoseUnit: null,
    suggestedRoute: null,
    animalCount: 3,
    target: { kind: "lote" as const, label: "Novilhas", href: "/lotes/lot-1" },
    canManage: true,
    canExecute: true,
  },
  {
    id: "agenda-2",
    fazendaId: "farm-1",
    plannedFor: "2026-08-01",
    status: "cancelada" as const,
    protocolId: "protocol-2",
    itemKey: "reforco",
    protocolLabel: "Raiva",
    itemLabel: "Reforço",
    productRequirementKind: "product_class",
    productClass: "vacina_raiva",
    productClassLabel: "Vacina contra raiva",
    productClassGroupId: null,
    productClassGroupName: null,
    plannedProductId: null,
    plannedProductName: null,
    suggestedDose: null,
    suggestedDoseUnit: null,
    suggestedRoute: null,
    animalCount: 1,
    target: { kind: "animal" as const, label: "Estrela", href: "/animais/animal-1" },
    canManage: false,
    canExecute: false,
  },
];

function renderPanel(onReschedule = vi.fn(), onCancel = vi.fn(), onExecute = vi.fn()) {
  render(
    <MemoryRouter>
      <SanitaryLocalAgendaPanelV2
        items={items}
        onReschedule={onReschedule}
        onCancel={onCancel}
        onExecute={onExecute}
      />
    </MemoryRouter>,
  );
}

describe("SanitaryLocalAgendaPanelV2", () => {
  it("lista registros sem expor identificadores técnicos e abre a origem", () => {
    renderPanel();
    expect(screen.getByText("Brucelose B19")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Ver agendas/ })[0]);
    expect(screen.getByRole("link", { name: /Novilhas/ })).toHaveAttribute("href", "/lotes/lot-1");
    expect(screen.queryByText("agenda-1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Executar grupo/ })).toBeInTheDocument();
  });

  it("filtra pelo conteúdo apresentado", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText("Buscar agenda sanitária"), { target: { value: "Estrela" } });
    expect(screen.getByText("Raiva")).toBeInTheDocument();
    expect(screen.queryByText("Brucelose B19")).not.toBeInTheDocument();
  });

  it("reagenda e cancela somente agendas gerenciáveis", async () => {
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn().mockResolvedValue(undefined);
    renderPanel(onReschedule, onCancel);

    fireEvent.click(screen.getAllByRole("button", { name: /Ver agendas/ })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Reagendar" })[0]);
    fireEvent.change(screen.getByLabelText("Nova data planejada"), { target: { value: "2026-07-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova data" }));
    await waitFor(() => expect(onReschedule).toHaveBeenCalledWith("agenda-1", "2026-07-15"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: "Cancelar agenda" })[0]);
    await waitFor(() => expect(onCancel).toHaveBeenCalledWith("agenda-1"));
    fireEvent.click(screen.getAllByRole("button", { name: /Ver agendas/ })[0]);
    expect(screen.getAllByRole("button", { name: "Cancelar agenda" })[1]).toBeDisabled();
  });

  it("abre modal de execução, exige confirmação explícita e não mostra executar para agenda cancelada", async () => {
    const onExecute = vi.fn().mockResolvedValue(undefined);
    renderPanel(vi.fn(), vi.fn(), onExecute);

    expect(screen.getAllByRole("button", { name: /Executar grupo/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Executar grupo/ }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Esta ação registra um evento sanitário executado.")).toBeInTheDocument();
    expect(screen.getByText("Produto real, dose e via serão registrados como execução sanitária.")).toBeInTheDocument();
    expect(screen.getByText(/Grupo técnico não define dose nem carência/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar execução" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Produto real"), { target: { value: "Vermífugo A" } });
    fireEvent.change(screen.getByLabelText("Dose"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Unidade da dose"), { target: { value: "ml" } });
    fireEvent.change(screen.getByLabelText("Via"), { target: { value: "subcutanea" } });
    fireEvent.click(screen.getByLabelText("Confirmo que este manejo sanitário foi executado."));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar execução" }));

    await waitFor(() =>
      expect(onExecute).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            agendaId: "agenda-1",
            product: expect.objectContaining({ productName: "Vermífugo A" }),
            application: expect.objectContaining({ dose: 2, doseUnit: "ml", route: "subcutanea" }),
            confirmation: expect.objectContaining({ userConfirmedExecution: true }),
          }),
        ],
      ),
    );
  });
});
