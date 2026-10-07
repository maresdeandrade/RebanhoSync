/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLotes } from "@/hooks/useLotes";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { DEFAULT_FARM_MEASUREMENT_CONFIG } from "@/lib/farms/measurementConfig";
import type { Animal } from "@/lib/offline/types";
import type { RegulatoryOperationalReadModel } from "@/lib/sanitario/compliance/regulatoryReadModel";
import Animais from "@/pages/Animais";

vi.mock("@/hooks/useAuth");
vi.mock("@/hooks/useDebouncedValue");
vi.mock("@/hooks/useLotes");
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
    especie: "bovino",
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

describe("Animais page", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseDebouncedValue = vi.mocked(useDebouncedValue);
  const mockedUseLotes = vi.mocked(useLotes);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);

  const emptyRegulatoryReadModel: RegulatoryOperationalReadModel = {
    entries: [],
    attention: {
      total: 0,
      openCount: 0,
      pendingCount: 0,
      adjustmentCount: 0,
      blockingCount: 0,
      feedBanOpenCount: 0,
      criticalChecklistCount: 0,
      badges: [],
      topItems: [],
      groupBadge: null,
    },
    flows: {
      nutrition: {
        blockers: [],
        warnings: [],
        totalCount: 0,
        blockerCount: 0,
        warningCount: 0,
        firstBlockerMessage: null,
        firstWarningMessage: null,
        hasIssues: false,
        tone: "success",
      },
      movementInternal: {
        blockers: [],
        warnings: [],
        totalCount: 0,
        blockerCount: 0,
        warningCount: 0,
        firstBlockerMessage: null,
        firstWarningMessage: null,
        hasIssues: false,
        tone: "success",
      },
      movementExternal: {
        blockers: [],
        warnings: [],
        totalCount: 0,
        blockerCount: 0,
        warningCount: 0,
        firstBlockerMessage: null,
        firstWarningMessage: null,
        hasIssues: false,
        tone: "success",
      },
      sale: {
        blockers: [],
        warnings: [],
        totalCount: 0,
        blockerCount: 0,
        warningCount: 0,
        firstBlockerMessage: null,
        firstWarningMessage: null,
        hasIssues: false,
        tone: "success",
      },
    },
    analytics: {
      subareas: [],
      impacts: [],
    },
    hasOpenIssues: false,
    hasBlockingIssues: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
      farmMeasurementConfig: DEFAULT_FARM_MEASUREMENT_CONFIG,
    } as ReturnType<typeof useAuth>);
    mockedUseDebouncedValue.mockImplementation((value) => value);
    mockedUseLotes.mockReturnValue([
      {
        id: "lote-1",
        fazenda_id: "farm-1",
        nome: "Matrizes",
        status: "ativo",
        pasto_id: null,
        touro_id: null,
        observacoes: null,
        payload: {},
        client_id: "client-1",
        client_op_id: "op-lote",
        client_tx_id: null,
        client_recorded_at: "2026-04-01T00:00:00.000Z",
        server_received_at: "2026-04-01T00:00:00.000Z",
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
        deleted_at: null,
      },
    ] as ReturnType<typeof useLotes>);
  });

  it("prioriza peso, ganho e proximo evento sem exibir fase vet ou vinculo", () => {
    const mother = makeAnimal({
      id: "cow-1",
      identificacao: "M-100",
      sexo: "F",
      nome: "Aurora",
      data_nascimento: "2020-01-10",
    });
    const calf = makeAnimal({
      id: "calf-1",
      identificacao: "BZ-01",
      sexo: "F",
      mae_id: mother.id,
      data_nascimento: "2026-02-01",
    });

    mockedUseLiveQuery.mockImplementation((() => {
      let callCount = 0;
      return () => {
        const index = callCount % 7;
        callCount += 1;

        switch (index) {
          case 0:
            return [mother, calf] as ReturnType<typeof useLiveQuery>;
          case 1:
            return [] as ReturnType<typeof useLiveQuery>;
          case 2:
            return [
              {
                animalId: mother.id,
                ultimoPesoKg: 450,
                ultimoPesoData: "2026-04-01T12:00:00.000Z",
                ganhoMedioDiaKg: 0.4,
                totalPesagens: 3,
              },
              {
                animalId: calf.id,
                ultimoPesoKg: 62,
                ultimoPesoData: "2026-04-03T12:00:00.000Z",
                ganhoMedioDiaKg: 0.7,
                totalPesagens: 2,
              },
            ] as ReturnType<typeof useLiveQuery>;
          case 3:
            return [
              {
                animalId: calf.id,
                titulo: "Sanitario: vacina reforco",
                data: "2026-04-10",
                status: "proximo",
                scheduleLabel: "Aplicar entre 3 e 8 meses",
                scheduleMode: "age_window",
                scheduleModeLabel: "Janela etaria",
                scheduleAnchor: "birth",
                scheduleAnchorLabel: "Nascimento",
              },
            ] as ReturnType<typeof useLiveQuery>;
          case 4:
            return emptyRegulatoryReadModel as ReturnType<typeof useLiveQuery>;
          case 5:
            // pendingOps — adicionado em Animais.tsx (6ª chamada useLiveQuery)
            return [] as ReturnType<typeof useLiveQuery>;
          case 6:
          default:
            return [mother] as ReturnType<typeof useLiveQuery>;
        }
      };
    })());

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Animais />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Último peso")).toHaveLength(2);
    expect(screen.getAllByText("Próxima ação")).toHaveLength(2);
    expect(screen.getAllByText(/Confiabilidade nao classificada/)).toHaveLength(2);
    expect(screen.getByText("01/04/2026")).toHaveAttribute("datetime", "2026-04-01T12:00:00.000Z");
    expect(screen.getByText("03/04/2026")).toHaveAttribute("datetime", "2026-04-03T12:00:00.000Z");
    expect(screen.queryByText("Fase vet.")).not.toBeInTheDocument();
    expect(screen.queryByText("Vinculo")).not.toBeInTheDocument();
    expect(screen.queryByText(/junto da matriz/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("450,0 kg").length).toBeGreaterThan(0);
    expect(screen.getAllByText("0,7 kg/dia").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sanitario: vacina reforco").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Janela etaria").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nascimento").length).toBeGreaterThan(0);
    expect(screen.getByText("Aplicar entre 3 e 8 meses")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir matriz" })).toBeInTheDocument();
  });

  function mockList(
    animals: Animal[] | undefined,
    weights: Array<{
      animalId: string;
      ultimoPesoKg: number | null;
      ultimoPesoData: string | null;
      ganhoMedioDiaKg: number | null;
      blocked?: boolean;
    }> = [],
    loading: { weight?: boolean; agenda?: boolean; regulatory?: boolean; pending?: boolean } = {},
  ) {
    let callCount = 0;
    mockedUseLiveQuery.mockImplementation((query, deps) => {
      const index = callCount++ % 7;
      if (index === 0) return (animals ?? []) as ReturnType<typeof useLiveQuery>;
      if (index === 2) return (loading.weight ? undefined : weights) as ReturnType<typeof useLiveQuery>;
      if (index === 3 && loading.agenda) return undefined;
      if (index === 4) return (loading.regulatory ? undefined : emptyRegulatoryReadModel) as ReturnType<typeof useLiveQuery>;
      if (index === 5 && loading.pending) return undefined;
      if (index !== 6) return [] as ReturnType<typeof useLiveQuery>;
      const search = String(deps?.[1] ?? "").toLowerCase();
      return animals?.filter(animal => animal.identificacao.toLowerCase().includes(search)) as ReturnType<typeof useLiveQuery>;
    });
  }

  function renderList() {
    return render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Animais />
      </MemoryRouter>,
    );
  }

  it("anuncia carregamento sem afirmar ausencia de animais", () => {
    mockList(undefined);
    renderList();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando animais...");
    expect(screen.queryByText(/Nenhum animal/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Novo animal" })).toHaveAttribute("href", "/animais/novo");
  });

  it("mantem a identidade enquanto as fontes auxiliares carregam e so depois afirma ausencia", () => {
    const animals = [makeAnimal({ id: "animal-1", identificacao: "BR-001", sexo: "F" })];
    mockList(animals, [], { weight: true, agenda: true, regulatory: true, pending: true });
    const view = renderList();

    expect(screen.getByRole("link", { name: "BR-001" })).toHaveAttribute("href", "/animais/animal-1");
    expect(screen.getByText("Carregando peso...")).toBeInTheDocument();
    expect(screen.getByText("Carregando ganho...")).toBeInTheDocument();
    expect(screen.getByText("Carregando agenda...")).toBeInTheDocument();
    expect(screen.getByText("Restrições carregando")).toBeInTheDocument();
    expect(screen.getByText("Fila local carregando")).toBeInTheDocument();
    expect(screen.queryByText("Sem pesagem")).not.toBeInTheDocument();
    expect(screen.queryByText("Sem agenda aberta.")).not.toBeInTheDocument();

    mockList(animals);
    view.rerender(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Animais />
      </MemoryRouter>,
    );

    expect(screen.getByText("Sem pesagem")).toBeInTheDocument();
    expect(screen.getByText("Sem agenda aberta.")).toBeInTheDocument();
    expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument();
  });

  it.each([
    ["calendarMode=janela_etaria", { agenda: true }],
    ["overlayImpact=sale", { regulatory: true }],
  ])("nao afirma recorte vazio enquanto a fonte do filtro %s carrega", (filter, loading) => {
    mockList([makeAnimal({ id: "animal-1", identificacao: "BR-001", sexo: "F" })], [], loading);
    render(
      <MemoryRouter
        initialEntries={[`/animais?${filter}`]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Animais />
      </MemoryRouter>,
    );

    expect(screen.getByText("Carregando recorte")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Carregando dados do recorte");
    expect(screen.queryByText(/Nenhum animal/)).not.toBeInTheDocument();
  });

  it("mantem a diferenca visual entre vendido, morto e retirado", () => {
    mockList([
      makeAnimal({ id: "sold", identificacao: "V-001", sexo: "F", status: "vendido" }),
      makeAnimal({ id: "dead", identificacao: "M-001", sexo: "F", status: "morto" }),
      makeAnimal({ id: "removed", identificacao: "R-001", sexo: "M", status: "retirado" }),
    ]);
    renderList();

    expect(screen.getByText("vendido", { exact: true })).toHaveClass("bg-semantic-warning-muted");
    expect(screen.getByText("morto", { exact: true })).toHaveClass("bg-semantic-error-muted");
    expect(screen.getByText("retirado", { exact: true })).toHaveClass("bg-semantic-error-muted");
  });

  it("explica o recorte de ativos e permite consultar outros filtros quando vazio", () => {
    mockList([]);
    renderList();
    expect(screen.getByRole("status")).toHaveTextContent("Nenhum animal ativo neste recorte");
    expect(screen.queryByText("Nenhum animal cadastrado")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Buscar animal" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Mostrar filtros/ }));
    expect(screen.getByRole("combobox", { name: "Lote" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Bezerra$/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Nenhum animal no recorte atual");
    expect(screen.getByRole("button", { name: /^Bezerra$/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("distingue busca sem resultado e recupera a lista ao limpar a busca", () => {
    mockList([makeAnimal({ id: "animal-1", identificacao: "BR-001", sexo: "F" })]);
    renderList();
    const search = screen.getByRole("textbox", { name: "Buscar animal" });
    fireEvent.change(search, { target: { value: "BR-999" } });
    expect(screen.getByRole("status")).toHaveTextContent("Nenhum animal encontrado na busca");
    expect(screen.queryByRole("link", { name: "BR-001" })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getByRole("link", { name: "BR-001" })).toHaveAttribute("href", "/animais/animal-1");
  });

  it("preserva unidade configurada, data ausente e conflito sem inventar peso", () => {
    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
      farmMeasurementConfig: { weight_unit: "arroba" },
    } as ReturnType<typeof useAuth>);
    mockList([
      makeAnimal({ id: "weighted", identificacao: "P-001", sexo: "F" }),
      makeAnimal({ id: "blocked", identificacao: "P-002", sexo: "M" }),
      makeAnimal({ id: "missing", identificacao: "P-003", sexo: "M" }),
    ], [
      { animalId: "weighted", ultimoPesoKg: 450, ultimoPesoData: null, ganhoMedioDiaKg: -0.4 },
      { animalId: "blocked", ultimoPesoKg: null, ultimoPesoData: null, ganhoMedioDiaKg: null, blocked: true },
    ]);
    renderList();
    expect(within(screen.getByText("30,00 arroba").parentElement!).getByText("Data não informada")).toBeInTheDocument();
    expect(screen.getByText("-0,03 arroba/dia")).toBeInTheDocument();
    expect(screen.getAllByText("Conflito factual")).toHaveLength(2);
    expect(screen.getByText("Sem pesagem")).toBeInTheDocument();
    expect(screen.queryByText("Peso atual")).not.toBeInTheDocument();
  });

  it("pagina o recorte quando a tabela excede cem animais", () => {
    const animaisBase = Array.from({ length: 101 }, (_, index) =>
      makeAnimal({
        id: `animal-${index + 1}`,
        identificacao: `A-${String(index + 1).padStart(3, "0")}`,
        sexo: index % 2 === 0 ? "F" : "M",
      }),
    );

    mockedUseLiveQuery.mockImplementation((() => {
      let callCount = 0;
      return () => {
        const index = callCount % 7;
        callCount += 1;

        switch (index) {
          case 0:
            return animaisBase as ReturnType<typeof useLiveQuery>;
          case 1:
            return [] as ReturnType<typeof useLiveQuery>;
          case 2:
            return [] as ReturnType<typeof useLiveQuery>;
          case 3:
            return [] as ReturnType<typeof useLiveQuery>;
          case 4:
            return emptyRegulatoryReadModel as ReturnType<typeof useLiveQuery>;
          case 5:
            // pendingOps — adicionado em Animais.tsx (6ª chamada useLiveQuery)
            return [] as ReturnType<typeof useLiveQuery>;
          case 6:
          default:
            return animaisBase as ReturnType<typeof useLiveQuery>;
        }
      };
    })());

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Animais />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Ir para a pagina 1" })).toBeInTheDocument();
    expect(screen.getAllByText("A-001").length).toBeGreaterThan(0);
    expect(screen.queryByText("A-101")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /proxima/i }));

    expect(screen.getByRole("link", { name: "Ir para a pagina 2" })).toBeInTheDocument();
    expect(screen.getAllByText("A-101").length).toBeGreaterThan(0);
    expect(screen.queryByText("A-001")).not.toBeInTheDocument();
  });

  it("abre a lista animal-centric ja filtrada por restricao operacional", () => {
    const activeAnimal = makeAnimal({
      id: "animal-1",
      identificacao: "BR-001",
      sexo: "F",
    });
    const soldAnimal = makeAnimal({
      id: "animal-2",
      identificacao: "BR-002",
      sexo: "M",
      status: "vendido",
    });

    mockedUseLiveQuery.mockImplementation((() => {
      let callCount = 0;
      return () => {
        const index = callCount % 7;
        callCount += 1;

        switch (index) {
          case 0:
            return [activeAnimal, soldAnimal] as ReturnType<typeof useLiveQuery>;
          case 1:
            return [] as ReturnType<typeof useLiveQuery>;
          case 2:
            return [] as ReturnType<typeof useLiveQuery>;
          case 3:
            return [] as ReturnType<typeof useLiveQuery>;
          case 4:
            return {
              ...emptyRegulatoryReadModel,
              attention: {
                ...emptyRegulatoryReadModel.attention,
                total: 1,
                openCount: 1,
                blockingCount: 1,
              },
              flows: {
                ...emptyRegulatoryReadModel.flows,
                sale: {
                  blockers: [],
                  warnings: [],
                  totalCount: 1,
                  blockerCount: 1,
                  warningCount: 0,
                  firstBlockerMessage:
                    "Checklist documental bloqueia o transito externo.",
                  firstWarningMessage: null,
                  hasIssues: true,
                  tone: "danger",
                },
              },
              analytics: {
                subareas: [
                  {
                    key: "documental",
                    label: "Documental",
                    openCount: 1,
                    blockerCount: 1,
                    warningCount: 0,
                    adjustmentCount: 0,
                    pendingCount: 1,
                    tone: "danger",
                    affectedImpacts: ["sale"],
                    recommendation: "Regularizar checklist.",
                  },
                ],
                impacts: [
                  {
                    key: "sale",
                    label: "Impacta transito/venda",
                    blockerCount: 1,
                    warningCount: 0,
                    totalCount: 1,
                    tone: "danger",
                    message: "Checklist documental bloqueia o transito externo.",
                  },
                ],
              },
              hasOpenIssues: true,
              hasBlockingIssues: true,
            } as ReturnType<typeof useLiveQuery>;
          case 5:
            // pendingOps — adicionado em Animais.tsx (6ª chamada useLiveQuery)
            return [] as ReturnType<typeof useLiveQuery>;
          case 6:
          default:
            return [activeAnimal, soldAnimal] as ReturnType<typeof useLiveQuery>;
        }
      };
    })());

    render(
      <MemoryRouter
        initialEntries={["/animais?overlayImpact=sale"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Animais />
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/Venda\/transito bloqueados/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("BR-001").length).toBeGreaterThan(0);
    expect(screen.queryByText("BR-002")).not.toBeInTheDocument();
  });

  it("aceita calendarMode e calendarAnchor por query string no recorte animal-centric", () => {
    const animalJanela = makeAnimal({
      id: "animal-1",
      identificacao: "BR-001",
      sexo: "F",
    });
    const animalRecorrente = makeAnimal({
      id: "animal-2",
      identificacao: "BR-002",
      sexo: "F",
    });

    mockedUseLiveQuery.mockImplementation((() => {
      let callCount = 0;
      return () => {
        const index = callCount % 7;
        callCount += 1;

        switch (index) {
          case 0:
            return [animalJanela, animalRecorrente] as ReturnType<typeof useLiveQuery>;
          case 1:
            return [] as ReturnType<typeof useLiveQuery>;
          case 2:
            return [] as ReturnType<typeof useLiveQuery>;
          case 3:
            return [
              {
                animalId: animalJanela.id,
                titulo: "Sanitario: brucelose",
                data: "2026-04-10",
                status: "proximo",
                scheduleLabel: "Aplicar entre 3 e 8 meses",
                scheduleMode: "janela_etaria",
                scheduleModeLabel: "Janela etaria",
                scheduleAnchor: "nascimento",
                scheduleAnchorLabel: "Nascimento",
              },
              {
                animalId: animalRecorrente.id,
                titulo: "Sanitario: vermifugo",
                data: "2026-04-12",
                status: "proximo",
                scheduleLabel: "A cada 90 dias",
                scheduleMode: "rotina_recorrente",
                scheduleModeLabel: "Rotina recorrente",
                scheduleAnchor: null,
                scheduleAnchorLabel: null,
              },
            ] as ReturnType<typeof useLiveQuery>;
          case 4:
            return emptyRegulatoryReadModel as ReturnType<typeof useLiveQuery>;
          case 5:
            // pendingOps — adicionado em Animais.tsx (6ª chamada useLiveQuery)
            return [] as ReturnType<typeof useLiveQuery>;
          case 6:
          default:
            return [animalJanela, animalRecorrente] as ReturnType<typeof useLiveQuery>;
        }
      };
    })());

    render(
      <MemoryRouter
        initialEntries={["/animais?calendarMode=janela_etaria&calendarAnchor=nascimento"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Animais />
      </MemoryRouter>,
    );

    expect(screen.getAllByText("BR-001").length).toBeGreaterThan(0);
    expect(screen.queryByText("BR-002")).not.toBeInTheDocument();
    expect(screen.getAllByText("Janela etaria").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nascimento").length).toBeGreaterThan(0);
  });
});
