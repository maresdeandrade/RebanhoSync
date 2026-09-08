/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MetricCard } from "../metric-card";

describe("MetricCard", () => {
  it("renders label and value with default styling", () => {
    render(<MetricCard label="Animais ativos" value={142} />);

    expect(screen.getByText("Animais ativos")).toBeInTheDocument();
    expect(screen.getByText("142")).toBeInTheDocument();
  });

  it("renders hint when provided", () => {
    render(
      <MetricCard
        label="Fila local"
        value={3}
        hint="A sincronizar com o servidor"
      />,
    );

    expect(screen.getByText("A sincronizar com o servidor")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(
      <MetricCard
        label="Notificações"
        value={5}
        icon={<span data-testid="metric-icon">🔔</span>}
      />,
    );

    expect(screen.getByTestId("metric-icon")).toBeInTheDocument();
  });

  it("applies semantic tone styles", () => {
    const { container } = render(
      <MetricCard
        label="Alertas sanitários"
        value={2}
        tone="danger"
      />,
    );

    expect(container.firstChild).toHaveClass("border-destructive/25");
  });

  it("renders extraContent when provided", () => {
    render(
      <MetricCard
        label="Cobertura ECC"
        value="12/15"
        extraContent={<span data-testid="extra">3 sem avaliação</span>}
      />,
    );

    expect(screen.getByTestId("extra")).toHaveTextContent("3 sem avaliação");
  });
});
