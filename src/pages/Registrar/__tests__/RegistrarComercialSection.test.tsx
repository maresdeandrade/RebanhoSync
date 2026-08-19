/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  RegistrarComercialSection,
  type ComercialFormData,
} from "@/pages/Registrar/components/RegistrarComercialSection";

const comercialData: ComercialFormData = {
  operationType: "compra",
  scope: "animal",
  occurredAt: "2026-06-04",
  quantidadeAnimais: "1",
  commercialWeightTotal: "",
  valorBruto: "",
  frete: "",
  comissao: "",
  descontos: "",
  taxasImpostos: "",
  bonificacoes: "",
  contraparteId: "none",
  financeTransactionId: "none",
  observacoes: "",
  pesosPorAnimal: {},
  valoresPorAnimal: {},
  newAnimals: [
    {
      localId: "animal-1",
      identificacao: "A-1",
      sexo: "F",
      especie: "bovino",
      raca: null,
      dataNascimento: "2025-01-01",
      dataEntrada: "2026-06-04",
      commercialWeight: null,
      valorIndividual: null,
    },
  ],
  commonSpecies: "bovino",
  commonBreed: "none",
  commonEntryDate: "2026-06-04",
  saleSnapshotIds: [],
  purchaseDestinationLotId: "",
  pricingMode: "per_head",
  pricePerArroba: "",
  arrobaBasis: null,
  carcassYieldPercent: "",
};

const commonProps = {
  fazendaId: "farm-1",
  selectedAnimalIds: [] as string[],
  animaisComPeso: [],
  contrapartes: [],
  canManageContraparte: false,
  showNovaContraparte: false,
  onToggleNovaContraparte: vi.fn(),
  novaContraparte: { nome: "", documento: "", telefone: "", email: "" },
  onNovaContraparteFieldChange: vi.fn(),
  onCreateContraparte: vi.fn(),
  isSavingContraparte: false,
  onNavigateContrapartes: vi.fn(),
  financeTransactions: [],
  currentLotActiveAnimalIds: [],
  targetMode: "none" as const,
  targetLotId: null,
  lotes: [{ id: "lot-1", nome: "Lote 1" }],
};

function StatefulCommercialSection({
  initialData = comercialData,
}: {
  initialData?: ComercialFormData;
}) {
  const [data, setData] = useState(initialData);
  return (
    <RegistrarComercialSection
      {...commonProps}
      comercialData={data}
      updateComercialData={(field, value) =>
        setData((current) => ({ ...current, [field]: value }))
      }
    />
  );
}

