/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OperationalInsightsPanel } from "@/features/operationalInsights/OperationalInsightsPanel";
import { buildOperationalInsights } from "@/features/operationalInsights/operationalInsightsAdapter";

const generatedAt = "2026-05-07T12:00:00.000Z";
const referenceDate = "2026-05-07";
const monthlyPeriod = { start: "2026-05-01", end: "2026-05-31" };

function expectReadOnly(container: HTMLElement) {
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(container.querySelector("a, button")).toBeNull();
}

describe("OperationalInsightsPanel", () => {
  it("renders read-only complete, partial and signal cards", () => {
    const viewModel = buildOperationalInsights({
      generatedAt,
      referenceDate,
      monthlyPeriod,
      sources: {
        agendaItems: [
          {
            id: "agenda-overdue",
            status: "agendado",
            data_prevista: "2026-05-06",
            dominio: "sanitario",
            tipo: "brucelose",
            source_ref: { produto: "Vacina Brucelose" },
          },
          {
            id: "agenda-missing-product",
            status: "agendado",
            data_prevista: "2026-05-08",
            dominio: "sanitario",
            tipo: "sanitario_sem_produto",
          },
          {
            id: "agenda-future-product",
            status: "agendado",
            data_prevista: "2026-05-09",
            dominio: "sanitario",
            tipo: "raiva",
            source_ref: { produto: "Vacina Raiva" },
          },
        ],
        animals: [
          {
            id: "animal-1",
            status: "ativo",
            lote_id: "lote-1",
            payload: {
              taxonomy_facts: {
                categoria_zootecnica: "vaca",
              },
            },
          },
        ],
        events: [
          {
            id: "event-1",
            dominio: "sanitario",
            occurred_at: "2026-05-05T12:00:00.000Z",
            animal_id: "animal-1",
          },
        ],
      },
      requireSanitaryProductSource: false,
    });

    const { container } = render(<OperationalInsightsPanel viewModel={viewModel} />);

    expect(screen.getByText("Central Operacional")).toBeInTheDocument();
    const priorityTitles = screen.getAllByText(
      /Atrasadas|Vencendo hoje|Pendencias abertas|Pendencias sanitarias/,
    );
    expect(priorityTitles.map((title) => title.textContent)).toEqual([
      "Atrasadas",
      "Vencendo hoje",
      "Pendencias abertas",
      "Pendencias sanitarias",
    ]);
    expect(screen.getByText("Resumo por estagio")).toBeInTheDocument();
    expect(screen.getByText("KPIs mensais")).toBeInTheDocument();
    expect(screen.getByText("Sinais operacionais auxiliares")).toBeInTheDocument();
    expect(screen.getAllByText("Parcial").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fonte carregada com limitacao.").length)
      .toBeGreaterThan(0);
    expect(screen.getAllByText("Fonte carregada, leitura completa.").length)
      .toBeGreaterThan(0);
    expect(screen.getByText("Vacina Raiva: 1")).toBeInTheDocument();
    expect(screen.getByText("vaca: 1")).toBeInTheDocument();
    expect(screen.getByText("sanitario: 1")).toBeInTheDocument();
    expect(screen.getByText("agenda:atrasada")).toBeInTheDocument();
    expect(screen.getByText("Sinais auxiliares; nao persistem tags."))
      .toBeInTheDocument();
    expect(screen.getAllByText(/Fonte: state_agenda_itens/i).length)
      .toBeGreaterThan(0);
    expectReadOnly(container);
  });

  it("renders blocked primary-source cards instead of hiding them", () => {
    const viewModel = buildOperationalInsights({
      generatedAt,
      referenceDate,
      monthlyPeriod,
      sources: {},
    });

    const { container } = render(<OperationalInsightsPanel viewModel={viewModel} />);

    expect(screen.getAllByText("Bloqueado").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fonte obrigatoria ausente.").length)
      .toBeGreaterThan(0);
    expect(screen.getAllByText("Leitura bloqueada").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Pendencias atuais exigem agenda aberta ja carregada."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Fonte ausente").length).toBeGreaterThan(0);
    expect(screen.getByText("Nenhum sinal auxiliar emitido pelas fontes carregadas."))
      .toBeInTheDocument();
    expectReadOnly(container);
  });

  it("renders loaded empty arrays as empty cards", () => {
    const viewModel = buildOperationalInsights({
      generatedAt,
      referenceDate,
      monthlyPeriod,
      sources: {
        agendaItems: [],
        animals: [],
        events: [],
      },
    });

    const { container } = render(<OperationalInsightsPanel viewModel={viewModel} />);

    expect(screen.getAllByText("Vazio").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fonte carregada, sem itens.").length)
      .toBeGreaterThan(0);
    expect(screen.queryByText("Pendencias atuais exigem agenda aberta ja carregada."))
      .not.toBeInTheDocument();
    expectReadOnly(container);
  });
});
