/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { SideNav } from "../SideNav";

vi.mock("@/hooks/useAuth");

describe("SideNav", () => {
  const mockedUseAuth = vi.mocked(useAuth);

  function renderSideNav() {
    render(
      <MemoryRouter
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <SideNav />
      </MemoryRouter>,
    );
  }

  it("keeps reproducao visible and hides advanced modules in essential mode", () => {
    mockedUseAuth.mockReturnValue({
      role: "manager",
      farmExperienceMode: "essencial",
    } as unknown as ReturnType<typeof useAuth>);

    renderSideNav();

    expect(screen.getByText("Reproducao")).toBeInTheDocument();
    expect(screen.queryByText("Eventos")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /configuracoes/i }));

    expect(screen.getByText("Protocolos")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Reconciliacao")).not.toBeInTheDocument();
  });

  it("shows advanced modules in complete mode", () => {
    mockedUseAuth.mockReturnValue({
      role: "manager",
      farmExperienceMode: "completo",
    } as unknown as ReturnType<typeof useAuth>);

    renderSideNav();

    expect(screen.getByText("Reproducao")).toBeInTheDocument();
    expect(screen.getByText("Eventos")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /configuracoes/i }));

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Protocolos")).toBeInTheDocument();
    expect(screen.queryByText("Categorias")).not.toBeInTheDocument();
    expect(screen.getByText("Reconciliacao")).toBeInTheDocument();
  });
});
