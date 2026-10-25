// @vitest-environment jsdom
import "fake-indexeddb/auto";
import Dexie from "dexie";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Component, StrictMode, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({
  value: {
    activeFarmId: "A" as string | null,
    role: "owner" as string | null,
    user: { id: "user-1" } as { id: string } | null,
    session: { user: { id: "user-1" } } as object | null,
    localOwnership: { status: "OWNED" },
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth.value }));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/offline/pull", () => ({
  pullDataForFarm: vi.fn(async () => undefined),
}));
vi.mock("@/lib/sanitario/catalog/products", () => ({
  refreshVeterinaryProductsCatalog: vi.fn(async () => undefined),
}));
vi.mock("@/utils/toast", () => ({ showError: vi.fn(), showSuccess: vi.fn() }));
import Insumos from "../../Insumos";
import { db } from "@/lib/offline/db";
import { fixture } from "./fixtures/inventoryProjection.inputs";
import { deferred } from "./fixtures/inventorySnapshotHarness";

function view() {
  return (
    <MemoryRouter>
      <Insumos />
    </MemoryRouter>
  );
}
async function seedFarm(farm: string) {
  const data = fixture();
  await db.state_insumos.bulkPut(
    data.insumos.map((row) => ({
      ...row,
      id: `${farm}-${row.id}`,
      fazenda_id: farm,
      nome: `${row.nome}-${farm}`,
    })),
  );
  await db.state_insumo_apresentacoes.bulkPut(
    data.apresentacoes.map((row) => ({
      ...row,
      id: `${farm}-${row.id}`,
      insumo_id: `${farm}-${row.insumo_id}`,
      fazenda_id: farm,
    })),
  );
  await db.state_insumo_lotes.bulkPut(
    data.lotes.map((row) => ({
      ...row,
      id: `${farm}-${row.id}`,
      insumo_id: `${farm}-${row.insumo_id}`,
      apresentacao_id: row.apresentacao_id
        ? `${farm}-${row.apresentacao_id}`
        : null,
      fazenda_id: farm,
    })),
  );
}
beforeEach(async () => {
  await db.open();
  auth.value = {
    activeFarmId: "A",
    role: "owner",
    user: { id: "user-1" },
    session: { user: { id: "user-1" } },
    localOwnership: { status: "OWNED" },
  };
  await seedFarm("A");
  await seedFarm("B");
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await db.delete();
});
it("never displays the A snapshot after selecting B while the real B read is pending", async () => {
  db.close();
  const release = deferred<void>();
  const started = deferred<void>();
  db.use({
    stack: "dbcore",
    name: "hold-B",
    create: (down) => ({
      ...down,
      table: (name) => {
        const table = down.table(name);
        return {
          ...table,
          query: (req) => {
            const result = table.query(req);
            if (name === "state_insumos" && req.query.range.lower === "B")
              return result.then((rows) => {
                started.resolve();
                return release.promise.then(() => rows);
              });
            return result;
          },
        };
      },
    }),
  });
  await db.open();
  const { rerender } = render(view());
  await screen.findAllByText("Sal-A");
  auth.value = { ...auth.value, activeFarmId: "B" };
  rerender(view());
  await started.promise;
  expect(screen.queryAllByText("Sal-A")).toHaveLength(0);
  await act(async () => {
    release.resolve();
  });
  await screen.findAllByText("Sal-B");
});
it("clears the A search/form context on A to B but preserves it on same-farm rerenders", async () => {
  const { rerender } = render(view());
  await screen.findAllByText("Sal-A");
  const search = screen.getByPlaceholderText(/Buscar insumo/i);
  fireEvent.change(search, { target: { value: "A-only" } });
  rerender(view());
  expect(
    (screen.getByPlaceholderText(/Buscar insumo/i) as HTMLInputElement).value,
  ).toBe("A-only");
  auth.value = { ...auth.value, activeFarmId: "B" };
  rerender(view());
  expect(
    (screen.getByPlaceholderText(/Buscar insumo/i) as HTMLInputElement).value,
  ).toBe("");
});

