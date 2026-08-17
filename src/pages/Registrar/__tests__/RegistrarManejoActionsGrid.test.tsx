/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RegistrarManejoActionsGrid } from "../components/RegistrarManejoActionsGrid";

describe("RegistrarManejoActionsGrid", () => {
  it("mantém ações com animais bloqueadas sem alvo e libera negócios patrimoniais", () => {
    render(
      <RegistrarManejoActionsGrid
        tipoManejo=""
        selectedAnimaisCount={0}
        hasExistingTarget={false}
        onSelectAction={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Pesagem" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Negócios Patrimoniais" }),
    ).not.toBeDisabled();
  });
});
