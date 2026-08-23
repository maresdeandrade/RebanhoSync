/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/offline/db";
import type { Insumo, InsumoLote } from "@/lib/offline/types";
import { loadSanitaryAgendaExecutionOptionsV2 } from "@/components/sanitario/SanitaryAgendaExecutionConfirmV2";
import { SanitaryLocalAgendaPanelV2 } from "@/components/sanitario/SanitaryLocalAgendaPanelV2";
import type {
  SanitaryAgendaBatchItemResultV2,
  SanitaryAgendaBatchResultV2,
} from "@/lib/sanitario/execution/sanitaryAgendaExecutionV2";

const items = [
  {
    id: "agenda-1",
    fazendaId: "farm-1",
    plannedFor: "2026-07-01",
    status: "programada" as const,
    protocolId: "protocol-1",
    itemKey: "dose-anual",
    protocolLabel: "Brucelose B19",
    itemLabel: "Dose anual",
    productRequirementKind: "product_class_group",
    productClass: null,
    productClassLabel: null,
    productClassGroupId: "group-1",
    productClassGroupName: "Antiparasitários",
    plannedProductId: null,
    plannedProductName: null,
    suggestedDose: null,
    suggestedDoseUnit: null,
    suggestedRoute: null,
    animalCount: 3,
    target: { kind: "lote" as const, label: "Novilhas", href: "/lotes/lot-1" },
    canManage: true,
    canExecute: true,
  },
  {
    id: "agenda-2",
    fazendaId: "farm-1",
    plannedFor: "2026-08-01",
    status: "cancelada" as const,
    protocolId: "protocol-2",
    itemKey: "reforco",
    protocolLabel: "Raiva",
    itemLabel: "Reforço",
    productRequirementKind: "product_class",
    productClass: "vacina_raiva",
    productClassLabel: "Vacina contra raiva",
    productClassGroupId: null,
    productClassGroupName: null,
    plannedProductId: null,
    plannedProductName: null,
    suggestedDose: null,
    suggestedDoseUnit: null,
    suggestedRoute: null,
    animalCount: 1,
    target: { kind: "animal" as const, label: "Estrela", href: "/animais/animal-1" },
    canManage: false,
    canExecute: false,
  },
];

function batchResult(
  itemResults: SanitaryAgendaBatchItemResultV2[],
): SanitaryAgendaBatchResultV2 {
  return {
    items: itemResults,
    executedCount: itemResults.filter((item) => item.status === "EXECUTADO")
      .length,
    failedCount: itemResults.filter((item) => item.status === "FALHOU").length,
    notExecutedCount: itemResults.filter(
      (item) => item.status === "NAO_EXECUTADO",
    ).length,
    retryAvailableCount: itemResults.filter((item) => item.retryAvailable)
      .length,
  };
}

function renderPanel(
  onReschedule = vi.fn(),
  onCancel = vi.fn(),
  onExecute = vi.fn().mockResolvedValue(batchResult([])),
  panelItems = items,
) {
  render(
    <MemoryRouter>
      <SanitaryLocalAgendaPanelV2
        items={panelItems}
        executionProductOptions={[
          {
            id: "product-1",
            label: "Vermífugo A · Lab",
            name: "Vermífugo A",
            productClass: "antiparasitario",
            source: "catalog_product",
          },
        ]}
        executionInventoryLotOptions={[
          {
            id: "stock-lot-1",
            label: "Lote sem identificação · saldo 100 doses",
            productId: "product-1",
            unit: "dose",
            balanceLabel: "100 doses",
          },
        ]}
        onReschedule={onReschedule}
        onCancel={onCancel}
        onExecute={onExecute}
      />
    </MemoryRouter>,
  );
}

