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

const emptyWindowSource = {
  catalog: { protocols: [], items: [], productClassGroups: [] },
  animals: [],
  lots: [],
  executedHistory: [],
  executedEvents: [],
  agendas: [],
  agendaAnimals: [],
};

function mockLiveQueries(windowSource = emptyWindowSource, localAgenda: unknown[] = []) {
  let call = 0;
  vi.mocked(useLiveQuery).mockImplementation(() => {
    call += 1;
    return call % 2 === 1 ? localAgenda : windowSource;
  });
}

function renderPage(initialEntry = "/protocolos-sanitarios") {
  render(<MemoryRouter initialEntries={[initialEntry]}><Routes><Route path="/protocolos-sanitarios" element={<ProtocolosSanitarios />} /><Route path="/protocolos-sanitarios/catalogo-v2" element={<div>Catálogo acessível</div>} /><Route path="/eventos" element={<div>Eventos acessíveis</div>} /></Routes></MemoryRouter>);
}

describe("Central Sanitária", () => {
  beforeEach(() => {
    vi.mocked(useLiveQuery).mockReset();
    mockLiveQueries();
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

  it("abre Janelas sanitárias com filtro inicial por animal e permite limpar", async () => {
    const user = userEvent.setup();
    vi.mocked(useLiveQuery).mockReset();
    mockLiveQueries({
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
            id: "animal-1",
            fazenda_id: "farm-1",
            identificacao: "Vaca 10",
            nome: null,
            sexo: "F",
            status: "ativo",
            lote_id: "lote-1",
            data_nascimento: "2026-03-01",
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
            client_op_id: "op-1",
            client_tx_id: null,
            client_recorded_at: "2026-01-01",
            server_received_at: "2026-01-01",
            created_at: "2026-01-01",
            updated_at: "2026-01-01",
            deleted_at: null,
          },
          {
            id: "animal-2",
            fazenda_id: "farm-1",
            identificacao: "Vaca 20",
            nome: null,
            sexo: "F",
            status: "ativo",
            lote_id: "lote-1",
            data_nascimento: "2026-03-01",
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
            client_op_id: "op-2",
            client_tx_id: null,
            client_recorded_at: "2026-01-01",
            server_received_at: "2026-01-01",
            created_at: "2026-01-01",
            updated_at: "2026-01-01",
            deleted_at: null,
          },
        ],
        lots: [{ id: "lote-1", fazenda_id: "farm-1", nome: "Lote recria", deleted_at: null }],
        executedHistory: [],
        executedEvents: [],
        agendas: [],
        agendaAnimals: [],
      });

    renderPage("/protocolos-sanitarios?tab=janelas&animalId=animal-1&loteId=lote-1");

    expect(screen.getByRole("tab", { name: /Janelas sanitárias/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Filtro ativo: animal Vaca 10")).toBeInTheDocument();
    expect(screen.getByText("Lote usado apenas como contexto auxiliar: Lote recria.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/animal-1|lote-1|protocol-b19|item-b19/);

    await user.selectOptions(screen.getByLabelText("Selecionar protocolo"), "protocol-b19");
    await screen.findByRole("option", { name: "B19 — fêmeas de 3 a 8 meses" });
    await user.selectOptions(screen.getByLabelText("Selecionar item do protocolo"), "item-b19");

    expect(screen.getByText("Vaca 10")).toBeInTheDocument();
    expect(screen.queryByText("Vaca 20")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Limpar filtro/i }));

    expect(screen.queryByText(/Filtro ativo:/)).not.toBeInTheDocument();
    expect(screen.getByText("Vaca 10")).toBeInTheDocument();
    expect(screen.getByText("Vaca 20")).toBeInTheDocument();
  });

  it("abre Janelas sanitárias com filtro inicial por lote e permite limpar", async () => {
    const user = userEvent.setup();
    vi.mocked(useLiveQuery).mockReset();
    mockLiveQueries({
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
          id: "animal-1",
          fazenda_id: "farm-1",
          identificacao: "Vaca 10",
          nome: null,
          sexo: "F",
          status: "ativo",
          lote_id: "lote-1",
          data_nascimento: "2026-03-01",
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
          client_op_id: "op-1",
          client_tx_id: null,
          client_recorded_at: "2026-01-01",
          server_received_at: "2026-01-01",
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
          deleted_at: null,
        },
        {
          id: "animal-2",
          fazenda_id: "farm-1",
          identificacao: "Vaca 20",
          nome: null,
          sexo: "F",
          status: "ativo",
          lote_id: "lote-1",
          data_nascimento: "2026-03-01",
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
          client_op_id: "op-2",
          client_tx_id: null,
          client_recorded_at: "2026-01-01",
          server_received_at: "2026-01-01",
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
          deleted_at: null,
        },
        {
          id: "animal-3",
          fazenda_id: "farm-1",
          identificacao: "Vaca 30",
          nome: null,
          sexo: "F",
          status: "ativo",
          lote_id: "lote-2",
          data_nascimento: "2026-03-01",
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
          client_op_id: "op-3",
          client_tx_id: null,
          client_recorded_at: "2026-01-01",
          server_received_at: "2026-01-01",
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
          deleted_at: null,
        },
      ],
      lots: [
        { id: "lote-1", fazenda_id: "farm-1", nome: "Lote recria", deleted_at: null },
        { id: "lote-2", fazenda_id: "farm-1", nome: "Lote descarte", deleted_at: null },
      ],
      executedHistory: [],
      executedEvents: [],
      agendas: [],
      agendaAnimals: [],
    });

    renderPage("/protocolos-sanitarios?tab=janelas&loteId=lote-1");

    expect(screen.getByRole("tab", { name: /Janelas sanitárias/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Filtro ativo: lote Lote recria")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/animal-1|lote-1|protocol-b19|item-b19/);

    await user.selectOptions(screen.getByLabelText("Selecionar protocolo"), "protocol-b19");
    await screen.findByRole("option", { name: "B19 — fêmeas de 3 a 8 meses" });
    await user.selectOptions(screen.getByLabelText("Selecionar item do protocolo"), "item-b19");

    expect(screen.getByText("Vaca 10")).toBeInTheDocument();
    expect(screen.getByText("Vaca 20")).toBeInTheDocument();
    expect(screen.queryByText("Vaca 30")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Limpar filtro/i }));

    expect(screen.queryByText(/Filtro ativo:/)).not.toBeInTheDocument();
    expect(screen.getByText("Vaca 10")).toBeInTheDocument();
    expect(screen.getByText("Vaca 20")).toBeInTheDocument();
    expect(screen.getByText("Vaca 30")).toBeInTheDocument();
  });

  it("mostra pendencias documentais na visão de histórico", async () => {
    const user = userEvent.setup();
    vi.mocked(useLiveQuery).mockReset();
    mockLiveQueries({
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
        executedEvents: [],
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

  it("lista eventos executados e filtros na visão de histórico", async () => {
    const user = userEvent.setup();
    vi.mocked(useLiveQuery).mockReset();
    mockLiveQueries({
      ...emptyWindowSource,
      executedEvents: [
        {
          eventId: "event-1",
          executedAt: "2026-07-02T12:00:00.000Z",
          protocolLabel: "Raiva",
          itemLabel: "Reforço anual",
          animalLabel: "14 animais",
          animalCount: 14,
          lotLabel: "L_09",
          productLabel: "Vacina Raiva",
          doseLabel: "2 ml",
          routeLabel: "subcutanea",
          responsibleLabel: "mv@example.com",
          originLabel: "agenda sanitária",
          stockLabel: "sem baixa",
          withdrawalLabel: "sem regra",
          recordType: "executed_event",
        },
      ],
    });

    renderPage();
    await user.click(screen.getByRole("tab", { name: /Histórico sanitário/ }));

    expect(screen.getByText("Eventos executados")).toBeInTheDocument();
    expect(screen.getByLabelText("Produto")).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de registro")).toBeInTheDocument();
    expect(screen.getByText("Raiva · Reforço anual")).toBeInTheDocument();
    expect(screen.getByText(/Vacina Raiva · 2 ml · subcutanea/)).toBeInTheDocument();
    expect(screen.getByText(/agenda sanitária · estoque sem baixa · carência sem regra/)).toBeInTheDocument();
  });
});
