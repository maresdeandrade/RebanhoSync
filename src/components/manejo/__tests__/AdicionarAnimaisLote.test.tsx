/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/offline/ops", () => ({
  createGesture: vi.fn(async () => "tx-bulk-lote"),
}));

vi.mock("@/lib/sanitario/compliance/regulatoryReadModel", () => ({
  loadRegulatorySurfaceSource: vi.fn(async () => null),
  buildRegulatoryOperationalReadModel: vi.fn(() => ({
    flows: { movementInternal: { blockers: [] } },
  })),
}));

vi.mock("@/utils/toast", () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type { Animal, OperationInput } from "@/lib/offline/types";
import { showError, showSuccess } from "@/utils/toast";
import { AdicionarAnimaisLote } from "../AdicionarAnimaisLote";

const farmId = "10000000-0000-4000-8000-000000000001";
const targetLotId = "20000000-0000-4000-8000-000000000001";
const sourceLotId = "20000000-0000-4000-8000-000000000002";
const lote = { id: targetLotId, fazenda_id: farmId, nome: "Lote Destino" };

function buildAnimal(index: number): Animal {
  const timestamp = "2026-08-23T12:00:00.000Z";
  return {
    id: `animal-${index}`,
    fazenda_id: farmId,
    identificacao: `BOV-${String(index).padStart(2, "0")}`,
    sexo: index % 2 === 0 ? "F" : "M",
    status: "ativo",
    especie: "bovino",
    lote_id: sourceLotId,
    data_nascimento: "2024-01-01",
    data_entrada: "2024-01-01",
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
    client_id: "client-test",
    client_op_id: `seed-op-${index}`,
    client_tx_id: `seed-tx-${index}`,
    client_recorded_at: timestamp,
    server_received_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };
}

async function seedAnimals(count: number) {
  await db.state_animais.bulkPut(
    Array.from({ length: count }, (_, index) => buildAnimal(index + 1)),
  );
}

async function selectAllVisibleAnimals(user: ReturnType<typeof userEvent.setup>) {
  const checkboxes = await screen.findAllByRole("checkbox");
  for (const checkbox of checkboxes) {
    await user.click(checkbox);
  }
}

function capturedOperations(): OperationInput[] {
  const call = vi.mocked(createGesture).mock.calls[0];
  if (!call) throw new Error("createGesture was not called");
  return call[1];
}

function expectMovementComposition(ops: OperationInput[], count: number) {
  expect(ops.filter((op) => op.table === "eventos")).toHaveLength(count);
  expect(ops.filter((op) => op.table === "eventos_movimentacao")).toHaveLength(
    count,
  );
  expect(ops.filter((op) => op.table === "animais")).toHaveLength(count);
}

describe("AdicionarAnimaisLote bulk feedback", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.state_animais.clear();
  });

  afterEach(async () => {
    cleanup();
    await db.state_animais.clear();
  });

  it("reports all 10 animals when every selected animal remains eligible", async () => {
    await seedAnimals(10);
    const user = userEvent.setup();
    render(
      <AdicionarAnimaisLote
        lote={lote}
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    await selectAllVisibleAnimals(user);
    await user.click(screen.getByRole("button", { name: "Adicionar 10" }));

    await waitFor(() => expect(createGesture).toHaveBeenCalledTimes(1));
    expectMovementComposition(capturedOperations(), 10);
    expect(showSuccess).toHaveBeenCalledWith(
      "10 animal(is) adicionado(s) ao lote Lote Destino.",
    );
  });

  it("reports 8 and only enqueues 8 when two of 10 selected animals become ineligible", async () => {
    await seedAnimals(10);
    const user = userEvent.setup();
    render(
      <AdicionarAnimaisLote
        lote={lote}
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    await selectAllVisibleAnimals(user);
    await act(async () => {
      await db.state_animais.delete("animal-9");
      await db.state_animais.update("animal-10", { lote_id: targetLotId });
    });
    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(8));
    await user.click(screen.getByRole("button", { name: "Adicionar 10" }));

    await waitFor(() => expect(createGesture).toHaveBeenCalledTimes(1));
    const ops = capturedOperations();
    expectMovementComposition(ops, 8);
    const processedIds = ops
      .filter((op) => op.table === "animais")
      .map((op) => op.record.id);
    expect(processedIds).not.toContain("animal-9");
    expect(processedIds).not.toContain("animal-10");
    expect(showSuccess).toHaveBeenCalledWith(
      "8 animal(is) adicionado(s) ao lote Lote Destino.",
    );
  });

  it("does not enqueue or show success when none of 5 selected animals remain eligible", async () => {
    await seedAnimals(5);
    const user = userEvent.setup();
    render(
      <AdicionarAnimaisLote
        lote={lote}
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    await selectAllVisibleAnimals(user);
    await act(async () => {
      await db.state_animais.toCollection().modify({ lote_id: targetLotId });
    });
    await waitFor(() =>
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0),
    );
    await user.click(screen.getByRole("button", { name: "Adicionar 5" }));

    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith(
        "Nenhum animal elegivel para movimentacao.",
      ),
    );
    expect(createGesture).not.toHaveBeenCalled();
    expect(showSuccess).not.toHaveBeenCalled();
  });
});
