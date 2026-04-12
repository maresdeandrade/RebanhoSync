/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import { useAuth } from "@/hooks/useAuth";
import type { RegulatoryOperationalReadModel } from "@/lib/sanitario/regulatoryReadModel";
import Eventos from "@/pages/Eventos";

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
          recommendation: "Revisar a quarentena antes de liberar venda ou transito.",
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
            message: "Transito externo bloqueado ate concluir o checklist documental.",
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
            message: "Transito externo bloqueado ate concluir o checklist documental.",
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
      () => responses[Math.min(callCount++, responses.length - 1)] as ReturnType<typeof useLiveQuery>,
    );
  };

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

  it("projeta conformidade aberta e CTA do overlay no historico", () => {
    render(
      <MemoryRouter>
        <Eventos />
      </MemoryRouter>,
    );

    expect(screen.getByText("Overlay regulatorio ativo")).toBeInTheDocument();
    expect(screen.getByText("Conformidade aberta")).toBeInTheDocument();
    expect(screen.getByText("Bloqueia nutricao")).toBeInTheDocument();
    expect(screen.getByText("Bloqueia venda/transito")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /abrir overlay de conformidade/i }),
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
      <MemoryRouter initialEntries={["/eventos?dominio=conformidade&overlayImpact=sale"]}>
        <Eventos />
      </MemoryRouter>,
    );

    expect(screen.getByText("Recorte regulatorio ativo")).toBeInTheDocument();
    expect(screen.getAllByText("Impacta transito/venda").length).toBeGreaterThan(0);
    expect(screen.getByText("Atualizacao documental - pendente")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /limpar recorte regulatorio/i }),
    ).toBeInTheDocument();
  });
});