it("preserves a filled entry form on same-farm renders and discards it on farm switch", async () => {
  const { rerender } = render(view());
  await screen.findAllByText("Sal-A");
  const local = screen.getByPlaceholderText(
    "Ex.: deposito, sala de medicamentos",
  );
  fireEvent.change(local, { target: { value: "Deposito-A" } });
  rerender(view());
  expect(
    (
      screen.getByPlaceholderText(
        "Ex.: deposito, sala de medicamentos",
      ) as HTMLInputElement
    ).value,
  ).toBe("Deposito-A");
  auth.value = { ...auth.value, activeFarmId: "B" };
  rerender(view());
  expect(
    (
      screen.getByPlaceholderText(
        "Ex.: deposito, sala de medicamentos",
      ) as HTMLInputElement
    ).value,
  ).toBe("");
});
it("discards snapshots and forms on session loss and recovers on authentication", async () => {
  const { rerender } = render(view());
  await screen.findAllByText("Sal-A");
  fireEvent.change(
    screen.getByPlaceholderText("Ex.: deposito, sala de medicamentos"),
    { target: { value: "Deposito-A" } },
  );
  auth.value = { ...auth.value, session: null, user: null };
  rerender(view());
  expect(screen.queryAllByText("Sal-A")).toHaveLength(0);
  expect(screen.getByText("Sessão indisponível")).toBeTruthy();
  auth.value = {
    ...auth.value,
    session: { user: { id: "user-2" } },
    user: { id: "user-2" },
  };
  rerender(view());
  await screen.findAllByText("Sal-A");
  expect(
    (
      screen.getByPlaceholderText(
        "Ex.: deposito, sala de medicamentos",
      ) as HTMLInputElement
    ).value,
  ).toBe("");
});
it("renders no previous snapshot with no active farm and resumes after rapid A-B-A", async () => {
  const { rerender } = render(<StrictMode>{view()}</StrictMode>);
  await screen.findAllByText("Sal-A");
  auth.value = { ...auth.value, activeFarmId: "B" };
  rerender(<StrictMode>{view()}</StrictMode>);
  auth.value = { ...auth.value, activeFarmId: null };
  rerender(<StrictMode>{view()}</StrictMode>);
  expect(screen.queryAllByText("Sal-A")).toHaveLength(0);
  expect(screen.queryAllByText("Sal-B")).toHaveLength(0);
  auth.value = { ...auth.value, activeFarmId: "A" };
  rerender(<StrictMode>{view()}</StrictMode>);
  await screen.findAllByText("Sal-A");
  expect(screen.queryAllByText("Sal-B")).toHaveLength(0);
});
it("keeps a correct farm form through role loading, offline and reconnect", async () => {
  const { rerender } = render(view());
  await screen.findAllByText("Sal-A");
  fireEvent.change(
    screen.getByPlaceholderText("Ex.: deposito, sala de medicamentos"),
    { target: { value: "Deposito-A" } },
  );
  for (const role of [null, "cowboy", "manager", "owner"]) {
    auth.value = { ...auth.value, role };
    rerender(view());
    const field = screen.getByPlaceholderText(
      "Ex.: deposito, sala de medicamentos",
    ) as HTMLInputElement;
    expect(field.value).toBe("Deposito-A");
    expect(field.disabled).toBe(role !== "owner" && role !== "manager");
  }
  act(() => {
    window.dispatchEvent(new Event("offline"));
    window.dispatchEvent(new Event("online"));
  });
  await act(async () => {
    await db.state_insumos.update("A-a", { nome: "Sal-A-reconectado" });
  });
  await screen.findAllByText("Sal-A-reconectado");
  // Existing subscription remains usable regardless of network events.
  await waitFor(() =>
    expect(
      (
        screen.getByPlaceholderText(
          "Ex.: deposito, sala de medicamentos",
        ) as HTMLInputElement
      ).value,
    ).toBe("Deposito-A"),
  );
});

