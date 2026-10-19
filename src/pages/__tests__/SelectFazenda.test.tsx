/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import "fake-indexeddb/auto";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import SelectFazenda from "@/pages/SelectFazenda";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

const membership = {
  role: "manager",
  fazendas: {
    id: "farm-1",
    nome: "Fazenda Boa Vista",
    municipio: "Rio Verde",
    estado: "GO",
    area_total_ha: 1280,
    tipo_producao: "corte",
    sistema_manejo: "pastagem",
  },
};
type Result = { data: unknown; error: unknown; status?: number };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("SelectFazenda", () => {
  const setActiveFarm = vi.fn();
  const signOut = vi.fn();
  const query = vi.fn<() => Promise<Result>>();
  const eq = vi.fn();
  const is = vi.fn();
  const abortSignal = vi.fn();

  function setUser(id: string | null = "user-1") {
    vi.mocked(useAuth).mockReturnValue({
      user: id ? { id, email: `${id}@fazenda.test` } : null,
      signOut,
      setActiveFarm,
    } as ReturnType<typeof useAuth>);
  }
  function permission(result: Result | Promise<Result>) {
    vi.mocked(supabase.rpc).mockReturnValue(
      Promise.resolve(result) as ReturnType<typeof supabase.rpc>,
    );
  }
  function page() {
    return (
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <SelectFazenda />
      </MemoryRouter>
    );
  }
  beforeEach(() => {
    vi.resetAllMocks();
    setUser();
    setActiveFarm.mockResolvedValue(undefined);
    query.mockResolvedValue({ data: [], error: null });
    permission({ data: false, error: null });
    const builder = {
      select: vi.fn().mockReturnThis(),
      eq: eq.mockReturnThis(),
      is: is.mockReturnThis(),
      abortSignal: abortSignal.mockReturnThis(),
      then: (
        resolve: (result: Result) => unknown,
        reject: (error: unknown) => unknown,
      ) => query().then(resolve, reject),
    };
    vi.mocked(supabase.from).mockReturnValue(
      builder as unknown as ReturnType<typeof supabase.from>,
    );
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("distingue carregamento de ausencia real e permite criacao somente apos confirmacao", async () => {
    const pending = deferred<Result>();
    query.mockReturnValue(pending.promise);
    permission({ data: true, error: null });
    render(page());
    expect(screen.getByText("Carregando fazendas...")).toBeInTheDocument();
    expect(
      screen.queryByText("Nenhuma fazenda vinculada"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/0 fazenda/)).not.toBeInTheDocument();
    await act(async () => pending.resolve({ data: [], error: null }));
    expect(
      await screen.findByText("Nenhuma fazenda vinculada"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Aceite um convite ou crie a primeira fazenda/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Criar nova fazenda" }),
    ).toHaveLength(2);
    fireEvent.click(
      screen.getAllByRole("button", { name: "Criar nova fazenda" })[0],
    );
    expect(mockNavigate).toHaveBeenCalledWith("/criar-fazenda");
  });

  it("seleciona somente memberships validos e preserva a navegacao", async () => {
    query.mockResolvedValue({
      data: [
        membership,
        { ...membership, role: "outsider" },
        { role: "owner", fazendas: null },
      ],
      error: null,
    });
    render(page());
    const button = await screen.findByRole("button", {
      name: /Fazenda Boa Vista/i,
    });
    expect(
      screen.getAllByRole("button", { name: /Fazenda Boa Vista/i }),
    ).toHaveLength(1);
    expect(screen.getByText("Rio Verde - GO")).toBeInTheDocument();
    expect(screen.getByText("1.280 ha")).toBeInTheDocument();
    expect(screen.getByText("Corte")).toBeInTheDocument();
    expect(screen.getByText("Pastagem")).toBeInTheDocument();
    expect(supabase.from).toHaveBeenCalledWith("user_fazendas");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(is).toHaveBeenCalledWith("deleted_at", null);
    fireEvent.click(button);
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith("/home", { replace: true }),
    );
    expect(setActiveFarm).toHaveBeenCalledExactlyOnceWith("farm-1");
  });

  it.each([
    [
      "HTTP 503",
      { data: null, error: { message: "Unavailable" }, status: 503 },
    ],
    [
      "HTTP 401",
      { data: null, error: { message: "JWT expired" }, status: 401 },
    ],
    [
      "erro com dados parciais",
      { data: [membership], error: { message: "Unavailable" } },
    ],
    ["resposta sem dados", { data: null, error: null }],
  ])("mostra falha sem lista vazia em %s", async (_label, result) => {
    query.mockResolvedValue(result);
    render(page());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível carregar suas fazendas",
    );
    expect(
      screen.getByRole("button", { name: "Tentar novamente" }),
    ).toBeEnabled();
    expect(
      screen.queryByText("Nenhuma fazenda vinculada"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/0 fazenda/)).not.toBeInTheDocument();
    expect(screen.queryByText("Fazenda Boa Vista")).not.toBeInTheDocument();
    expect(setActiveFarm).not.toHaveBeenCalled();
  });

  it("trata rejeicao de rede como falha", async () => {
    query.mockRejectedValue(new TypeError("Failed to fetch"));
    render(page());
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(
      screen.queryByText("Nenhuma fazenda vinculada"),
    ).not.toBeInTheDocument();
  });

  it("recupera com retry e mantem feedback em falhas repetidas sem duplicar consultas", async () => {
    const pending = deferred<Result>();
    query
      .mockResolvedValueOnce({ data: null, error: { message: "Unavailable" } })
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce({ data: [membership], error: null });
    render(page());
    const retry = await screen.findByRole("button", {
      name: "Tentar novamente",
    });
    fireEvent.click(retry);
    fireEvent.click(retry);
    expect(screen.getByText("Carregando fazendas...")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Tentar novamente" }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2));
    await act(async () =>
      pending.resolve({ data: null, error: { message: "Still unavailable" } }),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(
      await screen.findByRole("button", { name: /Fazenda Boa Vista/i }),
    ).toBeInTheDocument();
    expect(query).toHaveBeenCalledTimes(3);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it("encerra consulta travada e ignora resposta apos timeout", async () => {
    vi.useFakeTimers();
    const pending = deferred<Result>();
    query.mockReturnValue(pending.promise);
    render(page());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(abortSignal.mock.calls[0][0].aborted).toBe(true);
    await act(async () => pending.resolve({ data: [membership], error: null }));
    expect(screen.queryByText("Fazenda Boa Vista")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Nenhuma fazenda vinculada"),
    ).not.toBeInTheDocument();
  });

  it("descarta vinculos e permissao tardios ao trocar usuario", async () => {
    const previousFarms = deferred<Result>();
    const previousPermission = deferred<Result>();
    query
      .mockReturnValueOnce(previousFarms.promise)
      .mockResolvedValue({ data: [], error: null });
    permission(previousPermission.promise);
    const view = render(page());
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1));
    setUser("user-2");
    permission({ data: false, error: null });
    view.rerender(page());
    expect(
      await screen.findByText("Nenhuma fazenda vinculada"),
    ).toBeInTheDocument();
    await act(async () => {
      previousFarms.resolve({ data: [membership], error: null });
      previousPermission.resolve({ data: true, error: null });
    });
    expect(screen.queryByText("Fazenda Boa Vista")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Criar nova fazenda" }),
    ).not.toBeInTheDocument();
    expect(eq).toHaveBeenLastCalledWith("user_id", "user-2");
  });

  it("remove imediatamente dados e permissao ja carregados na troca de usuario", async () => {
    query.mockResolvedValueOnce({ data: [membership], error: null });
    permission({ data: true, error: null });
    const view = render(page());
    await screen.findByRole("button", { name: /Fazenda Boa Vista/i });
    expect(
      screen.getByRole("button", { name: "Criar nova fazenda" }),
    ).toBeInTheDocument();
    setUser("user-2");
    query.mockReturnValue(new Promise(() => {}));
    permission(new Promise(() => {}));
    view.rerender(page());
    expect(screen.queryByText("Fazenda Boa Vista")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Criar nova fazenda" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Carregando fazendas...")).toBeInTheDocument();
  });

  it("nao exibe vinculos quando a sessao e removida durante a consulta", async () => {
    const pending = deferred<Result>();
    query.mockReturnValue(pending.promise);
    const view = render(page());
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1));
    setUser(null);
    view.rerender(page());
    await act(async () => pending.resolve({ data: [membership], error: null }));
    expect(screen.queryByText("Fazenda Boa Vista")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Nenhuma fazenda vinculada"),
    ).not.toBeInTheDocument();
    expect(query).toHaveBeenCalledTimes(1);
    expect(setActiveFarm).not.toHaveBeenCalled();
  });

  it("revalida lista e permissao na atualizacao da sessao do mesmo usuario", async () => {
    permission({ data: true, error: null });
    const view = render(page());
    await screen.findByText("Nenhuma fazenda vinculada");
    expect(
      screen.getAllByRole("button", { name: "Criar nova fazenda" }),
    ).toHaveLength(2);
    setUser();
    query.mockReturnValue(new Promise(() => {}));
    permission(new Promise(() => {}));
    view.rerender(page());
    expect(
      screen.queryByRole("button", { name: "Criar nova fazenda" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Carregando fazendas...")).toBeInTheDocument();
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2));
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it.each(["erro", "excecao", "valor nao booleano", "pendente"])(
    "nao presume criacao autorizada com permissao: %s",
    async (scenario) => {
      if (scenario === "excecao") {
        vi.mocked(supabase.rpc).mockRejectedValue(
          new Error("Network unavailable"),
        );
      } else if (scenario === "pendente") {
        permission(new Promise(() => {}));
      } else {
        permission({
          data: scenario === "erro" ? true : "true",
          error: scenario === "erro" ? { message: "Unavailable" } : null,
        });
      }
      render(page());
      await screen.findByText("Nenhuma fazenda vinculada");
      expect(
        screen.queryByRole("button", { name: "Criar nova fazenda" }),
      ).not.toBeInTheDocument();
    },
  );
});
