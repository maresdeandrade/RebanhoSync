/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { db } from "@/lib/offline/db";
import type { Animal, Evento, EventoPesagem } from "@/lib/offline/types";
import { useAnimalWeightPresentation } from "@/hooks/useAnimalWeightPresentation";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireFarm } from "@/components/auth/RequireFarm";
import AnimalSimulacao from "../AnimalSimulacao";

const auth = vi.hoisted(() => ({
  activeFarmId: "farm-a" as string | null,
  session: { user: { id: "ux17-user" } } as { user: { id: string } } | null,
  loading: false,
  role: "manager" as string | null,
  refreshSettings: vi.fn(async () => {}),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/lib/offline/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/offline/db")>();
  return { ...actual, db: new actual.OfflineDB("UX17-isolation-test") };
});

const animalA = {
  id: "animal-a",
  fazenda_id: "farm-a",
  identificacao: "ANIMAL-A",
  deleted_at: null,
} as Animal;
const animalB = {
  id: "animal-b",
  fazenda_id: "farm-b",
  identificacao: "ANIMAL-B",
  deleted_at: null,
} as Animal;

function Harness({
  initialAnimal = "animal-a",
  guarded = false,
}: {
  initialAnimal?: string;
  guarded?: boolean;
}) {
  const page = <AnimalSimulacao />;
  return (
    <MemoryRouter initialEntries={[`/animais/${initialAnimal}/simulacao`]}>
      <Link to="/animais/animal-a/simulacao">Animal A</Link>
      <Link to="/animais/animal-b/simulacao">Animal B</Link>
      <Routes>
        <Route
          path="/animais/:id/simulacao"
          element={
            guarded ? (
              <RequireAuth>
                <RequireFarm>{page}</RequireFarm>
              </RequireAuth>
            ) : (
              page
            )
          }
        />
        <Route path="/login" element={<p>LOGIN</p>} />
        <Route path="/select-fazenda" element={<p>ESCOLHER FAZENDA</p>} />
      </Routes>
    </MemoryRouter>
  );
}

async function expectAnimal(name = "ANIMAL-A", weight = "410,0 kg") {
  await screen.findByRole(
    "heading",
    {
      name: `Simulação de Cenários — ${name}`,
    },
    { timeout: 5000 },
  );
  await screen.findAllByText(weight, {}, { timeout: 5000 });
}

function expectNoAnimal() {
  expect(
    screen.queryByTestId("productive-commercial-simulator"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: /Simulação de Cenários —/ }),
  ).not.toBeInTheDocument();
}

function fillScenario() {
  for (const [label, value] of [
    [/Peso-alvo vivo/, "600"],
    [/GMD assumido no cenário/, "1.5"],
    [/Preço por arroba/, "320"],
    [/Rendimento de carcaça/, "50"],
    [/Custo diário incremental/, "3"],
    [/Custos adicionais pontuais/, "25"],
  ] as const) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  expect(screen.queryByText("Simulação Bloqueada")).not.toBeInTheDocument();
  expect(screen.getAllByText("SIMULADO").length).toBeGreaterThan(0);
}

// Delay completion after the real IndexedDB read, without replacing useLiveQuery.
function pauseNextAnimalRead() {
  const read = db.state_animais.get.bind(db.state_animais);
  let resume!: () => void;
  let started!: () => void;
  const pending = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.spyOn(db.state_animais, "get").mockImplementationOnce(async (key) => {
    const value = await read(key as string);
    started();
    await pending;
    return value;
  });
  return { entered, resume };
}

beforeEach(async () => {
  await db.open();
  auth.activeFarmId = "farm-a";
  auth.session = { user: { id: "ux17-user" } };
  auth.role = "manager";
  auth.loading = false;
  auth.refreshSettings.mockClear();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  await db.state_animais.bulkPut([animalA, animalB]);
  const rows = [
    ["a-1", "animal-a", "farm-a", 400, 1],
    ["a-2", "animal-a", "farm-a", 410, 11],
    ["b-1", "animal-b", "farm-b", 700, 1],
    ["b-2", "animal-b", "farm-b", 720, 11],
    // Inconsistent foreign rows must not contaminate the factual history of A.
    ["foreign-event", "animal-a", "farm-b", 999, 20],
    ["foreign-detail", "animal-a", "farm-a", 888, 21],
  ] as const;
  await db.event_eventos.bulkPut(
    rows.map(
      ([id, animal_id, fazenda_id, , day]) =>
        ({
          id,
          animal_id,
          fazenda_id,
          dominio: "pesagem",
          deleted_at: null,
          occurred_at: `2026-01-${String(day).padStart(2, "0")}T12:00:00.000Z`,
        }) as Evento,
    ),
  );
  await db.event_eventos_pesagem.bulkPut(
    rows.map(
      ([evento_id, , fazenda_id, peso_kg]) =>
        ({
          evento_id,
          fazenda_id: evento_id === "foreign-detail" ? "farm-b" : fazenda_id,
          peso_kg,
          deleted_at: null,
        }) as EventoPesagem,
    ),
  );
});

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await db.delete();
});
afterAll(() => db.close());

