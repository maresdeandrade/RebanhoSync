/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Layers } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { EmptyState as CanonicalEmptyState } from "../empty-state";
import { EmptyState as LegacyEmptyState } from "@/components/EmptyState";

describe("EmptyState", () => {
  it("renders title, description and icon", () => {
    render(
      <CanonicalEmptyState
        icon={Layers}
        title="Nenhum lote cadastrado"
        description="Cadastre lotes para iniciar a gestão"
      />,
    );

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "Nenhum lote cadastrado",
    );
    expect(
      screen.getByText("Cadastre lotes para iniciar a gestão"),
    ).toBeInTheDocument();
  });

  it("handles action click event", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <CanonicalEmptyState
        icon={Layers}
        title="Vazio"
        action={{
          label: "Criar novo",
          onClick: handleClick,
        }}
      />,
    );

    const button = screen.getByRole("button", { name: "Criar novo" });
    await user.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("preserves compatibility through the legacy import path", () => {
    expect(LegacyEmptyState).toBe(CanonicalEmptyState);
  });
});
