/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectionHeader } from "../section-header";
import { PageHeader } from "../page-header";
import { PageIntro } from "../page-intro";

describe("SectionHeader", () => {
  it("renders h2 heading by default with title and description", () => {
    render(
      <SectionHeader
        title="Histórico de Pesagens"
        description="Pesagens factuais registradas para o lote"
      />,
    );

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("Histórico de Pesagens");
    expect(
      screen.getByText("Pesagens factuais registradas para o lote"),
    ).toBeInTheDocument();
  });

  it("supports level 3 heading when requested", () => {
    render(
      <SectionHeader
        title="Cockpit de Manejo"
        level={3}
      />,
    );

    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveTextContent("Cockpit de Manejo");
  });

  it("renders actions and badge when provided", () => {
    render(
      <SectionHeader
        title="Animais"
        badge={<span data-testid="test-badge">12 ativos</span>}
        actions={<button type="button">Novo Animal</button>}
      />,
    );

    expect(screen.getByTestId("test-badge")).toHaveTextContent("12 ativos");
    expect(screen.getByRole("button", { name: "Novo Animal" })).toBeInTheDocument();
  });

  it("applies border class when bordered is true", () => {
    const { container } = render(
      <SectionHeader
        title="Seção com borda"
        bordered
      />,
    );

    expect(container.firstChild).toHaveClass("border-b", "border-border/70");
  });
});

describe("PageHeader alias", () => {
  it("exports PageHeader pointing to PageIntro", () => {
    expect(PageHeader).toBe(PageIntro);
  });
});
