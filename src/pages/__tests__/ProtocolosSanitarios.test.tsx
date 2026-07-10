/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/hooks/useAuth";
import ProtocolosSanitarios from "@/pages/ProtocolosSanitarios";
import { listLocalSanitaryAgendasV2 } from "@/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2";
import { useLiveQuery } from "dexie-react-hooks";

vi.mock("@/hooks/useAuth");
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: vi.fn() }));
vi.mock("@/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2", async () => {
  const actual = await vi.importActual<typeof import("@/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2")>("@/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2");
  return { ...actual, listLocalSanitaryAgendasV2: vi.fn(), rescheduleLocalSanitaryAgendaV2: vi.fn(), cancelLocalSanitaryAgendaV2: vi.fn() };
});

function renderPage() {
  render(<MemoryRouter initialEntries={["/protocolos-sanitarios"]}><Routes><Route path="/protocolos-sanitarios" element={<ProtocolosSanitarios />} /><Route path="/protocolos-sanitarios/catalogo-v2" element={<div>Catálogo acessível</div>} /><Route path="/eventos" element={<div>Eventos acessíveis</div>} /></Routes></MemoryRouter>);
}

describe("Central Sanitária", () => {
  beforeEach(() => {
    vi.mocked(useLiveQuery)
      .mockReset()
      .mockReturnValueOnce([])
      .mockReturnValueOnce({
        catalog: { protocols: [], items: [], productClassGroups: [] },
        animals: [],
        lots: [],
        executedHistory: [],
        agendas: [],
        agendaAnimals: [],
      });
    vi.mocked(useAuth).mockReturnValue({ activeFarmId: "farm-1", farmExperienceMode: "completo", role: "manager" } as ReturnType<typeof useAuth>);
    vi.mocked(listLocalSanitaryAgendasV2).mockReturnValue(Promise.resolve([]));
  });

  it("renderiza as áreas da central com conformidade futura desabilitada", () => {
    renderPage();
    expect(screen.getByText("Central Sanitária")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Janelas sanitárias/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Agenda sanitária/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Catálogo sanitário/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Histórico sanitário/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Conformidade/ })).toBeDisabled();
  });

  it("explicita que planejamento não é execução nem histórico", () => {
    renderPage();
    expect(screen.getByText(/Isso cria agenda futura, não execução/)).toBeInTheDocument();
    expect(screen.getByText(/carência permanecem exclusivos do registro executado/)).toBeInTheDocument();
  });

  it("mostra pendencias documentais na visão de histórico", async () => {
    const user = userEvent.setup();
    vi.mocked(useLiveQuery)
      .mockReset()
      .mockReturnValueOnce([])
      .mockReturnValueOnce({
        catalog: {
          protocols: [
            {
              id: "protocol-b19",
              familyCode: "brucelose_b19",
              name: "Brucelose B19",
              scope: "global",
              fazendaId: null,
              speciesScope: {},
              jurisdictionScope: {},
              legalStatus: "manual_only",
              version: 1,
              status: "draft",
              approvalStatus: "draft",
              sourceRefsSnapshot: [],
              metadata: {},
            },
          ],
          items: [
            {
              id: "item-b19",
              protocolId: "protocol-b19",
              logicalItemKey: "b19_femeas_3_8_meses",
              version: 1,
              itemStatus: "draft",
              actionType: "vacinacao",
              productRequirementKind: "product_class",
              productId: null,
              productClass: "vacina_brucelose_b19",
              productClassGroupId: null,
              eligibilityRule: { species: ["bovino"], sex: "femea" },
              operationalWindowRule: {},
              doseRule: {},
              routeRule: {},
              boosterRule: {},
              speciesAuthorization: {},
              sourceRefsByField: {},
              limitations: [],
              snapshotTemplate: {},
              allowsAgendaAuto: false,
              requiresMvResponsavel: false,
              status: "draft",
            },
          ],
          productClassGroups: [],
        },
        animals: [
          {
            id: "animal-adulta",
            fazenda_id: "farm-1",
            identificacao: "Vaca 10",
            nome: null,
            sexo: "F",
            status: "ativo",
            lote_id: null,
            data_nascimento: "2024-01-01",
            data_entrada: null,
            data_saida: null,
            pai_id: null,
            mae_id: null,
            rfid: null,
            especie: "bovino",
            origem: null,
            raca: null,
            papel_macho: null,
            habilitado_monta: false,
            observacoes: null,
            payload: {},
            client_id: "client",
            client_op_id: "op",
            client_tx_id: null,
            client_recorded_at: "2026-01-01",
            server_received_at: "2026-01-01",
            created_at: "2026-01-01",
            updated_at: "2026-01-01",
            deleted_at: null,
          },
        ],
        lots: [],
        executedHistory: [],
        agendas: [],
        agendaAnimals: [],
      });
    vi.mocked(useAuth).mockReturnValue({ activeFarmId: "farm-1", farmExperienceMode: "completo", role: "manager" } as ReturnType<typeof useAuth>);
    vi.mocked(listLocalSanitaryAgendasV2).mockReturnValue(Promise.resolve([]));

    renderPage();
    await user.click(screen.getByRole("tab", { name: /Histórico sanitário/ }));

    expect(screen.getByText("Pendências documentais")).toBeInTheDocument();
    expect(
      screen.getByText("Fêmea adulta exige comprovação documental de B19."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir animal/i })).toHaveAttribute(
      "href",
      "/animais/animal-adulta",
    );
  });
});
