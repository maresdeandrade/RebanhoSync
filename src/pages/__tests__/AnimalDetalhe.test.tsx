/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import { useAuth } from "@/hooks/useAuth";
import { useAnimalWeightPresentation } from "@/hooks/useAnimalWeightPresentation";
import { selectAnimalWeightPresentation } from "@/lib/insights/animalWeightPresentation";
import { formatWeightPerDay } from "@/lib/format/weight";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { DEFAULT_FARM_MEASUREMENT_CONFIG } from "@/lib/farms/measurementConfig";
import type {
  AgendaItem,
  Animal,
  Evento,
  SanitarioCaso,
} from "@/lib/offline/types";
import { buildClinicalProtocolEventPayload } from "@/lib/sanitario/compliance/clinicalProtocols";
import type { SanitaryExecutedHistoryV2 } from "@/lib/sanitario/checks/sanitaryProtocolPrecheckV2";
import { validateClinicalCaseClosureInput } from "@/pages/animalDetalheClinicalCase";
import AnimalDetalhe, { AnimalSanitaryCasesPanel } from "@/pages/AnimalDetalhe";
import type { SanitaryProtocolCatalogReadModelV2 } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";

vi.mock("@/hooks/useAuth");
vi.mock("@/hooks/useAnimalWeightPresentation");
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));

