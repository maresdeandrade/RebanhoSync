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
});
