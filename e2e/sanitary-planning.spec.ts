import { expect, test, type Page, type Route } from "@playwright/test";

const farm = "00000000-0000-4000-8000-000000000010";
const otherFarm = "00000000-0000-4000-8000-000000000020";
const protocol = "00000000-0000-4000-8000-000000000030";
const item = "00000000-0000-4000-8000-000000000040";

function syntheticSingleRequest(route: Route) {
  return route.request().headers().accept?.includes("vnd.pgrst.object") || new URL(route.request().url()).searchParams.get("select") === "role";
}

async function fulfillSyntheticApi(route: Route, unexpected: string[]) {
  const request = route.request();
  const url = new URL(request.url());
    let data: unknown = [];
    const single = syntheticSingleRequest(route);
    if (url.pathname.endsWith("/user_fazendas")) data = single ? { role: "owner" } : [
      { role: "owner", fazendas: { id: farm, nome: "Fazenda de teste", estado: "MG" } },
      { role: "owner", fazendas: { id: otherFarm, nome: "Outra fazenda", estado: "MG" } },
    ];
    else if (url.pathname.endsWith("/user_settings")) data = { active_fazenda_id: null };
    else if (url.pathname.endsWith("/fazendas")) data = { metadata: {} };
    else if (url.pathname.includes("/rpc/")) data = false;
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method()) && !url.pathname.endsWith("/user_settings") && !url.pathname.includes("/rpc/")) {
      unexpected.push(`${request.method()} ${url.pathname}`);
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
}

async function prepare(page: Page) {
  const unexpected: string[] = [];
  page.on("pageerror", (error) => console.error(error.message));
  await page.clock.install({ time: new Date("2026-07-04T12:00:00Z") });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname !== "127.0.0.1") {
      unexpected.push(url.origin + url.pathname);
      return route.abort();
    }
    if (url.port === "4187") {
      if (request.isNavigationRequest()) {
        const response = await route.fetch({ url: "http://127.0.0.1:4187/e2e/fixtures/sanitary-planning.html" });
        return route.fulfill({ response });
      }
      return route.continue();
    }
    if (url.port !== "59997") { unexpected.push(url.origin + url.pathname); return route.abort(); }
    return fulfillSyntheticApi(route, unexpected);
  });
  return unexpected;
}

async function selectProtocol(page: Page) {
  await page.getByLabel("Selecionar protocolo", { exact: true }).selectOption(protocol);
  await page.getByLabel("Selecionar item do protocolo", { exact: true }).selectOption(item);
}

