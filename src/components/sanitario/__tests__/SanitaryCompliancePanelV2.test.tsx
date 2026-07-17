/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { SanitaryCompliancePanelV2 } from "@/components/sanitario/SanitaryCompliancePanelV2";
import { buildSanitaryComplianceV2 } from "@/lib/sanitario/compliance/sanitaryComplianceV2";

vi.mock("@/lib/sanitario/compliance/sanitaryComplianceV2", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/sanitario/compliance/sanitaryComplianceV2")
  >("@/lib/sanitario/compliance/sanitaryComplianceV2");
  return { ...actual, buildSanitaryComplianceV2: vi.fn() };
});

const statuses = {
  compliant: 1,
  planned: 1,
  due_soon: 0,
  due_now: 0,
  overdue: 0,
  insufficient_data: 0,
  document_pending: 0,
  blocked: 0,
  not_applicable: 0,
};

const rows = [
  {
    key: "animal-1|protocol-1|item-1",
    animalId: "animal-1",
    animalLabel: "Vaca Aurora",
    animalHref: "/animais/animal-1",
    lotId: "lot-1",
    lotLabel: "Matrizes",
    lotHref: "/lotes/lot-1",
    protocolId: "protocol-1",
    protocolLabel: "Brucelose B19",
    itemId: "item-1",
    itemKey: "b19_femeas_3_8_meses",
    itemLabel: "B19 — fêmeas de 3 a 8 meses",
    status: "compliant" as const,
    evidenceLabel: "Execução sanitária compatível registrada.",
    evidenceOrigin: "executed_event" as const,
    evidenceOriginLabel: "Evento sanitário executado",
    evidenceDate: "2026-07-01",
    agendaId: null,
    agendaDate: null,
    eventId: "event-private-id",
    documentPendency: null,
    productId: "product-1",
    productLabel: "Vacina B19",
    activeWithdrawal: null,
  },
  {
    key: "animal-2|protocol-1|item-1",
    animalId: "animal-2",
    animalLabel: "Vaca Brisa",
    animalHref: "/animais/animal-2",
    lotId: "lot-2",
    lotLabel: "Bezerras",
    lotHref: "/lotes/lot-2",
    protocolId: "protocol-1",
    protocolLabel: "Brucelose B19",
    itemId: "item-1",
    itemKey: "b19_femeas_3_8_meses",
    itemLabel: "B19 — fêmeas de 3 a 8 meses",
    status: "planned" as const,
    evidenceLabel: "Agenda futura prevista para 20/07/2026.",
    evidenceOrigin: "future_agenda" as const,
    evidenceOriginLabel: "Agenda sanitária futura",
    evidenceDate: "2026-07-20",
    agendaId: "agenda-private-id",
    agendaDate: "2026-07-20",
    eventId: null,
    documentPendency: null,
    productId: "product-1",
    productLabel: "Vacina B19",
    activeWithdrawal: null,
  },
];

function renderPanel(initialAnimalId?: string, initialLotId?: string) {
  vi.mocked(buildSanitaryComplianceV2).mockReturnValue({
    evaluatedAt: "2026-07-04",
    rows,
    statuses,
    byAnimal: [],
    byLot: [],
    byProtocol: [],
    byItem: [],
    createsAgenda: false,
    createsEvent: false,
    createsStockMovement: false,
    createsActiveWithdrawal: false,
    allowsOperationalRelease: false,
  });
  render(
    <MemoryRouter>
      <SanitaryCompliancePanelV2
        source={{
          catalog: { protocols: [], items: [], productClassGroups: [] },
          animals: [],
          lots: [],
          executedHistory: [],
          executedEvents: [],
          agendas: [],
          agendaAnimals: [],
        }}
        initialAnimalId={initialAnimalId}
        initialLotId={initialLotId}
      />
    </MemoryRouter>,
  );
}

describe("SanitaryCompliancePanelV2", () => {
  it("cards de situação filtram a lista", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Filtrar por Conforme" }));
    expect(screen.getByText("Vaca Aurora · Matrizes")).toBeInTheDocument();
    expect(screen.queryByText("Vaca Brisa · Bezerras")).not.toBeInTheDocument();
  });

  it("aplica filtros iniciais de animal e lote", () => {
    renderPanel("animal-2", "lot-2");
    expect(screen.getByText("Vaca Brisa · Bezerras")).toBeInTheDocument();
    expect(screen.queryByText("Vaca Aurora · Matrizes")).not.toBeInTheDocument();
  });

  it("não expõe identificadores técnicos nem nomes internos", () => {
    renderPanel();
    expect(screen.queryByText("event-private-id")).not.toBeInTheDocument();
    expect(screen.queryByText("agenda-private-id")).not.toBeInTheDocument();
    expect(screen.queryByText("b19_femeas_3_8_meses")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir evento" })).toBeInTheDocument();
  });
});
