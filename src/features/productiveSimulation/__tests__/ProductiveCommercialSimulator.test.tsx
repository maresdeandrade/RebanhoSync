/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ProductiveCommercialSimulator } from "../ProductiveCommercialSimulator";
import { useAnimalWeightPresentation } from "@/hooks/useAnimalWeightPresentation";

vi.mock("@/hooks/useAnimalWeightPresentation");

const mockedUseAnimalWeightPresentation = vi.mocked(useAnimalWeightPresentation);

describe("ProductiveCommercialSimulator (UI component)", () => {
  const mockAnimal = {
    id: "animal-123",
    brinco: "BR-99",
    nome: "Estrela",
    fazenda_id: "fazenda-456",
    deleted_at: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAnimalWeightPresentation.mockReturnValue({
      evidence: {
        status: "available",
        scopedEventCount: 2,
        observations: [],
        conflicts: [],
        limitations: [],
        referenceTimestamp: Date.now(),
      },
      latestObservedWeight: {
        status: "available",
        value: {
          animalId: "animal-123",
          fazendaId: "fazenda-456",
          weight: 420,
          unit: "kg",
          measuredAt: "2026-08-15T12:00:00.000Z",
          eventId: "evt-weight-2",
          ageDays: 10,
          limitations: [],
        },
      },
      gmd: {
        status: "CALCULATED",
        animalId: "animal-123",
        fazendaId: "fazenda-456",
        initialWeightKg: 380,
        finalWeightKg: 420,
        initialMeasuredAt: "2026-07-15T12:00:00.000Z",
        finalMeasuredAt: "2026-08-15T12:00:00.000Z",
        intervalDays: 31,
        weightDeltaKg: 40,
        gmdKgPerDay: 1.29,
        reliability: "UNCLASSIFIED",
        operationalUse: "NOT_AUTHORIZED",
        universalMinInterval: "CONTEXT_DEPENDENT",
        limitations: [],
      },
      observations: [],
    });
  });

  it("renderiza badges e seções distintas para OBSERVADO, PREMISSA e SIMULADO", () => {
    render(
      <ProductiveCommercialSimulator
        animal={mockAnimal}
        fazendaId="fazenda-456"
      />,
    );

    // Badges presentes e visíveis
    expect(screen.getByText("OBSERVADO")).toBeInTheDocument();
    expect(screen.getByText("PREMISSA")).toBeInTheDocument();
    expect(screen.getAllByText("SIMULADO").length).toBeGreaterThanOrEqual(2);

    // Factual: peso observado exibido
    expect(screen.getAllByText("420,0 kg").length).toBeGreaterThanOrEqual(1);

    // Simulado: ganho e dias calculados
    expect(screen.getByText("Tempo estimado no cenário")).toBeInTheDocument();
    expect(screen.getByText("Receita bruta simulada")).toBeInTheDocument();
  });

  it("garante que GMD factual observado é distinto do GMD assumido no formulário", () => {
    render(
      <ProductiveCommercialSimulator
        animal={mockAnimal}
        fazendaId="fazenda-456"
      />,
    );

    // GMD factual exibido na seção factual
    expect(screen.getByText("1,290 kg/dia")).toBeInTheDocument();

    // Input de GMD assumido na seção de premissas é editável
    const gmdInput = screen.getByLabelText(/GMD assumido no cenário/i) as HTMLInputElement;
    expect(gmdInput).toBeInTheDocument();
    expect(gmdInput.value).toBe("1.29");
  });

  it("permite edição das premissas e recalcula a projeção dinamicamente", () => {
    render(
      <ProductiveCommercialSimulator
        animal={mockAnimal}
        fazendaId="fazenda-456"
      />,
    );

    const targetInput = screen.getByLabelText(/Peso-alvo \(kg\)/i);
    const gmdInput = screen.getByLabelText(/GMD assumido no cenário/i);

    // Altera peso-alvo para 620 kg (ganho necessário = 200 kg) e GMD para 2.0 kg/dia (dias = 100)
    fireEvent.change(targetInput, { target: { value: "620" } });
    fireEvent.change(gmdInput, { target: { value: "2.0" } });

    // Ganho necessário esperado: 200 kg
    expect(screen.getByText("200,0 kg")).toBeInTheDocument();
    // Tempo estimado esperado: 100 dias
    expect(screen.getByText("100 dias")).toBeInTheDocument();
  });

  it("custo ausente não aparece como zero e exibe cobertura adequada", () => {
    render(
      <ProductiveCommercialSimulator
        animal={mockAnimal}
        fazendaId="fazenda-456"
      />,
    );

    // Com inputs de custos vazios por padrão
    expect(screen.getByText("Não informada")).toBeInTheDocument();
    expect(screen.getByText("Não informados")).toBeInTheDocument();

    // Preenche apenas o custo diário (5.00), deixando custos adicionais ausentes
    const dailyCostInput = screen.getByLabelText(/Custo diário incremental/i);
    fireEvent.change(dailyCostInput, { target: { value: "5.00" } });

    // Agora cobertura deve ser Parcial, e limitação explícita declarada
    expect(screen.getByText("Parcial")).toBeInTheDocument();
    expect(
      screen.getByText(/Custos ausentes não foram assumidos como zero/i),
    ).toBeInTheDocument();
  });

  it("não emite nenhuma recomendação comercial ou de abate", () => {
    render(
      <ProductiveCommercialSimulator
        animal={mockAnimal}
        fazendaId="fazenda-456"
      />,
    );

    const content = document.body.textContent?.toLowerCase() ?? "";

    expect(content).not.toContain("recomendamos");
    expect(content).not.toContain("melhor vender");
    expect(content).not.toContain("melhor manter");
    expect(content).not.toContain("deve abater");
    expect(content).not.toContain("deve vender");
  });

  it("bloqueia com aviso explícito quando o peso observado está indisponível", () => {
    mockedUseAnimalWeightPresentation.mockReturnValue({
      evidence: {
        status: "available",
        scopedEventCount: 0,
        observations: [],
        conflicts: [],
        limitations: [],
        referenceTimestamp: Date.now(),
      },
      latestObservedWeight: {
        status: "unavailable",
        reason: "NO_OBSERVATION",
        limitations: [],
      },
      gmd: {
        status: "NOT_CALCULATED",
        reason: "INSUFFICIENT_OBSERVATIONS",
        source: {
          status: "INSUFFICIENT_OBSERVATIONS",
          observedCount: 0,
          requiredCount: 2,
          limitations: [],
        },
      },
      observations: [],
    });

    render(
      <ProductiveCommercialSimulator
        animal={mockAnimal}
        fazendaId="fazenda-456"
      />,
    );

    expect(screen.getByText("Simulação Bloqueada")).toBeInTheDocument();
    expect(
      screen.getAllByText("Peso observado indisponível ou inválido.").length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Tempo estimado no cenário")).not.toBeInTheDocument();
  });
});
