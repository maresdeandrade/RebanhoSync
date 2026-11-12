/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SanitaryProtocolWindowSourceV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import { SanitaryProactiveTriagePanelV2 } from "../SanitaryProactiveTriagePanelV2";
import { triageSanitaryProtocolIntervalV2 } from "@/lib/sanitario/triage/sanitaryTriageV2";

vi.mock("@/lib/sanitario/triage/sanitaryTriageV2", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sanitario/triage/sanitaryTriageV2")>("@/lib/sanitario/triage/sanitaryTriageV2");
  return { ...actual, triageSanitaryProtocolIntervalV2: vi.fn() };
});

function evaluation(index: number) {
  return {
    animalId: `animal-${index % 2}`,
    identification: `Animal ${index}`,
    animalHref: `/animais/animal-${index % 2}`,
    lotId: "lot-1",
    lotLabel: "Lote 1",
    protocolId: "protocol-1",
    protocolLabel: "Protocolo 1",
    itemId: "item-1",
    itemKey: "item-1",
    itemLabel: "Manejo 1",
    status: "in_action_window",
    disposition: index % 2 === 0 ? "opportunity_in_window" : "restricted",
    temporalWindow: { resolution: "determined", intervals: [{ startDate: "2026-01-01", endDate: "2026-01-31" }] },
    intersectsPeriod: true,
    intervalStart: "2026-01-01",
    intervalEnd: "2026-01-31",
    reason: "Janela encontrada",
    warnings: [],
    blockers: index % 2 === 0 ? [] : ["Bloqueio técnico"],
    documentaryPending: false,
    documentaryPendingReasons: [],
    alreadyPlanned: false,
    plannedFor: null,
    planningAllowed: false,
    source: "SanitaryProtocolWindowRowV2",
  };
}

const source = {
  fazendaId: "farm-1",
  catalog: { protocols: [{ id: "protocol-1", name: "Protocolo 1" }], items: [{ id: "item-1", protocolId: "protocol-1" }], productClassGroups: [] },
  animals: [{ id: "animal-0" }, { id: "animal-1" }],
  lots: [{ id: "lot-1", nome: "Lote 1" }],
  executedHistory: [],
  executedEvents: [],
  agendas: [],
  agendaAnimals: [],
} as unknown as SanitaryProtocolWindowSourceV2;

const result = {
  period: { startDate: "2026-01-01", endDate: "2026-01-30" },
  evaluatedAt: "2026-01-01",
  evaluations: Array.from({ length: 100 }, (_, index) => evaluation(index)),
  summary: { opportunity_in_window: 50, future_opportunity: 0, scheduled: 0, factual_completed: 0, restricted: 50, insufficient_data: 0, outside_period: 0 },
  source: { type: "SanitaryProtocolWindowSourceV2", createsAgenda: false, createsEvent: false, createsStockMovement: false },
} as unknown as ReturnType<typeof triageSanitaryProtocolIntervalV2>;