describe("SanitaryLocalAgendaPanelV2", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all([
      db.catalog_sanitario_produtos_v2.clear(),
      db.catalog_sanitario_product_class_group_members_v2.clear(),
      db.state_insumos.clear(),
      db.state_insumo_lotes.clear(),
    ]);
  });

  afterEach(async () => {
    await Promise.all([
      db.catalog_sanitario_produtos_v2.clear(),
      db.catalog_sanitario_product_class_group_members_v2.clear(),
      db.state_insumos.clear(),
      db.state_insumo_lotes.clear(),
    ]);
  });

  it("resolve insumo sanitário em estoque como produto selecionável quando não há vínculo técnico", async () => {
    await db.state_insumos.put({
      id: "insumo-ibr-bvd",
      fazenda_id: "farm-1",
      nome: "Vacina Reprodutiva IBR BVD Leptospirose",
      tipo: "sanitario",
      categoria: "Vacina",
      produto_veterinario_id: null,
      unidade_base: "dose",
      ativo: true,
      payload: { tags: ["Vacina", "Sanitário"] },
      client_id: "client",
      client_op_id: "op-insumo",
      client_tx_id: null,
      client_recorded_at: "2026-01-01T00:00:00.000Z",
      server_received_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    } as Insumo);
    await db.state_insumo_lotes.put({
      id: "stock-lot-ibr-bvd",
      fazenda_id: "farm-1",
      insumo_id: "insumo-ibr-bvd",
      apresentacao_id: null,
      identificacao_lote: null,
      validade: null,
      fabricante: null,
      local_armazenamento: null,
      quantidade_inicial_base: 100,
      saldo_atual_base: 100,
      unidade_base: "dose",
      status: "ativo",
      payload: {},
      client_id: "client",
      client_op_id: "op-lot",
      client_tx_id: null,
      client_recorded_at: "2026-01-01T00:00:00.000Z",
      server_received_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    } as InsumoLote);

    const result = await loadSanitaryAgendaExecutionOptionsV2([
      {
        ...items[0],
        productRequirementKind: "product_class",
        productClass: "vacina_ibr_bvd",
        productClassLabel: "Vacina IBR/BVD",
      },
    ]);

    expect(result.productOptions).toEqual([
      expect.objectContaining({
        id: "insumo:insumo-ibr-bvd",
        name: "Vacina Reprodutiva IBR BVD Leptospirose",
        weakTechnicalLink: true,
      }),
    ]);
    expect(result.inventoryLotOptions).toEqual([
      expect.objectContaining({
        id: "stock-lot-ibr-bvd",
        productId: "insumo:insumo-ibr-bvd",
        balanceLabel: "100 doses",
      }),
    ]);
  });

  it("lista registros sem expor identificadores técnicos e abre a origem", () => {
    renderPanel();
    expect(screen.getByText("Brucelose B19")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Ver agendas/ })[0]);
    expect(screen.getByRole("link", { name: /Novilhas/ })).toHaveAttribute("href", "/lotes/lot-1");
    expect(screen.queryByText("agenda-1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Executar grupo/ })).toBeInTheDocument();
  });

  it("filtra pelo conteúdo apresentado", () => {
    renderPanel();
    fireEvent.change(screen.getByLabelText("Buscar agenda sanitária"), { target: { value: "Estrela" } });
    expect(screen.getByText("Raiva")).toBeInTheDocument();
    expect(screen.queryByText("Brucelose B19")).not.toBeInTheDocument();
  });

  it("reagenda e cancela somente agendas gerenciáveis", async () => {
    const onReschedule = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn().mockResolvedValue(undefined);
    renderPanel(onReschedule, onCancel);

    fireEvent.click(screen.getAllByRole("button", { name: /Ver agendas/ })[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Reagendar" })[0]);
    fireEvent.change(screen.getByLabelText("Nova data planejada"), { target: { value: "2026-07-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova data" }));
    await waitFor(() => expect(onReschedule).toHaveBeenCalledWith("agenda-1", "2026-07-15"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: "Cancelar agenda" })[0]);
    await waitFor(() => expect(onCancel).toHaveBeenCalledWith("agenda-1"));
    fireEvent.click(screen.getAllByRole("button", { name: /Ver agendas/ })[0]);
    expect(screen.getAllByRole("button", { name: "Cancelar agenda" })[1]).toBeDisabled();
  });

  it("abre modal de execução, exige confirmação explícita e não mostra executar para agenda cancelada", async () => {
    const onExecute = vi.fn().mockImplementation(async (payloads) =>
      batchResult(
        payloads.map((payload: { agendaId: string; clientOpId: string }) => ({
          agendaId: payload.agendaId,
          clientOpId: payload.clientOpId,
          status: "EXECUTADO" as const,
          retryAvailable: false,
        })),
      ),
    );
    renderPanel(vi.fn(), vi.fn(), onExecute);

    expect(screen.getAllByRole("button", { name: /Executar grupo/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Executar grupo/ }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Esta ação registra um evento sanitário executado.")).toBeInTheDocument();
    expect(screen.getByText("Produto real, dose e via serão registrados como execução sanitária.")).toBeInTheDocument();
    expect(screen.getByText(/Grupo técnico não define dose nem carência/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar execução" })).toBeDisabled();

    fireEvent.click(screen.getByLabelText("Produto real"));
    fireEvent.click(screen.getByRole("option", { name: "Vermífugo A · Lab" }));
    expect(screen.getByText("Doses previstas")).toBeInTheDocument();
    expect(screen.getAllByText("3 doses").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText("Doses extras/perda")).toHaveValue(0);
    fireEvent.change(screen.getByLabelText("Doses extras/perda"), { target: { value: "2" } });
    expect(screen.getByText("5 doses")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Saldo disponível: 100 doses")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Via"), { target: { value: "subcutanea" } });
    fireEvent.click(screen.getByLabelText("Confirmo que este manejo sanitário foi executado."));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar execução" }));

    await waitFor(() =>
      expect(onExecute).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            agendaId: "agenda-1",
            product: expect.objectContaining({
              productId: "product-1",
              productName: "Vermífugo A",
              inventoryLotId: "stock-lot-1",
              quantityConsumed: 5,
              unit: "dose",
            }),
            application: expect.objectContaining({ dose: 1, doseUnit: "dose", route: "subcutanea" }),
            confirmation: expect.objectContaining({ userConfirmedExecution: true }),
          }),
        ],
      ),
    );
  });

  it("mostra sucesso parcial e reenvia somente agendas falhas ou não executadas", async () => {
    const groupedItems = [
      { ...items[0], id: "agenda-a", target: { ...items[0].target, label: "Animal A" } },
      { ...items[0], id: "agenda-b", target: { ...items[0].target, label: "Animal B" } },
      { ...items[0], id: "agenda-c", target: { ...items[0].target, label: "Animal C" } },
    ];
    const onExecute = vi
      .fn()
      .mockImplementationOnce(async (payloads) =>
        batchResult([
          {
            agendaId: "agenda-a",
            clientOpId: payloads[0].clientOpId,
            status: "EXECUTADO",
            retryAvailable: false,
          },
          {
            agendaId: "agenda-b",
            clientOpId: payloads[1].clientOpId,
            status: "FALHOU",
            retryAvailable: true,
          },
          {
            agendaId: "agenda-c",
            clientOpId: payloads[2].clientOpId,
            status: "NAO_EXECUTADO",
            retryAvailable: true,
          },
        ]),
      )
      .mockImplementationOnce(async (payloads) =>
        batchResult(
          payloads.map((payload: { agendaId: string; clientOpId: string }) => ({
            agendaId: payload.agendaId,
            clientOpId: payload.clientOpId,
            status: "EXECUTADO" as const,
            retryAvailable: false,
          })),
        ),
      );
    renderPanel(vi.fn(), vi.fn(), onExecute, groupedItems);
    fireEvent.click(screen.getByRole("button", { name: /Executar grupo/i }));
    fireEvent.click(screen.getByLabelText("Produto real"));
    fireEvent.click(screen.getByRole("option", { name: "Vermífugo A · Lab" }));
    fireEvent.change(screen.getByLabelText("Via"), {
      target: { value: "subcutanea" },
    });
    fireEvent.click(
      screen.getByLabelText("Confirmo que este manejo sanitário foi executado."),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar execução" }));

    await screen.findByText("Resultado por agenda");
    expect(screen.getByText("Animal A")).toBeInTheDocument();
    expect(screen.getByText("Executado")).toBeInTheDocument();
    expect(screen.getByText("Animal B")).toBeInTheDocument();
    expect(screen.getByText("Falhou")).toBeInTheDocument();
    expect(screen.getByText("Animal C")).toBeInTheDocument();
    expect(screen.getByText("Não executado")).toBeInTheDocument();
    expect(screen.getAllByText("Retry disponível")).toHaveLength(2);

    const firstPayloads = onExecute.mock.calls[0][0];
    fireEvent.click(
      screen.getByRole("button", { name: "Reenviar 2 pendente(s)" }),
    );
    await waitFor(() => expect(onExecute).toHaveBeenCalledTimes(2));
    const retryPayloads = onExecute.mock.calls[1][0];
    expect(retryPayloads.map((payload: { agendaId: string }) => payload.agendaId)).toEqual([
      "agenda-b",
      "agenda-c",
    ]);
    expect(retryPayloads.map((payload: { clientOpId: string }) => payload.clientOpId)).toEqual([
      firstPayloads[1].clientOpId,
      firstPayloads[2].clientOpId,
    ]);
  });
});
