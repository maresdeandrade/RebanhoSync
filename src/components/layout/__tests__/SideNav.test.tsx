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

  function renderSideNav(initialEntry = "/home") {
    render(
      <MemoryRouter
        initialEntries={[initialEntry]}
        future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      >
        <SideNav />
      </MemoryRouter>,
    );
  }

  it("renders current sections, main items, links and active route", () => {
    mockedUseAuth.mockReturnValue({
      role: "manager",
      farmExperienceMode: "completo",
    } as unknown as ReturnType<typeof useAuth>);

    renderSideNav("/agenda");

    expect(screen.getByText("Operacao")).toBeInTheDocument();
    expect(screen.getByText("Estrutura")).toBeInTheDocument();
    expect(screen.getByText("Gestao")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /hoje/i })).toHaveAttribute(
      "href",
      "/home",
    );
    expect(screen.getByRole("link", { name: /registrar/i })).toHaveAttribute(
      "href",
      "/registrar",
    );
    expect(screen.getByRole("link", { name: /agenda/i })).toHaveAttribute(
      "href",
      "/agenda",
    );
    expect(screen.getByRole("link", { name: /animais/i })).toHaveAttribute(
      "href",
      "/animais",
    );
    expect(screen.getByRole("link", { name: /lotes/i })).toHaveAttribute(
      "href",
      "/lotes",
    );
    expect(screen.getByRole("link", { name: /pastos/i })).toHaveAttribute(
      "href",
      "/pastos",
    );
    expect(screen.getByRole("link", { name: /agenda/i })).toHaveClass(
      "bg-sidebar-primary",
    );
  });

  it("keeps reproducao visible and hides advanced modules in essential mode", () => {
    mockedUseAuth.mockReturnValue({
      role: "manager",
      farmExperienceMode: "essencial",
    } as unknown as ReturnType<typeof useAuth>);

    renderSideNav();

    expect(screen.getByText("Reproducao")).toBeInTheDocument();
    expect(screen.queryByText("Eventos")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /configuracoes/i }));

    expect(screen.getByRole("link", { name: /sanitário/i })).toHaveAttribute(
      "href",
      "/protocolos-sanitarios",
    );
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
    expect(screen.getByRole("link", { name: /lancamentos/i })).toHaveAttribute(
      "href",
      "/financeiro",
    );
    expect(screen.getByRole("link", { name: /parceiros/i })).toHaveAttribute(
      "href",
      "/contrapartes",
    );

    fireEvent.click(screen.getByRole("button", { name: /configuracoes/i }));

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ajustes/i })).toHaveAttribute(
      "href",
      "/configuracoes",
    );
    expect(screen.getByRole("link", { name: /sanitário/i })).toHaveAttribute(
      "href",
      "/protocolos-sanitarios",
    );
    expect(screen.queryByText("Categorias")).not.toBeInTheDocument();
    expect(screen.getByText("Reconciliacao")).toBeInTheDocument();
  });
});
