/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import { useAuth } from "@/hooks/useAuth";
import type { RegulatoryOperationalReadModel } from "@/lib/sanitario/compliance/regulatoryReadModel";
import Eventos from "@/pages/Eventos";
import { createGesture } from "@/lib/offline/ops";
import { db } from "@/lib/offline/db";
import type { Evento } from "@/lib/offline/types";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));
vi.mock("@/lib/offline/ops", () => ({ createGesture: vi.fn() }));

vi.mock("@/hooks/useAuth");
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));

describe("Eventos page", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);

  const createRegulatoryReadModel = (): RegulatoryOperationalReadModel => ({
    entries: [],
    attention: {
      total: 2,
      openCount: 2,
      pendingCount: 1,
      adjustmentCount: 1,
      blockingCount: 2,
      feedBanOpenCount: 1,
      criticalChecklistCount: 1,
      badges: [
        {
          key: "feed-ban",
          label: "Feed-ban",
          count: 1,
          tone: "danger",
        },
        {
          key: "checklist",
          label: "Checklist critico",
          count: 1,
          tone: "warning",
        },
      ],
      topItems: [
        {
          key: "quarentena-entrada",
          label: "Quarentena de entrada",
          tone: "danger",
          statusLabel: "Ajuste necessario",
          recommendation:
            "Revisar a quarentena antes de liberar venda ou transito.",
        },
      ],
      groupBadge: {
        key: "open",
        label: "Pendencias abertas",
        count: 2,
        tone: "danger",
      },
    },
    flows: {
      nutrition: {
        blockers: [
          {
            entryKey: "feed-ban-1",
            message: "Feed-ban aberto para o rebanho ruminante.",
          },
        ],
        warnings: [],
        totalCount: 1,
        blockerCount: 1,
        warningCount: 0,
        firstBlockerMessage: "Feed-ban aberto para o rebanho ruminante.",
        firstWarningMessage: null,
        hasIssues: true,
        tone: "danger",
      },
      movementInternal: {
        blockers: [],
        warnings: [
          {
            entryKey: "quarentena-1",
            message: "Quarentena ainda exige revisao operacional.",
          },
        ],
        totalCount: 1,
        blockerCount: 0,
        warningCount: 1,
        firstBlockerMessage: null,
        firstWarningMessage: "Quarentena ainda exige revisao operacional.",
        hasIssues: true,
        tone: "warning",
      },
      movementExternal: {
        blockers: [
          {
            entryKey: "gta-1",
            message:
              "Transito externo bloqueado ate concluir o checklist documental.",
          },
        ],
        warnings: [],
        totalCount: 1,
        blockerCount: 1,
        warningCount: 0,
        firstBlockerMessage:
          "Transito externo bloqueado ate concluir o checklist documental.",
        firstWarningMessage: null,
        hasIssues: true,
        tone: "danger",
      },
      sale: {
        blockers: [
          {
            entryKey: "gta-1",
            message:
              "Transito externo bloqueado ate concluir o checklist documental.",
          },
        ],
        warnings: [],
        totalCount: 1,
        blockerCount: 1,
        warningCount: 0,
        firstBlockerMessage:
          "Transito externo bloqueado ate concluir o checklist documental.",
        firstWarningMessage: null,
        hasIssues: true,
        tone: "danger",
      },
    },
    analytics: {
      subareas: [],
      impacts: [],
    },
    hasOpenIssues: true,
    hasBlockingIssues: true,
  });

  const queueLiveQueryResponses = (dataResponse: unknown) => {
    const responses = [createRegulatoryReadModel(), dataResponse];
    let callCount = 0;
    mockedUseLiveQuery.mockImplementation(
      () =>
        responses[callCount++ % responses.length] as ReturnType<
          typeof useLiveQuery
        >,
    );
  };

  const emptyData = () => ({
    eventos: [],
    totalCount: 0,
    sanitarios: [],
    pesagens: [],
    nutricao: [],
    movimentacoes: [],
    financeiro: [],
    reproducao: [],
    animais: [],
    lotes: [],
    gestos: [],
    agenda: [],
    insumoMovimentacoes: [],
    insumoLotes: [],
  });

  const event = (id: string, dominio = "pesagem") => ({
    id,
    fazenda_id: "farm-1",
    dominio,
    animal_id: "animal-1",
    lote_id: null,
    occurred_at: "2026-10-20T08:00:00.000Z",
    client_recorded_at: "2026-10-20T08:00:00.000Z",
    client_tx_id: id,
    payload: {},
    observacoes: "Registro de campo",
    deleted_at: null,
  });

  const renderPage = (url = "/eventos") =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <Eventos />
      </MemoryRouter>,
    );

  it("diferencia carregamento de histórico vazio sem exibir zeros prematuros", () => {
    queueLiveQueryResponses(undefined);
    renderPage();
    expect(
      screen.getByRole("status", { name: "Carregando eventos" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Nenhum evento registrado"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/0 registro\(s\)/)).not.toBeInTheDocument();
  });

  it("diferencia vazio de filtros e permite limpar o recorte", async () => {
    const user = userEvent.setup();
    renderPage("/eventos?dominio=pesagem");
    expect(
      screen.getByText("Nenhum evento para estes filtros"),
    ).toBeInTheDocument();
    await user.click(
      screen.getAllByRole("button", { name: "Limpar filtros" })[0],
    );
    expect(screen.getByText("Nenhum evento registrado")).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Buscar eventos" }),
    ).toBeInTheDocument();
  });

  it("atualiza a consulta Dexie após buscar e limpar sem resultados", async () => {
    const { useLiveQuery: realUseLiveQuery } =
      await vi.importActual<typeof import("dexie-react-hooks")>(
        "dexie-react-hooks",
      );
    mockedUseLiveQuery.mockImplementation(realUseLiveQuery);
    await db.event_eventos.put(event("search-ui-regression") as Evento);
    try {
      const user = userEvent.setup();
      renderPage();
      expect(
        await screen.findByText("Histórico registrado"),
      ).toBeInTheDocument();
      await user.type(
        screen.getByRole("textbox", { name: "Buscar eventos" }),
        "inexistente",
      );
      expect(
        await screen.findByText("Nenhum evento para estes filtros"),
      ).toBeInTheDocument();
      await user.click(
        screen.getAllByRole("button", { name: "Limpar filtros" })[0],
      );
      expect(
        await screen.findByText("Histórico registrado"),
      ).toBeInTheDocument();
      expect(screen.getByText("Registro de campo")).toBeInTheDocument();
    } finally {
      await db.event_eventos.delete("search-ui-regression");
    }
  });

  it("mostra offline e acompanha a reconexão sem alterar dados", () => {
    renderPage();
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    fireEvent(window, new Event("offline"));
    expect(screen.getByText(/Você está offline/)).toBeInTheDocument();
    online.mockReturnValue(true);
    fireEvent(window, new Event("online"));
    expect(screen.queryByText(/Você está offline/)).not.toBeInTheDocument();
    online.mockRestore();
    expect(createGesture).not.toHaveBeenCalled();
  });

  it("preserva pendentes, rejeições e ACK com ajuste sem afirmar sincronização comum", () => {
    queueLiveQueryResponses({
      ...emptyData(),
      totalCount: 60,
      eventos: [event("pending"), event("rejected"), event("altered")],
      gestos: [
        { client_tx_id: "pending", status: "PENDING" },
        { client_tx_id: "rejected", status: "REJECTED" },
        {
          client_tx_id: "altered",
          status: "SYNCED",
          sync_result: "APPLIED_ALTERED",
        },
      ],
    });
    renderPage();
    expect(screen.getByText("Salvo localmente")).toBeInTheDocument();
    expect(screen.getByText("Rejeitado")).toBeInTheDocument();
    expect(screen.getByText("Confirmado com ajuste")).toBeInTheDocument();
    expect(screen.queryByText("Sincronizado")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Resumo somente dos 3 eventos/),
    ).toBeInTheDocument();
    expect(screen.getByText(/3 de 60 registros/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Carregar mais \(restam 57\)/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Identificação indisponível")).toHaveLength(3);
    expect(
      screen.getAllByText("Ver detalhes técnicos")[0].closest("details"),
    ).not.toHaveAttribute("open");
  });

  it("preserva navegação e gravação de complemento como novo gesto", async () => {
    const user = userEvent.setup();
    vi.mocked(createGesture).mockResolvedValue("tx-complement");
    queueLiveQueryResponses({
      ...emptyData(),
      totalCount: 1,
      eventos: [event("weight")],
      pesagens: [{ evento_id: "weight", peso_kg: 300 }],
    });
    renderPage();
    await user.click(
      screen.getByRole("button", { name: /mais acoes para o evento weight/i }),
    );
    await user.click(screen.getByRole("menuitem", { name: /abrir ficha/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/animais/animal-1");
    await user.click(
      screen.getByRole("button", { name: /mais acoes para o evento weight/i }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: /adicionar complemento/i }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Complemento do evento" }),
      "Conferido no curral",
    );
    await user.click(
      screen.getByRole("button", { name: "Salvar complemento" }),
    );
    expect(createGesture).toHaveBeenCalledWith(
      "farm-1",
      expect.arrayContaining([
        expect.objectContaining({
          table: "eventos",
          record: expect.objectContaining({
            corrige_evento_id: "weight",
            observacoes: "Conferido no curral",
            dominio: "pesagem",
          }),
        }),
      ]),
    );
  });

  it("mantém bloqueio de complemento para domínio não suportado", async () => {
    queueLiveQueryResponses({
      ...emptyData(),
      totalCount: 1,
      eventos: [event("repro", "reproducao")],
    });
    renderPage();
    await userEvent.click(
      screen.getByRole("button", { name: /mais acoes para o evento repro/i }),
    );
    expect(
      screen.getByRole("menuitem", { name: /complemento indisponivel/i }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it("não afirma sincronização quando a transação local não tem gesto nem confirmação remota", () => {
    queueLiveQueryResponses({
      ...emptyData(),
      totalCount: 1,
      eventos: [event("unknown")],
    });
    renderPage();
    expect(screen.getByText("Envio não confirmado")).toBeInTheDocument();
    expect(screen.queryByText("Sincronizado")).not.toBeInTheDocument();
  });

  it("orienta selecionar fazenda quando não há contexto ativo", () => {
    mockedUseAuth.mockReturnValue({
      activeFarmId: null,
      farmMeasurementConfig: { weight_unit: "kg" },
    } as ReturnType<typeof useAuth>);
    queueLiveQueryResponses(undefined);
    renderPage();
    expect(screen.getByText("Selecione uma fazenda")).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: "Carregando eventos" }),
    ).not.toBeInTheDocument();
  });

  it("contém erro de leitura e permite tentar novamente", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedUseLiveQuery.mockImplementation(() => {
      throw new Error("Falha de leitura local");
    });
    renderPage();
    expect(
      within(screen.getByRole("alert")).getByText(
        "Não foi possível carregar os eventos",
      ),
    ).toBeInTheDocument();
    queueLiveQueryResponses(emptyData());
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar novamente" }),
    );
    expect(screen.getByText("Nenhum evento registrado")).toBeInTheDocument();
    expect(createGesture).not.toHaveBeenCalled();
    log.mockRestore();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
      farmMeasurementConfig: {
        weight_unit: "kg",
      },
    } as ReturnType<typeof useAuth>);
    queueLiveQueryResponses({
      eventos: [],
      totalCount: 0,
      sanitarios: [],
      pesagens: [],
      nutricao: [],
      movimentacoes: [],
      financeiro: [],
      reproducao: [],
      animais: [],
      lotes: [],
      gestos: [],
    });
  });

  it("projeta conformidade aberta e CTA no historico", () => {
    render(
      <MemoryRouter>
        <Eventos />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Historico de eventos executados"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Lista fatos ja registrados/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /novo registro manual/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Atenção de conformidade")).toBeInTheDocument();
    expect(screen.getByText("Conformidade aberta")).toBeInTheDocument();
    expect(screen.getByText("Bloqueia nutricao")).toBeInTheDocument();
    expect(screen.getByText("Bloqueia venda/transito")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /abrir conformidade/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /filtrar conformidade/i }),
    ).toBeInTheDocument();
  });

  it("abre o historico ja recortado por impacto regulatorio", () => {
    queueLiveQueryResponses({
      eventos: [
        {
          id: "evento-conformidade-1",
          dominio: "conformidade",
          animal_id: null,
          lote_id: null,
          source_task_id: null,
          source_tx_id: null,
          source_client_op_id: null,
          corrige_evento_id: null,
          occurred_at: "2026-04-10T08:00:00.000Z",
          observacoes: "Checklist documental concluido parcialmente.",
          payload: {
            official_item_label: "Atualizacao documental",
            status: "pendente",
            subarea: "atualizacao_rebanho",
            compliance_kind: "checklist",
          },
          client_id: "client-1",
          client_op_id: "op-1",
          client_tx_id: null,
          client_recorded_at: "2026-04-10T08:00:00.000Z",
          server_received_at: "2026-04-10T08:00:00.000Z",
          created_at: "2026-04-10T08:00:00.000Z",
          updated_at: "2026-04-10T08:00:00.000Z",
          deleted_at: null,
        },
      ],
      totalCount: 1,
      sanitarios: [],
      pesagens: [],
      nutricao: [],
      movimentacoes: [],
      financeiro: [],
      reproducao: [],
      animais: [],
      lotes: [],
      gestos: [],
    });

    render(
      <MemoryRouter
        initialEntries={["/eventos?dominio=conformidade&overlayImpact=sale"]}
      >
        <Eventos />
      </MemoryRouter>,
    );

    expect(screen.getByText("Recorte regulatorio ativo")).toBeInTheDocument();
    expect(
      screen.getAllByText("Impacta transito/venda").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("Atualizacao documental - pendente"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /limpar recorte regulatorio/i }),
    ).toBeInTheDocument();
  });

  it("oferece baixa assistida de estoque para evento sanitario com produto catalogado", async () => {
    const user = userEvent.setup();

    queueLiveQueryResponses({
      eventos: [
        {
          id: "evento-sanitario-1",
          dominio: "sanitario",
          animal_id: "animal-1",
          lote_id: null,
          source_task_id: null,
          source_tx_id: null,
          source_client_op_id: null,
          corrige_evento_id: null,
          occurred_at: "2026-05-10T08:00:00.000Z",
          observacoes: "Vacina aplicada.",
          payload: { produto_veterinario_id: "produto-1" },
          client_id: "client-1",
          client_op_id: "op-1",
          client_tx_id: null,
          client_recorded_at: "2026-05-10T08:00:00.000Z",
          server_received_at: "2026-05-10T08:00:00.000Z",
          created_at: "2026-05-10T08:00:00.000Z",
          updated_at: "2026-05-10T08:00:00.000Z",
          deleted_at: null,
        },
      ],
      totalCount: 1,
      sanitarios: [
        {
          evento_id: "evento-sanitario-1",
          fazenda_id: "farm-1",
          tipo: "vacinacao",
          produto: "Vacina Raiva",
          produto_nome_snapshot: "Vacina Raiva",
          estoque_lote_id: "lote-estoque-1",
          estoque_lote_codigo_snapshot: "VR-2026",
          validade_produto: "2026-12-31",
          dose_quantidade: 2,
          dose_unidade: "mL",
          via_aplicacao: "SC",
          responsavel_nome: "Joao",
          carencia_carne_ate: "2026-06-10",
          carencia_leite_ate: null,
          custo_total_snapshot: 18,
          protocol_item_version: 1,
          protocol_item_snapshot: { item_code: "raiva_d1" },
          dose: null,
          carencia_dias: null,
          payload: {
            produto_veterinario_id: "produto-1",
            produto_nome_catalogo: "Vacina Raiva",
          },
          client_id: "client-1",
          client_op_id: "op-detail-1",
          client_tx_id: null,
          client_recorded_at: "2026-05-10T08:00:00.000Z",
          server_received_at: "2026-05-10T08:00:00.000Z",
          created_at: "2026-05-10T08:00:00.000Z",
          updated_at: "2026-05-10T08:00:00.000Z",
          deleted_at: null,
        },
      ],
      pesagens: [],
      nutricao: [],
      movimentacoes: [],
      financeiro: [],
      reproducao: [],
      animais: [
        {
          id: "animal-1",
          identificacao: "Animal 001",
          deleted_at: null,
        },
      ],
      lotes: [],
      gestos: [],
    });

    render(
      <MemoryRouter>
        <Eventos />
      </MemoryRouter>,
    );

    await user.click(
      screen.getByRole("button", {
        name: /mais acoes para o evento evento-sanitario-1/i,
      }),
    );

    expect(
      screen.getByRole("menuitem", { name: /baixar do estoque/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Vacina Raiva \| lote VR-2026/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/dose 2 mL/i)).toBeInTheDocument();
    expect(screen.getByText(/via SC/i)).toBeInTheDocument();
    expect(
      screen.getByText(/carencia carne ate 10\/06\/2026/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/custo R\$\s?18,00/i)).toBeInTheDocument();
    expect(screen.getByText(/protocolo raiva_d1 \/ v1/i)).toBeInTheDocument();
  });
});
