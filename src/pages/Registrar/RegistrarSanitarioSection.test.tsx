/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
  biosecurityContext: {
    animals: [{ id: "animal-1", label: "Matriz 001" }],
    lote: { id: "lote-1", label: "Lote 1" },
    localId: null,
    agendaItemId: null,
  },
  onRegisterBiosecurityOccurrence: vi.fn().mockResolvedValue(undefined),
  isRegisteringBiosecurityOccurrence: false,
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

  it("mostra rotina normal sem abrir o wizard automaticamente", () => {
    render(<RegistrarSanitarioSection {...defaultProps} />);

    expect(
      screen.getByText("Biossegurança: Sem ocorrência informada"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre o mini wizard ao registrar ocorrência", () => {
    render(<RegistrarSanitarioSection {...defaultProps} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Registrar ocorrência/i }),
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("O que aconteceu?")).toBeInTheDocument();
    expect(screen.getByText("Visitante sem orientação")).toBeInTheDocument();
    expect(
      screen.getByText("Suspeita de doença notificável"),
    ).toBeInTheDocument();
  });

  it("permite selecionar múltiplos tipos e múltiplos animais", async () => {
    const onRegister = vi.fn().mockResolvedValue(undefined);
    render(
      <RegistrarSanitarioSection
        {...defaultProps}
        biosecurityContext={{
          animals: [
            { id: "animal-1", label: "Matriz 001" },
            { id: "animal-2", label: "Matriz 002" },
          ],
          lote: { id: "lote-1", label: "Lote 1" },
          localId: null,
          agendaItemId: null,
        }}
        onRegisterBiosecurityOccurrence={onRegister}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Registrar ocorrência/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Animal suspeito sem isolamento/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Vários animais/i }));
    fireEvent.change(screen.getByPlaceholderText("Informe o que foi feito no momento"), {
      target: { value: "Equipe orientada e área isolada." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Salvar ocorrência/i }));

    await waitFor(() =>
      expect(onRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo_ocorrencia: "visitante_sem_orientacao",
          tipos_ocorrencia: [
            "visitante_sem_orientacao",
            "animal_suspeito_sem_isolamento",
          ],
          escopo_tipo: "animal",
          escopos_tipo: ["animal", "animais"],
          animal_id: "animal-1",
          animal_ids: ["animal-1", "animal-2"],
        }),
      ),
    );
  });

  it("suprime opções de vínculo impossíveis para o tipo selecionado", async () => {
    render(<RegistrarSanitarioSection {...defaultProps} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Registrar ocorrência/i }),
    );

    expect(screen.getByRole("button", { name: /^Fazenda$/i })).toBeInTheDocument();
    expect(screen.queryByText(/Animal indisponível/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Vários indisponível/i)).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Visitante sem orientação/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Animal suspeito sem isolamento/i }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /^Fazenda$/i }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /^Animal$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Lote$/i })).toBeInTheDocument();
  });

  it("recalcula vínculos ao trocar tipo e remove vínculo incompatível", async () => {
    const onRegister = vi.fn().mockResolvedValue(undefined);
    render(
      <RegistrarSanitarioSection
        {...defaultProps}
        onRegisterBiosecurityOccurrence={onRegister}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Registrar ocorrência/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Fazenda/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /Visitante sem orientação/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Animal suspeito sem isolamento/i }),
    );
    fireEvent.change(screen.getByPlaceholderText("Informe o que foi feito no momento"), {
      target: { value: "Animal separado para observação." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Salvar ocorrência/i }));

    await waitFor(() =>
      expect(onRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          escopo_tipo: "animal",
          animal_id: "animal-1",
          lote_id: null,
        }),
      ),
    );
  });

  it("mostra estado vazio quando não há vínculo válido para o contexto", () => {
    render(
      <RegistrarSanitarioSection
        {...defaultProps}
        biosecurityContext={{
          animals: [],
          lote: null,
          localId: null,
          agendaItemId: null,
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Registrar ocorrência/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Visitante sem orientação/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Transporte com risco sanitário/i }),
    );

    expect(
      screen.getByText(
        "Nenhum vínculo disponível para este contexto. Ajuste o tipo de ocorrência ou registre a ocorrência pela tela adequada.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Lote indisponível/i)).not.toBeInTheDocument();
  });

  it("exige vínculo animal ou lote para suspeita notificável", async () => {
    const onRegister = vi.fn().mockResolvedValue(undefined);
    render(
      <RegistrarSanitarioSection
        {...defaultProps}
        biosecurityContext={{
          animals: [],
          lote: null,
          localId: null,
          agendaItemId: null,
        }}
        onRegisterBiosecurityOccurrence={onRegister}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Registrar ocorrência/i }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Suspeita de doença notificável/i,
      }),
    );
    fireEvent.change(screen.getByPlaceholderText("Informe o que foi feito no momento"), {
      target: { value: "Animal separado para observação." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Salvar ocorrência/i }));

    expect(
      await screen.findByText("Suspeita notificável exige vínculo com animal ou lote."),
    ).toBeInTheDocument();
    expect(onRegister).not.toHaveBeenCalled();
  });

  it("mantém vínculo clínico disponível para suspeita notificável e permite vínculo adicional coerente", () => {
    render(
      <RegistrarSanitarioSection
        {...defaultProps}
        biosecurityContext={{
          animals: [{ id: "animal-1", label: "Matriz 001" }],
          lote: { id: "lote-1", label: "Lote 1" },
          localId: "local-1",
          agendaItemId: "agenda-1",
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Registrar ocorrência/i }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Suspeita de doença notificável/i,
      }),
    );

    expect(screen.getByRole("button", { name: /^Animal$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Lote$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Fazenda$/i })).toBeInTheDocument();
  });

  it("permite vínculo adicional à fazenda quando suspeita notificável mantém vínculo clínico", async () => {
    const onRegister = vi.fn().mockResolvedValue(undefined);
    render(
      <RegistrarSanitarioSection
        {...defaultProps}
        biosecurityContext={{
          animals: [{ id: "animal-1", label: "Matriz 001" }],
          lote: { id: "lote-1", label: "Lote 1" },
          localId: null,
          agendaItemId: null,
        }}
        onRegisterBiosecurityOccurrence={onRegister}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Registrar ocorrência/i }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Suspeita de doença notificável/i,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Fazenda$/i }));
    fireEvent.change(screen.getByPlaceholderText("Informe o que foi feito no momento"), {
      target: { value: "Orientação registrada." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Salvar ocorrência/i }));

    await waitFor(() =>
      expect(onRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          escopo_tipo: "animal",
          escopos_tipo: ["animal", "fazenda"],
          animal_id: "animal-1",
        }),
      ),
    );
  });
});
