/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import { useAuth } from "@/hooks/useAuth";
import { writeAgendaUiState, readAgendaUiState } from "@/lib/agenda/storage";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { pullDataForFarm } from "@/lib/offline/pull";
import type {
  AgendaItem,
  Animal,
  CatalogoProtocoloOficial,
  CatalogoProtocoloOficialItem,
  FazendaSanidadeConfig,
  Lote,
} from "@/lib/offline/types";
import Agenda from "@/pages/Agenda";

vi.mock("@/hooks/useAuth");
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));
vi.mock("@/lib/offline/pull", () => ({
  pullDataForFarm: vi.fn().mockResolvedValue(undefined),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

Element.prototype.scrollIntoView = vi.fn();
Element.prototype.hasPointerCapture = vi.fn(() => false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

const FARM_ID = "farm-1";
const USER_ID = "user-1";

function createAnimal(overrides: Partial<Animal> = {}): Animal {
  return {
    id: "animal-1",
    fazenda_id: FARM_ID,
    identificacao: "Matriz 001",
    sexo: "F",
    status: "ativo",
    lote_id: "lote-1",
    data_nascimento: "2020-01-01",
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
    client_op_id: "animal-op-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-09T09:00:00.000Z",
    server_received_at: "2026-04-09T09:00:00.000Z",
    created_at: "2026-04-09T09:00:00.000Z",
    updated_at: "2026-04-09T09:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function createLote(overrides: Partial<Lote> = {}): Lote {
  return {
    id: "lote-1",
    fazenda_id: FARM_ID,
    nome: "Lote Sanitário",
    status: "ativo",
    pasto_id: null,
    touro_id: null,
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "lote-op-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-09T09:00:00.000Z",
    server_received_at: "2026-04-09T09:00:00.000Z",
    created_at: "2026-04-09T09:00:00.000Z",
    updated_at: "2026-04-09T09:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function createAgendaItem(overrides: Partial<AgendaItem> = {}): AgendaItem {
  return {
    id: "agenda-1",
    fazenda_id: FARM_ID,
    dominio: "sanitario",
    tipo: "vacinacao",
    status: "agendado",
    data_prevista: "2020-01-01",
    animal_id: "animal-1",
    lote_id: "lote-1",
    dedup_key: null,
    source_kind: "manual",
    source_ref: {
      produto: "Vacina Brucelose",
      indicacao: "Dose estrategica",
    },
    source_client_op_id: null,
    source_tx_id: null,
    source_evento_id: null,
    protocol_item_version_id: null,
    interval_days_applied: 0,
    payload: {
      produto: "Vacina Brucelose",
      calendario_base: {
        version: 1,
        mode: "janela_etaria",
        anchor: "nascimento",
        label: "Janela etaria oficial",
        age_start_days: 90,
        age_end_days: 240,
      },
    },
    client_id: "client-1",
    client_op_id: "agenda-op-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-09T09:00:00.000Z",
    server_received_at: "2026-04-09T09:00:00.000Z",
    created_at: "2026-04-09T09:00:00.000Z",
    updated_at: "2026-04-09T09:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function createSanidadeConfig(
  overrides: Partial<FazendaSanidadeConfig> = {},
): FazendaSanidadeConfig {
  return {
    fazenda_id: FARM_ID,
    uf: "SP",
    aptidao: "all",
    sistema: "all",
    zona_raiva_risco: "baixo",
    pressao_carrapato: "baixo",
    pressao_helmintos: "baixo",
    modo_calendario: "completo",
    payload: {
      activated_template_slugs: ["feed-ban-ruminantes"],
    },
    client_id: "client-1",
    client_op_id: "sanidade-op-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-10T09:00:00.000Z",
    server_received_at: "2026-04-10T09:00:00.000Z",
    created_at: "2026-04-10T09:00:00.000Z",
    updated_at: "2026-04-10T09:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

function createOfficialTemplate(
  overrides: Partial<CatalogoProtocoloOficial> = {},
): CatalogoProtocoloOficial {
  return {
    id: "template-1",
    slug: "feed-ban-ruminantes",
    nome: "Conformidade alimentar de ruminantes",
    versao: 1,
    escopo: "federal",
    uf: null,
    aptidao: "all",
    sistema: "all",
    status_legal: "obrigatorio",
    base_legal_json: {},
    payload: {
      execution_mode: "checklist",
      animal_centric: false,
    },
    created_at: "2026-04-10T09:00:00.000Z",
    updated_at: "2026-04-10T09:00:00.000Z",
    ...overrides,
  };
}

function createOfficialTemplateItem(
  overrides: Partial<CatalogoProtocoloOficialItem> = {},
): CatalogoProtocoloOficialItem {
  return {
    id: "template-item-1",
    template_id: "template-1",
    area: "nutricao",
    codigo: "feed-ban",
    categoria_animal: "all",
    gatilho_tipo: "uso_produto",
    gatilho_json: {},
    frequencia_json: {},
    requires_vet: false,
    requires_gta: false,
    carencia_regra_json: {},
    gera_agenda: false,
    payload: {
      label: "Feed-ban de ruminantes",
      subarea: "feed_ban",
    },
    created_at: "2026-04-10T09:00:00.000Z",
    updated_at: "2026-04-10T09:00:00.000Z",
    ...overrides,
  };
}

async function renderAgenda(initialEntries: string[] = ["/agenda"]) {
  const mockedPullDataForFarm = vi.mocked(pullDataForFarm);
  const rendered = render(
    <MemoryRouter
      initialEntries={initialEntries}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Agenda />
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(mockedPullDataForFarm).toHaveBeenCalled();
  });

  await waitFor(() => {
    expect(
      screen.queryByText(/Atualizando agenda local/i),
    ).not.toBeInTheDocument();
  });

  return rendered;
}

describe("Agenda page", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);
  const mockedPullDataForFarm = vi.mocked(pullDataForFarm);

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockedUseAuth.mockReturnValue({
      activeFarmId: FARM_ID,
      user: { id: USER_ID },
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    } as ReturnType<typeof useAuth>);

    mockedUseLiveQuery.mockReturnValue({
      itens: [
        createAgendaItem(),
        createAgendaItem({
          id: "agenda-2",
          tipo: "vermifugacao",
          data_prevista: "2099-01-01",
          source_ref: {
            produto: "Vermifugo Rotacao",
            indicacao: "Reforco futuro",
          },
          payload: {
            produto: "Vermifugo Rotacao",
          },
          client_op_id: "agenda-op-2",
        }),
      ],
      animais: [createAnimal()],
      lotes: [createLote()],
      protocolos: [],
      protocoloItens: [],
      gestos: [],
      sanidadeConfig: null,
      officialTemplates: [],
      officialTemplateItems: [],
    } as ReturnType<typeof useLiveQuery>);
  });

  it("rehydrates persisted quick filters and expanded groups", async () => {
    writeAgendaUiState(USER_ID, FARM_ID, {
      search: "",
      statusFilter: "all",
      dominioFilter: "all",
      dateFrom: "",
      dateTo: "",
      groupMode: "animal",
      quickTypeFilter: "all",
      quickScheduleFilter: "overdue",
      quickCalendarModeFilter: "all",
      quickCalendarAnchorFilter: "all",
      quickAnimalFilter: "all",
      expandedGroups: ["animal:animal-1"],
      revealedGroups: [],
      contextualFocus: null,
    });

    await renderAgenda();

    await waitFor(() => {
      expect(screen.getByText("Prazo: Atrasado")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /ocultar itens/i })).toBeInTheDocument();
    expect(screen.getByText("1 de 2 item(ns) visiveis")).toBeInTheDocument();
    expect(screen.getByText("Vacina Brucelose")).toBeInTheDocument();
    expect(screen.getByText("Janela etaria oficial")).toBeInTheDocument();
    expect(screen.getByText("Janela etaria")).toBeInTheDocument();
    expect(screen.queryByText("Vermifugo Rotacao")).not.toBeInTheDocument();
  });

  it("ignores non-persisted calendar mode values from storage and keeps default recorte", async () => {
    writeAgendaUiState(USER_ID, FARM_ID, {
      search: "",
      statusFilter: "all",
      dominioFilter: "all",
      dateFrom: "",
      dateTo: "",
      groupMode: "animal",
      quickTypeFilter: "all",
      quickScheduleFilter: "all",
      quickCalendarModeFilter: "janela_etaria",
      quickCalendarAnchorFilter: "all",
      quickAnimalFilter: "all",
      expandedGroups: ["animal:animal-1"],
      revealedGroups: [],
      contextualFocus: null,
    });

    await renderAgenda();

    await waitFor(() => {
      expect(screen.getAllByText("2 item(ns) no recorte").length).toBeGreaterThan(0);
    });

    expect(screen.queryByText("Filtros ativos")).not.toBeInTheDocument();
    expect(screen.queryByText("Calendario: Janela etaria")).not.toBeInTheDocument();
  });

  it("accepts calendarMode from query params and overrides the current recorte", async () => {
    const user = userEvent.setup();
    await renderAgenda(["/agenda?calendarMode=janela_etaria"]);

    await waitFor(() => {
      expect(screen.getByText("Calendario: Janela etaria")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /ver itens/i }));

    expect(screen.getByText("Vacina Brucelose")).toBeInTheDocument();
    expect(screen.queryByText("Vermifugo Rotacao")).not.toBeInTheDocument();
  });

  it("accepts calendarAnchor from query params and narrows the recorte", async () => {
    const user = userEvent.setup();
    await renderAgenda(["/agenda?calendarAnchor=nascimento"]);

    await waitFor(() => {
      expect(screen.getByText("Ancora: Nascimento")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /ver itens/i }));

    expect(screen.getByText("Vacina Brucelose")).toBeInTheDocument();
    expect(screen.queryByText("Vermifugo Rotacao")).not.toBeInTheDocument();
  });

  it("uses summary badges to focus the group and can reveal the full context", async () => {
    const user = userEvent.setup();
    await renderAgenda();

    expect(screen.getByRole("button", { name: /ver itens/i })).toBeInTheDocument();
    expect(screen.queryByText("Vacina Brucelose")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Atrasado 1" }));

    await waitFor(() => {
      expect(screen.getByText("Prazo: Atrasado")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /ocultar itens/i })).toBeInTheDocument();
    expect(screen.getByText("1 de 2 item(ns) visiveis")).toBeInTheDocument();
    expect(screen.getByText("Vacina Brucelose")).toBeInTheDocument();
    expect(screen.getByText("Janela etaria oficial")).toBeInTheDocument();
    expect(screen.queryByText("Vermifugo Rotacao")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ver grupo completo/i }));

    expect(screen.getByText("Vermifugo Rotacao")).toBeInTheDocument();

    expect(readAgendaUiState(USER_ID, FARM_ID)).toMatchObject({
      quickScheduleFilter: "overdue",
      expandedGroups: ["animal:animal-1"],
      revealedGroups: ["animal:animal-1"],
    });
    expect(mockedPullDataForFarm).toHaveBeenCalledWith(
      FARM_ID,
      [
        "agenda_itens",
        "animais",
        "lotes",
        "protocolos_sanitarios",
        "protocolos_sanitarios_itens",
        "fazenda_sanidade_config",
      ],
      { mode: "merge" },
    );
  });

  it("jumps between overdue groups through the critical shortcut bar", async () => {
    mockedUseLiveQuery.mockReturnValue({
      itens: [
        createAgendaItem(),
        createAgendaItem({
          id: "agenda-2",
          animal_id: "animal-2",
          lote_id: "lote-2",
          data_prevista: "2020-02-01",
          source_ref: {
            produto: "Vacina Reforco",
            indicacao: "Grupo 2",
          },
          payload: {
            produto: "Vacina Reforco",
          },
          client_op_id: "agenda-op-2",
        }),
      ],
      animais: [
        createAnimal(),
        createAnimal({
          id: "animal-2",
          identificacao: "Matriz 002",
          lote_id: "lote-2",
          client_op_id: "animal-op-2",
        }),
      ],
      lotes: [
        createLote(),
        createLote({
          id: "lote-2",
          nome: "Lote Reforco",
          client_op_id: "lote-op-2",
        }),
      ],
      protocolos: [],
      protocoloItens: [],
      gestos: [],
    } as ReturnType<typeof useLiveQuery>);

    const user = userEvent.setup();
    await renderAgenda();

    expect(screen.getByText("2 grupo(s) atrasado(s)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /proximo critico/i }));

    await waitFor(() => {
      expect(screen.getByText("Foco: Matriz 001")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /proximo critico/i }));

    await waitFor(() => {
      expect(screen.getByText("Foco: Matriz 002")).toBeInTheDocument();
    });

    expect(screen.getByText("Vacina Reforco")).toBeInTheDocument();
  });

  it("surfaces compliance restrictions from the official overlay in the agenda", async () => {
    mockedUseLiveQuery.mockReturnValue({
      itens: [createAgendaItem()],
      animais: [createAnimal()],
      lotes: [createLote()],
      protocolos: [],
      protocoloItens: [],
      gestos: [],
      sanidadeConfig: createSanidadeConfig(),
      officialTemplates: [createOfficialTemplate()],
      officialTemplateItems: [createOfficialTemplateItem()],
    } as ReturnType<typeof useLiveQuery>);

    await renderAgenda();

    expect(screen.getAllByText("Feed-ban 1").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Restricoes de conformidade em aberto"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Restricao de conformidade").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /abrir overlay de conformidade/i }),
    ).toBeInTheDocument();
  });
});
