/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGesture } from "@/lib/offline/ops";
import { showError } from "@/utils/toast";
import LoteNovo from "../LoteNovo";

vi.mock("@/lib/offline/db", () => ({ db: {} }));
vi.mock("@/lib/offline/ops", () => ({ createGesture: vi.fn() }));
vi.mock("@/lib/storage", () => ({ getActiveFarmId: () => "farm-ux08" }));
vi.mock("@/utils/toast", () => ({ showSuccess: vi.fn(), showError: vi.fn() }));
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: () => [
    { id: "option-1", nome: "Pasto 1", identificacao: "Touro 1" },
  ],
}));
vi.mock("@/components/ui/field-combobox", () => ({
  FieldCombobox: ({
    id,
    value,
    options,
    onValueChange,
    disabled,
  }: {
    id: string;
    value: string;
    options: { value: string; label: string }[];
    onValueChange: (value: string) => void;
    disabled: boolean;
  }) => (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

const routers: ReturnType<typeof createMemoryRouter>[] = [];
afterEach(async () => {
  await act(async () => {
    cleanup();
    routers.splice(0).forEach((router) => router.dispose());
  });
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createGesture).mockResolvedValue("tx-ux08");
});

function setup() {
  const router = createMemoryRouter(
    [
      { path: "/lotes/novo", element: <LoteNovo /> },
      { path: "*", element: <h1>Destino</h1> },
    ],
    { initialEntries: ["/lotes", "/lotes/novo", "/home"], initialIndex: 1 },
  );
  routers.push(router);
  render(
    <RouterProvider router={router} future={{ v7_startTransition: true }} />,
  );
  const user = userEvent.setup();
  const leave = async (path = "/home") => {
    await act(async () => {
      await router.navigate(path);
    });
  };
  return { router, user, leave, name: screen.getByLabelText("Nome do lote") };
}

function unloadIsBlocked() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("LoteNovo unsaved navigation with the real router", () => {
  it("leaves a pristine form directly, including loaded options", async () => {
    const { router, leave } = setup();
    expect(unloadIsBlocked()).toBe(false);
    await leave();
    expect(router.state.location.pathname).toBe("/home");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it.each(["nome", "status", "pasto", "touro"])(
    "protects a changed %s and releases after reverting it",
    async (field) => {
      const { router, user, leave, name } = setup();
      if (field === "nome") await user.type(name, "Lote UX08");
      else if (field === "status")
        await user.click(
          screen.getByRole("button", { name: "Inativo", exact: true }),
        );
      else
        await user.selectOptions(
          screen.getByLabelText(
            field === "pasto" ? "Pasto" : "Reprodutor vinculado",
          ),
          "option-1",
        );
      expect(unloadIsBlocked()).toBe(true);
      await leave();
      expect(router.state.location.pathname).toBe("/lotes/novo");
      expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
      await user.click(
        screen.getByRole("button", { name: "Continuar editando" }),
      );
      if (field === "nome") {
        expect(name).toHaveValue("Lote UX08");
        await user.clear(name);
      } else if (field === "status")
        await user.click(
          screen.getByRole("button", { name: "Ativo", exact: true }),
        );
      else
        await user.selectOptions(
          screen.getByLabelText(
            field === "pasto" ? "Pasto" : "Reprodutor vinculado",
          ),
          "null",
        );
      expect(unloadIsBlocked()).toBe(false);
      await leave();
      expect(router.state.location.pathname).toBe("/home");
    },
  );

  it("keeps one dialog on repeated navigation and discards only on confirmation", async () => {
    const { router, user, leave, name } = setup();
    await user.type(name, "Lote UX08");
    await leave();
    await leave("/agenda");
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    expect(name).toHaveValue("Lote UX08");
    expect(createGesture).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Descartar alterações" }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/agenda"));
  });

  it("Escape continues editing and selecting the same route does not prompt", async () => {
    const { user, leave, name } = setup();
    await user.type(name, "Lote UX08");
    await leave("/lotes/novo");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await leave();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(name).toHaveValue("Lote UX08");
  });

  it.each([-1, 1])(
    "blocks history delta %s and preserves its destination on discard",
    async (delta) => {
      const { router, user, name } = setup();
      await user.type(name, "Lote UX08");
      await act(async () => {
        await router.navigate(delta);
      });
      expect(router.state.location.pathname).toBe("/lotes/novo");
      await user.click(
        screen.getByRole("button", { name: "Descartar alterações" }),
      );
      await waitFor(() =>
        expect(router.state.location.pathname).toBe(
          delta === -1 ? "/lotes" : "/home",
        ),
      );
    },
  );

  it("retains the page during saving without discard dialogs or duplicate submissions", async () => {
    let finish!: (value: string) => void;
    vi.mocked(createGesture).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { router, user, leave, name } = setup();
    await user.type(name, "Lote UX08");
    const form = name.closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });
    expect(createGesture).toHaveBeenCalledTimes(1);
    expect(name).toBeDisabled();
    await leave();
    expect(router.state.location.pathname).toBe("/lotes/novo");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(unloadIsBlocked()).toBe(true);
    await act(async () => {
      finish("tx-ux08");
    });
    expect(router.state.location.pathname).toBe("/lotes");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(unloadIsBlocked()).toBe(false);
  });

  it("preserves values and protection on failure and allows a successful retry", async () => {
    vi.mocked(createGesture).mockRejectedValueOnce(new Error("local failure"));
    const { router, user, leave, name } = setup();
    await user.type(name, "Lote UX08");
    await user.click(
      screen.getAllByRole("button", { name: "Salvar lote", exact: true })[0],
    );
    await waitFor(() =>
      expect(showError).toHaveBeenCalledWith("Erro ao cadastrar lote."),
    );
    expect(name).toHaveValue("Lote UX08");
    expect(name).toBeEnabled();
    await leave();
    await user.click(
      screen.getByRole("button", { name: "Continuar editando" }),
    );
    await user.click(
      screen.getAllByRole("button", { name: "Salvar lote", exact: true })[0],
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/lotes"));
    expect(createGesture).toHaveBeenCalledTimes(2);
  });

  it("validation failure keeps the dirty form protected without persisting", async () => {
    const { user, leave } = setup();
    await user.click(
      screen.getByRole("button", { name: "Inativo", exact: true }),
    );
    await user.click(
      screen.getAllByRole("button", { name: "Salvar lote", exact: true })[0],
    );
    expect(createGesture).not.toHaveBeenCalled();
    await leave();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