test("B19 aprovada em fixture gera Agenda genérica condicional, offline e sem fatos", async ({ page, context }) => {
  const unexpected = await prepare(page);
  await page.goto("/select-fazenda?approved");
  await page.getByRole("button").filter({ hasText: "Fazenda de teste" }).click();
  await selectProtocol(page);
  await page.getByLabel("Geração de Agenda", { exact: true }).selectOption("automatic");
  await expect(page.getByLabel("Selecionar Bezerra teste 101", { exact: true })).toBeEnabled();
  await context.setOffline(true);
  await page.getByLabel("Selecionar Bezerra teste 101", { exact: true }).check();
  await page.getByRole("button", { name: "Planejar agenda para selecionados" }).click();
  await expect(page.getByText(/Avaliação\/manejo genérico/)).toBeVisible();
  await page.getByRole("button", { name: "Confirmar e gerar Agenda" }).click();
  await expect(page.getByRole("tab", { name: "Agenda sanitária", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(await counts(page)).toMatchObject({ agendas: 1, events: 0, movements: 0, queue: 0 });
  await context.setOffline(false);
  await page.reload();
  expect(await counts(page)).toMatchObject({ agendas: 1, events: 0, movements: 0 });
  expect(unexpected).toEqual([]);
});

async function counts(page: Page) {
  return page.evaluate(async () => {
    const { db } = await import("/src/lib/offline/db.ts");
    return { agendas: await db.ops_sanitario_agenda_v2.count(), events: await db.event_eventos.count(),
      movements: await db.state_insumo_movimentacoes.count(), queue: await db.queue_ops.count(), products: await db.catalog_sanitario_produtos_v2.count() };
  });
}

test("plano confirmado gera sozinho, recupera offline e respeita cancelamento e farm-switch", async ({ page, context }) => {
  const unexpected = await prepare(page);
  await page.goto("/select-fazenda?approved");
  await page.getByRole("button").filter({ hasText: "Fazenda de teste" }).click();
  await page.getByRole("checkbox", { name: /^Automatizar Brucelose B19/ }).check();
  await expect(page.getByText(/2 Agenda\(s\) serão criadas/)).toBeVisible();
  await context.setOffline(true);
  await page.getByLabel("Confirmar ativação do plano", { exact: true }).check();
  await page.getByRole("button", { name: "Ativar plano automático", exact: true }).click();
  await expect(page.getByText("Plano automático ativo", { exact: true })).toBeVisible();
  await expect(page.getByText("Agendas geradas automaticamente (2)", { exact: true })).toBeVisible();
  expect(await counts(page)).toMatchObject({ agendas: 2, events: 0, movements: 0, queue: 1 });
  await page.getByRole("button", { name: "Reavaliar plano", exact: true }).click();
  expect(await counts(page)).toMatchObject({ agendas: 2, events: 0 });
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByText("Plano automático ativo", { exact: true })).toBeVisible();
  expect(await counts(page)).toMatchObject({ agendas: 2, events: 0 });
  await page.evaluate(async () => {
    const { db } = await import("/src/lib/offline/db.ts");
    const { cancelLocalSanitaryAgendaV2 } = await import("/src/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2.ts");
    const agenda = await db.ops_sanitario_agenda_v2.toCollection().first();
    await cancelLocalSanitaryAgendaV2({ agendaId: agenda!.id, fazendaId: agenda!.fazenda_id });
  });
  await page.getByRole("button", { name: "Reavaliar plano", exact: true }).click();
  expect(await counts(page)).toMatchObject({ agendas: 2, events: 0, movements: 0 });
  // A local data refresh must trigger generation without another confirmation.
  await page.evaluate(async () => {
    const { db } = await import("/src/lib/offline/db.ts");
    const animal = await db.state_animais.get("female-test");
    await db.state_animais.put({ ...animal!, id: "new-female-test", identificacao: "Nova bezerra" });
  });
  await expect(page.getByText("Agendas geradas automaticamente (3)", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Trocar fazenda", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "Outra fazenda" }).click();
  await expect(page.getByText("Plano automático desativado", { exact: true })).toBeVisible();
  expect(await counts(page)).toMatchObject({ agendas: 3, events: 0 });
  expect(unexpected).toEqual([]);
});

test("fazenda → protocolo → seleção → revisão → Agenda; offline, reload, reagendamento, cancelamento e farm-switch", async ({ page, context }) => {
  const unexpected = await prepare(page);
  await page.goto("/select-fazenda");
  await page.getByRole("button").filter({ hasText: "Fazenda de teste" }).click();
  await expect(page.getByText("Central Sanitária", { exact: true })).toBeVisible();
  await selectProtocol(page);
  await expect(page.getByLabel("Selecionar Bezerra teste 101", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("Selecionar Bezerro teste 201", { exact: true })).toBeDisabled();
  await expect(page.getByText("Outra fazenda 301", { exact: true })).toHaveCount(0);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Selecionar todos os elegíveis visíveis" }).click();
  await page.getByRole("button", { name: "Planejar agenda para selecionados" }).click();
  await expect(page.getByRole("dialog", { name: "Revisar planejamento sanitário" })).toBeVisible();
  expect((await counts(page)).agendas).toBe(0);
  await page.getByRole("button", { name: "Voltar à seleção" }).click();
  expect((await counts(page)).agendas).toBe(0);
  await page.getByRole("button", { name: "Planejar agenda para selecionados" }).click();
  await page.getByRole("button", { name: "Confirmar e gerar Agenda" }).dblclick();
  await expect(page.getByRole("tab", { name: "Agenda sanitária", exact: true })).toHaveAttribute("data-state", "active");
  await expect.poll(() => counts(page)).toEqual({ agendas: 1, events: 0, movements: 0, queue: 0, products: 1 });
  await expect(page.getByText("Brucelose B19 — teste", { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: "scratch/sanitary-planning-agenda.png", fullPage: true });
  await context.setOffline(false);
  await page.reload();
  await page.getByRole("tab", { name: "Agenda sanitária", exact: true }).click();
  await page.getByRole("button", { name: "Ver agendas", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Reagendar", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Reagendar", exact: true }).first().click();
  await page.getByLabel("Nova data planejada").fill("2026-07-11");
  await page.getByRole("button", { name: "Salvar nova data" }).click();
  await expect(page.getByText("11/07/2026", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Trocar fazenda" }).click();
  await page.getByRole("button").filter({ hasText: "Outra fazenda" }).click();
  await page.getByRole("tab", { name: "Agenda sanitária", exact: true }).click();
  await expect(page.getByRole("button", { name: "Reagendar", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Trocar fazenda" }).click();
  await page.getByRole("button").filter({ hasText: "Fazenda de teste" }).click();
  await page.getByRole("tab", { name: "Agenda sanitária", exact: true }).click();
  await page.getByRole("button", { name: "Ver agendas", exact: true }).first().click();
  await page.getByRole("button", { name: "Cancelar agenda", exact: true }).first().click();
  await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
  expect(await counts(page)).toEqual({ agendas: 1, events: 0, movements: 0, queue: 0, products: 1 });
  expect(unexpected).toEqual([]);
});

test("catálogo vazio informa indisponibilidade sem fabricar protocolos ou produtos", async ({ page }) => {
  const unexpected = await prepare(page);
  await page.goto("/select-fazenda?empty=1");
  await page.getByRole("button").filter({ hasText: "Fazenda de teste" }).click();
  await expect(page.getByText(/Nenhum protocolo disponível no catálogo local/)).toBeVisible();
  await page.getByRole("button", { name: "Atualizar catálogo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Atualizar catálogo", exact: true })).toBeEnabled();
  expect(await counts(page)).toEqual({ agendas: 0, events: 0, movements: 0, queue: 0, products: 0 });
  expect(unexpected).toEqual([]);
});

test("plano integral contempla 20 itens e automatiza vários protocolos com histórico e recuperação offline", async ({ page, context }) => {
  const unexpected = await prepare(page);
  await page.goto("/select-fazenda?integral");
  await page.getByRole("button").filter({ hasText: "Fazenda de teste" }).click();
  const checkboxes = page.getByRole("checkbox", { name: /^Automatizar / });
  await expect(checkboxes).toHaveCount(20);
  await expect(page.getByText("Plano automático desativado", { exact: true })).toBeVisible();
  await page.getByText("Cobertura, sugestões e restrições de todos os itens", { exact: true }).click();
  await expect(page.getByText("Sugestão condicional — automação restrita", { exact: true })).toHaveCount(3);
  await expect(page.getByText("Bloqueio técnico específico", { exact: true })).toHaveCount(3);
  await context.setOffline(true);
  await page.getByLabel("Confirmar ativação do plano", { exact: true }).check();
  await page.getByRole("button", { name: "Ativar plano automático", exact: true }).click();
  await expect(page.getByText("Plano automático ativo", { exact: true })).toBeVisible();
  const snapshot = () => page.evaluate(async () => {
    const { db } = await import("/src/lib/offline/db.ts");
    const agendas = await db.ops_sanitario_agenda_v2.toArray();
    return { count: agendas.length, items: new Set(agendas.map((agenda) => agenda.protocol_item_snapshot.itemKey)).size,
      identities: new Set(agendas.map((agenda) => agenda.metadata.automationKey)).size,
      events: await db.event_eventos.count(), movements: await db.state_insumo_movimentacoes.count() };
  });
  await expect.poll(snapshot).toMatchObject({ items: 12, events: 4, movements: 0 });
  const before = await snapshot();
  expect(before.identities).toBe(before.count);
  await page.getByRole("button", { name: "Reavaliar plano", exact: true }).click();
  expect(await snapshot()).toEqual(before);
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByText("Plano automático ativo", { exact: true })).toBeVisible();
  await expect.poll(snapshot).toEqual(before);
  await page.getByRole("link", { name: "Trocar fazenda", exact: true }).click();
  await page.getByRole("button").filter({ hasText: "Outra fazenda" }).click();
  await expect(page.getByText("Plano automático desativado", { exact: true })).toBeVisible();
  expect(await snapshot()).toEqual(before);
  expect(unexpected).toEqual([]);
});
