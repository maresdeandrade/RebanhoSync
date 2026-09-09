/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/hooks/useAuth";
import AnimalSimulacao from "../AnimalSimulacao";

vi.mock("@/hooks/useAuth");
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));
vi.mock("@/features/productiveSimulation/ProductiveCommercialSimulator", () => ({
  ProductiveCommercialSimulator: ({ animal }: { animal: { brinco?: string } }) => (
    <div data-testid="mock-simulator">Simulator for {animal.brinco}</div>
  ),
}));

describe("AnimalSimulacao page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      currentFazenda: { id: "fazenda-1", nome: "Fazenda Modelo" },
    } as unknown as ReturnType<typeof useAuth>);
  });

  it("renderiza simulador quando o animal existe na fazenda", () => {
    vi.mocked(useLiveQuery).mockReturnValue({
      id: "animal-123",
      brinco: "BR-42",
      nome: "Mimosa",
      fazenda_id: "fazenda-1",
      deleted_at: null,
    });

    render(
      <MemoryRouter initialEntries={["/animais/animal-123/simulacao"]}>
        <Routes>
          <Route path="/animais/:id/simulacao" element={<AnimalSimulacao />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Simulação de Cenários — BR-42/i)).toBeInTheDocument();
    expect(screen.getByTestId("mock-simulator")).toHaveTextContent("Simulator for BR-42");
    expect(screen.getByText("Voltar para o detalhe do animal")).toBeInTheDocument();
  });

  it("exibe mensagem de carregamento quando o animal não for encontrado imediatamente", () => {
    vi.mocked(useLiveQuery).mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={["/animais/animal-123/simulacao"]}>
        <Routes>
          <Route path="/animais/:id/simulacao" element={<AnimalSimulacao />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Carregando dados do animal...")).toBeInTheDocument();
  });
});
