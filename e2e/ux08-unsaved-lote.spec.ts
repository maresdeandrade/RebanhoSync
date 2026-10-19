import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

async function setup(page: Page) {
  page.on("pageerror", (error) => {
    throw error;
  });
  const modules: Record<string, string> = {
    "/src/hooks/useAuth.tsx": `
      let session = { user: { id: 'ux08-user' } };
      const listeners = new Set();
      window.addEventListener('ux08:invalidate', () => { session = null; listeners.forEach(fn => fn()); });
      export const useAuth = () => ({
        session: window.React.useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => session),
        activeFarmId: 'ux08-farm', role: 'manager', loading: false, farmExperienceMode: 'completo',
        localOwnership: { status: 'OWNED' }, refreshSettings: async () => {}, isSuperAdmin: false,
      });`,
    "/src/lib/offline/db.ts": `
      export const db = {
        state_pastos: { where: () => ({ equals: () => ({ toArray: async () => [{id:'pasto-1', nome:'Pasto Norte'}] }) }) },
        state_animais: { filter: () => ({ toArray: async () => [{id:'touro-1', identificacao:'Touro 1'}] }) },
      };`,
    "/src/lib/offline/ops.ts": `
      export const createGesture = () => {
        window.__ux08Saves = (window.__ux08Saves || 0) + 1;
        return new Promise((resolve, reject) => {
          window.addEventListener('ux08:finish-save', event => event.detail === 'fail' ? reject(new Error('local test failure')) : resolve('tx-ux08'), { once: true });
        });
      };`,
    "/src/lib/storage.ts": "export const getActiveFarmId = () => 'ux08-farm';",
    "/src/utils/toast.ts":
      "export const showSuccess = () => {}; export const showError = () => {};",
    "/src/lib/offline/unknownOwnershipRecovery.ts":
      "export const resetUnknownLocalDatabase = async () => {}; export const UNKNOWN_LOCAL_RESET_CONFIRMATION = 'unused';",
    "/src/components/notifications/SanitaryNotificationManager.tsx":
      "export const SanitaryNotificationManager = () => null;",
    "/src/lib/telemetry/pilotMetrics.ts":
      "export const trackPilotMetric = async () => {};",
    "/src/lib/offline/syncWorker.ts":
      "export const startSyncWorker = () => {}; export const stopSyncWorker = () => {};",
    "/src/lib/offline/localReadBoundary.ts":
      "export const canReadLocalData = async () => true;",
    "/src/components/layout/TopBar.tsx": `export const TopBar = ({onMenuClick}) => window.React.createElement('button', {onClick:onMenuClick, className:'md:hidden', 'aria-label':'Abrir navegacao'}, 'Menu');`,
    "/src/pages/Lotes.tsx": `export default () => window.React.createElement('div', null, window.React.createElement('h1', null, 'Lotes'), window.React.createElement(window.UX08Link, {to:'/lotes/novo'}, 'Novo lote'));`,
    "/src/pages/Home.tsx":
      "export default () => window.React.createElement('h1', null, 'Hoje');",
    "/src/pages/Agenda/index.tsx":
      "export default () => window.React.createElement('h1', null, 'Agenda');",
    "/src/pages/Login.tsx":
      "export default () => window.React.createElement('h1', null, 'Entrar');",
  };
  await page.route("**/src/**", async (route) => {
    const source = modules[new URL(route.request().url()).pathname];
    if (source)
      await route.fulfill({ contentType: "text/javascript", body: source });
    else await route.continue();
  });
  await page.route("http://127.0.0.1:4173/lotes", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html><body><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      await import('/e2e/support/ux08-lote.tsx');
    </script></body></html>`,
    }),
  );
  await page.goto("/lotes");
  await page.getByRole("link", { name: "Novo lote", exact: true }).click();
  await expect(page.getByLabel("Nome do lote")).toBeVisible();
}

async function continueEditing(page: Page) {
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toHaveCount(1);
  await dialog.getByRole("button", { name: "Continuar editando" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("Nome do lote")).toHaveValue("Lote UX08");
}

test("Cancelar preserva alteracoes e permite descarte explicito", async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel("Nome do lote").fill("Lote UX08");
  await page.getByRole("button", { name: "Cancelar", exact: true }).dblclick();
  await continueEditing(page);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.getByRole("button", { name: "Descartar alterações" }).click();
  await expect(page).toHaveURL(/\/lotes$/);
});

test("intacto e alteracoes revertidas permitem saida direta", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await expect(page).toHaveURL(/\/lotes$/);
  await page.getByRole("link", { name: "Novo lote", exact: true }).click();
  await page.getByLabel("Nome do lote").fill("Rascunho");
  await page.getByLabel("Nome do lote").clear();
  await page.getByRole("button", { name: "Inativo", exact: true }).click();
  await page.getByRole("button", { name: "Ativo", exact: true }).click();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page).toHaveURL(/\/lotes$/);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("Voltar, historico, menu e barra inferior usam a mesma protecao", async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel("Nome do lote").fill("Lote UX08");
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await continueEditing(page);
  await page.evaluate(() => history.back());
  await continueEditing(page);
  await expect(page).toHaveURL(/\/lotes\/novo$/);
  await page.getByRole("button", { name: "Mais", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "Agenda", exact: true })
    .click();
  await continueEditing(page);
  await page
    .getByRole("navigation", { name: "Navegacao mobile" })
    .getByRole("link", { name: "Hoje", exact: true })
    .click();
  await page.getByRole("button", { name: "Descartar alterações" }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test("salvamento em andamento retém formulario; sucesso libera saida", async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel("Nome do lote").fill("Lote UX08");
  const save = page
    .getByRole("button", { name: "Salvar lote", exact: true })
    .last();
  await save.dblclick();
  await expect(page.getByLabel("Nome do lote")).toBeDisabled();
  await page
    .getByRole("navigation", { name: "Navegacao mobile" })
    .getByRole("link", { name: "Hoje", exact: true })
    .click();
  await expect(page).toHaveURL(/\/lotes\/novo$/);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { __ux08Saves: number }).__ux08Saves,
    ),
  ).toBe(1);
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("ux08:finish-save", { detail: "success" }),
    ),
  );
  await expect(page).toHaveURL(/\/lotes$/);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("falha preserva formulario e protecao; sessao invalidada sai sem bloqueio", async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel("Nome do lote").fill("Lote UX08");
  await page
    .getByRole("button", { name: "Salvar lote", exact: true })
    .last()
    .click();
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("ux08:finish-save", { detail: "fail" }),
    ),
  );
  await expect(page.getByLabel("Nome do lote")).toBeEnabled();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await continueEditing(page);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("ux08:invalidate")));
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("selecoes reais de pasto e reprodutor contam como alteracao e podem ser revertidas", async ({
  page,
}) => {
  await setup(page);
  for (const [label, option] of [
    ["Pasto", "Pasto Norte"],
    ["Reprodutor vinculado", "Touro 1"],
  ]) {
    await page.getByRole("combobox", { name: label, exact: true }).click();
    await page.getByRole("option", { name: option, exact: true }).click();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(page.getByRole("alertdialog")).toHaveCount(1);
    await page.getByRole("button", { name: "Continuar editando" }).click();
    await expect(
      page.getByRole("combobox", { name: label, exact: true }),
    ).toHaveText(option);
    await page.getByRole("combobox", { name: label, exact: true }).click();
    await page.getByRole("option", { name: "Nenhum", exact: true }).click();
  }
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page).toHaveURL(/\/lotes$/);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("recarregar usa confirmacao nativa e cancelar preserva preenchimento", async ({
  page,
}) => {
  await setup(page);
  await page.getByLabel("Nome do lote").fill("Lote UX08");
  const dialogPromise = page.waitForEvent("dialog");
  await page.evaluate(() => { setTimeout(() => window.location.reload(), 0); });
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe("beforeunload");
  await dialog.dismiss();
  await expect(page.getByLabel("Nome do lote")).toHaveValue("Lote UX08");
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("desktop tambem protege links e historico pode confirmar descarte", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await setup(page);
  await page.getByLabel("Nome do lote").fill("Lote UX08");
  await page
    .getByRole("navigation", { name: "Navegacao principal", exact: true })
    .getByRole("link", { name: "Agenda", exact: true })
    .click();
  await continueEditing(page);
  await page.evaluate(() => history.back());
  await page.getByRole("button", { name: "Descartar alterações" }).click();
  await expect(page).toHaveURL(/\/lotes$/);
  await page.evaluate(() => history.forward());
  await expect(page.getByLabel("Nome do lote")).toHaveValue("");
});

test("invalidacao de sessao durante salvamento remove a protecao", async ({ page }) => {
  await setup(page);
  await page.getByLabel("Nome do lote").fill("Lote UX08");
  await page.getByRole("button", { name: "Salvar lote", exact: true }).last().click();
  await expect(page.getByLabel("Nome do lote")).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event("ux08:invalidate")));
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  expect(await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  })).toBe(false);
});
