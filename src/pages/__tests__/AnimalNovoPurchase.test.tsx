/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { buildCommercialOperationGesture } from "@/lib/comercial/commercialOperationCommand";
import { EventValidationError } from "@/lib/events/validators";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { showError, showSuccess } from "@/utils/toast";
import AnimalNovo from "../AnimalNovo";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/hooks/useLotes", () => ({ useLotes: () => [] }));
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: () => [] }));
vi.mock("@/utils/toast", () => ({ showError: vi.fn(), showSuccess: vi.fn() }));
vi.mock("@/lib/offline/ops", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/offline/ops")>();
  return { ...actual, createGesture: vi.fn(actual.createGesture) };
});
vi.mock(
  "@/lib/comercial/commercialOperationCommand",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/lib/comercial/commercialOperationCommand")
      >();
    return {
      ...actual,
      buildCommercialOperationGesture: vi.fn(
        actual.buildCommercialOperationGesture,
      ),
    };
  },
);

const farm = "10000000-0000-4000-8000-000000000001";

async function clearStores() {
  await db.transaction(
    "rw",
    [
      db.state_animais,
      db.event_eventos,
      db.event_eventos_comercial,
      db.queue_ops,
      db.queue_gestures,
    ],
    async () => {
      await db.state_animais.clear();
      await db.event_eventos.clear();
      await db.event_eventos_comercial.clear();
      await db.queue_ops.clear();
      await db.queue_gestures.clear();
    },
  );
}

async function fillPurchase(instant: string, entryDate: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(instant));
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <AnimalNovo />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText(/Identificação/), {
    target: { value: "B04-UI" },
  });
  await user.click(screen.getByRole("tab", { name: "Origem" }));
  await user.click(screen.getByRole("button", { name: "Compra" }));
  fireEvent.change(screen.getByLabelText(/Valor Total/), {
    target: { value: "1000" },
  });
  fireEvent.change(screen.getByLabelText("Data de Entrada"), {
    target: { value: entryDate },
  });
  return user;
}

