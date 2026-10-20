import { expect, test, type Page } from "@playwright/test";
import type {} from "./support/ux17-simulation";

async function setup(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Auth is a controlled boundary; page, guards, simulator, hooks and IndexedDB are real.
  await page.route("**/src/hooks/useAuth.tsx*", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: 'export { useAuth } from "/e2e/support/ux17-auth.ts";',
    }),
  );
  await page.route("http://127.0.0.1:4173/animais/*/simulacao", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<html lang="pt-BR"><body><div id="root"></div><script type="module">
      import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      await import('/e2e/support/ux17-simulation.tsx');
    </script></body></html>`,
    }),
  );
  await page.goto("/animais/animal-a/simulacao", { timeout: 120000 });
  await expect(
    page.getByRole("heading", { name: "Simulação de Cenários — ANIMAL-A" }),
  ).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("410,0 kg", { exact: true })).toBeVisible();
  return errors;
}

async function fillScenario(page: Page) {
  await page.getByLabel(/Peso-alvo vivo/).fill("900");
  await page.getByLabel(/GMD assumido no cenário/).fill("1.5");
  await page.getByLabel(/Preço por arroba/).fill("320");
  await page.getByLabel(/Rendimento de carcaça/).fill("50");
  await expect(
    page.getByText("SIMULADO", { exact: true }).first(),
  ).toBeVisible();
}

test.describe("UX17 — Chromium com IndexedDB descartável", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.setTimeout(150000);

  test("troca A → B → A não mantém dados durante consulta atrasada", async ({
    page,
  }) => {
    const errors = await setup(page);
    await page.evaluate(() => window.ux17.pauseAnimalRead());
    await page.getByRole("button", { name: "Fazenda B", exact: true }).click();
    await expect(
      page.getByTestId("productive-commercial-simulator"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /Simulação de Cenários —/ }),
    ).toHaveCount(0);
    await page.screenshot({
      path: test.info().outputPath("ux17-farm-transition.png"),
    });
    await page.evaluate(() => window.ux17.resumeAnimalRead());
    await expect(page.getByTestId("simulacao-not-found")).toBeVisible();
    await page.getByRole("button", { name: "Fazenda A", exact: true }).click();
    await expect(page.getByText("410,0 kg", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("troca de animal na mesma fazenda descarta cenário e histórico anteriores", async ({
    page,
  }) => {
    const errors = await setup(page);
    await page.evaluate(() => window.ux17.useSameFarm());
    const before = await page.evaluate(() => window.ux17.snapshot());
    await fillScenario(page);
    await page.getByRole("link", { name: "Animal B", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Simulação de Cenários — ANIMAL-B" }),
    ).toBeVisible();
    await expect(page.getByLabel(/Peso-alvo vivo/)).toHaveValue("");
    await expect(page.getByLabel(/Preço por arroba/)).toHaveValue("");
    await expect(page.getByText("720,0 kg", { exact: true })).toBeVisible();
    await expect(page.getByText("410,0 kg", { exact: true })).toHaveCount(0);
    await expect(page.getByText("SIMULADO", { exact: true })).toHaveCount(0);
    await expect(page.getByText("OBSERVADO", { exact: true })).toBeVisible();
    await expect(page.getByText("PREMISSA", { exact: true })).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath("ux17-animal-b-reset.png"),
    });
    expect(await page.evaluate(() => window.ux17.snapshot())).toEqual(before);
    expect(errors).toEqual([]);
  });

  test("navegação entre fazendas e reload preservam identidade e limpam premissas", async ({
    page,
  }) => {
    const errors = await setup(page);
    await fillScenario(page);
    await page.getByRole("button", { name: "Fazenda B", exact: true }).click();
    await expect(page.getByTestId("simulacao-not-found")).toBeVisible();
    await page.getByRole("link", { name: "Animal B", exact: true }).click();
    await expect(page.getByText("720,0 kg", { exact: true })).toBeVisible();
    await expect(page.getByLabel(/Peso-alvo vivo/)).toHaveValue("");
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Simulação de Cenários — ANIMAL-B" }),
    ).toBeVisible();
    await expect(page.getByText("720,0 kg", { exact: true })).toBeVisible();
    await expect(page.getByText("410,0 kg", { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("retirada da sessão e da fazenda mantém os guards", async ({ page }) => {
    const errors = await setup(page);
    await page.evaluate(() => window.ux17.setAuth({ activeFarmId: null }));
    await expect(
      page.getByText("ESCOLHER FAZENDA", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId("productive-commercial-simulator"),
    ).toHaveCount(0);
    await page.evaluate(() => window.ux17.setAuth({ session: null }));
    await page.getByRole("link", { name: "Animal A", exact: true }).click();
    await expect(page.getByText("LOGIN", { exact: true })).toBeVisible();
    await expect(
      page.getByTestId("productive-commercial-simulator"),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
