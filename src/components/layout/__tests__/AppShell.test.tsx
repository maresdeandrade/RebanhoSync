/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AppShell } from "../AppShell";
import { PageContainer } from "../PageContainer";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ activeFarmId: "farm-1" }),
}));

vi.mock("@/components/notifications/SanitaryNotificationManager", () => ({
  SanitaryNotificationManager: () => null,
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/offline/syncWorker", () => ({
  startSyncWorker: vi.fn(),
  stopSyncWorker: vi.fn(),
}));

vi.mock("../TopBar", () => ({
  TopBar: () => <header data-testid="topbar" />,
}));

vi.mock("../SideNav", () => ({
  SideNav: ({ mobile = false }: { mobile?: boolean }) => (
    <nav aria-label={mobile ? "Menu completo" : "Navegacao principal"} />
  ),
}));

vi.mock("../MobileBottomNav", () => ({
  MobileBottomNav: () => <nav aria-label="Navegacao mobile" />,
}));

describe("AppShell", () => {
  it("keeps one main landmark and the canonical shell regions", () => {
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/home" element={<p>Conteudo da pagina</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("topbar")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Navegacao principal" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Navegacao mobile" }),
    ).toBeInTheDocument();

    const main = screen.getByRole("main");
    expect(main).toHaveClass(
      "min-w-0",
      "flex-1",
      "pb-[calc(6rem+env(safe-area-inset-bottom))]",
    );
    expect(main.querySelectorAll(".app-content")).toHaveLength(1);
    expect(screen.getByText("Conteudo da pagina")).toBeInTheDocument();
  });
});

describe("PageContainer", () => {
  it.each([
    ["full", "max-w-none"],
    ["standard", "max-w-7xl"],
    ["narrow", "max-w-5xl"],
  ] as const)("maps %s to its canonical width", (width, expectedClass) => {
    render(
      <PageContainer width={width} data-testid={`container-${width}`} />,
    );

    expect(screen.getByTestId(`container-${width}`)).toHaveClass(
      "mx-auto",
      "w-full",
      expectedClass,
    );
  });
});
