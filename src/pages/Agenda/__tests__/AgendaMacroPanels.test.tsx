/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AgendaComplianceSummaryPanel } from "@/pages/Agenda/components/AgendaComplianceSummaryPanel";
import { AgendaLifecycleSummaryPanel } from "@/pages/Agenda/components/AgendaLifecycleSummaryPanel";
import { AgendaOverviewHeader } from "@/pages/Agenda/components/AgendaOverviewHeader";
import { AgendaStatusMetrics } from "@/pages/Agenda/components/AgendaStatusMetrics";

describe("Agenda macro panels", () => {
  it("renders overview badges and registrar action", () => {
    const onGoToRegistrar = vi.fn();

    render(
      <AgendaOverviewHeader
        badges={[
          { key: "recorte", label: "2 item(ns) no recorte", tone: "neutral" },
          { key: "filters", label: "Filtros ativos", tone: "info" },
        ]}
        onGoToRegistrar={onGoToRegistrar}
      />,
    );

    expect(screen.getByText("2 item(ns) no recorte")).toBeInTheDocument();
    expect(screen.getByText("Filtros ativos")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /registrar/i }));
    expect(onGoToRegistrar).toHaveBeenCalledTimes(1);
  });

  it("renders compliance panel and triggers overlay navigation", () => {
    const onOpenComplianceOverlay = vi.fn();

    render(
      <AgendaComplianceSummaryPanel
        openCount={2}
        blockingCount={1}
        badges={[{ key: "feed-ban", label: "Feed-ban", count: 2, tone: "danger" }]}
        topItems={[
          {
            key: "item-1",
            label: "Feed-ban ruminantes",
            statusLabel: "Pendente",
            kindLabel: "Restricao",
            detail: "Ajustar rotina de trato.",
            recommendation: "Validar checklist oficial.",
            tone: "danger",
          },
        ]}
        onOpenComplianceOverlay={onOpenComplianceOverlay}
      />,
    );

    expect(screen.getByText("Restricoes de conformidade em aberto")).toBeInTheDocument();
    expect(screen.getByText("Feed-ban 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /abrir overlay de conformidade/i }));
    expect(onOpenComplianceOverlay).toHaveBeenCalledTimes(1);
  });

  it("renders lifecycle panel items with actionable links", () => {
    render(
      <MemoryRouter>
        <AgendaLifecycleSummaryPanel
          total={1}
          strategic={1}
          biological={0}
          items={[
            {
              animalId: "animal-1",
              identificacao: "Matriz 001",
              kindLabel: "Decisao estrategica",
              kindTone: "warning",
              autoApplyLabel: "Manual",
              autoApplyTone: "warning",
              stageLabel: "Novilha para Matriz",
              loteNome: "Lote A",
              reason: "Atingiu limiar de idade.",
            },
          ]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Transicoes de estagio no radar")).toBeInTheDocument();
    expect(screen.getByText("Matriz 001")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /abrir ficha/i })).toHaveAttribute("href", "/animais/animal-1");
    expect(screen.getByRole("link", { name: /tratar na fila/i })).toHaveAttribute("href", "/animais/transicoes");
  });

  it("renders status metrics counters", () => {
    render(<AgendaStatusMetrics agendado={3} concluido={1} cancelado={2} />);

    expect(screen.getByText("Agendados")).toBeInTheDocument();
    expect(screen.getByText("Concluidos")).toBeInTheDocument();
    expect(screen.getByText("Cancelados")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
