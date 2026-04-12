/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import { useAuth } from "@/hooks/useAuth";
import { pullDataForFarm } from "@/lib/offline/pull";
import Dashboard from "@/pages/Dashboard";

vi.mock("@/hooks/useAuth");
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));
vi.mock("@/lib/offline/pull", () => ({
  pullDataForFarm: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("recharts", () => {
  const MockContainer = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );

  return {
    ResponsiveContainer: MockContainer,
    BarChart: MockContainer,
    LineChart: MockContainer,
    CartesianGrid: MockContainer,
    Tooltip: MockContainer,
    XAxis: MockContainer,
    YAxis: MockContainer,
    Bar: MockContainer,
    Line: MockContainer,
  };
});

describe("Dashboard page", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);
  const mockedPullDataForFarm = vi.mocked(pullDataForFarm);

  const buildRegulatoryReadModel = (overrides: Record<string, unknown> = {}) => ({
    entries: [],
    attention: {
      total: 0,
      openCount: 0,
      pendingCount: 0,
      adjustmentCount: 0,
      blockingCount: 0,
      feedBanOpenCount: 0,
      criticalChecklistCount: 0,
      badges: [],
      topItems: [],
      groupBadge: null,
    },
    flows: {
      nutrition: {
        blockers: [],
        warnings: [],
        totalCount: 0,
        blockerCount: 0,
        warningCount: 0,
        firstBlockerMessage: null,
        firstWarningMessage: null,
        hasIssues: false,
        tone: "success",
      },
      movementInternal: {
        blockers: [],
        warnings: [],
        totalCount: 0,
        blockerCount: 0,
        warningCount: 0,
        firstBlockerMessage: null,
        firstWarningMessage: null,
        hasIssues: false,
        tone: "success",
      },
      movementExternal: {
        blockers: [],
        warnings: [],
        totalCount: 0,
        blockerCount: 0,
        warningCount: 0,
        firstBlockerMessage: null,
        firstWarningMessage: null,
        hasIssues: false,
        tone: "success",
      },
      sale: {
        blockers: [],
        warnings: [],
        totalCount: 0,
        blockerCount: 0,
        warningCount: 0,
        firstBlockerMessage: null,
        firstWarningMessage: null,
        hasIssues: false,
        tone: "success",
      },
    },
    analytics: {
      subareas: [],
      impacts: [],
    },
    hasOpenIssues: false,
    hasBlockingIssues: false,
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
    } as ReturnType<typeof useAuth>);

    mockedUseLiveQuery.mockImplementation((() => {
      const responses = [
        128,
        7,
        {
          totalOpen: 0,
          criticalCount: 0,
          warningCount: 0,
          mandatoryCount: 0,
          requiresVetCount: 0,
          scheduleModes: [],
          scheduleAnchors: [],
          topItems: [],
        },
        buildRegulatoryReadModel(),
        {
          recentItems: [],
          totalCount: 0,
        },
        {
          successful: 24,
          failed: 0,
          backlog: 1,
          processed: 24,
          successRate: 100,
          rejectionRate: 0,
        },
        [],
        [],
        [],
      ];
      let callCount = 0;
      return () =>
        responses[callCount++] as ReturnType<typeof useLiveQuery>;
    })());
  });

  it("prioritizes operational summary and keeps pilot telemetry collapsed", () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText("Prioridades administrativas")).toBeInTheDocument();
    expect(screen.getAllByText("DLQ local").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fila de sync").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Conformidade regulatoria").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Agenda aberta").length).toBeGreaterThan(0);
    expect(screen.getByText("Leitura do sync")).toBeInTheDocument();
    expect(screen.queryByText("Indicadores do piloto")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /telemetria de piloto/i }));

    expect(screen.getByText("Indicadores do piloto")).toBeInTheDocument();
    expect(mockedPullDataForFarm).toHaveBeenCalledWith(
      "farm-1",
      ["agenda_itens"],
      { mode: "merge" },
    );
  });

  it("expands regulatory analytics by subarea and impact with filtered CTAs", () => {
    mockedUseLiveQuery.mockImplementation((() => {
      const responses = [
        128,
        7,
        {
          totalOpen: 0,
          criticalCount: 0,
          warningCount: 0,
          mandatoryCount: 0,
          requiresVetCount: 0,
          scheduleModes: [],
          scheduleAnchors: [],
          topItems: [],
        },
        buildRegulatoryReadModel({
          attention: {
            total: 3,
            openCount: 3,
            pendingCount: 2,
            adjustmentCount: 1,
            blockingCount: 2,
            feedBanOpenCount: 1,
            criticalChecklistCount: 1,
            badges: [],
            topItems: [],
            groupBadge: null,
          },
          flows: {
            nutrition: {
              blockers: [
                {
                  key: "feed-ban",
                  label: "Feed-ban",
                  message: "Feed-ban aberto para o rebanho ruminante.",
                  severity: "block",
                  tone: "danger",
                },
              ],
              warnings: [],
              totalCount: 1,
              blockerCount: 1,
              warningCount: 0,
              firstBlockerMessage: "Feed-ban aberto para o rebanho ruminante.",
              firstWarningMessage: null,
              hasIssues: true,
              tone: "danger",
            },
            movementInternal: {
              blockers: [],
              warnings: [
                {
                  key: "quarentena",
                  label: "Quarentena",
                  message: "Quarentena ainda exige revisao operacional.",
                  severity: "warning",
                  tone: "warning",
                },
              ],
              totalCount: 1,
              blockerCount: 0,
              warningCount: 1,
              firstBlockerMessage: null,
              firstWarningMessage: "Quarentena ainda exige revisao operacional.",
              hasIssues: true,
              tone: "warning",
            },
            movementExternal: {
              blockers: [
                {
                  key: "documental",
                  label: "Documental",
                  message: "Checklist documental bloqueia o transito externo.",
                  severity: "block",
                  tone: "warning",
                },
              ],
              warnings: [],
              totalCount: 1,
              blockerCount: 1,
              warningCount: 0,
              firstBlockerMessage: "Checklist documental bloqueia o transito externo.",
              firstWarningMessage: null,
              hasIssues: true,
              tone: "danger",
            },
            sale: {
              blockers: [
                {
                  key: "documental",
                  label: "Documental",
                  message: "Checklist documental bloqueia o transito externo.",
                  severity: "block",
                  tone: "warning",
                },
              ],
              warnings: [],
              totalCount: 1,
              blockerCount: 1,
              warningCount: 0,
              firstBlockerMessage: "Checklist documental bloqueia o transito externo.",
              firstWarningMessage: null,
              hasIssues: true,
              tone: "danger",
            },
          },
          analytics: {
            subareas: [
              {
                key: "feed_ban",
                label: "Feed-ban",
                openCount: 1,
                blockerCount: 1,
                warningCount: 0,
                adjustmentCount: 0,
                pendingCount: 1,
                tone: "danger",
                affectedImpacts: ["nutrition"],
                recommendation:
                  "Revisar formulacao de ruminantes antes de liberar qualquer registro de nutricao.",
              },
              {
                key: "documental",
                label: "Documental",
                openCount: 1,
                blockerCount: 1,
                warningCount: 0,
                adjustmentCount: 0,
                pendingCount: 1,
                tone: "danger",
                affectedImpacts: ["sale"],
                recommendation:
                  "Regularizar GTA, comprovacao ou etapa documental antes de liberar transito e venda.",
              },
            ],
            impacts: [
              {
                key: "nutrition",
                label: "Impacta nutricao",
                blockerCount: 1,
                warningCount: 0,
                totalCount: 1,
                tone: "danger",
                message: "Feed-ban aberto para o rebanho ruminante.",
              },
              {
                key: "movementInternal",
                label: "Impacta lote",
                blockerCount: 0,
                warningCount: 1,
                totalCount: 1,
                tone: "warning",
                message: "Quarentena ainda exige revisao operacional.",
              },
              {
                key: "sale",
                label: "Impacta transito/venda",
                blockerCount: 1,
                warningCount: 0,
                totalCount: 1,
                tone: "danger",
                message: "Checklist documental bloqueia o transito externo.",
              },
            ],
          },
          hasOpenIssues: true,
          hasBlockingIssues: true,
        }),
        {
          recentItems: [],
          totalCount: 0,
        },
        {
          successful: 24,
          failed: 0,
          backlog: 1,
          processed: 24,
          successRate: 100,
          rejectionRate: 0,
        },
        [],
        [],
        [],
      ];
      let callCount = 0;
      return () => responses[callCount++] as ReturnType<typeof useLiveQuery>;
    })());

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Dashboard />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Pendencias regulatorias por subarea"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Impacto operacional da conformidade"),
    ).toBeInTheDocument();
    const subareaLinks = screen.getAllByRole("link", {
      name: /abrir overlay filtrado/i,
    });
    expect(subareaLinks[0]).toHaveAttribute(
      "href",
      "/protocolos-sanitarios?overlaySubarea=feed_ban",
    );
    const impactLinks = screen.getAllByRole("link", { name: /abrir recorte/i });
    expect(impactLinks[0]).toHaveAttribute(
      "href",
      "/protocolos-sanitarios?overlayImpact=nutrition",
    );
    const animalLinks = screen.getAllByRole("link", { name: /ver animais/i });
    expect(animalLinks[0]).toHaveAttribute(
      "href",
      "/animais?overlaySubarea=feed_ban",
    );
  });

  it("exposes declarative sanitary cuts with direct agenda and animal-centric links", () => {
    mockedUseLiveQuery.mockImplementation((() => {
      const responses = [
        128,
        7,
        {
          totalOpen: 4,
          criticalCount: 2,
          warningCount: 1,
          mandatoryCount: 2,
          requiresVetCount: 1,
          scheduleModes: [
            {
              key: "campaign",
              label: "Campanha",
              count: 2,
            },
            {
              key: "age_window",
              label: "Janela etaria",
              count: 1,
            },
          ],
          scheduleAnchors: [
            {
              key: "calendar_month",
              label: "Calendario",
              count: 2,
            },
            {
              key: "birth",
              label: "Nascimento",
              count: 1,
            },
          ],
          topItems: [],
        },
        buildRegulatoryReadModel(),
        {
          recentItems: [],
          totalCount: 0,
        },
        {
          successful: 24,
          failed: 0,
          backlog: 0,
          processed: 24,
          successRate: 100,
          rejectionRate: 0,
        },
        [],
        [],
        [],
      ];
      let callCount = 0;
      return () => responses[callCount++] as ReturnType<typeof useLiveQuery>;
    })());

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Dashboard />
      </MemoryRouter>,
    );

    expect(screen.getByText("Agenda sanitaria por calendario")).toBeInTheDocument();
    expect(screen.getByText("Agenda sanitaria por ancora")).toBeInTheDocument();
    expect(screen.getByText("Campanha")).toBeInTheDocument();
    expect(screen.getByText("Janela etaria")).toBeInTheDocument();
    expect(screen.getByText("Nascimento")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /abrir campanha/i })).toHaveAttribute(
      "href",
      "/agenda?calendarMode=campaign",
    );
    expect(screen.getByRole("link", { name: /abrir nascimento/i })).toHaveAttribute(
      "href",
      "/agenda?calendarAnchor=birth",
    );
    expect(
      document.querySelector('a[href="/animais?calendarMode=campaign"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('a[href="/animais?calendarAnchor=birth"]'),
    ).not.toBeNull();
  });
});
