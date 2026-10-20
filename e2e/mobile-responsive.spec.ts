import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
];
const longId = "BR" + "1234567890".repeat(12);
const longLot = "Lote" + "Matrizes".repeat(20);
const longFarm = "Fazenda" + "Horizonte".repeat(25);
const pageErrors = new WeakMap<Page, string[]>();

async function setup(
  page: Page,
  path: string,
  offline = false,
  sync = "syncing",
) {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  const modules: Record<string, string> = {
    "/src/hooks/useAuth.tsx": `
      import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "/src/lib/farms/lifecycleConfig.ts";
      import { DEFAULT_FARM_MEASUREMENT_CONFIG } from "/src/lib/farms/measurementConfig.ts";
      export const useAuth = () => ({
        activeFarmId: "responsive-farm", role: "owner", farmExperienceMode: "completo",
        farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
        farmMeasurementConfig: DEFAULT_FARM_MEASUREMENT_CONFIG
      });`,
    "/src/components/notifications/SanitaryNotificationManager.tsx":
      "export const SanitaryNotificationManager = () => null;",
    "/src/lib/telemetry/pilotMetrics.ts":
      "export const trackPilotMetric = async () => {};",
    "/src/lib/offline/syncWorker.ts":
      "export const startSyncWorker = () => {}; export const stopSyncWorker = () => {};",
    "/src/lib/offline/localReadBoundary.ts": `export const canReadLocalData = async () => true;
       export const requireTenantSensitiveRead = async () => {};
       export const requireTenantSensitiveAccess = async () => {};`,
    "/src/lib/offline/ops.ts": `
      export const createGesture = async () => {
        window.unexpectedActions.push("createGesture");
        throw new Error("Operacao inesperada na fixture de layout");
      };
      export const getCreateGestureDiagnostic = () => null;`,
    "/src/lib/offline/syncQueries.ts": `
      export const loadFarmSyncSummary = async () => ({
        fazendaId: "responsive-farm", savedLocalCount: 0, pendingCount: 0,
        syncingCount: ${sync === "syncing" ? 1 : 0},
        rejectionCount: 0, reconcileCount: 0,
        errorCount: ${sync === "error" ? 1 : 0},
        syncedAlteredCount: 0, lastCompletedStage: "synced"
      });`,
    "/src/lib/supabase.ts": `
      const data = { nome: ${JSON.stringify(longFarm)}, municipio: "Cuiaba",
        estado: "MT", tipo_producao: "corte" };
      const query = {
        select: () => query, eq: () => query, is: () => query,
        single: async () => ({ data, error: null }),
        maybeSingle: async () => ({ data, error: null }),
      };
      export const supabase = {
        from: () => query, auth: { getUser: async () => ({ data: { user: null } }) }
      };`,
  };
  await page.addInitScript((online) => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => online,
    });
  }, !offline);
  await page.route("**/src/**", async (route) => {
    const source = modules[new URL(route.request().url()).pathname];
    if (source)
      await route.fulfill({ contentType: "text/javascript", body: source });
    else await route.continue();
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      await route.abort();
      return;
    }
    await route.fallback();
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
        await import('/e2e/support/mobile-responsive.tsx');
      </script></body></html>`,
    }),
  );
  await page.goto(path);
}

async function noOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll("main *, header *")]
      .flatMap((node) => {
        const rect = node.getBoundingClientRect();
        const scrollParent = node.closest('[role="tablist"]');
        return rect.width && rect.right > innerWidth + 1 && !scrollParent
          ? [
              {
                tag: node.tagName,
                text: node.textContent?.slice(0, 65),
                width: rect.width,
                right: rect.right,
                classes: node.className,
              },
            ]
          : [];
      })
      .slice(0, 12),
  }));
  expect(dimensions.document, JSON.stringify(dimensions)).toBeLessThanOrEqual(
    dimensions.viewport + 1,
  );
}

test.afterEach(async ({ page }, info) => {
  if (!page.isClosed()) {
    const screenshotPath = info.outputPath("layout.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await info.attach("layout", {
      path: screenshotPath,
      contentType: "image/png",
    });
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { unexpectedActions: string[] })
            .unexpectedActions ?? [],
      ),
    ).toEqual([]);
    expect(pageErrors.get(page) ?? []).toEqual([]);
  }
});

for (const viewport of viewports) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("UX10 — detalhe, identificacao longa, indicadores e abas", async ({
      page,
    }) => {
      await setup(page, "/responsive/animal/responsive-animal");
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        longId,
      );
      await expect(
        page.getByText(`Lote: ${longLot}`, { exact: true }),
      ).toBeVisible();
      await noOverflow(page);
      const tabs = page.getByRole("tablist", { name: "Seções do animal" });
      const scroller = tabs.locator("..");
      if (viewport.width < 640) {
        expect(
          await scroller.evaluate(
            (node) => node.scrollWidth > node.clientWidth,
          ),
        ).toBe(true);
      }
      for (const name of [
        "Histórico",
        "Sanidade",
        "Agenda",
        "Comercial",
        "Visão geral",
      ]) {
        await page.getByRole("tab", { name, exact: true }).click();
        await expect(
          page.getByRole("tab", { name, exact: true }),
        ).toHaveAttribute("aria-selected", "true");
        await noOverflow(page);
      }
      await expect(
        page.getByRole("link", { name: "Registrar manejo", exact: true }),
      ).toBeVisible();
    });

    test("UX11 — CSV longo preserva identidade, mensagens e importacao", async ({
      page,
    }) => {
      await setup(page, "/responsive/importar");
      await expect(
        page.getByRole("heading", { name: "Importar animais por planilha" }),
      ).toBeVisible();
      const csv = [
        "identificacao;sexo;especie;lote;data_nascimento;origem",
        `${longId}NOVO;F;bovino;;2024-01-10;nascimento`,
        `${longId};M;bovino;;2024-01-10;nascimento`,
      ].join("\n");
      await page.getByRole("textbox").fill(csv);
      await expect(
        page.getByText(`${longId}NOVO`.toLowerCase(), { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(
          `Identificação "${longId}" já existe na fazenda ativa.`,
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Importar 1 animal(is)",
          exact: true,
        }),
      ).toBeEnabled();
      await noOverflow(page);
      expect(await page.getByRole("textbox").inputValue()).toBe(csv);
      const fileName = "animais_" + "identificacoes".repeat(20) + ".csv";
      await page.locator('input[type="file"]').setInputFiles({
        name: fileName,
        mimeType: "text/csv",
        buffer: Buffer.from(csv),
      });
      await expect(page.getByText(fileName, { exact: true })).toBeVisible();
      await noOverflow(page);
      expect(await page.getByRole("textbox").inputValue()).toBe(csv);
    });

    test("UX12 — progresso e seis etapas com acoes acessiveis", async ({
      page,
    }) => {
      await setup(page, "/responsive/onboarding");
      await expect(
        page.getByRole("heading", { name: "Implantacao guiada da fazenda" }),
      ).toBeVisible();
      await expect(page.getByRole("progressbar")).toBeVisible();
      await expect(page.getByText("3/6 etapas", { exact: true })).toBeVisible();
      await expect(
        page.getByRole("progressbar").locator("> div"),
      ).toHaveAttribute("style", /translateX\(-50%\)/);
      await noOverflow(page);
      for (const name of [
        "Fazenda",
        "Pastos",
        "Lotes",
        "Rebanho",
        "Protocolos",
        "Primeiro manejo",
      ]) {
        await page.getByRole("button", { name: new RegExp(name) }).click();
        await expect(
          page.getByRole("link", { name: "Abrir proximo passo" }),
        ).toBeVisible();
        await noOverflow(page);
      }
      await expect(
        page.getByRole("button", { name: "Proxima etapa" }),
      ).toBeDisabled();
      await page.getByRole("button", { name: "Etapa anterior" }).click();
      await expect(
        page.getByRole("heading", { name: "5. Ativar protocolos sanitarios" }),
      ).toBeVisible();
    });

    test("UX15 + UX04/UX05 — menu, offline/sync, fazenda e barras", async ({
      page,
    }) => {
      await setup(page, "/responsive-shell", true, "error");
      if (viewport.width < 768) {
        const menuSize = await page
          .getByRole("button", { name: "Abrir navegacao" })
          .boundingBox();
        expect(
          menuSize!.width,
          JSON.stringify(menuSize),
        ).toBeGreaterThanOrEqual(44);
      }
      await expect(page.getByText(longFarm, { exact: true })).toBeVisible();
      await expect(
        page.getByRole("status").filter({ hasText: "Sem internet" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Erro de sincronização" }),
      ).toBeVisible();
      await noOverflow(page);
      if (viewport.width < 768) {
        const menu = page.getByRole("button", { name: "Abrir navegacao" });
        const box = await menu.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        await menu.click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(menu).toBeFocused();
        await page.getByRole("button", { name: "Mais", exact: true }).click();
        await page
          .getByRole("dialog")
          .getByRole("link", { name: "Agenda", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByRole("main")).toBeFocused();
        // Retorna para exercitar o contrato UX05 com componentes de producao.
        await page.goBack();
        await page
          .getByRole("button", { name: "Salvar cadastro" })
          .scrollIntoViewIfNeeded();
        const actions = await page
          .locator(".mobile-form-actions")
          .boundingBox();
        const nav = await page
          .getByRole("navigation", { name: "Navegacao mobile" })
          .boundingBox();
        expect(actions!.y + actions!.height).toBeLessThanOrEqual(nav!.y);
        for (const name of ["Salvar cadastro", "Cancelar"]) {
          const action = page.getByRole("button", { name, exact: true });
          const target = await action.boundingBox();
          expect(target!.height).toBeGreaterThanOrEqual(44);
          await expect(action).toBeInViewport();
        }
      }
      await page.getByRole("button", { name: longFarm, exact: true }).click();
      await expect(
        page.getByRole("menuitem", { name: "Trocar fazenda" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toHaveCount(0);
      await noOverflow(page);
    });

    test("UX15 — online sincronizando preserva controles e nomes", async ({
      page,
    }) => {
      await setup(page, "/responsive-shell");
      await expect(
        page.getByRole("button", { name: "Sincronizando", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("status").filter({ hasText: "Sem internet" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: longFarm, exact: true }),
      ).toBeVisible();
      const profile = await page
        .getByRole("link", { name: "Abrir perfil" })
        .boundingBox();
      expect(profile!.width).toBeGreaterThanOrEqual(44);
      expect(profile!.height).toBeGreaterThanOrEqual(44);
      await noOverflow(page);
    });
  });
}