it("saves an actual lot edit under StrictMode and discards its selection on farm switch", async () => {
  const { rerender } = render(<StrictMode>{view()}</StrictMode>);
  await screen.findAllByText("Sal-A");
  fireEvent.click(
    screen.getAllByRole("button", { name: "Editar cadastro do lote" })[0],
  );
  fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
  await waitFor(async () => expect(await db.queue_gestures.count()).toBe(1));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Salvar cadastro" }),
    ).toBeNull(),
  );
  fireEvent.click(
    screen.getAllByRole("button", { name: "Editar cadastro do lote" })[0],
  );
  auth.value = { ...auth.value, activeFarmId: "B" };
  rerender(<StrictMode>{view()}</StrictMode>);
  expect(screen.queryByRole("button", { name: "Salvar cadastro" })).toBeNull();
  await screen.findAllByText("Sal-B");
  expect(await db.queue_gestures.count()).toBe(1);
});
it("rejects the actual page command if the farm changes during its asynchronous lookup", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const { rerender } = render(view());
  await screen.findAllByText("Sal-A");
  const started = deferred<void>();
  const release = deferred<void>();
  const get = db.queue_gestures.get.bind(db.queue_gestures);
  vi.spyOn(db.queue_gestures, "get").mockImplementationOnce((key) =>
    Dexie.Promise.resolve(get(key)).then((result) => {
      started.resolve();
      return Dexie.Promise.resolve(release.promise).then(() => result);
    }),
  );
  fireEvent.click(
    screen.getAllByRole("button", { name: "Editar cadastro do lote" })[0],
  );
  fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
  await started.promise;
  auth.value = { ...auth.value, activeFarmId: "B" };
  rerender(view());
  await act(async () => {
    release.resolve();
  });
  await screen.findAllByText("Sal-B");
  expect(await db.queue_gestures.count()).toBe(0);
  expect(await db.queue_ops.count()).toBe(0);
  expect((await db.state_insumo_lotes.get("A-a1"))!.fazenda_id).toBe("A");
});

it("ignores a late A response after B is active and permits a fresh A on A-B-A", async () => {
  db.close();
  const started = deferred<void>();
  const release = deferred<void>();
  let held = false;
  const middleware = {
    stack: "dbcore" as const,
    name: "late-A",
    create: (down: import("dexie").DBCore) => ({
      ...down,
      table: (name: string) => {
        const table = down.table(name);
        return {
          ...table,
          query: (req: import("dexie").DBCoreQueryRequest) => {
            const result = table.query(req);
            if (
              name === "state_insumos" &&
              req.query.range.lower === "A" &&
              !held
            ) {
              held = true;
              return result.then((rows) => {
                started.resolve();
                return release.promise.then(() => rows);
              });
            }
            return result;
          },
        };
      },
    }),
  };
  db.use(middleware);
  await db.open();
  try {
    const { rerender } = render(view());
    await started.promise;
    auth.value = { ...auth.value, activeFarmId: "B" };
    rerender(view());
    await screen.findAllByText("Sal-B");
    expect(screen.queryAllByText("Sal-A")).toHaveLength(0);
    auth.value = { ...auth.value, activeFarmId: "A" };
    rerender(view());
    await screen.findAllByText("Sal-A");
    await act(async () => {
      release.resolve();
    });
    expect(screen.queryAllByText("Sal-B")).toHaveLength(0);
    await db.state_insumos.update("A-a", { nome: "A-fresh" });
    await screen.findAllByText("A-fresh");
  } finally {
    release.resolve();
    db.unuse(middleware);
  }
});
class ReadBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <span role="alert">Query failed</span>
    ) : (
      this.props.children
    );
  }
}
it("recovers the actual page after a Dexie read failure and boundary remount", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  db.close();
  let fail = true;
  const middleware = {
    stack: "dbcore" as const,
    name: "fail-read",
    create: (down: import("dexie").DBCore) => ({
      ...down,
      table: (name: string) => {
        const table = down.table(name);
        return {
          ...table,
          query: (req: import("dexie").DBCoreQueryRequest) =>
            table.query(req).then((rows) => {
              if (name === "state_insumos" && fail)
                throw new Error("read failure");
              return rows;
            }),
        };
      },
    }),
  };
  db.use(middleware);
  await db.open();
  try {
    const { rerender } = render(
      <ReadBoundary key="failed">{view()}</ReadBoundary>,
    );
    await screen.findByRole("alert");
    expect(screen.queryAllByText("Sal-A")).toHaveLength(0);
    fail = false;
    rerender(<ReadBoundary key="recovered">{view()}</ReadBoundary>);
    await screen.findAllByText("Sal-A");
  } finally {
    db.unuse(middleware);
  }
});
