/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import Registrar from "@/pages/Registrar";
import { MemoryRouter } from "react-router-dom";
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

  beforeEach(() => {
    vi.clearAllMocks();
    
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

    // Mock useLiveQuery
    // Return a universal object that satisfies various query shapes to avoid crashes
    // and provide animals for selection.
    const universalRecord = {
      id: "animal-1",
      identificacao: "Boi 1",
      sexo: "M",
      lote_id: "lote-A",
      fazenda_id: "farm-1",
      nome: "Protocolo Fake", // for protocols/contrapartes
      tipo: "vacinacao", // for protocoloItens
      deleted_at: null,
    };
    mockedUseLiveQuery.mockReturnValue(
      [universalRecord] as ReturnType<typeof useLiveQuery>,
    );
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

    // 2. Click "Próximo"
    const nextButton1 = screen.getByText("Próximo");
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
    const nextButton2 = screen.getAllByText("Próximo")[0]; // Should be the visible one
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
});
