/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMemoryRouter,
  Link,
  RouterProvider,
  useLocation,
} from "react-router-dom";

import EditarFazenda from "@/pages/EditarFazenda";

const mocks = vi.hoisted(() => ({
  role: "owner" as "owner" | "manager" | "cowboy" | null,
  metadata: {} as Record<string, unknown>,
  from: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
  save: vi.fn(),
  refreshSettings: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    activeFarmId: "farm-1",
    role: mocks.role,
    loading: false,
    refreshSettings: mocks.refreshSettings,
  }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: mocks.from },
}));

const names = [
  "Modo essencial",
  "Validacao forte",
  "Movimentacao consistente",
] as const;

async function renderPage() {
  const router = createMemoryRouter(
    [{ path: '*', element: <EditarFazenda /> }],
    { initialEntries: ['/editar-fazenda'] },
  );
  const result = render(
    <RouterProvider router={router} />,
  );
  await screen.findByRole("button", { name: "Salvar fazenda" });
  return result;
}

function RouteMarker() {
  const location = useLocation();
  return <output data-testid="current-route">{location.pathname}</output>;
}

async function renderPageWithHomeRoute() {
  const router = createMemoryRouter(
    [
      {
        path: "/editar-fazenda",
        element: (
          <>
            <Link to="/home">Abrir home</Link>
            <EditarFazenda />
          </>
        ),
      },
      { path: "/home", element: <RouteMarker /> },
    ],
    { initialEntries: ["/editar-fazenda"] },
  );
  render(<RouterProvider router={router} />);
  await screen.findByRole("button", { name: "Salvar fazenda" });
  return router;
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom nao implementa a medicao usada pelo input interno do Radix.
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  mocks.role = "owner";
  mocks.metadata = {};
  mocks.single.mockImplementation(async () => ({
    data: { nome: "Fazenda teste", metadata: mocks.metadata, updated_at: "2026-11-20T00:00:00Z" },
    error: null,
  }));
  mocks.save.mockResolvedValue({ data: {metadata:{},updated_at:"2026-11-20T00:00:01Z"}, error: null });
  const writeQuery = {eq: () => writeQuery, select: () => writeQuery, single: mocks.save};
  mocks.update.mockReturnValue(writeQuery);
  mocks.from.mockReturnValue({
    select: () => ({ eq: () => ({ single: mocks.single }) }),
    update: mocks.update,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EditarFazenda — acessibilidade dos switches (UX09B)", () => {
  it("associa os tres nomes visuais a switches com IDs exclusivos", async () => {
    const { container } = await renderPage();

    expect(screen.getAllByRole("switch")).toHaveLength(3);
    for (const name of names) {
      const control = screen.getByRole("switch", { name, exact: true });
      expect(screen.getByLabelText(name, { exact: true })).toBe(control);
      expect(control.id).not.toBe("");
      expect(control).toBeChecked();
      expect(control).toBeEnabled();
    }
    const ids = [...container.querySelectorAll("[id]")].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(names)("o rotulo de %s alterna o estado quando habilitado", async (name) => {
    const user = userEvent.setup();
    const { container } = await renderPage();
    const control = screen.getByRole("switch", { name, exact: true });
    const label = container.querySelector(`label[for="${control.id}"]`)!;

    await user.click(label);
    expect(control).not.toBeChecked();
    await user.click(label);
    expect(control).toBeChecked();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each(names)("preserva foco, Space e Enter em %s", async (name) => {
    const user = userEvent.setup();
    await renderPage();
    const control = screen.getByRole("switch", { name, exact: true });

    // Percorre a ordem real de tabulacao, sem atribuir foco artificialmente.
    for (let index = 0; index < 30 && document.activeElement !== control; index++) {
      await user.tab();
    }
    expect(control).toHaveFocus();
    await user.keyboard("[Space]");
    expect(control).not.toBeChecked();
    await user.keyboard("[Enter]");
    expect(control).toBeChecked();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("desligar validacao forte desliga e bloqueia movimentacao sem reativa-la automaticamente", async () => {
    const user = userEvent.setup();
    const { container } = await renderPage();
    const strict = screen.getByRole("switch", { name: names[1] });
    const movement = screen.getByRole("switch", { name: names[2] });

    await user.click(strict);
    expect(strict).not.toBeChecked();
    expect(movement).not.toBeChecked();
    expect(movement).toBeDisabled();
    await user.click(container.querySelector(`label[for="${movement.id}"]`)!);
    await user.click(movement);
    expect(movement).not.toBeChecked();

    await user.click(strict);
    expect(movement).toBeEnabled();
    expect(movement).not.toBeChecked();
    await user.click(movement);
    expect(movement).toBeChecked();
  });

  it("reflete os estados carregados e bloqueia movimentacao quando validacao esta desligada", async () => {
    mocks.metadata = {
      app_experience: { mode: "completo" },
      eventos_rollout: { strict_rules_enabled: false, strict_anti_teleporte: true },
    };
    await renderPage();
    for (const name of names) {
      expect(screen.getByRole("switch", { name })).not.toBeChecked();
    }
    expect(screen.getByRole("switch", { name: names[2] })).toBeDisabled();
  });

  it("manager pode alternar modo essencial, mas nao os controles exclusivos de owner", async () => {
    mocks.role = "manager";
    const user = userEvent.setup();
    const { container } = await renderPage();
    const essential = screen.getByRole("switch", { name: names[0] });
    expect(essential).toBeEnabled();
    await user.click(container.querySelector(`label[for="${essential.id}"]`)!);
    expect(essential).not.toBeChecked();

    for (const name of names.slice(1)) {
      const control = screen.getByRole("switch", { name });
      expect(control).toBeDisabled();
      await user.click(container.querySelector(`label[for="${control.id}"]`)!);
      await user.click(control);
      expect(control).toBeChecked();
    }
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each(["cowboy", null] as const)("nao exibe switches para perfil sem permissao: %s", async (role) => {
    mocks.role = role;
    const router = createMemoryRouter(
      [{ path: '*', element: <EditarFazenda /> }],
      { initialEntries: ['/editar-fazenda'] },
    );
    render(
      <RouterProvider router={router} />,
    );
    expect(await screen.findByText("Voce nao tem permissao para editar esta fazenda.")).toBeVisible();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("desabilita os tres switches durante salvamento e respeita cliques nos rotulos", async () => {
    let completeSave!: (value: { error: null }) => void;
    mocks.save.mockReturnValue(new Promise<{ error: null }>((resolve) => {
      completeSave = resolve;
    }));
    const user = userEvent.setup();
    const { container } = await renderPage();
    await user.click(screen.getByRole("button", { name: "Salvar fazenda" }));
    expect(screen.getByRole("button", { name: "Salvando..." })).toBeDisabled();

    for (const name of names) {
      const control = screen.getByRole("switch", { name });
      expect(control).toBeDisabled();
      await user.click(container.querySelector(`label[for="${control.id}"]`)!);
      expect(control).toBeChecked();
    }
    expect(mocks.update).toHaveBeenCalledTimes(1);
    await act(async () => completeSave({ data: {metadata:{},updated_at:"2026-11-20T00:00:01Z"}, error: null } as never));
    expect(mocks.refreshSettings).toHaveBeenCalledTimes(1);
    for (const name of names) {
      expect(screen.getByRole("switch", { name })).toBeEnabled();
    }
  });

  it("navega para /home sem diálogo somente depois da gravação confirmada", async () => {
    let completeSave!: (value: unknown) => void;
    mocks.save.mockReturnValue(new Promise((resolve) => {
      completeSave = resolve;
    }));
    const user = userEvent.setup();
    const router = await renderPageWithHomeRoute();

    await user.clear(screen.getByLabelText("Nome da fazenda"));
    await user.type(screen.getByLabelText("Nome da fazenda"), "Fazenda atualizada");
    await user.click(screen.getByRole("button", { name: "Salvar fazenda" }));
    await user.click(screen.getByRole("link", { name: "Abrir home" }));
    expect(router.state.location.pathname).toBe("/editar-fazenda");
    expect(screen.getByText("Descartar alterações não salvas?")).toBeVisible();

    await act(async () => {
      completeSave({
        data: { metadata: {}, updated_at: "2026-11-20T00:00:01Z" },
        error: null,
      });
    });

    expect(await screen.findByTestId("current-route")).toHaveTextContent("/home");
    expect(
      screen.queryByText("Descartar alterações não salvas?"),
    ).not.toBeInTheDocument();
  });

  it("bloqueia saída enquanto grava e preserva o formulário se a gravação falhar", async () => {
    let rejectSave!: (reason: Error) => void;
    mocks.save.mockReturnValue(new Promise((_resolve, reject) => {
      rejectSave = reject;
    }));
    const user = userEvent.setup();
    const router = await renderPageWithHomeRoute();

    await user.clear(screen.getByLabelText("Nome da fazenda"));
    await user.type(screen.getByLabelText("Nome da fazenda"), "Rascunho preservado");
    await user.click(screen.getByRole("button", { name: "Salvar fazenda" }));
    await user.click(screen.getByRole("link", { name: "Abrir home" }));

    expect(router.state.location.pathname).toBe("/editar-fazenda");
    expect(screen.getByText("Descartar alterações não salvas?")).toBeVisible();
    await act(async () => rejectSave(new Error("persist failed")));

    expect(router.state.location.pathname).toBe("/editar-fazenda");
    expect(screen.getByLabelText("Nome da fazenda")).toHaveValue(
      "Rascunho preservado",
    );
    expect(screen.getByText("Descartar alterações não salvas?")).toBeVisible();
  });
});
