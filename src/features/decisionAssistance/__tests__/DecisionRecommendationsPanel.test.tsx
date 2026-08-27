/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { DecisionRecommendationsPanel } from "@/features/decisionAssistance/DecisionRecommendationsPanel";
import {
  buildOperationalHistoryReviewRecommendation,
  buildOverdueAgendaRecommendation,
} from "@/lib/insights/decisionRecommendations";
import type { AgendaItem } from "@/lib/offline/types";
import {
  createMetricPeriod,
  createMetricResult,
} from "@/lib/reports/metricContract";

describe("DecisionRecommendationsPanel", () => {
  it("shows provenance, limitations, non-authorization and a canonical navigation CTA", () => {
    const recommendation = buildOverdueAgendaRecommendation({
      fazendaId: "farm-1",
      cutoffAt: "2026-08-23T12:00:00.000Z",
      timezone: "America/Sao_Paulo",
      timezoneVerified: true,
      referenceDate: "2026-08-23",
      agenda: {
        availability: "loaded",
        convergence: { mode: "standard_pull", verified: true },
        records: [
          {
            id: "agenda-1",
            fazenda_id: "farm-1",
            dominio: "sanitario",
            tipo: "vacina",
            status: "agendado",
            data_prevista: "2026-08-20",
            animal_id: "animal-1",
            lote_id: null,
            deleted_at: null,
          } as AgendaItem,
        ],
      },
    });

    render(
      <MemoryRouter>
        <DecisionRecommendationsPanel recommendations={[recommendation]} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Decisao assistida")).toBeInTheDocument();
    expect(screen.getByText("Evidencia completa")).toBeInTheDocument();
    expect(screen.getAllByText(/state_agenda_itens/)).toHaveLength(2);
    expect(screen.getByText(/standard_pull/)).toBeInTheDocument();
    expect(screen.getByText(/nao cria Evento/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Revisar Agenda" }),
    ).toHaveAttribute("href", "/agenda");
  });

  it("renders safely while an older snapshot has no recommendations", () => {
    render(
      <MemoryRouter>
        <DecisionRecommendationsPanel />
      </MemoryRouter>,
    );

    expect(screen.getByText("Decisao assistida")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("explains the MetricResult limitation and only navigates to reports", () => {
    const recommendation = buildOperationalHistoryReviewRecommendation({
      fazendaId: "farm-1",
      cutoffAt: "2026-08-23T12:00:00.000Z",
      timezone: "America/Sao_Paulo",
      timezoneVerified: true,
      metrics: {
        availability: "loaded",
        convergence: { mode: "local_derived", verified: true },
        records: [
          {
            metricKey: "eventos_periodo",
            result: createMetricResult({
              value: 4,
              status: "partial",
              period: createMetricPeriod("2026-08-01", "2026-08-23", {
                timezone: "America/Sao_Paulo",
                timezoneSource: "farm",
              }),
              coverage: {
                kind: "historical",
                state: "partial",
                scope: { fazendaId: "farm-1", domain: "operacional" },
                evidence: ["Cobertura local incompleta."],
              },
              sources: [{ name: "event_eventos", role: "primary" }],
              limitations: ["Historico completo nao comprovado."],
            }),
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <DecisionRecommendationsPanel recommendations={[recommendation]} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Evidencia parcial")).toBeInTheDocument();
    expect(screen.getByText(/event_eventos/)).toBeInTheDocument();
    expect(
      screen.getByText(/Historico completo nao comprovado/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Revisar relatorios" }),
    ).toHaveAttribute("href", "/relatorios");
    expect(screen.getByText(/nao cria nem altera Evento/)).toBeInTheDocument();
  });
});
