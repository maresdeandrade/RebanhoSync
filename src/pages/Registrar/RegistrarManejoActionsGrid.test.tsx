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
        onSelectAction={vi.fn()}
      />
    );

    expect(screen.getByText(/Sanitario/i)).toBeInTheDocument();
    expect(screen.getByText(/Pesagem/i)).toBeInTheDocument();
    expect(screen.getByText(/Mover/i)).toBeInTheDocument();
    expect(screen.getByText(/Nutricao/i)).toBeInTheDocument();
    expect(screen.getByText(/Financeiro/i)).toBeInTheDocument();
    expect(screen.getByText(/Reproducao/i)).toBeInTheDocument();
  });

  it("deve desabilitar opcoes dependentes quando nenhum animal for selecionado", () => {
    render(
      <RegistrarManejoActionsGrid
        tipoManejo=""
        selectedAnimaisCount={0}
        onSelectAction={vi.fn()}
      />
    );

    // Sanitário, Pesagem, Movimentação, Nutrição e Reprodução exigem animais
    expect(screen.getByText(/Sanitario/i).closest("button")).toBeDisabled();
    expect(screen.getByText(/Pesagem/i).closest("button")).toBeDisabled();
    expect(screen.getByText(/Mover/i).closest("button")).toBeDisabled();
    expect(screen.getByText(/Nutricao/i).closest("button")).toBeDisabled();
    expect(screen.getByText(/Reproducao/i).closest("button")).toBeDisabled();

    // Financeiro (compra de lote novo) NÃO exige que animais prévios estejam selecionados
    expect(screen.getByText(/Financeiro/i).closest("button")).not.toBeDisabled();
  });

  it("deve chamar onSelectAction com o tipo correto ao clicar na opcao", () => {
    const mockSelect = vi.fn();
    render(
      <RegistrarManejoActionsGrid tipoManejo="" selectedAnimaisCount={1} onSelectAction={mockSelect} />
    );

    fireEvent.click(screen.getByText(/Sanitario/i));
    expect(mockSelect).toHaveBeenCalledWith("sanitario");
  });
});
