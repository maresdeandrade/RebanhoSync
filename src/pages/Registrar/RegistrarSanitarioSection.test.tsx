/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import "@testing-library/jest-dom";
import { RegistrarSanitarioSection } from "./components/RegistrarSanitarioSection";
import type { SanitarioTipoEnum } from "@/lib/offline/types";
import type { ComponentProps } from "react";

type SanitarioProps = ComponentProps<typeof RegistrarSanitarioSection>;

const defaultProps: SanitarioProps = {
  sanitarioTipo: "vacinacao" as SanitarioTipoEnum,
  onSanitarioTipoChange: vi.fn(),
  produto: "",
  onProdutoChange: vi.fn(),
  sanitatioProductMissing: false,
  selectedVeterinaryProduct: null,
  hasVeterinaryProducts: true,
  isVeterinaryProductsEmpty: false,
  veterinaryProductSuggestions: [],
  selectedVeterinaryProductId: "",
  onSelectVeterinaryProduct: vi.fn(),
  protocoloId: "",
  onProtocoloChange: vi.fn(),
  protocolos: [],
  protocoloItemId: "",
  onProtocoloItemChange: vi.fn(),
  protocoloItensEvaluated: [],
  selectedAnimaisDetalhesCount: 1,
  selectedProtocolRestrictionsText: null,
  selectedProtocolPrimaryReason: null,
  selectedProtocolCompatibleWithAll: null,
  allProtocolItemsIneligible: false,
  clinicalCases: [],
  selectedClinicalCaseId: "",
  onClinicalCaseChange: vi.fn(),
  createClinicalCase: false,
  onCreateClinicalCaseChange: vi.fn(),
};

describe("RegistrarSanitarioSection", () => {
  it("deve renderizar os baloes de tipo de manejo", () => {
    render(<RegistrarSanitarioSection {...defaultProps} />);

    expect(screen.getByRole("button", { name: /Vacinação/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Vermifugação/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Medicamento/i })).toBeInTheDocument();
  });

  it("deve chamar a alteracao do tipo de manejo ao clicar num balao diferente", () => {
    const mockTipoChange = vi.fn();
    render(<RegistrarSanitarioSection {...defaultProps} onSanitarioTipoChange={mockTipoChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Vermifugação/i }));
    expect(mockTipoChange).toHaveBeenCalledWith("vermifugacao");
  });

  it("deve exibir os baloes de protocolo quando informados", () => {
    render(
      <RegistrarSanitarioSection
        {...defaultProps}
        protocolos={[{ id: "prot-1", nome: "Protocolo Raiva 2026" }]}
      />
    );

    expect(screen.getByRole("button", { name: /Protocolo Raiva 2026/i })).toBeInTheDocument();
  });

  it("deve renderizar as sugestoes do catalogo veterinario", () => {
    const mockSelectProduct = vi.fn();
    render(
      <RegistrarSanitarioSection
        {...defaultProps}
        veterinaryProductSuggestions={[
          { id: "prod-1", nome: "Vacina Brucelose", categoria: "Biológico" },
        ]}
        onSelectVeterinaryProduct={mockSelectProduct}
      />
    );

    const prodButton = screen.getByRole("button", { name: /Vacina Brucelose/i });
    fireEvent.click(prodButton);
    expect(mockSelectProduct).toHaveBeenCalledWith(expect.objectContaining({ id: "prod-1" }));
  });

  it("deve permitir abrir novo caso clinico", () => {
    const mockCreateClinicalCase = vi.fn();
    render(
      <RegistrarSanitarioSection
        {...defaultProps}
        onCreateClinicalCaseChange={mockCreateClinicalCase}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Abrir novo caso clínico/i }));
    expect(mockCreateClinicalCase).toHaveBeenCalledWith(true);
  });

  it("deve permitir selecionar caso clinico existente", () => {
    const mockClinicalCaseChange = vi.fn();
    render(
      <RegistrarSanitarioSection
        {...defaultProps}
        clinicalCases={[{ id: "caso-1", label: "TPB em acompanhamento" }]}
        onClinicalCaseChange={mockClinicalCaseChange}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "caso-1" },
    });
    expect(mockClinicalCaseChange).toHaveBeenCalledWith("caso-1");
  });
});