describe("SanitaryProactiveTriagePanelV2", () => {
  beforeEach(() => {
    vi.mocked(triageSanitaryProtocolIntervalV2).mockReturnValue(result);
  });
  afterEach(() => vi.clearAllMocks());

  it("não monta detalhes de grupos grandes até abrir e pagina a expansão", () => {
    render(<MemoryRouter><SanitaryProactiveTriagePanelV2 source={source} /></MemoryRouter>);
    expect(screen.getByRole("button", { name: /100 avaliações/ })).toBeInTheDocument();
    expect(screen.queryByText("Animal 0")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Protocolo 1.*Manejo 1.*100 avaliações/ }));
    expect(screen.getAllByText(/Animal 0 · Lote 1/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Mostrar mais \(50 restantes\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Animal 99 · Lote 1/)).not.toBeInTheDocument();
  });

  it("mostra total da fazenda separado do indicador filtrado e recalcula o filtro", () => {
    render(<MemoryRouter><SanitaryProactiveTriagePanelV2 source={source} /></MemoryRouter>);
    expect(screen.getByText(/Total da fazenda no período: 100 avaliações em 2 animais distintos/)).toBeInTheDocument();
    expect(screen.getAllByText("50")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Filtrar por situação"), { target: { value: "restricted" } });
    expect(screen.getByText(/50 avaliações em 1 animais distintos/)).toBeInTheDocument();
    expect(screen.getByText(/Total da fazenda no período: 100 avaliações/)).toBeInTheDocument();
  });

  it("seleciona coletivamente todo o grupo, inclusive avaliações após a primeira página", () => {
    const collectiveResult = {
      ...result,
      evaluations: Array.from({ length: 60 }, (_, index) => ({
        ...evaluation(index),
        animalId: `animal-${index}`,
        identification: `Animal ${index}`,
        disposition: "opportunity_in_window" as const,
        blockers: [],
      })),
      summary: { ...result.summary, opportunity_in_window: 60, restricted: 0 },
    } as typeof result;
    vi.mocked(triageSanitaryProtocolIntervalV2).mockReturnValue(collectiveResult);

    render(<MemoryRouter><SanitaryProactiveTriagePanelV2 source={source} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Selecionar elegíveis do grupo Protocolo 1 Manejo 1 \(60\)/ }));

    expect(screen.getByText("60 avaliação(ões) selecionada(s)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Planejar selecionados/ })).toBeEnabled();
  });

  it("seleciona somente as avaliações elegíveis em um grupo misto", () => {
    const mixedEvaluations = Array.from({ length: 4 }, (_, index) => ({
      ...evaluation(index),
      animalId: `mixed-animal-${index}`,
      animalHref: `/animais/mixed-animal-${index}`,
      disposition: index % 2 === 0 ? "opportunity_in_window" as const : "restricted" as const,
      blockers: index % 2 === 0 ? [] : ["Bloqueio técnico"],
    }));
    vi.mocked(triageSanitaryProtocolIntervalV2).mockReturnValue({
      ...result,
      evaluations: mixedEvaluations,
      summary: { ...result.summary, opportunity_in_window: 2, restricted: 2 },
    } as typeof result);

    render(<MemoryRouter><SanitaryProactiveTriagePanelV2 source={source} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Selecionar elegíveis do grupo Protocolo 1 Manejo 1 \(2\)/ }));

    expect(screen.getByText("2 avaliação(ões) selecionada(s)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Selecionar elegíveis no recorte \(2\)/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Planejar selecionados/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Protocolo 1.*Manejo 1.*4 avaliações/ }));
    expect(screen.getAllByRole("checkbox", { name: /para Agenda/ })).toHaveLength(2);
  });

  it("desabilita ações coletivas quando o recorte não tem avaliação elegível", () => {
    const blocked = {
      ...evaluation(1),
      disposition: "restricted" as const,
      blockers: ["Bloqueio técnico"],
    };
    vi.mocked(triageSanitaryProtocolIntervalV2).mockReturnValue({
      ...result,
      evaluations: [blocked],
      summary: { ...result.summary, opportunity_in_window: 0, restricted: 1 },
    } as typeof result);

    render(<MemoryRouter><SanitaryProactiveTriagePanelV2 source={source} /></MemoryRouter>);

    expect(screen.getByRole("button", { name: /Selecionar elegíveis no recorte \(0\)/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Selecionar elegíveis do grupo Protocolo 1 Manejo 1 \(0\)/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Planejar selecionados/ })).toBeDisabled();
  });

  it("preserva a seleção individual ao avançar a paginação do mesmo recorte", () => {
    const pagedResult = {
      ...result,
      evaluations: Array.from({ length: 60 }, (_, index) => ({
        ...evaluation(index),
        animalId: `paged-animal-${index}`,
        identification: `Paginado ${index}`,
        disposition: "opportunity_in_window" as const,
        blockers: [],
      })),
      summary: { ...result.summary, opportunity_in_window: 60, restricted: 0 },
    } as typeof result;
    vi.mocked(triageSanitaryProtocolIntervalV2).mockReturnValue(pagedResult);

    render(<MemoryRouter><SanitaryProactiveTriagePanelV2 source={source} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Protocolo 1.*Manejo 1.*60 avaliações/ }));
    const firstCheckbox = screen.getByRole("checkbox", { name: "Selecionar Paginado 0 para Agenda" });
    fireEvent.click(firstCheckbox);
    expect(screen.getByText("1 avaliação(ões) selecionada(s)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Mostrar mais \(10 restantes\)/ }));

    expect(screen.getByRole("checkbox", { name: "Selecionar Paginado 0 para Agenda" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Paginado 55 para Agenda" }));
    expect(screen.getByText("2 avaliação(ões) selecionada(s)")).toBeInTheDocument();
  });
});
