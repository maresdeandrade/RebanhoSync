/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { SanitaryLocalAgendaPanelV2 } from "@/components/sanitario/SanitaryLocalAgendaPanelV2";

const items = [
  { id: "agenda-1", plannedFor: "2026-07-01", status: "programada" as const, protocolLabel: "Brucelose B19", itemLabel: "Dose anual", target: { kind: "lote" as const, label: "Novilhas", href: "/lotes/lot-1" }, canManage: true },
  { id: "agenda-2", plannedFor: "2026-08-01", status: "cancelada" as const, protocolLabel: "Raiva", itemLabel: "Reforço", target: { kind: "animal" as const, label: "Estrela", href: "/animais/animal-1" }, canManage: false },
];

function renderPanel(onReschedule = vi.fn(), onCancel = vi.fn()) {
  render(<MemoryRouter><SanitaryLocalAgendaPanelV2 items={items} onReschedule={onReschedule} onCancel={onCancel} /></MemoryRouter>);
}

describe("SanitaryLocalAgendaPanelV2", () => {
  it("lista registros sem expor identificadores técnicos e abre a origem", () => {
    renderPanel();
    expect(screen.getByText("Brucelose B19")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Novilhas/ })).toHaveAttribute("href", "/lotes/lot-1");
    expect(screen.queryByText("agenda-1")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Execução indisponível" }).every((button) => button.hasAttribute("disabled"))).toBe(true);
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

    fireEvent.click(screen.getAllByRole("button", { name: "Reagendar" })[0]);
    fireEvent.change(screen.getByLabelText("Nova data planejada"), { target: { value: "2026-07-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova data" }));
    await waitFor(() => expect(onReschedule).toHaveBeenCalledWith("agenda-1", "2026-07-15"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: "Cancelar agenda" })[0]);
    await waitFor(() => expect(onCancel).toHaveBeenCalledWith("agenda-1"));
    expect(screen.getAllByRole("button", { name: "Cancelar agenda" })[1]).toBeDisabled();
  });
});
