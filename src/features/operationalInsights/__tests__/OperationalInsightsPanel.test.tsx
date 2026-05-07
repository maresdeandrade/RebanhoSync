/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OperationalInsightsPanel } from "@/features/operationalInsights/OperationalInsightsPanel";
import { buildOperationalInsights } from "@/features/operationalInsights/operationalInsightsAdapter";

const generatedAt = "2026-05-07T12:00:00.000Z";
const referenceDate = "2026-05-07";
const monthlyPeriod = { start: "2026-05-01", end: "2026-05-31" };

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

    render(<OperationalInsightsPanel viewModel={viewModel} />);

    expect(screen.getByText("Central Operacional")).toBeInTheDocument();
    expect(screen.getByText("Pendencias abertas")).toBeInTheDocument();
    expect(screen.getByText("Vencendo hoje")).toBeInTheDocument();
    expect(screen.getByText("Atrasadas")).toBeInTheDocument();
    expect(screen.getByText("Pendencias sanitarias")).toBeInTheDocument();
    expect(screen.getByText("Resumo por estagio")).toBeInTheDocument();
    expect(screen.getByText("KPIs mensais")).toBeInTheDocument();
    expect(screen.getByText("Sinais operacionais auxiliares")).toBeInTheDocument();
    expect(screen.getAllByText("Parcial").length).toBeGreaterThan(0);
    expect(screen.getByText("Vacina Raiva: 1")).toBeInTheDocument();
    expect(screen.getByText("vaca: 1")).toBeInTheDocument();
    expect(screen.getByText("sanitario: 1")).toBeInTheDocument();
    expect(screen.getByText("agenda:atrasada")).toBeInTheDocument();
    expect(screen.getAllByText(/sinal auxiliar nao persistido/i).length)
      .toBeGreaterThan(0);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders blocked primary-source cards instead of hiding them", () => {
    const viewModel = buildOperationalInsights({
      generatedAt,
      referenceDate,
      monthlyPeriod,
      sources: {},
    });

    render(<OperationalInsightsPanel viewModel={viewModel} />);

    expect(screen.getAllByText("Bloqueado").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Pendencias atuais exigem agenda aberta ja carregada."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("sem fonte primaria").length).toBeGreaterThan(0);
    expect(screen.getByText("Nenhum sinal auxiliar emitido pelas fontes carregadas."))
      .toBeInTheDocument();
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

    render(<OperationalInsightsPanel viewModel={viewModel} />);

    expect(screen.getAllByText("Vazio").length).toBeGreaterThan(0);
    expect(screen.queryByText("Pendencias atuais exigem agenda aberta ja carregada."))
      .not.toBeInTheDocument();
  });
});
