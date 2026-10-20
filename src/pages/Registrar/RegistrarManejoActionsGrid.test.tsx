/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import { RegistrarManejoActionsGrid } from "./components/RegistrarManejoActionsGrid";

describe("RegistrarManejoActionsGrid", () => {
  it("deve renderizar todos os botoes de acao de manejo", () => {
    render(
      <RegistrarManejoActionsGrid
        tipoManejo=""
        selectedAnimaisCount={1}
        hasExistingTarget={true}
        onSelectAction={vi.fn()}
      />,
    );

    expect(screen.getByText(/Sanitário/i)).toBeInTheDocument();
    expect(screen.getByText(/Pesagem/i)).toBeInTheDocument();
    expect(screen.getByText(/Mover/i)).toBeInTheDocument();
    expect(screen.getByText(/Nutrição/i)).toBeInTheDocument();
    expect(screen.getByText(/Negócios Patrimoniais/i)).toBeInTheDocument();
    expect(screen.getByText(/Reprodução/i)).toBeInTheDocument();
  });

  it("deve desabilitar opcoes dependentes quando nenhum animal for selecionado", () => {
    render(
      <RegistrarManejoActionsGrid
        tipoManejo=""
        selectedAnimaisCount={0}
        hasExistingTarget={false}
        onSelectAction={vi.fn()}
      />,
    );

    // Sanitário, Pesagem, Movimentação, Nutrição e Reprodução exigem animais
    expect(screen.getByText(/Sanitário/i).closest("button")).toBeDisabled();
    expect(screen.getByText(/Pesagem/i).closest("button")).toBeDisabled();
    expect(screen.getByText(/Mover/i).closest("button")).toBeDisabled();
    expect(screen.getByText(/Nutrição/i).closest("button")).toBeDisabled();
    expect(screen.getByText(/Reprodução/i).closest("button")).toBeDisabled();

    // Financeiro (compra de lote novo) NÃO exige que animais prévios estejam selecionados
    expect(
      screen.getByText(/Negócios Patrimoniais/i).closest("button"),
    ).not.toBeDisabled();
  });

  it("deve chamar onSelectAction com o tipo correto ao clicar na opcao", () => {
    const mockSelect = vi.fn();
    render(
      <RegistrarManejoActionsGrid
        tipoManejo=""
        selectedAnimaisCount={1}
        hasExistingTarget={true}
        onSelectAction={mockSelect}
      />,
    );

    fireEvent.click(screen.getByText(/Sanitário/i));
    expect(mockSelect).toHaveBeenCalledWith("sanitario");
  });
});
