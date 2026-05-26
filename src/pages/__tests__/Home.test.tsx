/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Home from "../Home";

type HomeSnapshotStub = {
  generatedAt: string;
  referenceDate: string;
  monthlyPeriod: { start: string; end: string };
  operationalInsightSources: Record<string, unknown>;
  animais: number;
  lotes: number;
  pastos: number;
  protocolos: number;
  agendaHoje: number;
  agendaAtrasada: number;
  syncSummary: {
    pendingCount: number;
    savedLocalCount: number;
    syncingCount: number;
    rejectionCount: number;
    lastCompletedStage: string | null;
    lastCompletedAt: string | null;
  };
  lifecyclePendings: Array<{
    animalId: string;
    identificacao: string;
    currentStageLabel: string;
    targetStageLabel: string;
    queueKindLabel: string;
    canAutoApply: boolean;
    reason: string;
  }>;
  lifecyclePendingCount: number;
  lifecycleStrategicCount: number;
  lifecycleBiologicalCount: number;
  sanitaryAttention: {
    criticalCount: number;
    warningCount: number;
    totalOpen: number;
    mandatoryCount: number;
    requiresVetCount: number;
    scheduleModes: Array<{ key: string; label: string; count: number }>;
    operationalClasses: Array<{ key: string; label: string; count: number }>;
    topItems: unknown[];
  };
  regulatoryCompliance: {
    hasBlockingIssues: boolean;
    attention: {
      openCount: number;
      badges: Array<{ key: string; label: string; count: number; tone: "neutral" }>;
      topItems: unknown[];
    };
    flows: {
      nutrition: { blockerCount: number };
      sale: { blockerCount: number };
      movementInternal: { warningCount: number };
    };
  };
  replenishmentAlerts: Array<{
    insumoId: string;
    productId: string | null;
    insumo: string;
    categoria: string;
    tipo: string;
    unidadeBase: string;
    severity: "warning" | "critical";
    currentBalanceBase: number;
    futureDemandBase: number;
    projectedBalanceBase: number;
    minimumStockBase: number | null;
    reorderPointBase: number | null;
    currentGapBase: number | null;
    projectedGapBase: number | null;
    reasons: string[];
  }>;
  proximosItens: Array<{
    id: string;
    data: string;
    titulo: string;
    contexto: string;
    status: "hoje" | "atrasado" | "proximo";
  }>;
  eventosRecentes: Array<{
    id: string;
    titulo: string;
    contexto: string;
    data: string;
  }>;
  checklist: Array<{
    label: string;
    helper: string;
    path: string;
    done: boolean;
  }>;
};

let currentSnapshot: HomeSnapshotStub | null = null;

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: () => currentSnapshot,
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    activeFarmId: "farm-1",
    role: "manager",
    farmLifecycleConfig: {},
  }),
}));

vi.mock("@/lib/offline/db", () => ({
  db: {},
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          is: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/components/offline/SyncStatusPanel", () => ({
  SyncStatusPanel: ({
    summary,
  }: {
    summary: HomeSnapshotStub["syncSummary"];
  }) => (
    <section aria-label="Estado de sync">
      Rejeicoes {summary.rejectionCount}
    </section>
  ),
}));

vi.mock("@/features/operationalInsights/useOperationalInsights", () => ({
  useOperationalInsights: () => ({}),
}));

vi.mock("@/features/operationalInsights/OperationalInsightsPanel", () => ({
  OperationalInsightsPanel: () => (
    <section aria-label="Central Operacional">Insights read-only</section>
  ),
}));

function createSnapshot(
  overrides: Partial<HomeSnapshotStub> = {},
): HomeSnapshotStub {
  return {
    generatedAt: "2026-05-08T12:00:00.000Z",
    referenceDate: "2026-05-08",
    monthlyPeriod: { start: "2026-05-01", end: "2026-05-31" },
    operationalInsightSources: {},
    animais: 12,
    lotes: 3,
    pastos: 4,
    protocolos: 1,
    agendaHoje: 0,
    agendaAtrasada: 0,
    syncSummary: {
      pendingCount: 0,
      savedLocalCount: 0,
      syncingCount: 0,
      rejectionCount: 0,
      lastCompletedStage: null,
      lastCompletedAt: null,
    },
    lifecyclePendings: [],
    lifecyclePendingCount: 0,
    lifecycleStrategicCount: 0,
    lifecycleBiologicalCount: 0,
    sanitaryAttention: {
      criticalCount: 0,
      warningCount: 0,
      totalOpen: 0,
      mandatoryCount: 0,
      requiresVetCount: 0,
      scheduleModes: [],
      operationalClasses: [],
      topItems: [],
    },
    regulatoryCompliance: {
      hasBlockingIssues: false,
      attention: {
        openCount: 0,
        badges: [],
        topItems: [],
      },
      flows: {
        nutrition: { blockerCount: 0 },
        sale: { blockerCount: 0 },
        movementInternal: { warningCount: 0 },
      },
    },
    replenishmentAlerts: [],
    proximosItens: [],
    eventosRecentes: [],
    checklist: [],
    ...overrides,
  };
}

