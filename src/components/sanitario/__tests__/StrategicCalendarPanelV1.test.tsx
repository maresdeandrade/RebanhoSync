/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrategicCalendarPanelV1 } from "../StrategicCalendarPanelV1";
import { saveStrategicCalendarV1 } from "@/lib/sanitario/calendar/saveStrategicCalendarV1";

const state = vi.hoisted(() => ({ operations: [] as any[], project: vi.fn(() => ({ stages: [] })) }));
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: () => state.operations }));
vi.mock("@/lib/sanitario/calendar/saveStrategicCalendarV1", () => ({ saveStrategicCalendarV1: vi.fn() }));
vi.mock("@/lib/sanitario/strategic/strategicCycleV1", () => ({ projectStrategicCycleV1: state.project }));

const source = (farmId = "farm-1", variant?: string) => ({
  fazendaId: farmId, animals: [], catalog: { protocols: [], items: [] },
  farmConfig: variant ? { fazenda_id: farmId, payload: { sanitary_strategic_calendar_v1: {
    schemaVersion: 1, revision: 2, variant, declaredAt: "2026-01-01T00:00:00Z", declaredBy: "user", provenance: "farm_declared", effectiveFrom: "2026-01-01",
  } } } : undefined,
}) as any;

describe("StrategicCalendarPanelV1", () => {
  beforeEach(() => { state.operations = []; vi.mocked(saveStrategicCalendarV1).mockResolvedValue("op"); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it("mantém variante confirmada até sincronizar e envia revisão original", async () => {
    render(<StrategicCalendarPanelV1 source={source("farm-1", "5-7-9")} canManage onOpenAgenda={vi.fn()} onOpenTriage={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Variante declarada"), { target: { value: "5-6-9" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar variante" }));
    await waitFor(() => expect(saveStrategicCalendarV1).toHaveBeenCalledWith("farm-1", 2, "5-6-9"));
    expect(screen.getByText(/Confirmada: 5-7-9/)).toBeInTheDocument();
    expect(await screen.findByText(/Aguardando sincronização/)).toBeInTheDocument();
  });
  it("não leva rascunho entre fazendas e impede gravação sem gestão", () => {
    const callbacks = { onOpenAgenda: vi.fn(), onOpenTriage: vi.fn() };
    const view = render(<StrategicCalendarPanelV1 source={source("farm-1", "5-7-9")} canManage {...callbacks} />);
    fireEvent.change(screen.getByLabelText("Variante declarada"), { target: { value: "5-6-9" } });
    view.rerender(<StrategicCalendarPanelV1 source={source("farm-2")} canManage={false} {...callbacks} />);
    expect(screen.getByLabelText("Variante declarada")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Salvar variante" })).toBeDisabled();
  });
  it("não atribui retroativamente a variante declarada durante o próprio ciclo", () => {
    const s = source("farm-1", "5-7-9");
    s.farmConfig.payload.sanitary_strategic_calendar_v1.effectiveFrom = "2026-11-01";
    s.animals = [{ id: "animal", fazenda_id: "farm-1", nome: "Animal", deleted_at: null }];
    render(<StrategicCalendarPanelV1 source={s} canManage onOpenAgenda={vi.fn()} onOpenTriage={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Ano do ciclo"), { target: { value: "2026" } });
    fireEvent.change(screen.getByLabelText("Animal do ciclo"), { target: { value: "animal" } });
    expect(state.project).toHaveBeenLastCalledWith(expect.objectContaining({ cycleYear: 2026, variant: null, configRevision: null }));
    expect(screen.getByText(/não comprova a variante adotada durante todo este ciclo/)).toBeInTheDocument();
  });
});
