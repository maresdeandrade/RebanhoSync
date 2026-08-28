/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { DecisionRecommendationsPanel } from "@/features/decisionAssistance/DecisionRecommendationsPanel";
import {
  buildHerdFlowReviewRecommendation,
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
    expect(screen.getByText("Revisao operacional")).toBeInTheDocument();
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
    expect(screen.getByText("Cobertura e fluxo")).toBeInTheDocument();
    expect(screen.getByText(/event_eventos/)).toBeInTheDocument();
    expect(
      screen.getByText(/Historico completo nao comprovado/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Revisar relatorios" }),
    ).toHaveAttribute("href", "/relatorios");
    expect(screen.getByText(/nao cria nem altera Evento/)).toBeInTheDocument();
  });

  it("keeps the herd flow CTA navigational and free of factual effects", () => {
    const period = createMetricPeriod("2026-08-01", "2026-08-23", {
      timezone: "America/Sao_Paulo",
      timezoneSource: "farm",
    });
    const coverage = {
      kind: "historical" as const,
      state: "partial" as const,
      scope: { fazendaId: "farm-1", domain: "rebanho" },
      evidence: ["Cobertura local incompleta."],
    };
    const input = {
      fazendaId: "farm-1",
      cutoffAt: "2026-08-23T12:00:00.000Z",
      timezone: "America/Sao_Paulo",
      timezoneVerified: true,
      metrics: {
        availability: "loaded" as const,
        convergence: { mode: "local_derived" as const, verified: true },
        records: [
          {
            metricKey: "rebanho_entradas",
            result: createMetricResult({
              value: 3,
              status: "partial",
              period,
              coverage,
              sources: [
                { name: "event_eventos", role: "primary" },
                { name: "event_eventos_comercial", role: "auxiliary" },
                { name: "event_eventos_reproducao", role: "auxiliary" },
              ],
              limitations: ["Transferencias externas nao sao inferidas."],
            }),
          },
          {
            metricKey: "rebanho_saidas",
            result: createMetricResult({
              value: 1,
              status: "partial",
              period,
              coverage,
              sources: [
                { name: "event_eventos", role: "primary" },
                { name: "event_eventos_comercial", role: "auxiliary" },
              ],
              limitations: ["Descarte sem Evento nao e fabricado."],
            }),
          },
        ],
      },
    };
    const snapshot = structuredClone(input);
    const recommendation = buildHerdFlowReviewRecommendation(input);

    render(
      <MemoryRouter>
        <DecisionRecommendationsPanel recommendations={[recommendation]} />
      </MemoryRouter>,
    );

    const cta = screen.getByRole("link", { name: "Revisar relatorios" });
    expect(cta).toHaveAttribute("href", "/relatorios");
    expect(screen.getByText("Fontes auxiliares:")).toBeInTheDocument();
    expect(screen.getByText(/event_eventos_comercial/)).toBeInTheDocument();
    expect(screen.getByText(/Outras limitacoes/)).toBeInTheDocument();
    fireEvent.click(cta);
    expect(input).toEqual(snapshot);
    expect(
      screen.getByText(/nao move animal nem altera state_/),
    ).toBeInTheDocument();
  });

  it("prioritizes review states without changing recommendation meaning", () => {
    const base = buildOperationalHistoryReviewRecommendation({
      fazendaId: "farm-1",
      cutoffAt: "2026-08-23T12:00:00.000Z",
      timezone: "America/Sao_Paulo",
      timezoneVerified: true,
      metrics: {
        availability: "not_loaded",
        convergence: { mode: "not_verified", verified: false },
      },
    });
    const confirmed = {
      ...base,
      id: "confirmed-last",
      status: "confirmed" as const,
      question: "Leitura confirmada",
    };
    const ambiguous = {
      ...base,
      id: "ambiguous-first",
      status: "ambiguous" as const,
      question: "Conflito para revisar",
    };

    render(
      <MemoryRouter>
        <DecisionRecommendationsPanel
          recommendations={[confirmed, ambiguous]}
        />
      </MemoryRouter>,
    );

    const higherPriority = screen.getByText("Conflito para revisar");
    const lowerPriority = screen.getByText("Leitura confirmada");
    expect(
      higherPriority.compareDocumentPosition(lowerPriority) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
