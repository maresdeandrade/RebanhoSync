/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import Login from "@/pages/Login";
import SignUp from "@/pages/SignUp";
import AcceptInvite from "@/pages/AcceptInvite";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { signInWithPassword: vi.fn(), signUp: vi.fn(), getUser: vi.fn() },
    rpc: vi.fn(),
  },
}));
const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
const token = "11111111-1111-4111-8111-111111111111";
const invitePath = `/invites/${token}`;
const query = `?${new URLSearchParams({ redirect: invitePath })}`;
const session = { user: { id: "fixture-user" } };
const preview = {
  fazenda_nome: "Fazenda de teste",
  role: "manager",
  inviter_nome: "Maria",
  expires_at: "2099-01-01",
  status: "pending",
  is_valid: true,
};
let publishSession: (session: unknown) => void;
const setActiveFarm = vi.fn();

function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">
        {location.pathname + location.search}
      </output>
      <button onClick={() => navigate(-1)}>Voltar teste</button>
    </>
  );
}
function Harness({
  entry,
  authenticated = false,
  farm = null,
}: {
  entry: string;
  authenticated?: boolean;
  farm?: string | null;
}) {
  const [currentSession, setSession] = useState<unknown>(
    authenticated ? session : null,
  );
  publishSession = setSession;
  vi.mocked(useAuth).mockReturnValue({
    session: currentSession,
    activeFarmId: farm,
    setActiveFarm,
  } as ReturnType<typeof useAuth>);
  return (
    <MemoryRouter
      initialEntries={[entry]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <LocationProbe />
      <Routes>
        <Route path="/invites/:token" element={<AcceptInvite />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/home" element={<p>Home de teste</p>} />
        <Route path="/select-fazenda" element={<p>Selecao de teste</p>} />
      </Routes>
    </MemoryRouter>
  );
}
function fillLogin() {
  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: "fixture@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: "fixture-password" },
  });
}
function fillSignup() {
  fireEvent.change(screen.getByLabelText("Nome"), {
    target: { value: "Maria Teste" },
  });
  fireEvent.change(screen.getByLabelText("E-mail"), {
    target: { value: "fixture@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Telefone"), {
    target: { value: "+5511987654321" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: "fixture-password" },
  });
  fireEvent.change(screen.getByLabelText("Confirmar Senha"), {
    target: { value: "fixture-password" },
  });
}
function expectNoAcceptance() {
  expect(
    vi
      .mocked(supabase.rpc)
      .mock.calls.filter(([name]) => name === "accept_invite"),
  ).toHaveLength(0);
  expect(setActiveFarm).not.toHaveBeenCalled();
}
async function at(path: string) {
  await waitFor(() =>
    expect(screen.getByTestId("location")).toHaveTextContent(path),
  );
}

describe("continuidade de convites na autenticacao", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: session.user },
      error: null,
    } as never);
    vi.mocked(supabase.rpc).mockImplementation(
      async (name) =>
        ({
          data: name === "get_invite_preview" ? preview : "fixture-farm",
          error: null,
        }) as never,
    );
    vi.mocked(supabase.auth.signInWithPassword).mockImplementation(async () => {
      publishSession(session);
      return { data: session, error: null } as never;
    });
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: session.user, session },
      error: null,
    } as never);
  });
  afterEach(cleanup);

  it("convite -> login -> mesmo convite, aceitando somente apos nova acao explicita", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    } as never);
    render(<Harness entry={invitePath} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Aceitar convite" }),
    );
    await at(`/login${query}`);
    fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByRole("button", { name: "Aceitar convite" });
    await at(invitePath);
    expectNoAcceptance();
    fireEvent.click(screen.getByRole("button", { name: "Aceitar convite" }));
    await at("/home");
    expect(supabase.rpc).toHaveBeenCalledWith("accept_invite", {
      _token: token,
    });
  });

  it("convite -> login -> cadastro com sessao imediata -> mesmo convite", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    } as never);
    render(<Harness entry={invitePath} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Aceitar convite" }),
    );
    await screen.findByRole("link", { name: "Cadastre-se aqui" });
    fireEvent.click(screen.getByRole("link", { name: "Cadastre-se aqui" }));
    await at(`/signup${query}`);
    fillSignup();
    fireEvent.click(screen.getByRole("button", { name: "Criar Conta" }));
    await screen.findByRole("button", { name: "Aceitar convite" });
    await at(invitePath);
    expectNoAcceptance();
  });

  it("confirmacao de email mantem contexto no link e no callback para login posterior", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: session.user, session: null },
      error: null,
    } as never);
    const view = render(<Harness entry={`/signup${query}`} />);
    fillSignup();
    fireEvent.click(screen.getByRole("button", { name: "Criar Conta" }));
    expect(
      await screen.findByText(/Verifique seu email para confirmar/),
    ).toBeInTheDocument();
    await at(`/signup${query}`);
    expectNoAcceptance();
    const options = vi.mocked(supabase.auth.signUp).mock.calls[0][0].options;
    const callback = new URL(options!.emailRedirectTo!);
    expect(callback.origin).toBe(window.location.origin);
    expect(callback.pathname + callback.search).toBe(`/login${query}`);
    expect(
      screen.getByRole("link", { name: "Faça login aqui" }),
    ).toHaveAttribute("href", `/login${query}`);
    view.unmount();
    render(<Harness entry={callback.pathname + callback.search} />);
    fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByRole("button", { name: "Aceitar convite" });
    expectNoAcceptance();
  });

  it.each(["/login", "/signup"])(
    "usuario autenticado em %s retorna ao convite",
    async (path) => {
      render(
        <Harness entry={path + query} authenticated farm="existing-farm" />,
      );
      await screen.findByRole("button", { name: "Aceitar convite" });
      await at(invitePath);
      expectNoAcceptance();
    },
  );
  it("usuario autenticado abre convite diretamente sem aceite automatico", async () => {
    render(<Harness entry={invitePath} authenticated />);
    await screen.findByRole("button", { name: "Aceitar convite" });
    expectNoAcceptance();
  });
  it.each([
    ["/login", null, "/select-fazenda"],
    ["/login", "farm", "/home"],
    ["/signup", null, "/select-fazenda"],
    ["/signup", "farm", "/home"],
  ])(
    "preserva destino normal %s com fazenda %s",
    async (path, farm, target) => {
      render(<Harness entry={path!} authenticated farm={farm} />);
      await at(target!);
      expectNoAcceptance();
    },
  );
  it("login normal apos autenticacao preserva selecao de fazenda", async () => {
    render(<Harness entry="/login" />);
    fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await at("/select-fazenda");
  });
  it("cadastro normal com sessao imediata preserva selecao de fazenda e options", async () => {
    render(<Harness entry="/signup" />);
    fillSignup();
    fireEvent.click(screen.getByRole("button", { name: "Criar Conta" }));
    await at("/select-fazenda");
    expect(
      vi.mocked(supabase.auth.signUp).mock.calls[0][0].options,
    ).not.toHaveProperty("emailRedirectTo");
  });
  it.each([
    "https://example.test/evil",
    "//example.test/evil",
    invitePath + "?evil",
    "%2Finvites%2Fbad",
  ])(
    "rejeita redirect invalido %s sem transportar para cadastro",
    async (redirect) => {
      render(<Harness entry={`/login?${new URLSearchParams({ redirect })}`} />);
      expect(
        screen.getByRole("link", { name: "Cadastre-se aqui" }),
      ).toHaveAttribute("href", "/signup");
      fillLogin();
      fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
      await at("/select-fazenda");
      expectNoAcceptance();
    },
  );
  it("erro de login mantem campos e destino para tentar novamente", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: {},
      error: { message: "Credenciais invalidas" },
    } as never);
    render(<Harness entry={`/login${query}`} />);
    fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Credenciais invalidas",
    );
    expect(screen.getByLabelText("E-mail")).toHaveValue("fixture@example.test");
    await at(`/login${query}`);
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByRole("button", { name: "Aceitar convite" });
    expectNoAcceptance();
  });
  it("erro de cadastro preserva destino e permite nova tentativa", async () => {
    vi.mocked(supabase.auth.signUp).mockRejectedValueOnce(
      new Error("Cadastro indisponivel"),
    );
    render(<Harness entry={`/signup${query}`} />);
    fillSignup();
    fireEvent.click(screen.getByRole("button", { name: "Criar Conta" }));
    await screen.findByText("Cadastro indisponivel");
    await at(`/signup${query}`);
    fireEvent.click(screen.getByRole("button", { name: "Criar Conta" }));
    await screen.findByRole("button", { name: "Aceitar convite" });
    expectNoAcceptance();
  });
  it.each(["expired", "accepted"])(
    "preserva aviso de convite %s sem aceitar",
    async (status) => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { ...preview, status, is_valid: false },
        error: null,
      } as never);
      render(<Harness entry={invitePath} authenticated />);
      await screen.findByText("Convite expirado ou ja utilizado");
      expect(
        screen.queryByRole("button", { name: "Aceitar convite" }),
      ).not.toBeInTheDocument();
      expectNoAcceptance();
    },
  );
  it("preserva erro de convite inexistente sem aceitar", async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: null,
    } as never);
    render(<Harness entry={invitePath} authenticated />);
    await screen.findByText("Convite nao encontrado.");
    expectNoAcceptance();
  });
  it.each([
    ["email does not match", "Este convite foi enviado para outro e-mail"],
    ["phone does not match", "Seu telefone nao corresponde"],
    ["already a member", "Voce ja faz parte desta fazenda"],
  ])("mantem mensagem da RPC: %s", async (message, expected) => {
    vi.mocked(supabase.rpc).mockImplementation(
      async (name) =>
        ({
          data: name === "get_invite_preview" ? preview : null,
          error: name === "accept_invite" ? { message } : null,
        }) as never,
    );
    render(<Harness entry={invitePath} authenticated />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Aceitar convite" }),
    );
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining(expected),
        }),
      ),
    );
    await at(invitePath);
    expect(setActiveFarm).not.toHaveBeenCalled();
  });
  it("ida, volta e repeticao entre formularios preservam convite sem loops", async () => {
    render(<Harness entry={`/login${query}`} />);
    for (let step = 0; step < 2; step++) {
      fireEvent.click(screen.getByRole("link", { name: "Cadastre-se aqui" }));
      await at(`/signup${query}`);
      fireEvent.click(screen.getByRole("button", { name: "Voltar teste" }));
      await at(`/login${query}`);
    }
    fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
    await screen.findByRole("button", { name: "Aceitar convite" });
    await act(async () => publishSession(session));
    await at(invitePath);
    expectNoAcceptance();
  });
});
