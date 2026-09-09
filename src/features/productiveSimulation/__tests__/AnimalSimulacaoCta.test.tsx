/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AnimalSimulacaoCta } from "../AnimalSimulacaoCta";

describe("AnimalSimulacaoCta", () => {
  it("renderiza botão de navegação para a rota de simulação do animal", () => {
    render(
      <MemoryRouter>
        <AnimalSimulacaoCta animalId="animal-abc-123" />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: /Simular cenário/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/animais/animal-abc-123/simulacao");
  });
});