function renderHome() {
  render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
    >
      <Home />
    </MemoryRouter>,
  );
}

describe("Home", () => {
  beforeEach(() => {
    currentSnapshot = createSnapshot();
  });

  it("renders overdue and due today agenda items before broad views", () => {
    currentSnapshot = createSnapshot({
      agendaAtrasada: 1,
      agendaHoje: 1,
      proximosItens: [
        {
          id: "agenda-overdue",
          data: "2026-05-07",
          titulo: "Sanitario: vacinacao",
          contexto: "Animal 001",
          status: "atrasado",
        },
        {
          id: "agenda-today",
          data: "2026-05-08",
          titulo: "Pesagem: lote 2",
          contexto: "Lote recria",
          status: "hoje",
        },
      ],
    });

    renderHome();

    expect(screen.getByText("Pendencias atrasadas")).toBeInTheDocument();
    expect(screen.getByText("Sanitario: vacinacao")).toBeInTheDocument();
    expect(screen.getAllByText("Agenda de hoje").length).toBeGreaterThan(0);
    expect(screen.getByText("Pesagem: lote 2")).toBeInTheDocument();
  });

  it("renders explicit empty states for daily agenda", () => {
    renderHome();

    expect(
      screen.getByText("Sem pendencias atrasadas no recorte carregado."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nada vence hoje no recorte carregado/i),
    ).toBeInTheDocument();
  });

  it("keeps safe CTAs for Agenda, Registrar and Rebanho", () => {
    renderHome();

    expect(
      screen.getAllByRole("link", { name: /registrar manejo/i })[0],
    ).toHaveAttribute("href", "/registrar");
    expect(
      screen.getByRole("link", { name: /ver agenda completa/i }),
    ).toHaveAttribute("href", "/agenda");
    expect(screen.getByRole("link", { name: /ver rebanho/i })).toHaveAttribute(
      "href",
      "/animais",
    );
  });

  it("links sanitary operational classes to the filtered agenda", () => {
    currentSnapshot = createSnapshot({
      sanitaryAttention: {
        criticalCount: 1,
        warningCount: 0,
        totalOpen: 1,
        mandatoryCount: 1,
        requiresVetCount: 0,
        scheduleModes: [],
        operationalClasses: [
          {
            key: "operational_protocol",
            label: "Protocolo operacional",
            count: 1,
          },
        ],
        topItems: [
          {
            id: "agenda-sanitaria-1",
            data: "2026-05-08",
            titulo: "Calendario oficial: Endectocida",
            contexto: "Matrizes",
            produto: "Endectocida",
            priorityLabel: "Critico hoje",
            priorityTone: "danger",
            mandatory: true,
            requiresVet: false,
            operationalClass: "operational_protocol",
          },
        ],
      },
    });

    renderHome();

    expect(
      screen.getByRole("link", { name: /protocolo operacional 1/i }),
    ).toHaveAttribute("href", "/agenda?operationalClass=operational_protocol");
    expect(screen.getAllByText("Protocolo operacional").length).toBeGreaterThan(0);
  });

  it("keeps sync status visible", () => {
    currentSnapshot = createSnapshot({
      syncSummary: {
        pendingCount: 1,
        savedLocalCount: 1,
        syncingCount: 0,
        rejectionCount: 2,
        lastCompletedStage: null,
        lastCompletedAt: null,
      },
    });

    renderHome();

    expect(
      screen.getByRole("region", { name: /estado de sync/i }),
    ).toHaveTextContent("Rejeicoes 2");
  });

  it("renders passive inventory replenishment alerts", () => {
    currentSnapshot = createSnapshot({
      replenishmentAlerts: [
        {
          insumoId: "insumo-sal",
          productId: "produto-sal",
          insumo: "Sal mineral",
          categoria: "suplemento",
          tipo: "nutricional",
          unidadeBase: "kg",
          severity: "warning",
          currentBalanceBase: 30,
          futureDemandBase: 12,
          projectedBalanceBase: 18,
          minimumStockBase: 20,
          reorderPointBase: 50,
          currentGapBase: 20,
          projectedGapBase: 2,
          reasons: ["Demanda futura projeta saldo abaixo do estoque minimo."],
        },
      ],
    });

    renderHome();

    expect(screen.getByText("Reposicao de estoque")).toBeInTheDocument();
    expect(screen.getByText("Sal mineral")).toBeInTheDocument();
    expect(
      screen.getByText(/demanda futura projeta saldo abaixo do estoque minimo/i),
    ).toBeInTheDocument();
  });

  it("renders loading state without showing empty agenda states", () => {
    currentSnapshot = null;

    renderHome();

    expect(screen.getByText("Carregando a rotina da fazenda")).toBeInTheDocument();
    expect(
      screen.queryByText("Sem pendencias atrasadas no recorte carregado."),
    ).not.toBeInTheDocument();
  });
});