describe("AnimalNovo — compra com data de entrada", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      activeFarmId: farm,
      role: "owner",
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    } as ReturnType<typeof useAuth>);
    await clearStores();
  });

  afterEach(async () => {
    cleanup();
    vi.useRealTimers();
    await clearStores();
  });

  it.each([
    ["2026-10-16T08:00:00.000Z", "2026-10-16", "2026-10-16T08:00:00.000Z"],
    ["2026-10-16T11:59:59.999Z", "2026-10-16", "2026-10-16T11:59:59.999Z"],
    ["2026-10-16T14:00:00.000Z", "2026-10-16", "2026-10-16T14:00:00.000Z"],
    ["2026-10-16T08:00:00.000Z", "2026-10-15", "2026-10-15T12:00:00.000Z"],
    ["2026-10-16T08:00:00.000Z", "", "2026-10-16T08:00:00.000Z"],
    ["2026-10-16T23:59:59.999Z", "2026-10-16", "2026-10-16T23:59:59.999Z"],
    ["2026-10-17T00:00:00.000Z", "2026-10-17", "2026-10-17T00:00:00.000Z"],
  ])(
    "persiste uma única compra: agora=%s, entrada=%s, fato=%s",
    async (instant, entryDate, expectedOccurredAt) => {
      const user = await fillPurchase(instant, entryDate);
      await user.click(
        screen.getAllByRole("button", { name: "Salvar animal" })[0],
      );
      await waitFor(() =>
        expect(showSuccess).toHaveBeenCalledWith(
          "Animal e compra cadastrados localmente!",
        ),
      );

      expect(buildCommercialOperationGesture).toHaveBeenCalledTimes(1);
      expect(buildCommercialOperationGesture).toHaveBeenCalledWith(
        expect.objectContaining({
          occurredAt: expectedOccurredAt,
          fazendaId: farm,
        }),
      );
      expect(createGesture).toHaveBeenCalledTimes(1);
      const [animals, events, details, ops, gestures] = await Promise.all([
        db.state_animais.toArray(),
        db.event_eventos.toArray(),
        db.event_eventos_comercial.toArray(),
        db.queue_ops.toArray(),
        db.queue_gestures.toArray(),
      ]);
      expect(animals).toHaveLength(1);
      expect(events).toHaveLength(1);
      expect(details).toHaveLength(1);
      expect(ops).toHaveLength(1);
      expect(gestures).toHaveLength(1);
      expect(animals[0]).toMatchObject({
        fazenda_id: farm,
        origem: "compra",
        data_entrada: entryDate || null,
      });
      expect(events[0]).toMatchObject({
        fazenda_id: farm,
        animal_id: animals[0].id,
        occurred_at: expectedOccurredAt,
      });
      expect(details[0]).toMatchObject({
        fazenda_id: farm,
        evento_id: events[0].id,
        animal_ids: [animals[0].id],
        occurred_at: expectedOccurredAt,
      });
      expect(ops[0]).toMatchObject({
        table: "commercial_operation_v2",
        sync_state: "PENDING",
      });
      expect(gestures[0]).toMatchObject({
        fazenda_id: farm,
        status: "PENDING",
      });
      for (const record of [animals[0], events[0], details[0], ops[0]]) {
        expect(record.client_tx_id).toBe(gestures[0].client_tx_id);
      }
      expect(showError).not.toHaveBeenCalled();
    },
  );

  it("rejeita entrada futura antes de construir ou persistir", async () => {
    const user = await fillPurchase("2026-10-16T23:59:59.999Z", "2026-10-17");
    await user.click(
      screen.getAllByRole("button", { name: "Salvar animal" })[0],
    );
    expect(showError).toHaveBeenCalledWith(
      "Data de entrada não pode ser inválida ou futura.",
    );
    expect(buildCommercialOperationGesture).not.toHaveBeenCalled();
    expect(createGesture).not.toHaveBeenCalled();
    expect(await db.queue_gestures.count()).toBe(0);
    expect(
      screen.getAllByRole("button", { name: "Salvar animal" })[0],
    ).toBeEnabled();
  });

  it.each([
    [new Error("falha de construção"), "Erro ao cadastrar animal."],
    [
      new EventValidationError([
        {
          code: "INVALID",
          field: "occurredAt",
          message: "Mensagem factual preservada.",
        },
      ]),
      "Mensagem factual preservada.",
    ],
  ])(
    "trata falha do builder, mostra feedback e libera novo submit: %s",
    async (error, expectedMessage) => {
      const user = await fillPurchase("2026-10-16T14:00:00.000Z", "2026-10-16");
      vi.mocked(buildCommercialOperationGesture).mockImplementationOnce(() => {
        throw error;
      });
      await user.click(
        screen.getAllByRole("button", { name: "Salvar animal" })[0],
      );
      await waitFor(() =>
        expect(showError).toHaveBeenCalledWith(expectedMessage),
      );
      expect(
        screen.getAllByRole("button", { name: "Salvar animal" })[0],
      ).toBeEnabled();
      expect(createGesture).not.toHaveBeenCalled();
      expect(await db.state_animais.count()).toBe(0);
      expect(await db.event_eventos.count()).toBe(0);
      expect(await db.event_eventos_comercial.count()).toBe(0);
      expect(await db.queue_ops.count()).toBe(0);
      expect(await db.queue_gestures.count()).toBe(0);

      await user.click(
        screen.getAllByRole("button", { name: "Salvar animal" })[0],
      );
      await waitFor(() =>
        expect(showSuccess).toHaveBeenCalledWith(
          "Animal e compra cadastrados localmente!",
        ),
      );
      expect(createGesture).toHaveBeenCalledTimes(1);
      expect(await db.state_animais.count()).toBe(1);
      expect(await db.queue_gestures.count()).toBe(1);
    },
  );

  it("cadastra nascimento de hoje sem fabricar Evento comercial", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-16T08:00:00.000Z"));
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AnimalNovo />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText(/Identificação/), {
      target: { value: "B04-NASC" },
    });
    await user.click(screen.getByRole("tab", { name: "Origem" }));
    await user.click(
      screen.getByRole("button", { name: "Nascimento" }),
    );
    fireEvent.change(screen.getByLabelText("Data de Nascimento"), {
      target: { value: "2026-10-16" },
    });
    await user.click(
      screen.getAllByRole("button", { name: "Salvar animal" })[0],
    );
    await waitFor(() =>
      expect(showSuccess).toHaveBeenCalledWith("Animal cadastrado localmente!"),
    );
    expect(await db.state_animais.count()).toBe(1);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.event_eventos_comercial.count()).toBe(0);
  });
});