describe("RegistrarComercialSection", () => {
  it("apresenta compra, venda e sociedade somente na seção de ação", () => {
    render(
      <RegistrarComercialSection
        {...commonProps}
        comercialData={comercialData}
        updateComercialData={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Compra" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Venda" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sociedade" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Animal individual" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Custo total da aquisição")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Compra e venda sao registros manuais informados pelo usuario/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/nao validam aptidao comercial/i),
    ).toBeInTheDocument();
  });

  it("mantém compra individual em uma linha e redistribui ao mudar para lote", () => {
    render(<StatefulCommercialSection />);

    const quantity = screen.getByLabelText(/Quantidade de Animais/i);
    expect(quantity).toHaveValue(1);
    expect(quantity).toBeDisabled();
    expect(screen.getAllByLabelText(/Identificação animal/i)).toHaveLength(1);
    fireEvent.change(screen.getByLabelText(/Valor Bruto \(R\$\)/i), {
      target: { value: "10" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Lote de animais" }));

    expect(quantity).toHaveValue(2);
    expect(quantity).not.toBeDisabled();
    expect(screen.getAllByLabelText(/Identificação animal/i)).toHaveLength(2);
    expect(screen.getByLabelText("Valor animal 1")).toHaveValue(5);
    expect(screen.getByLabelText("Valor animal 2")).toHaveValue(5);
  });

  it("sincroniza totais e linhas de peso e valor nos dois sentidos", () => {
    render(<StatefulCommercialSection />);
    fireEvent.click(screen.getByRole("button", { name: "Lote de animais" }));

    fireEvent.change(screen.getByLabelText("Peso total (@)"), {
      target: { value: "100" },
    });
    expect(screen.getByLabelText("Peso animal 1")).toHaveValue(50);
    expect(screen.getByLabelText("Peso animal 2")).toHaveValue(50);

    fireEvent.change(screen.getByLabelText("Peso animal 1"), {
      target: { value: "40" },
    });
    expect(screen.getByLabelText("Peso total (@)")).toHaveValue(90);
    expect(screen.getByText("45.00 @")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Valor Bruto \(R\$\)/i), {
      target: { value: "10" },
    });
    expect(screen.getByLabelText("Valor animal 1")).toHaveValue(5);
    expect(screen.getByLabelText("Valor animal 2")).toHaveValue(5);

    fireEvent.change(screen.getByLabelText("Valor animal 1"), {
      target: { value: "4" },
    });
    expect(screen.getByLabelText(/Valor Bruto \(R\$\)/i)).toHaveValue(9);
  });

  it("rotula o resultado da venda como receita líquida", () => {
    render(
      <RegistrarComercialSection
        {...commonProps}
        targetMode="existing"
        selectedAnimalIds={["animal-1"]}
        comercialData={{
          ...comercialData,
          operationType: "venda",
          newAnimals: [],
        }}
        updateComercialData={vi.fn()}
      />,
    );

    expect(screen.getByText("Receita líquida da venda")).toBeInTheDocument();
  });

  it("recalcula arrobas, valores e bruto ao alterar peso e preço por arroba", () => {
    render(
      <StatefulCommercialSection
        initialData={{
          ...comercialData,
          scope: "lote",
          quantidadeAnimais: "2",
          pricingMode: "per_arroba",
          pricePerArroba: "300",
          arrobaBasis: null,
          carcassYieldPercent: "",
          commercialWeightTotal: "32.40",
          valorBruto: "9720.00",
          newAnimals: [
            { ...comercialData.newAnimals[0]!, commercialWeight: 18 },
            {
              ...comercialData.newAnimals[0]!,
              localId: "animal-2",
              identificacao: "A-2",
              commercialWeight: 14.4,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("18.0000")).toBeInTheDocument();
    expect(screen.getByText("R$ 5400.00")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Peso animal 1"), {
      target: { value: "20" },
    });
    expect(screen.getByLabelText(/Valor Bruto \(R\$\)/i)).toHaveValue(10320);

    fireEvent.change(screen.getByLabelText("Preço por arroba"), {
      target: { value: "310" },
    });
    expect(screen.getByLabelText(/Valor Bruto \(R\$\)/i)).toHaveValue(10664);
  });

  it("adiciona, duplica e remove linhas sem perder detalhes expandidos", () => {
    render(<StatefulCommercialSection />);
    fireEvent.click(screen.getByRole("button", { name: "Lote de animais" }));
    fireEvent.change(screen.getByLabelText("Identificação animal 1"), {
      target: { value: "A-100" },
    });
    fireEvent.click(screen.getByLabelText("Detalhes animal 1"));
    fireEvent.change(screen.getByLabelText("Nascimento animal 1"), {
      target: { value: "2025-03-04" },
    });
    fireEvent.click(screen.getByLabelText("Detalhes animal 1"));
    fireEvent.click(screen.getByLabelText("Detalhes animal 1"));
    expect(screen.getByLabelText("Nascimento animal 1")).toHaveValue(
      "2025-03-04",
    );

    fireEvent.click(screen.getByRole("button", { name: "Adicionar animal" }));
    expect(screen.getAllByLabelText(/Identificação animal/i)).toHaveLength(3);
    fireEvent.click(screen.getByLabelText("Duplicar animal 1"));
    expect(screen.getAllByLabelText(/Identificação animal/i)).toHaveLength(4);
    fireEvent.click(screen.getByLabelText("Remover animal 4"));
    expect(screen.getAllByLabelText(/Identificação animal/i)).toHaveLength(3);
  });

  it("limpa dados incompatíveis ao trocar de preço por arroba para por cabeça", () => {
    render(
      <StatefulCommercialSection
        initialData={{
          ...comercialData,
          pricingMode: "per_arroba",
          pricePerArroba: "300",
          arrobaBasis: "carcass_weight",
          valorBruto: "6000.00",
          commercialWeightTotal: "300.00",
          newAnimals: [
            {
              ...comercialData.newAnimals[0]!,
              commercialWeight: 300,
              valorIndividual: 6000,
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Valor por cabeça" }));
    expect(screen.queryByLabelText("Preço por arroba")).toBeNull();
    expect(screen.getByLabelText(/Valor Bruto \(R\$\)/i)).toHaveValue(null);
    expect(screen.getByLabelText("Valor animal 1")).toHaveValue(null);
    expect(screen.getByLabelText("Peso animal 1")).toHaveValue(null);
  });

  it("usa arroba como unidade comercial central", () => {
    render(<StatefulCommercialSection />);
    expect(screen.getByLabelText("Peso total (@)")).toBeInTheDocument();
    expect(screen.getByText("Peso individual (@)")).toBeInTheDocument();
    expect(screen.getByText("Peso médio (@)")).toBeInTheDocument();
    expect(
      screen.getByText(/O peso comercial não atualiza o peso atual do animal/i),
    ).toBeInTheDocument();
  });

  it("preserva a digitação sequencial do peso total acima de dez", async () => {
    const user = userEvent.setup();
    render(<StatefulCommercialSection />);

    const total = screen.getByLabelText("Peso total (@)");
    await user.type(total, "125");

    expect(total).toHaveValue(125);
    expect(screen.getByLabelText("Peso animal 1")).toHaveValue(125);
  });

  it("simula valor total e apresenta preços efetivos por arroba", () => {
    render(
      <StatefulCommercialSection
        initialData={{
          ...comercialData,
          pricingMode: "total_value",
          commercialWeightTotal: "20",
          valorBruto: "6000",
          frete: "100",
          descontos: "50",
          bonificacoes: "150",
          newAnimals: [
            {
              ...comercialData.newAnimals[0]!,
              commercialWeight: 20,
              valorIndividual: 6000,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Simulação comercial")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Valor total" }),
    ).toBeInTheDocument();
    expect(screen.getByText("20 @")).toBeInTheDocument();
    expect(screen.getByText("R$ 300.00/@")).toBeInTheDocument();
    expect(screen.getByText("R$ 295.00/@")).toBeInTheDocument();
  });

  it("exibe R$/cabeça derivado do total negociado e identifica a entrada", () => {
    render(
      <StatefulCommercialSection
        initialData={{
          ...comercialData,
          scope: "lote",
          quantidadeAnimais: "2",
          pricingMode: "total_value",
          commercialWeightTotal: "20",
          valorBruto: "6200",
          newAnimals: [
            { ...comercialData.newAnimals[0]!, commercialWeight: 10 },
            {
              ...comercialData.newAnimals[0]!,
              localId: "animal-2",
              identificacao: "A-2",
              commercialWeight: 10,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Valor total negociado (entrada)")).toBeInTheDocument();
    expect(screen.getByText("R$ 3100.00/cabeça")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 310.00/@").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("R$ 3100.00").length).toBeGreaterThan(0);
  });

  it("recebe arrobas diretamente e redistribui na unidade selecionada", () => {
    render(
      <StatefulCommercialSection
        initialData={{
          ...comercialData,
          scope: "lote",
          quantidadeAnimais: "2",
          pricingMode: "per_arroba",
          pricePerArroba: "300",
          arrobaBasis: null,
          carcassYieldPercent: "",
          commercialWeightTotal: "32.4",
          valorBruto: "9720",
          newAnimals: [
            { ...comercialData.newAnimals[0]!, commercialWeight: 18 },
            {
              ...comercialData.newAnimals[0]!,
              localId: "animal-2",
              identificacao: "A-2",
              commercialWeight: 14.4,
            },
          ],
        }}
      />,
    );

    expect(screen.getByLabelText("Peso total (@)")).toHaveValue(32.4);
    expect(screen.getByText("Peso individual (@)")).toBeInTheDocument();
    expect(screen.getByText("Peso médio (@)")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Base de cálculo da arroba"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Informe diretamente as arrobas/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Peso total (@)"), {
      target: { value: "30" },
    });
    expect(screen.getByLabelText("Peso animal 1")).toHaveValue(15);
    expect(screen.getByLabelText("Peso animal 2")).toHaveValue(15);
    fireEvent.change(screen.getByLabelText("Peso animal 1"), {
      target: { value: "12" },
    });
    expect(screen.getByLabelText("Peso total (@)")).toHaveValue(27);
  });

  it("oferece cálculo opcional em kg sem esconder a entrada direta em arrobas", () => {
    render(
      <StatefulCommercialSection
        initialData={{
          ...comercialData,
          pricingMode: "per_arroba",
          pricePerArroba: "300",
          arrobaBasis: "live_weight_yield",
          carcassYieldPercent: "54",
        }}
      />,
    );

    expect(screen.getByLabelText("Peso total (kg)")).toBeInTheDocument();
    expect(screen.getByText("Peso individual (kg)")).toBeInTheDocument();
    expect(screen.getByText("Peso médio (kg)")).toBeInTheDocument();
    expect(screen.getByLabelText("Rendimento de carcaça")).toBeInTheDocument();
  });

  it("troca kg-arroba-kg sem reaproveitar pesos incompatíveis", async () => {
    const initialData = {
      ...comercialData,
      pricingMode: "per_head" as const,
      pricePerArroba: "",
      arrobaBasis: null,
      carcassYieldPercent: "",
      commercialWeightTotal: "500",
      valorBruto: "2500",
      newAnimals: [
        {
          ...comercialData.newAnimals[0]!,
          commercialWeight: 500,
          valorIndividual: 2500,
        },
      ],
    };
    render(<StatefulCommercialSection initialData={initialData} />);
    expect(screen.getByLabelText("Peso animal 1")).toHaveValue(500);
    fireEvent.click(screen.getByRole("button", { name: "Preço por arroba" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Peso animal 1")).toHaveValue(null),
    );
    expect(screen.getByText("Peso individual (@)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Valor por cabeça" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Peso animal 1")).toHaveValue(null),
    );
    expect(screen.getByText("Peso individual (@)")).toBeInTheDocument();
  });

  it("aceita peso direto em arroba sem rendimento", () => {
    render(
      <StatefulCommercialSection
        initialData={{
          ...comercialData,
          pricingMode: "per_arroba",
          pricePerArroba: "300",
          arrobaBasis: null,
          carcassYieldPercent: "",
        }}
      />,
    );
    expect(screen.getByLabelText("Peso total (@)")).not.toBeDisabled();
    expect(screen.queryByLabelText("Rendimento de carcaça")).toBeNull();
    fireEvent.change(screen.getByLabelText("Peso animal 1"), {
      target: { value: "18" },
    });
    expect(screen.getAllByText("R$ 5400.00")).toHaveLength(2);
  });

  it("identifica nascimento exato e categoria somente quando derivável", () => {
    render(<StatefulCommercialSection />);
    fireEvent.change(screen.getByLabelText("Nascimento animal 1"), {
      target: { value: "2025-03-04" },
    });
    expect(screen.getByText(/Exata/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Detalhes animal 1"));
    expect(screen.getByText(/Derivada:/)).toBeInTheDocument();
  });

  it("não infere categoria quando faltam os fatos cadastrais", () => {
    render(
      <StatefulCommercialSection
        initialData={{
          ...comercialData,
          newAnimals: [{ ...comercialData.newAnimals[0]!, dataNascimento: "" }],
        }}
      />,
    );
    fireEvent.click(screen.getByLabelText("Detalhes animal 1"));
    expect(
      screen.getByText(/Não derivada: dados cadastrais insuficientes/i),
    ).toBeInTheDocument();
  });
});
