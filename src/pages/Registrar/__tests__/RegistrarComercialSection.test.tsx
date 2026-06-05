/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  RegistrarComercialSection,
  type ComercialFormData,
} from "@/pages/Registrar/components/RegistrarComercialSection";

const comercialData: ComercialFormData = {
  operationType: "venda",
  scope: "lote",
  occurredAt: "2026-06-04",
  quantidadeAnimais: "",
  pesoVivoTotal: "",
  valorBruto: "",
  frete: "",
  comissao: "",
  descontos: "",
  taxasImpostos: "",
  contraparteId: "none",
  financeTransactionId: "none",
  observacoes: "",
  pesosPorAnimal: {},
  valoresPorAnimal: {},
};

describe("RegistrarComercialSection", () => {
  it("apresenta compra e venda como registros manuais sem aptidao comercial", () => {
    render(
      <RegistrarComercialSection
        fazendaId="farm-1"
        comercialData={comercialData}
        updateComercialData={vi.fn()}
        selectedAnimalIds={[]}
        animaisComPeso={[]}
        contrapartes={[]}
        canManageContraparte={false}
        showNovaContraparte={false}
        onToggleNovaContraparte={vi.fn()}
        novaContraparte={{ nome: "", documento: "", telefone: "", email: "" }}
        onNovaContraparteFieldChange={vi.fn()}
        onCreateContraparte={vi.fn()}
        isSavingContraparte={false}
        onNavigateContrapartes={vi.fn()}
        financeTransactions={[]}
        weightUnitLabel="kg"
      />,
    );

    expect(
      screen.getByRole("button", { name: /Compra manual/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Venda manual/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Compra e venda sao registros manuais informados pelo usuario/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/nao validam aptidao comercial/i)).toBeInTheDocument();
  });
});
