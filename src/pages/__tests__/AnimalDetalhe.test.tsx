/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { DEFAULT_FARM_MEASUREMENT_CONFIG } from "@/lib/farms/measurementConfig";
import type {
  AgendaItem,
  Animal,
  Evento,
  SanitarioCaso,
} from "@/lib/offline/types";
import { buildClinicalProtocolEventPayload } from "@/lib/sanitario/compliance/clinicalProtocols";
import { validateClinicalCaseClosureInput } from "@/pages/animalDetalheClinicalCase";
import AnimalDetalhe, { AnimalSanitaryCasesPanel } from "@/pages/AnimalDetalhe";
import type { SanitaryProtocolCatalogReadModelV2 } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";

vi.mock("@/hooks/useAuth");
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
  }

  const setupMockLiveQuery = (mockResponses: MockLiveQueryResponses) => {
    mockedUseLiveQuery.mockImplementation((fn: unknown) => {
      if (typeof fn !== "function") return null;
      const str = fn.toString();

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
        return mockResponses.eventos ?? [];
      }
      if (str.includes("state_agenda_itens")) {
        return mockResponses.agenda ?? [];
      }
      if (str.includes("catalog_doencas_notificaveis")) {
        return mockResponses.officialDiseases ?? [];
      }
      if (str.includes("state_animais_sociedade")) {
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
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
      farmMeasurementConfig: DEFAULT_FARM_MEASUREMENT_CONFIG,
    } as ReturnType<typeof useAuth>);
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

    expect(screen.getByText("Proximo manejo")).toBeInTheDocument();

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

  it("integra pre-checagem sanitaria v2 read-only na ficha do animal", async () => {
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

    expect(screen.getByText("Pré-checagem sanitária")).toBeInTheDocument();
    expect(
      screen.getByText("Catálogo sanitário local ainda não sincronizado"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /criar agenda/i }))
      .not.toBeInTheDocument();
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

  it("exibe ultimo ECC e historico em ordem decrescente de data", () => {
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
    expect(screen.getByText("Último ECC Factual")).toBeInTheDocument();
    expect(screen.getAllByText("25/05/2026").length).toBeGreaterThan(0);
    expect(screen.getByText("10/05/2026")).toBeInTheDocument();
    expect(screen.getAllByText(/obs: "Gorda"/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Escore bom")).toBeInTheDocument();
  });
});
