/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import "fake-indexeddb/auto";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import Registrar from "@/pages/Registrar";
import { runRegistrarFinalizeGestureEffect } from "@/pages/Registrar/effects/finalizeGesture";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLotes } from "@/hooks/useLotes";
import { useLiveQuery } from "dexie-react-hooks";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";

// Mock hooks
vi.mock("@/hooks/useAuth");
vi.mock("@/hooks/useLotes");
vi.mock("dexie-react-hooks");
vi.mock("@/lib/offline/pull", () => ({
  pullDataForFarm: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/pages/Registrar/effects/bootstrap", () => ({
  refreshRegistrarSanitaryProtocolsEffect: vi.fn().mockResolvedValue(undefined),
  refreshRegistrarVeterinaryProductsEffect: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/pages/Registrar/effects/finalizeGesture", () => ({
  runRegistrarFinalizeGestureEffect: vi.fn().mockResolvedValue(undefined),
}));

// Mock scrollIntoView for Radix UI
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

// Mock navigation
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("Registrar Page - Anti-Teleport", () => {
  const mockFarmId = "farm-1";
  const mockLotes = [
    { id: "lote-A", nome: "Lote A", fazenda_id: mockFarmId },
    { id: "lote-B", nome: "Lote B", fazenda_id: mockFarmId },
  ];
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseLotes = vi.mocked(useLotes);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);
  let extraAnimals: Array<{
    id: string;
    identificacao: string;
    sexo: string;
    lote_id: string;
    fazenda_id: string;
    deleted_at: null;
  }>;

  beforeEach(() => {
    vi.clearAllMocks();
    extraAnimals = [];
    
    // Default mocks
    mockedUseAuth.mockReturnValue({
      activeFarmId: mockFarmId,
      role: "owner",
      farmMeasurementConfig: { weight_unit: "kg" },
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    } as ReturnType<typeof useAuth>);
    
    // Mock useLotes to return mock lotes
    // Since useLotes is a custom hook that might do something, let's mock its return value
    // Wait, useLotes is exported as a function, but imported as named import.
    // However, in Registrar.tsx: import { useLotes } from "@/hooks/useLotes";
    // So mocking the module works.
    // Wait, useLotes returns `lotes` array directly (from useLiveQuery).
    // Let's check implementation again. Yes.
    mockedUseLotes.mockReturnValue(mockLotes as ReturnType<typeof useLotes>);

    const universalRecord = {
      id: "animal-1",
      identificacao: "Boi 1",
      sexo: "M",
      lote_id: "lote-A",
      fazenda_id: "farm-1",
      deleted_at: null,
    };
    mockedUseLiveQuery.mockImplementation(((query) => {
      const querySource =
        typeof query === "function" ? query.toString() : "";

      if (
        querySource.includes("loadRegulatorySurfaceSource") ||
        querySource.includes("loadRegistrarRegulatorySurfaceSourceEffect")
      ) {
        return {
          config: null,
          templates: [],
          items: [],
        } as ReturnType<typeof useLiveQuery>;
      }

      if (querySource.includes("state_agenda_itens.get")) {
        return {
          agendaItem: {
            id: "agenda-1",
            dominio: "sanitario",
            tipo: "vacinacao",
            status: "agendado",
            data_prevista: "2026-05-08",
          },
          animal: universalRecord,
          lote: mockLotes[0],
          pasto: {
            id: "pasto-1",
            nome: "Piquete 1",
            tipo_pasto: "cultivado",
          },
        } as ReturnType<typeof useLiveQuery>;
      }

      if (querySource.includes("state_animais.get")) {
        return null as ReturnType<typeof useLiveQuery>;
      }

      if (
        querySource.includes("loadRegistrarProtocolosEffect") ||
        querySource.includes("state_protocolos_sanitarios")
      ) {
        return [
          {
            id: "proto-1",
            nome: "Protocolo Teste",
            ativo: true,
            fazenda_id: "farm-1",
            deleted_at: null,
          },
        ] as ReturnType<typeof useLiveQuery>;
      }

      if (
        querySource.includes("loadRegistrarProtocoloItensEffect") ||
        querySource.includes("state_protocolos_sanitarios_itens")
      ) {
        return [
          {
            id: "item-1",
            protocolo_id: "proto-1",
            fazenda_id: "farm-1",
            tipo: "vacinacao",
            produto: "Vacina Teste",
            deleted_at: null,
          },
        ] as ReturnType<typeof useLiveQuery>;
      }

      if (
        querySource.includes("state_animais") ||
        querySource.includes("loadRegistrarAnimaisNoLoteEffect")
      ) {
        return [universalRecord, ...extraAnimals] as ReturnType<typeof useLiveQuery>;
      }

      return [] as ReturnType<typeof useLiveQuery>;
    }) as typeof useLiveQuery);
  });

  it("mantém a confirmação contextual e os pesos ao voltar e avançar", async () => {
    render(
      <MemoryRouter
        initialEntries={["/registrar?dominio=pesagem&animalId=animal-1"]}
      >
        <Registrar />
      </MemoryRouter>,
    );

    const input = await screen.findByPlaceholderText("Peso (kg)");
    const review = screen.getByRole("button", { name: "Revisar informações" });
    expect(review).toBeDisabled();
    fireEvent.change(input, { target: { value: "-1" } });
    expect(review).toBeDisabled();
    fireEvent.change(input, { target: { value: "430.5" } });
    fireEvent.click(review);

    expect(await screen.findByText("Etapa 3/3: Registrar")).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Pesos por animal" }),
    ).toHaveTextContent("Boi 1");
    expect(
      screen.getByRole("list", { name: "Pesos por animal" }),
    ).toHaveTextContent("430.5 kg");
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByPlaceholderText("Peso (kg)")).toHaveValue(430.5);
    fireEvent.click(
      screen.getByRole("button", { name: "Revisar informações" }),
    );
    expect(screen.getByText("Etapa 3/3: Registrar")).toBeInTheDocument();
    expect(runRegistrarFinalizeGestureEffect).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("não restaura ação ou seleção da URL em renders de interação", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/registrar?dominio=pesagem&animalId=animal-1&loteId=lote-A",
        ]}
      >
        <Registrar />
      </MemoryRouter>,
    );

    await screen.findByPlaceholderText("Peso (kg)");
    fireEvent.click(screen.getByRole("button", { name: "Mover", exact: true }));
    expect(screen.getByText("Lote Destino")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByText("Etapa 1/3: Definir contexto")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(runRegistrarFinalizeGestureEffect).not.toHaveBeenCalled();
  });

  it.each(["kg", "arroba"] as const)(
    "revisa múltiplos animais na unidade %s sem executar fatos",
    async (unit) => {
      extraAnimals = [
        {
          id: "animal-2",
          identificacao: "Boi 2",
          sexo: "M",
          lote_id: "lote-A",
          fazenda_id: mockFarmId,
          deleted_at: null,
        },
      ];
      mockedUseAuth.mockReturnValue({
        ...mockedUseAuth(),
        farmMeasurementConfig: { weight_unit: unit },
      });
      render(
        <MemoryRouter>
          <Registrar />
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByText("Selecione o lote"));
      fireEvent.click(await screen.findByRole("option", { name: "Lote A" }));
      for (const checkbox of screen.getAllByRole("checkbox"))
        fireEvent.click(checkbox);
      fireEvent.click(screen.getByRole("button", { name: "Escolher manejo" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Pesagem", exact: true }),
      );
      const inputs = screen.getAllByPlaceholderText(`Peso (${unit})`);
      const values = unit === "kg" ? ["430.5", "510"] : ["28.7", "34"];
      fireEvent.change(inputs[0], { target: { value: values[0] } });
      expect(
        screen.getByRole("button", { name: "Revisar informações" }),
      ).toBeDisabled();
      fireEvent.change(inputs[1], { target: { value: values[1] } });
      fireEvent.click(
        screen.getByRole("button", { name: "Revisar informações" }),
      );
      const rows = within(
        screen.getByRole("list", { name: "Pesos por animal" }),
      ).getAllByRole("listitem");
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent(`Boi 1${values[0]} ${unit}`);
      expect(rows[1]).toHaveTextContent(`Boi 2${values[1]} ${unit}`);
      fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
      expect(
        screen
          .getAllByPlaceholderText(`Peso (${unit})`)
          .map((input) => (input as HTMLInputElement).value),
      ).toEqual(values);
      expect(runRegistrarFinalizeGestureEffect).not.toHaveBeenCalled();
    },
  );

  it("aplica uma nova entrada contextual sem remontar a página", async () => {
    function ChangeContext() {
      const [, setSearchParams] = useSearchParams();
      return (
        <button
          onClick={() =>
            setSearchParams(
              "dominio=movimentacao&animalId=animal-1&loteId=lote-A",
            )
          }
        >
          Alterar contexto
        </button>
      );
    }
    render(
      <MemoryRouter
        initialEntries={["/registrar?dominio=pesagem&animalId=animal-1"]}
      >
        <ChangeContext />
        <Registrar />
      </MemoryRouter>,
    );
    fireEvent.change(await screen.findByPlaceholderText("Peso (kg)"), {
      target: { value: "430" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Revisar informações" }),
    );
    expect(await screen.findByText("Etapa 3/3: Registrar")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Alterar contexto" }));
    expect(await screen.findByText("Lote Destino")).toBeInTheDocument();
    expect(screen.getByText("Etapa 2/3: Escolher ação")).toBeInTheDocument();
    expect(runRegistrarFinalizeGestureEffect).not.toHaveBeenCalled();
  });

  it("resets destination (toLoteId) when source (selectedLoteId) is changed to match destination", async () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Registrar />
      </MemoryRouter>
    );

    // 1. Select Lote A as Source
    const sourceSelect = screen.getByText("Selecione o lote");
    fireEvent.click(sourceSelect);
    
    const optionA = await screen.findByText("Lote A");
    fireEvent.click(optionA);

    // 1b. Select an animal (required for Movimentacao)
    // The animals list should be rendered now
    const checkbox = await screen.findByRole("checkbox");
    fireEvent.click(checkbox);

    // 2. Click "Escolher manejo"
    const nextButton1 = screen.getByText("Escolher manejo");
    fireEvent.click(nextButton1);

    // 3. Select "Mover" (Movimentacao)
    const moveButton = screen.getByText("Mover");
    fireEvent.click(moveButton);

    // 4. Select Destination: Lote B
    // The select placeholder is "Selecione o destino"
    const destSelectTrigger = screen.getByText("Selecione o destino");
    fireEvent.click(destSelectTrigger);
    
    const optionB = await screen.findByText("Lote B");
    fireEvent.click(optionB);

    // Verify destination is selected (text changes to "Lote B")
    expect(screen.getByText("Lote B")).toBeInTheDocument();

    // 5. Go back to step 1
    const backButton = screen.getByText("Voltar");
    fireEvent.click(backButton);

    // 6. Change Source to Lote B
    // The source select now shows "Lote A"
    const sourceSelect2 = screen.getAllByText("Lote A").at(-1);
    expect(sourceSelect2).toBeDefined();
    fireEvent.click(sourceSelect2!);
    
    const optionB_Source = await screen.findByText("Lote B");
    fireEvent.click(optionB_Source);

    // 7. Go to step 2 again
    const nextButton2 = screen.getAllByText("Escolher manejo")[0]; // Should be the visible one
    fireEvent.click(nextButton2);
    
    // 8. Select "Mover" again?
    // The state `tipoManejo` is preserved?
    // In Registrar: `const [tipoManejo, setTipoManejo] = useState<EventDomain | null>(null);`
    // Step 2 renders buttons to SET `tipoManejo`.
    // But if we go back, `step` changes, but `tipoManejo` state remains.
    // Wait, step 2 renders the buttons, but clicking them sets `tipoManejo`.
    // Does it auto-select if already set?
    // The buttons have `variant={tipoManejo === "movimentacao" ? "default" : "outline"}`.
    // So it shows as selected.
    // And the form inputs for `movimentacao` are rendered: `{tipoManejo === "movimentacao" && ...}`.
    
    // So we should see "Lote Destino" label.
    expect(screen.getByText("Lote Destino")).toBeInTheDocument();

    // 9. Verify Destination is RESET
    // It should NOT show "Lote B". It should show "Selecione o destino".
    expect(screen.getByText("Selecione o destino")).toBeInTheDocument();
    // And "Lote B" should not be the selected value text (might still be in document as option if open, but we closed it).
    // Ideally, check that "Lote B" is NOT the text content of the trigger.
    
  });

  it("prefills contextual query without saving automatically", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/registrar?loteId=lote-A&animalId=animal-1&pastoId=pasto-1",
        ]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Registrar />
      </MemoryRouter>
    );

    await screen.findByText("Contexto");

    expect(screen.getAllByText(/1 animal\(is\) selecionado\(s\)/i).length)
      .toBeGreaterThan(0);
    expect(screen.getByText("Animal: Boi 1")).toBeInTheDocument();
    expect(screen.getByText("Lote: Lote A")).toBeInTheDocument();
    expect(screen.getByText("Pasto: Piquete 1")).toBeInTheDocument();
    expect(screen.getByText(/nenhum animal e inferido automaticamente/i)).toBeInTheDocument();
    expect(runRegistrarFinalizeGestureEffect).not.toHaveBeenCalled();
  });

  it("renders sanitary registrar from agenda sourceTaskId without render loop", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          "/registrar?sourceTaskId=agenda-1&dominio=sanitario&animalId=animal-1&protocoloId=proto-1&protocoloItemId=item-1",
        ]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Registrar />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Escolher ação/i).length).toBeGreaterThan(0);
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(runRegistrarFinalizeGestureEffect).not.toHaveBeenCalled();
  });

  it("keeps pastoId as informative context without selecting animals", () => {
    render(
      <MemoryRouter
        initialEntries={["/registrar?pastoId=pasto-1"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Registrar />
      </MemoryRouter>
    );

    expect(screen.getByText("Pasto: Piquete 1")).toBeInTheDocument();
    expect(screen.queryByText(/animal\(is\) selecionado\(s\)/i)).not.toBeInTheDocument();
    expect(runRegistrarFinalizeGestureEffect).not.toHaveBeenCalled();
  });
});
