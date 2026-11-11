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
import { listSanitaryDocumentaryPendenciesV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import { pullSanitarioProductClassV2Catalog, pullSanitarioTechnicalCatalogV2, pullSanitarioProtocolCatalogV2 } from "@/lib/offline/pull";

vi.mock("@/lib/offline/pull", () => ({
  pullSanitarioProductClassV2Catalog: vi.fn().mockResolvedValue(undefined),
  pullSanitarioTechnicalCatalogV2: vi.fn().mockResolvedValue(undefined),
  pullSanitarioProtocolCatalogV2: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sanitario/windows/sanitaryProtocolWindowsV2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sanitario/windows/sanitaryProtocolWindowsV2")>();
  return { ...actual, listSanitaryDocumentaryPendenciesV2: vi.fn(actual.listSanitaryDocumentaryPendenciesV2) };
});

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
  const source = { farmUf: "MG", ...windowSource };
  vi.mocked(useLiveQuery).mockImplementation(() => {
    call += 1;
    return call % 2 === 1 ? localAgenda : source;
  });
}

function renderPage(initialEntry = "/protocolos-sanitarios") {
  render(<MemoryRouter initialEntries={[initialEntry]}><Routes><Route path="/protocolos-sanitarios" element={<ProtocolosSanitarios />} /><Route path="/protocolos-sanitarios/catalogo-v2" element={<div>Catálogo acessível</div>} /><Route path="/eventos" element={<div>Eventos acessíveis</div>} /></Routes></MemoryRouter>);
}

describe("Central Sanitária", () => {
  beforeEach(() => {
    vi.mocked(listSanitaryDocumentaryPendenciesV2).mockClear();
    vi.mocked(pullSanitarioProductClassV2Catalog).mockClear();
    vi.mocked(pullSanitarioTechnicalCatalogV2).mockClear();
    vi.mocked(pullSanitarioProtocolCatalogV2).mockClear();
    vi.mocked(useLiveQuery).mockReset();
    mockLiveQueries();
    vi.mocked(useAuth).mockReturnValue({ activeFarmId: "farm-1", farmExperienceMode: "completo", role: "manager" } as ReturnType<typeof useAuth>);
    vi.mocked(listLocalSanitaryAgendasV2).mockReturnValue(Promise.resolve([]));
  });

  it("mostra falha da consulta local e permite tentar novamente sem exibir dados antigos", async () => {
    let call = 0;
    vi.mocked(useLiveQuery).mockImplementation(() => (++call % 2 ? [] : { fazendaId: "farm-1", readError: "local_read_failed" }));
    renderPage();
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível consultar os dados sanitários locais");
    expect(screen.queryByLabelText("Animal das necessidades")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar consulta novamente" }));
    expect(call).toBeGreaterThan(2);
  });

  it("calcula pendências apenas no Histórico e reutiliza o resultado ao filtrar", async () => {
    const user = userEvent.setup();
    renderPage();
    const initial = vi.mocked(listSanitaryDocumentaryPendenciesV2).mock.calls.length;
    await user.click(screen.getByRole("tab", { name: /Histórico sanitário/ }));
    const history = vi.mocked(listSanitaryDocumentaryPendenciesV2).mock.calls.length;
    await user.type(screen.getByLabelText("Texto"), "B19");
    const filtered = vi.mocked(listSanitaryDocumentaryPendenciesV2).mock.calls.length;
    console.info("SANITARY_HISTORY_EVALUATIONS", JSON.stringify({ initial, history, filtered }));
    expect({ initial, history, filtered }).toEqual({ initial: 0, history: 1, filtered: 1 });
    expect(pullSanitarioProductClassV2Catalog).not.toHaveBeenCalled();
    expect(pullSanitarioTechnicalCatalogV2).not.toHaveBeenCalled();
    expect(pullSanitarioProtocolCatalogV2).not.toHaveBeenCalled();
    expect(screen.getByText("Filtros do histórico sanitário")).toBeInTheDocument();
  });

  it("preserva a atualização explícita dos três catálogos, sem pull na abertura", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(pullSanitarioProtocolCatalogV2).not.toHaveBeenCalled();
    await user.click(screen.getByRole("tab", { name: /Catálogo sanitário/ }));
    await user.click(screen.getByRole("button", { name: "Atualizar catálogo" }));
    expect(pullSanitarioProductClassV2Catalog).toHaveBeenCalledExactlyOnceWith("farm-1");
    expect(pullSanitarioTechnicalCatalogV2).toHaveBeenCalledExactlyOnceWith("farm-1");
    expect(pullSanitarioProtocolCatalogV2).toHaveBeenCalledExactlyOnceWith();
  });

  it("renderiza as áreas da central com a aba Conformidade ativa", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByText("Central Sanitária")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Triagem sanitária/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Agenda sanitária/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Catálogo sanitário/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Histórico sanitário/ })).toBeInTheDocument();
    const complianceTab = screen.getByRole("tab", { name: /Conformidade/ });
    expect(complianceTab).toBeEnabled();
    await user.click(complianceTab);
    expect(screen.getByText("Resumo de conformidade")).toBeInTheDocument();
  });

  it("explicita estado vazio sem tratar ausência de dados como conformidade", () => {
    renderPage();
    expect(screen.getByText(/Nenhum animal ativo disponível nesta fazenda/)).toBeInTheDocument();
    expect(screen.getByText(/Isso não comprova conformidade sanitária/)).toBeInTheDocument();
  });

  it("abre a triagem proativa com filtro inicial por animal e mantém o alvo na URL", async () => {
    const user = userEvent.setup();
    vi.mocked(useLiveQuery).mockReset();
    const makeAnimal = (id: string, label: string, lotId = "lote-1") => ({
      id, fazenda_id: "farm-1", identificacao: label, nome: null, sexo: "F", status: "ativo", lote_id: lotId,
      data_nascimento: "2025-01-01", data_entrada: null, data_saida: null, pai_id: null, mae_id: null, rfid: null,
      especie: "bovino", origem: null, raca: null, papel_macho: null, habilitado_monta: false, observacoes: null,
      payload: {}, client_id: "client", client_op_id: `op-${id}`, client_tx_id: null, client_recorded_at: "2026-01-01",
      server_received_at: "2026-01-01", created_at: "2026-01-01", updated_at: "2026-01-01", deleted_at: null,
    });
    mockLiveQueries({
      catalog: { protocols: [{ id: "protocol-b19", familyCode: "brucelose_b19", name: "Brucelose B19", scope: "global", fazendaId: null, speciesScope: {}, jurisdictionScope: {}, legalStatus: "manual_only", version: 1, status: "active", approvalStatus: "approved", sourceRefsSnapshot: [], metadata: {} }], items: [{ id: "item-b19", protocolId: "protocol-b19", logicalItemKey: "b19_femeas_3_8_meses", version: 1, itemStatus: "recomendado", actionType: "vacinacao", productRequirementKind: "product_class", productId: null, productClass: "vacina_brucelose_b19", productClassGroupId: null, eligibilityRule: { species: ["bovino"], sex: "femea", age_min_months: 1 }, operationalWindowRule: {}, doseRule: {}, routeRule: {}, boosterRule: {}, speciesAuthorization: {}, sourceRefsByField: {}, limitations: [], snapshotTemplate: {}, requiresMvResponsavel: false, status: "active" }], productClassGroups: [] },
      animals: [makeAnimal("animal-1", "Vaca 10"), makeAnimal("animal-2", "Vaca 20")],
      lots: [{ id: "lote-1", fazenda_id: "farm-1", nome: "Lote recria", deleted_at: null }], executedHistory: [], executedEvents: [], agendas: [], agendaAnimals: [],
    });
    renderPage("/protocolos-sanitarios?tab=janelas&animalId=animal-1&loteId=lote-1");
    expect(screen.getByRole("tab", { name: /Triagem sanitária/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Filtrar por animal")).toHaveValue("animal-1");
    expect(screen.getByLabelText("Filtrar por lote")).toHaveValue("lote-1");
    await user.selectOptions(screen.getByLabelText("Filtrar por animal"), "todos");
    expect(screen.getByLabelText("Filtrar por animal")).toHaveValue("todos");
  });

  it("permite escolher lote, horizonte personalizado e mantém a triagem somente derivada", async () => {
    const user = userEvent.setup();
    vi.mocked(useLiveQuery).mockReset();
    const animal = { id: "animal-1", fazenda_id: "farm-1", identificacao: "Vaca 10", nome: null, sexo: "F", status: "ativo", lote_id: "lote-1", data_nascimento: "2025-01-01", data_entrada: null, data_saida: null, pai_id: null, mae_id: null, rfid: null, especie: "bovino", origem: null, raca: null, papel_macho: null, habilitado_monta: false, observacoes: null, payload: {}, client_id: "client", client_op_id: "op-1", client_tx_id: null, client_recorded_at: "2026-01-01", server_received_at: "2026-01-01", created_at: "2026-01-01", updated_at: "2026-01-01", deleted_at: null };
    mockLiveQueries({ catalog: { protocols: [], items: [{ id: "item-1", protocolId: "protocol-1", logicalItemKey: "item-1", version: 1, itemStatus: "recomendado", actionType: "manejo_sanitario", productRequirementKind: "none", productId: null, productClass: null, productClassGroupId: null, eligibilityRule: { species: ["bovino"], age_min_months: 1 }, operationalWindowRule: {}, doseRule: {}, routeRule: {}, boosterRule: {}, speciesAuthorization: {}, sourceRefsByField: {}, limitations: [], snapshotTemplate: {}, requiresMvResponsavel: false, status: "active" }], productClassGroups: [] }, animals: [animal], lots: [{ id: "lote-1", fazenda_id: "farm-1", nome: "Lote recria", deleted_at: null }], executedHistory: [], executedEvents: [], agendas: [], agendaAnimals: [] });
    renderPage("/protocolos-sanitarios?tab=janelas");
    await user.selectOptions(screen.getByLabelText("Horizonte da triagem"), "custom");
    await user.clear(screen.getByLabelText("Data inicial da triagem"));
    await user.type(screen.getByLabelText("Data inicial da triagem"), "2027-01-01");
    await user.clear(screen.getByLabelText("Data final da triagem"));
    await user.type(screen.getByLabelText("Data final da triagem"), "2027-03-31");
    expect(screen.getByText(/Consulta: 01\/01\/2027 a 31\/03\/2027/)).toBeInTheDocument();
    expect(screen.queryByText(/Planejar manejo/)).not.toBeInTheDocument();
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