describe("UX17 — real Dexie/IndexedDB farm isolation", () => {
  it("01: permite o animal A em A e mantém OBSERVADO/PREMISSA/SIMULADO sem escritas", async () => {
    render(<Harness />);
    await expectAnimal();
    const before = await Promise.all(db.tables.map((table) => table.toArray()));
    fillScenario();
    expect(screen.getByText("OBSERVADO")).toBeInTheDocument();
    expect(screen.getByText("PREMISSA")).toBeInTheDocument();
    const after = await Promise.all(db.tables.map((table) => table.toArray()));
    expect(after).toEqual(before);
  });

  it("02: rejeita animal A quando B está ativa", async () => {
    auth.activeFarmId = "farm-b";
    render(<Harness />);
    await screen.findByTestId("simulacao-not-found");
    expectNoAnimal();
  });

  it("03: A → B → A remove a apresentação anterior imediatamente", async () => {
    const view = render(<Harness />);
    await expectAnimal();
    const delayed = pauseNextAnimalRead();
    auth.activeFarmId = "farm-b";
    view.rerender(<Harness />);
    try {
      expectNoAnimal();
    } finally {
      delayed.resume();
    }
    await screen.findByTestId("simulacao-not-found");
    auth.activeFarmId = "farm-a";
    view.rerender(<Harness />);
    await expectAnimal();
  });

  it("04: consulta de A concluída após a troca para B não exibe A", async () => {
    const delayed = pauseNextAnimalRead();
    const view = render(<Harness />);
    await delayed.entered;
    auth.activeFarmId = "farm-b";
    view.rerender(<Harness />);
    await screen.findByTestId("simulacao-not-found");
    await act(async () => {
      delayed.resume();
    });
    expectNoAnimal();
    expect(screen.getByTestId("simulacao-not-found")).toBeInTheDocument();
  });

  it("05: troca da rota remove o animal anterior enquanto a nova consulta está pendente", async () => {
    render(<Harness />);
    await expectAnimal();
    const delayed = pauseNextAnimalRead();
    fireEvent.click(screen.getByRole("link", { name: "Animal B" }));
    try {
      expectNoAnimal();
    } finally {
      delayed.resume();
    }
    await screen.findByTestId("simulacao-not-found");
  });

  it("06: animal excluído é indisponível", async () => {
    await db.state_animais.update("animal-a", {
      deleted_at: "2026-02-01T00:00:00Z",
    });
    render(<Harness />);
    await screen.findByTestId("simulacao-not-found");
    expectNoAnimal();
  });

  it("07: retirar a fazenda ativa oculta imediatamente o animal", async () => {
    const view = render(<Harness />);
    await expectAnimal();
    auth.activeFarmId = null;
    view.rerender(<Harness />);
    expectNoAnimal();
    expect(screen.getByTestId("simulacao-loading")).toBeInTheDocument();
  });

  it("08: sem sessão o guard redireciona ao login sem ler o animal", async () => {
    auth.session = null;
    const read = vi.spyOn(db.state_animais, "get");
    render(<Harness guarded />);
    await screen.findByText("LOGIN");
    expectNoAnimal();
    expect(read).not.toHaveBeenCalled();
  });

  it("08: sem vínculo com a fazenda o guard mantém a recusa após recuperação", async () => {
    auth.role = null;
    const read = vi.spyOn(db.state_animais, "get");
    render(<Harness guarded />);
    await screen.findByText("ESCOLHER FAZENDA");
    expectNoAnimal();
    expect(read).not.toHaveBeenCalled();
    expect(auth.refreshSettings).toHaveBeenCalledOnce();
  });

  it("09: o hook real separa eventos e detalhes factuais das duas fazendas", async () => {
    const { result, unmount } = renderHook(() =>
      useAnimalWeightPresentation(animalA, "farm-a"),
    );
    await waitFor(() =>
      expect(result.current?.latestObservedWeight.status).toBe("available"),
    );
    expect(result.current?.observations.map((item) => item.weightKg)).toEqual([
      400, 410,
    ]);
    expect(result.current?.gmd).toMatchObject({
      status: "CALCULATED",
      gmdKgPerDay: 1,
      fazendaId: "farm-a",
      animalId: "animal-a",
    });
    unmount();
    const other = renderHook(() =>
      useAnimalWeightPresentation(animalB, "farm-b"),
    );
    await waitFor(() =>
      expect(other.result.current?.latestObservedWeight.status).toBe(
        "available",
      ),
    );
    expect(
      other.result.current?.observations.map((item) => item.weightKg),
    ).toEqual([700, 720]);
    expect(other.result.current?.gmd).toMatchObject({
      status: "CALCULATED",
      gmdKgPerDay: 2,
      fazendaId: "farm-b",
      animalId: "animal-b",
    });
  });

  it("10: remontagem e reabertura do IndexedDB preservam identidade e escopo", async () => {
    const first = render(<Harness />);
    await expectAnimal();
    first.unmount();
    db.close();
    await db.open();
    auth.activeFarmId = "farm-b";
    render(<Harness initialAnimal="animal-b" />);
    await expectAnimal("ANIMAL-B", "720,0 kg");
    expect(screen.queryByText("410,0 kg")).not.toBeInTheDocument();
  });

  it("09: conclusão tardia da pesagem de A não contamina o simulador de B", async () => {
    const read = db.event_eventos_pesagem.bulkGet.bind(
      db.event_eventos_pesagem,
    );
    let resume!: () => void;
    const gate = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const weightRead = vi
      .spyOn(db.event_eventos_pesagem, "bulkGet")
      .mockImplementationOnce(async (keys) => {
        const details = await read(keys);
        await gate;
        return details;
      });
    const view = render(<Harness />);
    await waitFor(() => expect(weightRead).toHaveBeenCalledOnce());
    auth.activeFarmId = "farm-b";
    view.rerender(<Harness />);
    fireEvent.click(screen.getByRole("link", { name: "Animal B" }));
    try {
      await expectAnimal("ANIMAL-B", "720,0 kg");
    } finally {
      await act(async () => {
        resume();
      });
    }
    expect(screen.queryByText("410,0 kg")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/GMD assumido no cenário/)).toHaveValue(2);
  });

  it("11: troca direta para outro animal da mesma fazenda descarta as premissas anteriores", async () => {
    await db.state_animais.put({ ...animalB, fazenda_id: "farm-a" });
    await db.event_eventos
      .where("animal_id")
      .equals("animal-b")
      .modify({ fazenda_id: "farm-a" });
    await db.event_eventos_pesagem.bulkPut([
      {
        evento_id: "b-1",
        fazenda_id: "farm-a",
        peso_kg: 700,
        deleted_at: null,
      } as EventoPesagem,
      {
        evento_id: "b-2",
        fazenda_id: "farm-a",
        peso_kg: 720,
        deleted_at: null,
      } as EventoPesagem,
    ]);
    render(<Harness />);
    await expectAnimal();
    fillScenario();
    fireEvent.click(screen.getByRole("link", { name: "Animal B" }));
    await expectAnimal("ANIMAL-B", "720,0 kg");
    expect(screen.getByLabelText(/Peso-alvo vivo/)).toHaveValue(null);
    expect(screen.getByLabelText(/Preço por arroba/)).toHaveValue(null);
    expect(screen.getByLabelText(/Rendimento de carcaça/)).toHaveValue(null);
    expect(screen.getByLabelText(/Custo diário incremental/)).toHaveValue(null);
    expect(screen.getByLabelText(/Custos adicionais pontuais/)).toHaveValue(
      null,
    );
    expect(screen.getByLabelText(/GMD assumido no cenário/)).toHaveValue(2);
    expect(screen.queryByText("SIMULADO")).not.toBeInTheDocument();
    expect(screen.queryByText("410,0 kg")).not.toBeInTheDocument();
  });

  it("11: sair e retornar à fazenda durante cenário preenchido descarta premissas", async () => {
    const view = render(<Harness />);
    await expectAnimal();
    fillScenario();
    auth.activeFarmId = "farm-b";
    view.rerender(<Harness />);
    await screen.findByTestId("simulacao-not-found");
    auth.activeFarmId = "farm-a";
    view.rerender(<Harness />);
    await expectAnimal();
    expect(screen.getByLabelText(/Peso-alvo vivo/)).toHaveValue(null);
    expect(screen.queryByText("SIMULADO")).not.toBeInTheDocument();
  });
});
