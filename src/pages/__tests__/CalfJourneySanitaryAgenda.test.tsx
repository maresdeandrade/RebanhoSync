/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  beforeEach,
  afterEach,
  it,
  expect,
  vi,
  type MockInstance,
} from "vitest";
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: "ui-i03" } } },
        error: null,
      })),
    },
  },
}));
vi.mock("@/utils/toast", () => ({ showSuccess: vi.fn(), showError: vi.fn() }));
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/offline/db";
import { establishLocalOwnership } from "@/lib/offline/ownership";
import * as localReadBoundary from "@/lib/offline/localReadBoundary";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { showError } from "@/utils/toast";
import AnimalPosParto from "../AnimalPosParto";
import AnimalCriaInicial from "../AnimalCriaInicial";
import type { Animal, SanitarioAgendaLocalV2 } from "@/lib/offline/types";

const farm = "11111111-1111-4111-8111-111111111111";
const calf = "22222222-2222-4222-8222-222222222222";
const mother = "33333333-3333-4333-8333-333333333333";
let consoleErrors: MockInstance<typeof console.error>;
let queryWaitController: AbortController;
let pendingQueryTurn: Promise<void> | undefined;
beforeEach(async () => {
  queryWaitController = new AbortController();
  pendingQueryTurn = undefined;
  for (const table of db.tables) await table.clear();
  localStorage.clear();
  vi.clearAllMocks();
  // Keep console output intact; act warnings must fail the test, not be hidden.
  consoleErrors = vi.spyOn(console, "error");
  vi.mocked(useAuth).mockReturnValue({
    activeFarmId: farm,
    user: { id: "ui-i03" },
    role: "owner",
    farmMeasurementConfig: { weight_unit: "kg" },
    farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
  } as ReturnType<typeof useAuth>);
  await establishLocalOwnership({ user: { id: "ui-i03" } } as never);
  const base = {
    fazenda_id: farm,
    identificacao: "CRIA-I03",
    sexo: "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: "2026-04-01",
    revision: 1,
    payload: { generated_from: "evento_parto", birth_event_id: "birth-i03" },
  };
  await db.state_animais.bulkPut([
    { ...base, id: calf, mae_id: mother },
    { ...base, id: mother, identificacao: "MAE-I03", payload: {} },
  ] as Animal[]);
});
afterEach(async () => {
  queryWaitController.abort();
  await pendingQueryTurn;
  await act(async () => {
    cleanup();
  });
  const actWarnings = consoleErrors.mock.calls
    .map((args) => args.join(" "))
    .filter((message) => /act\(/.test(message));
  vi.restoreAllMocks();
  expect(actWarnings).toEqual([]);
});
function open(kind: "postpartum" | "calf") {
  render(
    <MemoryRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      initialEntries={[
        kind === "postpartum"
          ? `/animais/${mother}/pos-parto?cria=${calf}`
          : `/animais/${calf}/cria-inicial`,
      ]}
    >
      <Routes>
        <Route path="/animais/:id/pos-parto" element={<AnimalPosParto />} />
        <Route
          path="/animais/:id/cria-inicial"
          element={<AnimalCriaInicial />}
        />
      </Routes>
    </MemoryRouter>,
  );
}
it.each(["postpartum", "calf"] as const)(
  "%s recognizes V2 intentions and directs them to the Central",
  async (kind) => {
    await db.ops_sanitario_agenda_v2.put({
      id: "v2-i03",
      fazenda_id: farm,
      status: "programada",
      data_programada: "2026-04-04",
      acao_sanitaria: "revisao_neonatal",
      dedup_key: "calf-journey-review",
      client_id: "ui",
      client_op_id: "ui-op",
      client_tx_id: null,
      client_recorded_at: "2026-04-01T12:00:00Z",
      server_received_at: "2026-04-01T12:00:00Z",
      created_at: "2026-04-01T12:00:00Z",
      updated_at: "2026-04-01T12:00:00Z",
      deleted_at: null,
      source_demand_key: null,
      preview_group_id: null,
      protocolo_id: null,
      protocol_item_version_id: null,
      protocol_item_snapshot: {},
      janela_inicio: "2026-04-04",
      janela_fim: null,
      lote_id: null,
      produto_veterinario_id: null,
      produto_snapshot: {},
      produto_classe: null,
      execution_evento_id: null,
      metadata: { journey: "cria", milestone_label: "Revisao neonatal" },
    } as SanitarioAgendaLocalV2);
    await db.ops_sanitario_agenda_animais_v2.put({
      agenda_id: "v2-i03",
      animal_id: calf,
      fazenda_id: farm,
      planned_status: "planejado",
      execution_evento_id: null,
      not_executed_reason: null,
      metadata: {},
      created_at: "2026-04-01T12:00:00Z",
      updated_at: "2026-04-01T12:00:00Z",
    });
    // A visible link precedes the asynchronous Dexie result. Observe the real
    // authorized query instead of racing its publication against findBy's timer.
    let queryCompleted = false;
    const read = localReadBoundary.readTenantSensitive;
    vi.spyOn(localReadBoundary, "readTenantSensitive").mockImplementation(
      async (query) => {
        const result = await read(query);
        if (Array.isArray(result) && result.some((row) => row?.id === "v2-i03"))
          queryCompleted = true;
        return result;
      },
    );
    await act(async () => {
      open(kind);
    });
    // Flush each React turn while IndexedDB progresses: awaiting the whole query
    // inside one act would prevent parent queries from mounting this child.
    const signal = queryWaitController.signal;
    while (!queryCompleted && !signal.aborted) {
      pendingQueryTurn = Promise.resolve(
        act(async () => {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }),
      );
      await pendingQueryTurn;
    }
    if (signal.aborted) return;
    expect(
      screen.getByRole("link", { name: /Abrir Central Sanitária/i }),
    ).toHaveAttribute("href", "/protocolos-sanitarios?tab=agenda");
    expect(
      screen.getByText(/1 atividade\(s\) sanitária\(s\)/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Registrar cura do umbigo/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Registrar manejo na Central Sanitária/i })).toHaveAttribute("href", `/protocolos-sanitarios?tab=agenda&animalId=${calf}`);
  },
);
it.each(["postpartum", "calf"] as const)(
  "%s reports gate OFF while preserving the valid local record",
  async (kind) => {
    open(kind);
    const button = await screen.findByRole("button", {
      name:
        kind === "postpartum" ? "Registrar pós-parto" : "Salvar ficha inicial",
    });
    await waitFor(() => expect(button).toBeEnabled());
    await act(async () => {
      fireEvent.click(button);
      await vi.waitFor(() =>
        expect(showError).toHaveBeenCalledWith(
          expect.stringMatching(/planejamento sanitário.*indisponível/i),
        ),
      );
      expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
      expect(
        (
          (await db.state_animais.get(calf))?.payload.neonatal_setup as Record<
            string,
            unknown
          >
        )?.completed_at,
      ).toBeTruthy();
      expect(
        (await db.queue_ops.toArray()).filter(
          (op) =>
            op.table === "agenda_itens" && op.record.dominio === "sanitario",
        ),
      ).toHaveLength(0);
      cleanup();
    });
  },
);
