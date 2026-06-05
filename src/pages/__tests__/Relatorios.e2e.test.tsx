/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { triggerDownload } from "@/lib/offline/rejections";
import { trackPilotMetric } from "@/lib/telemetry/pilotMetrics";
import { showSuccess } from "@/utils/toast";
import Relatorios from "@/pages/Relatorios";

vi.mock("@/hooks/useAuth");
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));
vi.mock("@/lib/offline/rejections", () => ({
  triggerDownload: vi.fn(),
}));
vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn().mockResolvedValue(undefined),
  buildPilotMetricsSummary: vi.fn(),
}));
vi.mock("@/utils/toast", () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

describe("Relatorios flow", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);
  const mockedFrom = vi.mocked(supabase.from);
  const mockedTriggerDownload = vi.mocked(triggerDownload);
  const mockedTrackPilotMetric = vi.mocked(trackPilotMetric);
  const maybeSingle = vi.fn();
  const openWindow = {
    document: {
      write: vi.fn(),
      close: vi.fn(),
    },
    focus: vi.fn(),
    print: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-29T12:00:00.000Z"));
    vi.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
      farmMeasurementConfig: { weight_unit: "kg" },
    } as ReturnType<typeof useAuth>);

    mockedUseLiveQuery.mockReturnValue({
      animals: [
        {
          id: "animal-1",
          fazenda_id: "farm-1",
          identificacao: "BR-001",
          sexo: "F",
          status: "ativo",
          lote_id: null,
          data_nascimento: null,
          data_entrada: null,
          data_saida: null,
          pai_id: null,
          mae_id: null,
          nome: null,
          rfid: null,
          origem: null,
          raca: null,
          papel_macho: null,
          habilitado_monta: false,
          observacoes: null,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-1",
          client_tx_id: null,
          client_recorded_at: "2026-03-29T10:00:00.000Z",
          server_received_at: "2026-03-29T10:00:00.000Z",
          created_at: "2026-03-29T10:00:00.000Z",
          updated_at: "2026-03-29T10:00:00.000Z",
          deleted_at: null,
        },
      ],
      lotes: [],
      pastos: [],
      agenda: [
        {
          id: "agenda-1",
          fazenda_id: "farm-1",
          dominio: "sanitario",
          tipo: "vacinacao_aftosa",
          status: "agendado",
          data_prevista: "2026-03-29",
          animal_id: "animal-1",
          lote_id: null,
          dedup_key: null,
          source_kind: "manual",
          source_ref: null,
          source_client_op_id: null,
          source_tx_id: null,
          source_evento_id: null,
          protocol_item_version_id: null,
          interval_days_applied: null,
          payload: {
            produto_veterinario_id: "prod-sal",
            produto_nome_catalogo: "Sal mineral",
            quantityPerAnimal: 2,
            productUnit: "kg",
          },
          client_id: "client-1",
          client_op_id: "op-1",
          client_tx_id: null,
          client_recorded_at: "2026-03-29T10:00:00.000Z",
          server_received_at: "2026-03-29T10:00:00.000Z",
          created_at: "2026-03-29T10:00:00.000Z",
          updated_at: "2026-03-29T10:00:00.000Z",
          deleted_at: null,
        },
      ],
      eventos: [
        {
          id: "evento-1",
          fazenda_id: "farm-1",
          dominio: "financeiro",
          occurred_at: "2026-03-28T10:00:00.000Z",
          animal_id: null,
          lote_id: null,
          source_task_id: null,
          source_tx_id: null,
          source_client_op_id: null,
          corrige_evento_id: null,
          observacoes: null,
          payload: {
            inventory_policy: {
              estoque_minimo_base: 20,
              ponto_ressuprimento_base: 50,
            },
          },
          client_id: "client-1",
          client_op_id: "op-1",
          client_tx_id: null,
          client_recorded_at: "2026-03-28T10:00:00.000Z",
          server_received_at: "2026-03-28T10:00:00.000Z",
          created_at: "2026-03-28T10:00:00.000Z",
          updated_at: "2026-03-28T10:00:00.000Z",
          deleted_at: null,
        },
      ],
      eventosPesagem: [],
      eventosFinanceiro: [
        {
          evento_id: "evento-1",
          fazenda_id: "farm-1",
          tipo: "venda",
          valor_total: 3500,
          contraparte_id: null,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-1",
          client_tx_id: null,
          client_recorded_at: "2026-03-28T10:00:00.000Z",
          server_received_at: "2026-03-28T10:00:00.000Z",
          created_at: "2026-03-28T10:00:00.000Z",
          updated_at: "2026-03-28T10:00:00.000Z",
          deleted_at: null,
        },
      ],
      insumos: [
        {
          id: "insumo-1",
          fazenda_id: "farm-1",
          nome: "Sal mineral",
          tipo: "nutricional",
          categoria: "suplemento",
          produto_veterinario_id: "prod-sal",
          unidade_base: "kg",
          ativo: true,
          payload: {
            inventory_policy: {
              estoque_minimo_base: 20,
              ponto_ressuprimento_base: 50,
            },
          },
          client_id: "client-1",
          client_op_id: "op-1",
          client_tx_id: null,
          client_recorded_at: "2026-03-20T10:00:00.000Z",
          server_received_at: "2026-03-20T10:00:00.000Z",
          created_at: "2026-03-20T10:00:00.000Z",
          updated_at: "2026-03-20T10:00:00.000Z",
          deleted_at: null,
        },
      ],
      insumoApresentacoes: [
        {
          id: "apresentacao-1",
          fazenda_id: "farm-1",
          insumo_id: "insumo-1",
          nome: "Saco 25 kg",
          unidade_compra: "saco",
          quantidade_base: 25,
          unidade_base: "kg",
          codigo_barras: null,
          fabricante: null,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-1",
          client_tx_id: null,
          client_recorded_at: "2026-03-20T10:00:00.000Z",
          server_received_at: "2026-03-20T10:00:00.000Z",
          created_at: "2026-03-20T10:00:00.000Z",
          updated_at: "2026-03-20T10:00:00.000Z",
          deleted_at: null,
        },
      ],
      insumoLotes: [
        {
          id: "insumo-lote-1",
          fazenda_id: "farm-1",
          insumo_id: "insumo-1",
          apresentacao_id: "apresentacao-1",
          identificacao_lote: "Lote A",
          validade: null,
          fabricante: null,
          local_armazenamento: "Deposito",
          quantidade_inicial_base: 50,
          saldo_atual_base: 42,
          unidade_base: "kg",
          status: "ativo",
          custo_total: 100,
          custo_unitario: 2,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-1",
          client_tx_id: null,
          client_recorded_at: "2026-03-20T10:00:00.000Z",
          server_received_at: "2026-03-20T10:00:00.000Z",
          created_at: "2026-03-20T10:00:00.000Z",
          updated_at: "2026-03-20T10:00:00.000Z",
          deleted_at: null,
        },
      ],
      insumoMovimentacoes: [
        {
          id: "mov-1",
          fazenda_id: "farm-1",
          insumo_id: "insumo-1",
          insumo_lote_id: "insumo-lote-1",
          tipo: "entrada",
          quantidade_base: 50,
          unidade_base: "kg",
          occurred_at: "2026-03-22T10:00:00.000Z",
          source_evento_id: null,
          source_evento_dominio: null,
          animal_id: null,
          rebanho_lote_id: null,
          pasto_id: null,
          observacoes: null,
          custo_unitario_snapshot: 2,
          custo_total_snapshot: 100,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-1",
          client_tx_id: null,
          client_recorded_at: "2026-03-22T10:00:00.000Z",
          server_received_at: "2026-03-22T10:00:00.000Z",
          created_at: "2026-03-22T10:00:00.000Z",
          updated_at: "2026-03-22T10:00:00.000Z",
          deleted_at: null,
        },
        {
          id: "mov-2",
          fazenda_id: "farm-1",
          insumo_id: "insumo-1",
          insumo_lote_id: "insumo-lote-1",
          tipo: "consumo_nutricao",
          quantidade_base: 8,
          unidade_base: "kg",
          occurred_at: "2026-03-23T10:00:00.000Z",
          source_evento_id: null,
          source_evento_dominio: null,
          animal_id: null,
          rebanho_lote_id: null,
          pasto_id: null,
          observacoes: null,
          custo_unitario_snapshot: 2,
          custo_total_snapshot: 16,
          payload: {},
          client_id: "client-1",
          client_op_id: "op-1",
          client_tx_id: null,
          client_recorded_at: "2026-03-23T10:00:00.000Z",
          server_received_at: "2026-03-23T10:00:00.000Z",
          created_at: "2026-03-23T10:00:00.000Z",
          updated_at: "2026-03-23T10:00:00.000Z",
          deleted_at: null,
        },
      ],
      gestures: [],
      rejections: [],
    } as ReturnType<typeof useLiveQuery>);

    maybeSingle.mockResolvedValue({
      data: {
        nome: "Fazenda Boa Vista",
      },
    });

    mockedFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          is: () => ({
            maybeSingle,
          }),
        }),
      }),
    } as never);

    vi.spyOn(window, "open").mockReturnValue(openWindow as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("gera CSV e abre impressao do resumo operacional", async () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Relatorios />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: /Fazenda Boa Vista/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Leituras derivadas de eventos, state_\* e agenda/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/nao representam DRE, ROI, margem ou custo por arroba/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Resumo operacional/i)).toBeInTheDocument();
    expect(screen.getByText(/Financeiro operacional/i)).toBeInTheDocument();
    expect(screen.getByText(/nao e DRE, ROI ou margem/i)).toBeInTheDocument();
    expect(screen.getByText(/Estoque operacional/i)).toBeInTheDocument();
    expect(screen.getByText(/Custo operacional parcial/i)).toBeInTheDocument();
    expect(screen.getByText(/Fonte: read model de inventario/i)).toBeInTheDocument();
    expect(screen.getByText(/Entradas com custo/i)).toBeInTheDocument();
    expect(screen.getByText(/Saidas\/consumos com custo/i)).toBeInTheDocument();
    expect(screen.getByText(/Saldo economico conhecido/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Demanda futura por agenda valida/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Alertas de reposicao/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Ressuprir/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/saldo atual abaixo do ponto de ressuprimento/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Sal mineral/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/2 kg/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+50/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/-8/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/R\$ 100,00/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 16,00/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 84,00/i)).toBeInTheDocument();
    expect(screen.getByText(/28\/02\/2026 a 29\/03\/2026/i)).toBeInTheDocument();
    expect(screen.getAllByText(/R\$ 3\.500,00/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /Exportar CSV/i }));

    await waitFor(() => {
      expect(mockedTriggerDownload).toHaveBeenCalledTimes(1);
    });
    expect(showSuccess).toHaveBeenCalledWith("Resumo exportado em CSV.");
    expect(mockedTrackPilotMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        fazendaId: "farm-1",
        eventName: "report_exported",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Imprimir/i }));

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledTimes(1);
    });

    expect(openWindow.document.write).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(openWindow.print).toHaveBeenCalledTimes(1);
    });
    expect(mockedTrackPilotMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        fazendaId: "farm-1",
        eventName: "report_printed",
      }),
    );
  });
});
