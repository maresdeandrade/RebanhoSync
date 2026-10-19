import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page, path = "/home") {
  page.on("pageerror", (error) => console.error(error.message));
  const modules: Record<string, string> = {
    "/src/hooks/useAuth.tsx":
      'export const useAuth = () => ({ activeFarmId: "ux04", role: "manager", farmExperienceMode: "completo" });',
    "/src/components/notifications/SanitaryNotificationManager.tsx":
      "export const SanitaryNotificationManager = () => null;",
    "/src/lib/telemetry/pilotMetrics.ts":
      "export const trackPilotMetric = async () => {};",
    "/src/lib/offline/syncWorker.ts":
      "export const startSyncWorker = () => {}; export const stopSyncWorker = () => {};",
    "/src/lib/offline/localReadBoundary.ts":
      "export const canReadLocalData = async () => true;",
    "/src/components/layout/TopBar.tsx":
      'export const TopBar = ({onMenuClick}) => window.React.createElement("header", null, window.React.createElement("button", {onClick:onMenuClick, className:"md:hidden", "aria-label":"Abrir navegacao"}, "Menu"));',
  };
  await page.route("**/src/**", async (route) => {
    const source = modules[new URL(route.request().url()).pathname];
    if (source)
      await route.fulfill({ contentType: "text/javascript", body: source });
    else await route.continue();
  });
  await page.route(`http://127.0.0.1:4173${path}`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><body><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      await import('/e2e/support/ux04-navigation.tsx');
    </script></body></html>`,
    }),
  );
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: path, exact: true }),
  ).toBeVisible();
}

async function open(page: Page, bottom = false) {
  await page
    .getByRole("button", {
      name: bottom ? "Mais" : "Abrir navegacao",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return page.getByRole("dialog");
}

async function closedAt(page: Page, path: string) {
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: path, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toBeFocused();
}

test.describe("UX04 mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("links simples, grupos, perfil e rota atual fecham o painel", async ({
    page,
  }) => {
    await setup(page);
    for (const [name, path] of [
      ["Agenda", "/agenda"],
      ["Agenda", "/agenda"],
      ["Lancamentos", "/financeiro"],
      ["Meu Perfil", "/perfil"],
    ]) {
      const menu = await open(page);
      await menu.getByRole("link", { name, exact: true }).click();
      await closedAt(page, path);
    }
  });

  test("grupos, Escape, botao fechar e clique fora preservam foco", async ({
    page,
  }) => {
    await setup(page);
    const menu = await open(page);
    const group = menu.getByRole("button", {
      name: "Configuracoes",
      exact: true,
    });
    for (const expanded of ["true", "false"]) {
      await group.click();
      await expect(group).toHaveAttribute("aria-expanded", expanded);
      await expect(menu).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Abrir navegacao" }),
    ).toBeFocused();
    await open(page);
    await page.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(menu).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Abrir navegacao" }),
    ).toBeFocused();
    await open(page, true);
    await page.mouse.click(385, 400);
    await expect(menu).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Mais", exact: true }),
    ).toBeFocused();
  });

  test("teclado, navegacao programatica e barra inferior", async ({ page }) => {
    await setup(page);
    const menu = await open(page);
    await menu.getByRole("link", { name: "Agenda", exact: true }).focus();
    await page.keyboard.press("Enter");
    await closedAt(page, "/agenda");
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("textbox", { name: "Campo de destino" }),
    ).toBeFocused();
    for (const path of [
      "/eventos",
      "/eventos?tab=recentes",
      "/eventos?tab=recentes#resumo",
    ]) {
      await open(page);
      await page.evaluate(
        (detail) =>
          window.dispatchEvent(new CustomEvent("ux04:navigate", { detail })),
        path,
      );
      await closedAt(page, path);
    }
    await page
      .getByRole("navigation", { name: "Navegacao mobile" })
      .getByRole("link", { name: "Hoje", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "/home", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test("UX04 desktop preserva navegacao e foco do link", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setup(page);
  const nav = page.getByRole("navigation", {
    name: "Navegacao principal",
    exact: true,
  });
  const link = nav.getByRole("link", { name: "Agenda", exact: true });
  await link.click();
  await expect(
    page.getByRole("heading", { name: "/agenda", exact: true }),
  ).toBeVisible();
  await expect(link).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Navegacao mobile" }),
  ).toBeHidden();
});