function makeAnimal(
  overrides: Partial<Animal> & Pick<Animal, "id" | "identificacao" | "sexo">,
): Animal {
  return {
    id: overrides.id,
    fazenda_id: "farm-1",
    identificacao: overrides.identificacao,
    sexo: overrides.sexo,
    status: "ativo",
    lote_id: "lote-1",
    data_nascimento: "2025-01-10",
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    origem: "nascimento",
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-01T00:00:00.000Z",
    server_received_at: "2026-04-01T00:00:00.000Z",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeAgendaItem(
  overrides: Partial<AgendaItem> & Pick<AgendaItem, "id" | "tipo" | "data_prevista">,
): AgendaItem {
  return {
    id: overrides.id,
    fazenda_id: "farm-1",
    dominio: "sanitario",
    tipo: overrides.tipo,
    status: "agendado",
    data_prevista: overrides.data_prevista,
    animal_id: "animal-1",
    lote_id: null,
    dedup_key: null,
    source_kind: "automatico",
    source_ref: null,
    source_client_op_id: null,
    source_tx_id: null,
    source_evento_id: null,
    protocol_item_version_id: "item-1",
    interval_days_applied: 0,
    payload: {},
    client_id: "client-1",
    client_op_id: "agenda-op-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-01T00:00:00.000Z",
    server_received_at: "2026-04-01T00:00:00.000Z",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeSanitarioCaso(overrides: Partial<SanitarioCaso> = {}): SanitarioCaso {
  return {
    id: "caso-1",
    fazenda_id: "farm-1",
    animal_id: "animal-1",
    tipo: "clinico",
    status: "em_acompanhamento",
    opened_at: "2026-05-20T12:00:00.000Z",
    closed_at: null,
    disease_code: null,
    disease_name: null,
    notification_type: null,
    requires_immediate_notification: false,
    movement_blocked: false,
    source_alert_evento_id: null,
    closure_reason: null,
    observacoes: "Tratamento em acompanhamento",
    payload: {},
    client_id: "client-1",
    client_op_id: "case-op-1",
    client_tx_id: null,
    client_recorded_at: "2026-05-20T12:00:00.000Z",
    server_received_at: "2026-05-20T12:00:00.000Z",
    created_at: "2026-05-20T12:00:00.000Z",
    updated_at: "2026-05-20T12:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeEvento(overrides: Partial<Evento> = {}): Evento {
  return {
    id: "evento-1",
    fazenda_id: "farm-1",
    dominio: "sanitario",
    occurred_at: "2026-05-21T09:30:00.000Z",
    animal_id: "animal-1",
    lote_id: null,
    source_task_id: null,
    source_tx_id: null,
    source_client_op_id: null,
    corrige_evento_id: null,
    sanitario_caso_id: "caso-1",
    observacoes: "Suspeita TPB: aplicado anti-inflamatorio e reavaliar em 48h",
    payload: {
      tipo: "medicamento",
    },
    client_id: "client-1",
    client_op_id: "event-op-1",
    client_tx_id: null,
    client_recorded_at: "2026-05-21T09:30:00.000Z",
    server_received_at: "2026-05-21T09:30:00.000Z",
    created_at: "2026-05-21T09:30:00.000Z",
    updated_at: "2026-05-21T09:30:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeWeightPresentation(weights: number[], sameInstant = false, measuredAt?: string[]) {
  const animal = makeAnimal({ id: "animal-1", identificacao: "PESO-01", sexo: "M" });
  return selectAnimalWeightPresentation({
    fazendaId: "farm-1", animalId: animal.id, animal,
    events: weights.map((_, index) => makeEvento({
      id: `weight-${index}`, dominio: "pesagem",
      occurred_at: measuredAt?.[index] ?? `2026-01-${sameInstant ? "01" : String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
    })),
    weightDetails: weights.map((weight, index) => ({
      evento_id: `weight-${index}`, fazenda_id: "farm-1", peso_kg: weight,
    })),
    referenceDate: "2026-02-01T12:00:00.000Z",
  });
}

function RegistrationDestination() {
  const { search } = useLocation();
  return <p>Registro: {search}</p>;
}

describe("AnimalDetalhe", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);

  interface MockLiveQueryResponses {
    animal?: unknown;
    lote?: unknown;
    mae?: unknown;
    pai?: unknown;
    crias?: unknown;
    eventos?: unknown;
    agenda?: unknown;
    officialDiseases?: unknown;
    ultimoPeso?: unknown;
    historicoPeso?: unknown;
    ultimoEcc?: unknown;
    historicoEcc?: unknown;
    sociedadeAtiva?: unknown;
    contraparte?: unknown;
    sanitaryCases?: unknown;
    activeSanitaryCase?: unknown;
    sanitaryCatalog?: SanitaryProtocolCatalogReadModelV2 | null;
    sanitaryHistory?: SanitaryExecutedHistoryV2[];
  }

  const setupMockLiveQuery = (mockResponses: MockLiveQueryResponses) => {
    mockedUseLiveQuery.mockImplementation((fn: unknown) => {
      if (typeof fn !== "function") return null;
      const str = fn.toString();

      if (str.includes("readAnimalInActiveFarm")) {
        return mockResponses.animal ?? null;
      }
      if (str.includes("event_eventos")) {
        if (str.includes("pesagem")) {
          if (str.includes("resolveCurrentWeight")) {
            return mockResponses.ultimoPeso ?? null;
          }
          return mockResponses.historicoPeso ?? [];
        }
        if (str.includes("ecc")) {
          if (str.includes("eligible[0]")) {
            return mockResponses.ultimoEcc ?? null;
          }
          return mockResponses.historicoEcc ?? [];
        }
        return "eventos" in mockResponses ? mockResponses.eventos : [];
      }
      if (str.includes("state_agenda_itens")) {
        return "agenda" in mockResponses ? mockResponses.agenda : [];
      }
      if (str.includes("catalog_doencas_notificaveis")) {
        return mockResponses.officialDiseases ?? [];
      }
      if (str.includes("state_sociedade_animais")) {
        return mockResponses.sociedadeAtiva ?? null;
      }
      if (str.includes("state_contrapartes")) {
        return mockResponses.contraparte ?? null;
      }
      if (str.includes("state_sanitario_casos")) {
        if (str.includes("status === ")) {
          return mockResponses.activeSanitaryCase ?? null;
        }
        return mockResponses.sanitaryCases ?? [];
      }
      if (str.includes("getAnimalSanitaryExecutedHistoryV2")) {
        return mockResponses.sanitaryHistory ?? [];
      }
      if (str.includes("readLocalSanitaryProtocolCatalogV2")) {
        return mockResponses.sanitaryCatalog ?? null;
      }
      if (str.includes("state_lotes")) {
        if (str.includes(".get")) {
          return mockResponses.lote ?? null;
        }
        return [];
      }
      if (str.includes("state_animais")) {
        if (str.includes("mae_id === animal.id")) {
          return mockResponses.crias ?? [];
        }
        if (str.includes("mae_id")) {
          return mockResponses.mae ?? null;
        }
        if (str.includes("pai_id")) {
          return mockResponses.pai ?? null;
        }
        return mockResponses.animal ?? null;
      }
      return null;
    });
  };

  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.clearAllMocks();
    vi.mocked(useAnimalWeightPresentation).mockReturnValue(makeWeightPresentation([]));
    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
      role: "owner",
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
      farmMeasurementConfig: DEFAULT_FARM_MEASUREMENT_CONFIG,
    } as ReturnType<typeof useAuth>);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const renderDetail = () => render(
    <MemoryRouter initialEntries={["/animais/animal-1"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/animais/:id" element={<AnimalDetalhe />} />
        <Route path="/registrar" element={<RegistrationDestination />} />
      </Routes>
    </MemoryRouter>,
  );

  it("abre Visão geral e mantém casos e suas ações dentro de Sanidade", async () => {
    const user = userEvent.setup();
    setupMockLiveQuery({
      animal: makeAnimal({ id: "animal-1", identificacao: "V2-001", sexo: "F", data_nascimento: "2026-10-06" }),
      sanitaryCases: [makeSanitarioCaso()],
    });
    renderDetail();

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent?.trim())).toEqual([
      "Visão geral", "Histórico", "Sanidade", "Agenda", "Comercial",
    ]);
    expect(screen.getByRole("tab", { name: "Visão geral" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Identificação complementar")).toBeVisible();
    expect(screen.getByText("06/10/2026")).toBeVisible();
    expect(screen.queryByText("Tratamento em acompanhamento")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Sanidade" }));
    const cases = screen.getByRole("region", { name: "Casos sanitários" });
    expect(within(cases).getByText("Tratamento em acompanhamento")).toBeVisible();
    await user.click(within(cases).getByRole("button", { name: /Encerrar caso/i }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByText(/Encerrar caso clinico/i)).toBeVisible();
  });

  it("filtra a coleção factual sem perder ordem, domínios ou detalhes especializados", async () => {
    const user = userEvent.setup();
    const domains = ["pesagem", "reproducao", "sanitario", "alerta_sanitario", "conformidade", "movimentacao", "comercial", "ecc", "nutricao", "pastagem", "financeiro", "obito", "dominio_novo"];
    const events = domains.map((dominio, index) => ({
      ...makeEvento({ id: `event-${index}`, dominio: dominio as Evento["dominio"], observacoes: `Fato ${dominio}` }),
      ...(dominio === "comercial" ? { detailsComercial: {
        operation_type: "venda", contraparte_nome: "Comprador teste", quantidade_animais: 2,
        peso_vivo_total: 800, valor_bruto: 9000, valor_liquido_derivado: 8500,
        observacoes: "Detalhe comercial preservado",
      } } : {}),
      ...(dominio === "reproducao" ? { details: { tipo: "diagnostico", macho_id: "pai-teste", payload: { resultado: "positivo" } }, machoIdentificacao: "TOURO-01" } : {}),
      ...(dominio === "alerta_sanitario" ? { payload: { route_label: "Rota teste", immediate_actions: ["Isolar animal"] } } : {}),
    }));
    setupMockLiveQuery({ animal: makeAnimal({ id: "animal-1", identificacao: "V2-B", sexo: "M" }), eventos: events });
    renderDetail();
    await user.click(screen.getByRole("tab", { name: "Histórico" }));
    const panel = screen.getByRole("tabpanel");
    const articles = () => Array.from(panel.querySelectorAll("article"));
    expect(articles()).toHaveLength(domains.length);
    expect(articles().map((article) => within(article).getByText(/^Domínio:/).textContent)).toEqual(domains.map((domain) => `Domínio: ${domain.replaceAll("_", " ")}`));
    expect(screen.getByRole("button", { name: "Todos (13)" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Pesagem (1)" }));
    expect(articles()).toHaveLength(1);
    expect(within(panel).getByText("Fato pesagem")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Sanidade (3)" }));
    expect(articles()).toHaveLength(3);
    expect(articles().map((article) => within(article).getByText(/^Domínio:/).textContent)).toEqual(["Domínio: sanitario", "Domínio: alerta sanitario", "Domínio: conformidade"]);
    expect(within(panel).getByText("Rota: Rota teste")).toBeVisible();
    expect(within(panel).getByText("Passos: Isolar animal")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Comercial (1)" }));
    expect(articles()).toHaveLength(1);
    expect(within(panel).getByText(/Comprador teste/)).toBeVisible();
    expect(within(panel).getByText("Quantidade: 2 cab.")).toBeVisible();
    expect(within(panel).getByText('Obs: "Detalhe comercial preservado"')).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Reprodução (1)" }));
    expect(within(panel).getByText("Reprodutor: TOURO-01")).toBeVisible();
    expect(within(panel).getByText("Diagnostico: positivo")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Outros (5)" }));
    expect(articles()).toHaveLength(5);
    for (const domain of domains.slice(8)) expect(within(panel).getByText(`Fato ${domain}`)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Todos (13)" }));
    expect(articles()).toHaveLength(domains.length);
  });

  it("mostra vazio específico do filtro mesmo quando há outros eventos", async () => {
    const user = userEvent.setup();
    setupMockLiveQuery({ animal: makeAnimal({ id: "animal-1", identificacao: "V2-B", sexo: "M" }), eventos: [makeEvento()] });
    renderDetail();
    await user.click(screen.getByRole("tab", { name: "Histórico" }));
    await user.click(screen.getByRole("button", { name: "Pesagem (0)" }));
    expect(screen.getByText("Nenhum evento de pesagem registrado.")).toBeVisible();
    expect(screen.queryByText("Nenhum evento registrado.")).not.toBeInTheDocument();
  });

  it("separa atrasadas, hoje, próximas e encerradas e prioriza atraso no card", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 7, 0, 30));
    const user = userEvent.setup();
    const items = [
      makeAgendaItem({ id: "future-later", tipo: "futura_tardia", data_prevista: "2026-10-15" }),
      makeAgendaItem({ id: "done", tipo: "tarefa_concluida", data_prevista: "2026-10-01", status: "concluido" }),
      makeAgendaItem({ id: "future", tipo: "vermifugacao", data_prevista: "2026-10-12" }),
      makeAgendaItem({ id: "overdue-later", tipo: "atraso_recente", data_prevista: "2026-10-06" }),
      makeAgendaItem({ id: "today", tipo: "pesagem", data_prevista: "2026-10-07" }),
      makeAgendaItem({ id: "cancelled", tipo: "tarefa_cancelada", data_prevista: "2026-10-20", status: "cancelado" }),
      makeAgendaItem({ id: "overdue", tipo: "vacinacao", data_prevista: "2026-10-05" }),
    ];
    setupMockLiveQuery({ animal: makeAnimal({ id: "animal-1", identificacao: "V2-B", sexo: "M" }), agenda: items.map((item) => ({ item })) });
    renderDetail();
    expect(screen.getByText("2 tarefas atrasadas")).toBeVisible();
    expect(screen.getByText("vacinacao · 05/10/2026")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Agenda" }));
    const sections = ["Atrasadas", "Hoje", "Próximas", "Encerradas"].map((name) => screen.getByRole("region", { name }));
    const expected = [["vacinacao", "atraso recente"], ["pesagem"], ["vermifugacao", "futura tardia"], ["tarefa concluida", "tarefa cancelada"]];
    sections.forEach((section, index) => {
      for (const label of expected[index]) expect(within(section).getByText(label)).toBeVisible();
    });
    for (const label of expected.flat()) expect(within(screen.getByRole("tabpanel")).getAllByText(label)).toHaveLength(1);
    expect(sections[0].textContent?.indexOf("vacinacao")).toBeLessThan(sections[0].textContent?.indexOf("atraso recente") ?? 0);
    expect(sections[2].textContent?.indexOf("vermifugacao")).toBeLessThan(sections[2].textContent?.indexOf("futura tardia") ?? 0);
    expect(within(sections[1]).getByText("Previsto: 07/10/2026")).toBeVisible();
    expect(within(sections[3]).getByText("concluido")).toBeVisible();
    expect(within(sections[3]).getByText("cancelado")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Histórico" }));
    expect(screen.getByText("Nenhum evento registrado.")).toBeVisible();
  });

  it.each([
    { status: "agendado" as const, date: "2026-10-07", summary: "Hoje" },
    { status: "agendado" as const, date: "2026-10-12", summary: "Próxima: 12/10/2026" },
    { status: "concluido" as const, date: "2026-10-05", summary: "Sem tarefa pendente na Agenda" },
    { status: "cancelado" as const, date: "2026-10-12", summary: "Sem tarefa pendente na Agenda" },
  ])("card reflete $status em $date com data civil", ({ status, date, summary }) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 7, 23, 30));
    setupMockLiveQuery({ animal: makeAnimal({ id: "animal-1", identificacao: "V2-B", sexo: "M" }), agenda: [{ item: makeAgendaItem({ id: "task", tipo: "pesagem", status, data_prevista: date }) }] });
    renderDetail();
    expect(screen.getByText(summary)).toBeVisible();
  });

  it("distingue carregamento de listas carregadas vazias", async () => {
    const user = userEvent.setup();
    const responses: MockLiveQueryResponses = { animal: makeAnimal({ id: "animal-1", identificacao: "V2-B", sexo: "M" }), agenda: undefined, eventos: undefined };
    setupMockLiveQuery(responses);
    const view = renderDetail();
    expect(screen.getByText("Carregando Agenda…")).toBeVisible();
    expect(screen.queryByText("Sem tarefa pendente na Agenda")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Histórico" }));
    expect(screen.getByText("Carregando histórico…")).toBeVisible();
    expect(screen.queryByText("Nenhum evento registrado.")).not.toBeInTheDocument();
    responses.eventos = [];
    responses.agenda = [];
    view.rerender(<MemoryRouter initialEntries={["/animais/animal-1"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Routes><Route path="/animais/:id" element={<AnimalDetalhe />} /></Routes></MemoryRouter>);
    expect(screen.getByText("Nenhum evento registrado.")).toBeVisible();
    expect(screen.getByText("Sem tarefa pendente na Agenda")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Agenda" }));
    expect(screen.getByText("Nenhuma tarefa na Agenda.")).toBeVisible();
  });

  it("não confunde tarefa vencida com ausência de pendências e mantém a Agenda", async () => {
    const user = userEvent.setup();
    setupMockLiveQuery({
      animal: makeAnimal({ id: "animal-1", identificacao: "V2-002", sexo: "M", lote_id: null }),
      agenda: [{ item: makeAgendaItem({ id: "expired", tipo: "vacina_brucelose", data_prevista: "2020-01-01" }) }],
    });
    renderDetail();
    expect(screen.getByText("1 tarefa atrasada")).toBeVisible();
    expect(screen.queryByText("Sem pendências")).not.toBeInTheDocument();
    expect(screen.queryByText("Sem agenda")).not.toBeInTheDocument();
    expect(screen.getAllByText("Sem lote definido").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Último peso registrado" })).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Agenda" }));
    expect(screen.getByText(/Previsto:/)).toBeVisible();
    expect(screen.getByText("agendado")).toBeVisible();
  });

  it("mantém bloqueio e confirmação de estágio visíveis com detalhes técnicos fechados", () => {
    setupMockLiveQuery({
      animal: makeAnimal({
        id: "animal-1", identificacao: "V2-003", sexo: "F",
        payload: {
          lifecycle: { estagio_vida: "cria_neonatal" },
          sanidade_alerta: { status: "suspeita_aberta", movement_blocked: true },
        },
      }),
    });
    const { container } = renderDetail();
    expect(screen.getByText("Movimentacao bloqueada")).toBeVisible();
    expect(screen.getByRole("button", { name: "Registrar manejo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Confirmar transicao" })).toBeVisible();
    const disclosures = container.querySelectorAll("details");
    expect(disclosures).toHaveLength(2);
    disclosures.forEach((disclosure) => expect(disclosure).not.toHaveAttribute("open"));
    expect(screen.getByText("Regra usada")).not.toBeVisible();
    expect(screen.getByText("Aliases:", { exact: false })).not.toBeVisible();
  });

  it("exibe sociedade exclusivamente pelo contrato vigente após reconstrução", () => {
    setupMockLiveQuery({
      animal: makeAnimal({
        id: "animal-1",
        identificacao: "SOC-001",
        sexo: "F",
        origem: "sociedade",
      }),
      sociedadeAtiva: {
        id: "link-1",
        fazenda_id: "farm-1",
        sociedade_id: "sociedade-1",
        animal_id: "animal-1",
        data_entrada: "2026-08-20",
        status: "ativo",
        deleted_at: null,
        contraparte_id: "contraparte-1",
        nome: "Parceria vigente",
        percentual_fazenda: 60,
        percentual_parceiro: 40,
      },
      contraparte: {
        id: "contraparte-1",
        fazenda_id: "farm-1",
        nome: "Sócio atual",
      },
    });

    render(
      <MemoryRouter initialEntries={["/animais/animal-1"]}>
        <Routes>
          <Route path="/animais/:id" element={<AnimalDetalhe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Detalhes da sociedade")).toBeInTheDocument();
    expect(screen.getAllByText(/Sócio atual/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/60%/).length).toBeGreaterThan(0);

    const querySources = mockedUseLiveQuery.mock.calls.map(([query]) =>
      typeof query === "function" ? query.toString() : "",
    );
    expect(querySources.some((source) => source.includes("state_sociedade_animais"))).toBe(true);
    expect(querySources.some((source) => source.includes("state_sociedades_pecuarias"))).toBe(true);
    expect(querySources.some((source) => source.includes("state_animais_sociedade"))).toBe(false);
  });

  it("nao renderiza animal de outra fazenda", () => {
    setupMockLiveQuery({ animal: undefined });

    render(
      <MemoryRouter initialEntries={["/animais/animal-farm-b"]}>
        <Routes>
          <Route path="/animais/:id" element={<AnimalDetalhe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: /animal não encontrado/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /mover de lote/i }),
    ).not.toBeInTheDocument();
  });

  it("renderiza aba de agenda sem quebrar o fluxo da página", () => {
    const animal = makeAnimal({
      id: "animal-1",
      identificacao: "BR-001",
      sexo: "F",
    });

    setupMockLiveQuery({
      animal,
      agenda: [
        {
          item: makeAgendaItem({
            id: "agenda-1",
            tipo: "vacina_brucelose",
            data_prevista: "2026-04-15",
          }),
          scheduleLabel: "Aplicar entre 3 e 8 meses",
          scheduleModeLabel: "Janela etaria",
          scheduleAnchorLabel: "Nascimento",
        },
      ],
    });

    render(
      <MemoryRouter
        initialEntries={["/animais/animal-1"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/animais/:id" element={<AnimalDetalhe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Agenda", { selector: "h3" })).toBeInTheDocument();

    expect(screen.getByRole("tab", { name: /agenda/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Registrar manejo/i }),
    ).toHaveAttribute("href", "/registrar?animalId=animal-1&loteId=lote-1");
  });

  it("lista casos sanitarios persistidos do animal", () => {
    const clinicalCase = makeSanitarioCaso();
    const sanitaryEvent = makeEvento();
    const onCloseClinicalCase = vi.fn();

    render(
      <MemoryRouter
        initialEntries={["/animais/animal-1/casos"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AnimalSanitaryCasesPanel
          animalId="animal-1"
          cases={[clinicalCase]}
          eventsByCase={new Map([["caso-1", [sanitaryEvent]]])}
          onCloseClinicalCase={onCloseClinicalCase}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Manejo clinico")).toBeInTheDocument();
    expect(screen.getByText("em acompanhamento")).toBeInTheDocument();
    expect(screen.getByText("Tratamento em acompanhamento")).toBeInTheDocument();
    expect(screen.getByText("Timeline do caso")).toBeInTheDocument();
    expect(screen.getByText("medicamento")).toBeInTheDocument();
    expect(
      screen.getByText("Suspeita TPB: aplicado anti-inflamatorio e reavaliar em 48h"),
    ).toBeInTheDocument();
    expect(screen.getByText("Apoio clinico")).toBeInTheDocument();
    expect(screen.getByText("Contexto")).toBeInTheDocument();
    expect(
      screen.getByText("Terapia de Tristeza Parasitaria Bovina (TPB)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Diminazeno (Ganaseg/Outros)")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Apoio clinico informativo; nao gera agenda, evento ou baixa de estoque\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Registrar conduta/i })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("produto=Diminazeno"),
    );
    expect(screen.getAllByRole("link", { name: /Registrar conduta/i })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("clinicalProtocolId=med-tpb"),
    );
    expect(screen.getAllByRole("link", { name: /Registrar conduta/i })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("clinicalProtocolItemId=tpb-diminazeno"),
    );
    expect(screen.getByRole("link", { name: /Registrar manejo/i })).toHaveAttribute(
      "href",
      "/registrar?dominio=sanitario&animalId=animal-1&sanitarioTipo=medicamento&sanitarioCasoId=caso-1",
    );
    fireEvent.click(screen.getByRole("button", { name: /Encerrar caso/i }));
    expect(onCloseClinicalCase).toHaveBeenCalledWith(clinicalCase);
  });

  it("mostra roteiro clinico selecionado explicitamente no payload do caso", () => {
    render(
      <MemoryRouter
        initialEntries={["/animais/animal-1/casos"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AnimalSanitaryCasesPanel
          animalId="animal-1"
          cases={[
            makeSanitarioCaso({
              payload: { clinical_protocol_id: "med-mastite-seca" },
              observacoes: "Secagem planejada com risco de mastite.",
            }),
          ]}
          eventsByCase={new Map()}
          onCloseClinicalCase={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Selecionado")).toBeInTheDocument();
    expect(screen.getByText("Terapia de Vaca Seca (Mastite)")).toBeInTheDocument();
    expect(
      screen.getByText("Antibiotico Intramamario (Vaca Seca)"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Registrar conduta/i })).toHaveAttribute(
      "href",
      expect.stringContaining("produto=Antibiotico+Intramamario"),
    );
    expect(screen.getByRole("link", { name: /Registrar conduta/i })).toHaveAttribute(
      "href",
      expect.stringContaining("clinicalProtocolId=med-mastite-seca"),
    );
    expect(
      screen.queryByText("Terapia de Tristeza Parasitaria Bovina (TPB)"),
    ).not.toBeInTheDocument();
  });

  it("mostra referencia de roteiro clinico no evento da timeline do caso", () => {
    render(
      <MemoryRouter
        initialEntries={["/animais/animal-1/casos"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AnimalSanitaryCasesPanel
          animalId="animal-1"
          cases={[
            makeSanitarioCaso({
              observacoes: "Caso clinico em acompanhamento.",
            }),
          ]}
          eventsByCase={
            new Map([
              [
                "caso-1",
                [
                  makeEvento({
                    observacoes: "Conduta registrada pelo roteiro selecionado.",
                    payload: buildClinicalProtocolEventPayload({
                      protocolId: "med-tpb",
                      itemId: "tpb-diminazeno",
                    }),
                  }),
                ],
              ],
            ])
          }
          onCloseClinicalCase={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Roteiro clinico").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "Roteiro: Terapia de Tristeza Parasitaria Bovina (TPB) | Conduta: Diminazeno (Ganaseg/Outros)",
      ),
    ).toBeInTheDocument();
  });

  it("filtra casos sanitarios por roteiro clinico derivado", () => {
    render(
      <MemoryRouter
        initialEntries={["/animais/animal-1/casos"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AnimalSanitaryCasesPanel
          animalId="animal-1"
          cases={[
            makeSanitarioCaso({
              id: "caso-tpb",
              observacoes: "Caso com conduta TPB.",
            }),
            makeSanitarioCaso({
              id: "caso-mastite",
              observacoes: "Caso com conduta de mastite.",
              payload: { clinical_protocol_id: "med-mastite-seca" },
            }),
          ]}
          eventsByCase={
            new Map([
              [
                "caso-tpb",
                [
                  makeEvento({
                    sanitario_caso_id: "caso-tpb",
                    observacoes: "Conduta TPB registrada.",
                    payload: buildClinicalProtocolEventPayload({
                      protocolId: "med-tpb",
                      itemId: "tpb-diminazeno",
                    }),
                  }),
                ],
              ],
              [
                "caso-mastite",
                [
                  makeEvento({
                    id: "evento-mastite",
                    sanitario_caso_id: "caso-mastite",
                    observacoes: "Conduta mastite registrada.",
                    payload: buildClinicalProtocolEventPayload({
                      protocolId: "med-mastite-seca",
                      itemId: "secagem-intramamario",
                    }),
                  }),
                ],
              ],
            ])
          }
          onCloseClinicalCase={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("2 de 2 casos")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Terapia de Vaca Seca \(Mastite\) \(1\)/i,
      }),
    );

    expect(screen.getByText("1 de 2 casos")).toBeInTheDocument();
    expect(screen.getByText("Caso com conduta de mastite.")).toBeInTheDocument();
    expect(screen.queryByText("Caso com conduta TPB.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Todos$/i }));

    expect(screen.getByText("2 de 2 casos")).toBeInTheDocument();
    expect(screen.getByText("Caso com conduta TPB.")).toBeInTheDocument();
  });

  it("valida encerramento de caso clinico antes de atualizar estado", () => {
    const openClinicalCase = makeSanitarioCaso();

    expect(
      validateClinicalCaseClosureInput({
        caseRecord: openClinicalCase,
        reason: "resolvido",
        notes: "",
      }),
    ).toBeNull();

    expect(
      validateClinicalCaseClosureInput({
        caseRecord: openClinicalCase,
        reason: "sem_resposta",
        notes: "curto",
      }),
    ).toBe("Informe observacoes de encerramento com pelo menos 10 caracteres.");

    expect(
      validateClinicalCaseClosureInput({
        caseRecord: makeSanitarioCaso({ status: "encerrado" }),
        reason: "resolvido",
        notes: "",
      }),
    ).toBe("Este caso clinico ja esta encerrado ou indisponivel.");

    expect(
      validateClinicalCaseClosureInput({
        caseRecord: makeSanitarioCaso({ tipo: "notificavel" }),
        reason: "resolvido",
        notes: "",
      }),
    ).toBe("Apenas casos clinicos podem ser encerrados por este fluxo.");
  });

  it("exibe estado vazio de ECC quando nao ha registros factuais", () => {
    const animal = makeAnimal({
      id: "animal-1",
      identificacao: "BR-001",
      sexo: "F",
    });

    setupMockLiveQuery({
      animal,
    });

    render(
      <MemoryRouter
        initialEntries={["/animais/animal-1"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/animais/:id" element={<AnimalDetalhe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Sem ECC factual registrado")).toBeInTheDocument();
  });

  it("renderiza Sanidade como resumo compacto e deixa pre-checagem completa fechada", async () => {
    const user = userEvent.setup();
    const animal = makeAnimal({
      id: "animal-1",
      identificacao: "BR-001",
      sexo: "F",
      especie: "bovino",
    } as Partial<Animal> & Pick<Animal, "id" | "identificacao" | "sexo">);

    setupMockLiveQuery({
      animal,
      sanitaryCatalog: {
        protocols: [],
        items: [],
        productClassGroups: [],
      },
      sanitaryHistory: [],
    });

    render(
      <MemoryRouter
        initialEntries={["/animais/animal-1"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/animais/:id" element={<AnimalDetalhe />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: /sanidade/i }));

    expect(screen.getByText("Conformidade sanitária")).toBeInTheDocument();
    expect(screen.getByText("Pendências principais")).toBeInTheDocument();
    expect(screen.getByText("Histórico de entrada")).toBeInTheDocument();
    expect(screen.getAllByText("Agenda futura").length).toBeGreaterThan(0);
    expect(screen.queryByText("Preview manual sanitário")).not.toBeInTheDocument();
    expect(screen.queryByText("Candidatas")).not.toBeInTheDocument();
    expect(screen.queryByText("Bloqueadas")).not.toBeInTheDocument();
    expect(screen.queryByText("Não aplicáveis")).not.toBeInTheDocument();
    expect(screen.queryByText("Pré-checagem sanitária")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Planejar agenda/i }))
      .not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: /Ver detalhes técnicos da pré-checagem/i,
      }),
    );

    expect(screen.getByText("Pré-checagem sanitária")).toBeInTheDocument();
    expect(
      screen.getByText("Catálogo sanitário local ainda não sincronizado"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /criar agenda/i }))
      .not.toBeInTheDocument();
  });

  it("exibe pendência documental B19 no resumo da aba Sanidade", async () => {
    const user = userEvent.setup();
    const animal = makeAnimal({
      id: "animal-1",
      identificacao: "BR-001",
      sexo: "F",
      especie: "bovino",
      data_nascimento: "2024-01-01",
    } as Partial<Animal> & Pick<Animal, "id" | "identificacao" | "sexo">);

    setupMockLiveQuery({
      animal,
      sanitaryCatalog: {
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
      sanitaryHistory: [],
    });

    render(
      <MemoryRouter
        initialEntries={["/animais/animal-1"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/animais/:id" element={<AnimalDetalhe />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: /sanidade/i }));

    expect(screen.getByText("Fêmea adulta exige comprovação documental de B19.")).toBeInTheDocument();
    expect(screen.getAllByText("Pendência documental").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Abrir conformidade na Central/i }))
      .toHaveAttribute(
        "href",
        "/protocolos-sanitarios?tab=conformidade&animalId=animal-1&loteId=lote-1",
      );
  });

  it("exibe acao de registrar historico anterior sem usar marcar como vacinado", async () => {
    const user = userEvent.setup();
    const warningSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const animal = makeAnimal({
      id: "animal-1",
      identificacao: "BR-001",
      sexo: "F",
      especie: "bovino",
    } as Partial<Animal> & Pick<Animal, "id" | "identificacao" | "sexo">);

    setupMockLiveQuery({
      animal,
      sanitaryCatalog: {
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
      sanitaryHistory: [],
    });

    render(
      <MemoryRouter
        initialEntries={["/animais/animal-1"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/animais/:id" element={<AnimalDetalhe />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("tab", { name: /sanidade/i }));
    await user.click(
      screen.getByRole("button", { name: /Registrar histórico anterior/i }),
    );

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Histórico anterior não registra execução da fazenda",
    );
    expect(
      screen.getByLabelText("Referência do documento"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Sem referência vinculada, o histórico não comprova regra crítica.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Marcar como vacinado/i)).not.toBeInTheDocument();
    expect(
      warningSpy.mock.calls.some((call) =>
        call.some((message) =>
          String(message).includes("Missing `Description` or `aria-describedby={undefined}`"),
        ),
      ),
    ).toBe(false);
    warningSpy.mockRestore();
  });

  it("diferencia estado atual de autorizacao comercial", async () => {
    const user = userEvent.setup();
    const animal = makeAnimal({
      id: "animal-1",
      identificacao: "BR-001",
      sexo: "M",
    });

    setupMockLiveQuery({
      animal,
    });

    render(
      <MemoryRouter
        initialEntries={["/animais/animal-1"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/animais/:id" element={<AnimalDetalhe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Estado atual: ativo")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Estado, status e classificacao sao leitura operacional; nao autorizam venda ou abate/i,
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /mais acoes/i }));
    expect(
      await screen.findByRole("menuitem", { name: /registrar venda manual/i }),
    ).toBeInTheDocument();
  });

  it("exibe ultimo ECC e preserva o historico recolhido em ordem decrescente", async () => {
    const user = userEvent.setup();
    const animal = makeAnimal({
      id: "animal-1",
      identificacao: "BR-001",
      sexo: "F",
    });

    const mockUltimoEcc = {
      event_id: "evt-ecc-2",
      occurred_at: "2026-05-25T10:00:00.000Z",
      deleted_at: null,
      ecc: 4.25,
      escala_min: 1.0,
      escala_max: 5.0,
      escala_passo: 0.25,
      observacoes: "Gorda",
    };

    const mockHistoricoEcc = [
      {
        id: "evt-ecc-2",
        data: "2026-05-25",
        dataLabel: "25/05/2026",
        occurred_at: "2026-05-25T10:00:00.000Z",
        ecc: 4.25,
        escalaMin: 1.0,
        escalaMax: 5.0,
        escalaPasso: 0.25,
        observacoes: "Gorda",
      },
      {
        id: "evt-ecc-1",
        data: "2026-05-10",
        dataLabel: "10/05/2026",
        occurred_at: "2026-05-10T14:30:00.000Z",
        ecc: 3.5,
        escalaMin: 1.0,
        escalaMax: 5.0,
        escalaPasso: 0.25,
        observacoes: "Escore bom",
      },
    ];

    setupMockLiveQuery({
      animal,
      ultimoEcc: mockUltimoEcc,
      historicoEcc: mockHistoricoEcc,
    });

    render(
      <MemoryRouter
        initialEntries={["/animais/animal-1"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/animais/:id" element={<AnimalDetalhe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("4.25").length).toBeGreaterThan(0);
    expect(screen.getByText("Último ECC factual")).toBeInTheDocument();
    expect(screen.getAllByText("25/05/2026").length).toBeGreaterThan(0);
    const disclosure = screen.getByText("Histórico de avaliações (2)").closest("details");
    expect(disclosure).not.toHaveAttribute("open");
    expect(screen.getByText("Observações: Gorda")).toBeVisible();
    await user.click(screen.getByText("Histórico de avaliações (2)"));
    expect(disclosure).toHaveAttribute("open");
    expect(screen.getByText("10/05/2026")).toBeVisible();
    expect(screen.getByText("Escore bom")).toBeVisible();
    expect(disclosure?.textContent?.indexOf("25/05/2026")).toBeLessThan(disclosure?.textContent?.indexOf("10/05/2026") ?? 0);
  });

  it.each([
    { weights: [300, 312], variation: "+12,0 kg · ganho", gmd: "12,0 kg/dia" },
    { weights: [312, 300], variation: "−12,0 kg · perda", gmd: "-12,0 kg/dia" },
    { weights: [300, 300], variation: "0,0 kg · sem variação", gmd: "0,0 kg/dia" },
  ])("apresenta variação $variation e GMD factual qualificado", ({ weights, variation, gmd }) => {
    vi.mocked(useAnimalWeightPresentation).mockReturnValue(makeWeightPresentation(weights));
    setupMockLiveQuery({ animal: makeAnimal({ id: "animal-1", identificacao: "PESO-01", sexo: "M" }) });
    renderDetail();
    const section = within(screen.getByLabelText("Peso e GMD"));
    expect(section.getByText(`${weights[1].toFixed(1).replace(".", ",")} kg`)).toBeVisible();
    expect(section.getByText(variation)).toBeVisible();
    expect(section.getByText(gmd)).toBeVisible();
    expect(section.getByText("01/01/2026 a 02/01/2026")).toBeVisible();
    expect(section.getByText("Intervalo: 1 dia")).toBeVisible();
    expect(section.getByText(/Confiabilidade não classificada/)).toBeVisible();
    expect(section.getByText(/Uso operacional não autorizado/)).toBeVisible();
  });

  it.each([
    { durationMs: 60_000, interval: "1 minuto" },
    { durationMs: 30_000, interval: "30 segundos" },
    { durationMs: 500, interval: "menos de 1 segundo" },
    { durationMs: 1, interval: "menos de 1 segundo" },
    { durationMs: 90_000, interval: "1,5 minutos" },
    { durationMs: 61_100, interval: "aproximadamente 1,02 minutos" },
    { durationMs: 3_600_000, interval: "1 hora" },
    { durationMs: 86_400_000, interval: "1 dia" },
  ])("formata intervalo positivo de $durationMs ms sem zerar ou alterar o GMD", ({ durationMs, interval }) => {
    const initial = "2026-01-01T12:00:00.000Z";
    const final = new Date(Date.parse(initial) + durationMs).toISOString();
    const presentation = makeWeightPresentation([300, 301], false, [initial, final]);
    expect(presentation.gmd.status).toBe("CALCULATED");
    if (presentation.gmd.status !== "CALCULATED") throw new Error("GMD não calculado no cenário factual");
    const upstreamGmd = presentation.gmd.gmdKgPerDay;
    if (durationMs === 60_000) expect(upstreamGmd).toBe(1440);
    vi.mocked(useAnimalWeightPresentation).mockReturnValue(presentation);
    setupMockLiveQuery({ animal: makeAnimal({ id: "animal-1", identificacao: "PESO-01", sexo: "M" }) });
    renderDetail();
    const section = within(screen.getByLabelText("Peso e GMD"));
    expect(section.getByText(`Intervalo: ${interval}`)).toBeVisible();
    expect(section.queryByText("Intervalo: 0 dias")).not.toBeInTheDocument();
    expect(section.getByText(formatWeightPerDay(upstreamGmd, "kg"))).toBeVisible();
    expect(section.getByText("+1,0 kg · ganho")).toBeVisible();
    expect(presentation.gmd.gmdKgPerDay).toBe(upstreamGmd);
    expect(section.getByText(/Uso operacional não autorizado/)).toBeVisible();
  });

  it.each([
    { weights: [], conflict: false, message: "Sem pesagem factual disponível.", source: "Observações elegíveis: 0 de 2." },
    { weights: [300], conflict: false, message: "São necessárias duas observações factuais elegíveis.", source: "Observações elegíveis: 1 de 2." },
    { weights: [300, 310], conflict: true, message: "Peso indisponível: conflito factual.", source: "Há conflito entre registros de pesagem." },
  ])("distingue ausência, insuficiência e conflito: $message", ({ weights, conflict, message, source }) => {
    vi.mocked(useAnimalWeightPresentation).mockReturnValue(makeWeightPresentation(weights, conflict));
    setupMockLiveQuery({ animal: makeAnimal({ id: "animal-1", identificacao: "PESO-01", sexo: "M" }) });
    renderDetail();
    const section = within(screen.getByLabelText("Peso e GMD"));
    expect(section.getByText(message)).toBeVisible();
    expect(section.getByText(source)).toBeVisible();
    expect(section.getByText("GMD indisponível")).toBeVisible();
    expect(section.queryByText(/^Intervalo:/)).not.toBeInTheDocument();
    expect(section.queryByText("0,0 kg/dia")).not.toBeInTheDocument();
    expect(section.queryByText("0,0 kg")).not.toBeInTheDocument();
    if (conflict) expect(section.getByText(/Histórico indisponível: conflito/)).toBeVisible();
  });

  it("usa a unidade da fazenda e navega para registrar pesagem com animal e lote", async () => {
    const user = userEvent.setup();
    vi.mocked(useAnimalWeightPresentation).mockReturnValue(makeWeightPresentation([300, 315]));
    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1", role: "owner", farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
      farmMeasurementConfig: { ...DEFAULT_FARM_MEASUREMENT_CONFIG, weight_unit: "arroba" },
    } as ReturnType<typeof useAuth>);
    setupMockLiveQuery({ animal: makeAnimal({ id: "animal-1", identificacao: "PESO-01", sexo: "M" }) });
    renderDetail();
    const section = within(screen.getByLabelText("Peso e GMD"));
    expect(section.getByText("21,00 arroba")).toBeVisible();
    expect(section.getByText("+1,00 arroba · ganho")).toBeVisible();
    expect(section.getByText("1,00 arroba/dia")).toBeVisible();
    await user.click(section.getByRole("button", { name: "Registrar pesagem" }));
    expect(screen.getByText("Registro: ?dominio=pesagem&animalId=animal-1&loteId=lote-1")).toBeVisible();
  });

  it("preserva escala ECC personalizada e observação longa; foca e expande histórico e registra ECC", async () => {
    const user = userEvent.setup();
    const notes = "Avaliação registrada com escala específica. ".repeat(12);
    setupMockLiveQuery({
      animal: makeAnimal({ id: "animal-1", identificacao: "ECC-01", sexo: "M" }),
      ultimoEcc: { ecc: 6.25, occurred_at: "2026-05-25T12:00:00.000Z", escala_min: 1.5, escala_max: 9.5, escala_passo: 0.25, observacoes: notes },
      historicoEcc: [
        { id: "ecc-2", ecc: 6.25, dataLabel: "25/05/2026", escalaMin: 1.5, escalaMax: 9.5, escalaPasso: 0.25, observacoes: notes },
        { id: "ecc-1", ecc: 3.5, dataLabel: "10/05/2026", escalaMin: 1, escalaMax: 5, escalaPasso: 0.5, observacoes: "Escala anterior preservada" },
      ],
    });
    renderDetail();
    const section = within(screen.getByLabelText("Escore de Condição Corporal"));
    expect(section.getAllByText("Escala: 1.5 a 9.5 (passo 0.25)").length).toBe(2);
    const observation = section.getByText(`Observações: ${notes.trim()}`);
    expect(observation).toBeVisible();
    expect(observation).not.toHaveClass("truncate");
    const summary = section.getByText("Histórico de avaliações (2)");
    summary.focus();
    expect(summary).toHaveFocus();
    await user.click(summary);
    expect(summary.closest("details")).toHaveAttribute("open");
    expect(section.getByText("Escala anterior preservada")).toBeVisible();
    expect(section.getByText("Escala: 1 a 5 (passo 0.5)")).toBeVisible();
    await user.click(section.getByRole("button", { name: "Registrar ECC" }));
    expect(screen.getByText("Registro: ?dominio=ecc&animalId=animal-1")).toBeVisible();
  });
});
