/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/hooks/useAuth";
import ProtocolosSanitarios from "@/pages/ProtocolosSanitarios";

vi.mock("@/hooks/useAuth");

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/protocolos-sanitarios"]}>
      <Routes>
        <Route
          path="/protocolos-sanitarios"
          element={
            <>
              <ProtocolosSanitarios />
              <LocationProbe />
            </>
          }
        />
        <Route
          path="/protocolos-sanitarios/catalogo-v2"
          element={<div>Catalogo v2 acessivel</div>}
        />
        <Route path="/select-fazenda" element={<div>Selecionar fazenda</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtocolosSanitarios page", () => {
  const mockedUseAuth = vi.mocked(useAuth);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
      farmExperienceMode: "completo",
      role: "manager",
    } as ReturnType<typeof useAuth>);
  });

  it("oculta superficies legadas e aponta para o Catalogo Sanitario v2", () => {
    renderPage();

    expect(screen.getByText("Protocolos sanitarios")).toBeInTheDocument();
    expect(screen.queryByText("Pack Oficial")).not.toBeInTheDocument();
    expect(screen.queryByText("Pack oficial")).not.toBeInTheDocument();
    expect(screen.queryByText("Conformidade")).not.toBeInTheDocument();
    expect(screen.queryByText("Protocolos da fazenda")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Abrir catalogo sanitario v2" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Consultar catalogo" })).toBeEnabled();
  });

  it("mantem o Catalogo v2 acessivel pela tela principal de protocolos", () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir catalogo sanitario v2" }),
    );

    expect(screen.getByText("Catalogo v2 acessivel")).toBeInTheDocument();
  });

  it("nao renderiza CTAs operacionais legados", () => {
    renderPage();

    for (const forbiddenLabel of [
      /Criar protocolo/i,
      /Editar protocolo/i,
      /Ativar pack/i,
      /Aplicar pack/i,
      /Gerar agenda/i,
      /^Agendar$/i,
      /^Executar$/i,
      /Registrar evento/i,
      /Movimentar estoque/i,
      /Calcular carencia/i,
    ]) {
      expect(
        screen.queryByRole("button", { name: forbiddenLabel }),
      ).not.toBeInTheDocument();
    }
  });
});
