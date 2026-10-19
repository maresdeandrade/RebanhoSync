/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  RouterProvider,
  useLocation,
} from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "../AppShell";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    activeFarmId: "farm-ux04",
    role: "manager",
    farmExperienceMode: "completo",
  }),
}));
vi.mock("@/components/notifications/SanitaryNotificationManager", () => ({
  SanitaryNotificationManager: () => null,
}));
vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/offline/syncWorker", () => ({
  startSyncWorker: vi.fn(),
  stopSyncWorker: vi.fn(),
}));
vi.mock("@/lib/offline/localReadBoundary", () => ({
  canReadLocalData: vi.fn().mockResolvedValue(true),
}));
vi.mock("../TopBar", () => ({
  TopBar: ({ onMenuClick }: { onMenuClick: () => void }) => (
    <header>
      <button onClick={onMenuClick}>Abrir navegacao</button>
    </header>
  ),
}));

afterEach(cleanup);

function Destination() {
  const location = useLocation();
  return (
    <>
      <h1>
        {location.pathname}
        {location.search}
        {location.hash}
      </h1>
      <input aria-label="Campo de destino" />
    </>
  );
}

async function setup(initialEntry = "/home") {
  const router = createMemoryRouter(
    [
      {
        element: <AppShell />,
        children: [{ path: "*", element: <Destination /> }],
      },
    ],
    { initialEntries: [initialEntry] },
  );
  render(<RouterProvider router={router} />);
  const user = userEvent.setup();
  const opener = await screen.findByRole("button", { name: "Abrir navegacao" });
  async function open() {
    await user.click(opener);
    return within(await screen.findByRole("dialog"));
  }
  return { user, router, opener, open };
}

async function expectClosedAt(path: string) {
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(
    screen.getByRole("heading", { name: path, exact: true }),
  ).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("main")).toHaveFocus());
}

describe("AppShell mobile navigation", () => {
  it.each([
    ["Agenda", "/agenda"],
    ["Lancamentos", "/financeiro"],
    ["Meu Perfil", "/perfil"],
  ])(
    "closes after selecting %s and focuses the destination",
    async (label, path) => {
      const { user, open } = await setup();
      const menu = await open();
      await user.click(menu.getByRole("link", { name: label, exact: true }));
      await expectClosedAt(path);
    },
  );

  it("closes when the selected destination is already the current route", async () => {
    const { user, open } = await setup("/agenda");
    const menu = await open();
    await user.click(menu.getByRole("link", { name: "Agenda", exact: true }));
    await expectClosedAt("/agenda");
  });

  it("keeps the panel open while a navigation group expands or collapses", async () => {
    const { user, open } = await setup();
    const menu = await open();
    const group = menu.getByRole("button", {
      name: "Configuracoes",
      exact: true,
    });
    await user.click(group);
    expect(group).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(group);
    expect(group).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it.each(["/eventos", "/home?tab=recentes", "/home#resumo"])(
    "closes after programmatic navigation to %s",
    async (path) => {
      const { router, open } = await setup();
      await open();
      await act(async () => {
        await router.navigate(path);
      });
      await expectClosedAt(path);
    },
  );

  it.each(["Escape", "Fechar"])(
    "restores focus to the opener after %s",
    async (action) => {
      const { user, open, opener } = await setup();
      const menu = await open();
      if (action === "Escape") await user.keyboard("{Escape}");
      else
        await user.click(
          menu.getByRole("button", { name: "Fechar", exact: true }),
        );
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      await waitFor(() => expect(opener).toHaveFocus());
    },
  );

  it("supports keyboard selection and subsequent focus in the destination", async () => {
    const { user, open } = await setup();
    const menu = await open();
    menu.getByRole("link", { name: "Agenda", exact: true }).focus();
    await user.keyboard("{Enter}");
    await expectClosedAt("/agenda");
    await user.tab();
    expect(
      screen.getByRole("textbox", { name: "Campo de destino" }),
    ).toHaveFocus();
  });

  it("keeps desktop link focus without opening or closing a mobile panel", async () => {
    const { user } = await setup();
    const nav = screen.getByRole("navigation", { name: "Navegacao principal" });
    const link = within(nav).getByRole("link", { name: "Agenda", exact: true });
    await user.click(link);
    expect(
      screen.getByRole("heading", { name: "/agenda", exact: true }),
    ).toBeInTheDocument();
    expect(link).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
