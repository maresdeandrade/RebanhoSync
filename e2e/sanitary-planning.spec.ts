import { chromium, expect, test, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { resolve } from "node:path";
const homologatedCatalog = JSON.parse(readFileSync(new URL("../docs/review/evidence/SANITARIO_V2_VF2_CATALOG_READONLY_20261023.json", import.meta.url), "utf8")) as typeof import("../docs/review/evidence/SANITARIO_V2_VF2_CATALOG_READONLY_20261023.json");
const initialBootstrap = JSON.parse(readFileSync(new URL("../docs/review/evidence/SANITARIO_V2_INITIAL_BOOTSTRAP_20261022.json", import.meta.url), "utf8")) as typeof import("../docs/review/evidence/SANITARIO_V2_INITIAL_BOOTSTRAP_20261022.json");

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

async function prepare(page: Page, api?: (route: Route, unexpected: string[]) => Promise<void>) {
  await page.context().grantPermissions(["local-network-access"], { origin: "http://127.0.0.1:4187" });
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
    return api ? api(route, unexpected) : fulfillSyntheticApi(route, unexpected);
  });
  return unexpected;
}

async function selectProtocol(page: Page, protocolId = protocol, itemId = item) {
  await page.getByLabel("Filtrar por protocolo", { exact: true }).selectOption(protocolId);
  await page.getByLabel("Filtrar por manejo", { exact: true }).selectOption(itemId);
  await page.getByLabel("Filtrar por situação", { exact: true }).selectOption("opportunity_in_window");
  await expect(page.getByRole('button', { name: /^Selecionar elegíveis no recorte/ })).toBeEnabled();
}

async function openPlanning(page: Page) {
  const unexpected = await prepare(page);
  await page.goto("/select-fazenda");
  await page.getByRole("button").filter({ hasText: "Fazenda de teste" }).click();
  await selectProtocol(page);
  return unexpected;
}

async function reviewSelection(page: Page) {
  await selectAllForPlanning(page);
  await page.getByRole("button", { name: "Planejar selecionados", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Revisar planejamento sanitário", exact: true })).toBeVisible();
}

async function selectAllForPlanning(page: Page) {
  await page.getByRole("button", { name: /^Selecionar elegíveis no recorte/ }).click();
}

async function confirmPlanning(page: Page) {
  await page.getByRole("button", { name: "Confirmar e gerar Agenda", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function openHomologated(page: Page) {
  const unexpected = await prepare(page);
  await page.goto("/select-fazenda?homologado");
  await page.getByRole("button").filter({ hasText: "Fazenda de teste" }).click();
  await expect(page.getByRole("heading", { name: "Central Sanitária", exact: true })).toBeVisible();
  return unexpected;
}

type BootstrapItem = (typeof initialBootstrap.groups)[number]["item_versions"][number];

function assertPublishedSourceCoverage(actual: (typeof homologatedCatalog.items)[number]) {
    for (const ref of Object.values(actual.source_refs_by_field).flat()) {
        const sourceId = "id" in ref ? ref.id : null;
        const metadata = "metadata" in ref ? ref.metadata : null;
        const coverageIds = metadata && "coverage_ids" in metadata ? metadata.coverage_ids : [];
        expect(homologatedCatalog.sources.some(source => source.id === sourceId)).toBe(true);
        expect(coverageIds.length).toBeGreaterThan(0);
        for (const id of coverageIds) {
          expect(homologatedCatalog.coverage.some(coverage => coverage.id === id && coverage.source_id === sourceId)).toBe(true);
        }
    }
}

async function assertPublishedItemDetails(page: Page, expected: BootstrapItem) {
      const article = page.getByRole("article", { name: `${expected.logical_item_key} — versão ${expected.version}`, exact: true });
      await expect(article.getByText("Versão do item", { exact: true }).locator("..").getByText(`v${expected.version}`, { exact: true })).toBeVisible();
      const row = homologatedCatalog.items.find(item => item.id === expected.id)!;
      const titles = new Set(Object.values(row.source_refs_by_field).flatMap(refs => refs.map(ref => ref.title)));
      for (const title of titles) await expect(article.getByText(title, { exact: true }).first()).toBeVisible();
      const coverageIds = new Set(Object.values(row.source_refs_by_field).flatMap(refs => refs.flatMap(ref => ref.metadata.coverage_ids)));
      for (const id of coverageIds) await expect(article.getByText(new RegExp(id)).first()).toBeVisible();
      await expect(article.getByText("Limitações operacionais", { exact: true })).toBeVisible();
      if (expected.logical_item_key === "raiva_primovac_dose1") {
        await article.screenshot({ path: "scratch/sanitary-vf2-rabies-catalog.png" });
      }
}

async function assertPublishedProtocol(page: Page, protocol: (typeof homologatedCatalog.protocols)[number], expectedItems: BootstrapItem[]) {
    await page.getByRole("button").filter({ hasText: protocol.family_code }).click();
    const details = page.getByRole("button", { name: "Limitações e detalhes técnicos", exact: true });
    for (const trigger of await details.all()) await trigger.click();
    await expect(page.getByText("Versão do item", { exact: true }).first()).toBeVisible();
    for (const expected of expectedItems.filter(item => homologatedCatalog.items.find(row => row.id === item.id)?.protocol_id === protocol.id)) {
      await assertPublishedItemDetails(page, expected);
    }
}

test("VF2 catálogo homologado mantém IDs, versões, fontes e restrições verificáveis", async ({ page }) => {
  const unexpected = await openHomologated(page);
  const expectedItems = initialBootstrap.groups.flatMap(group => group.item_versions);
  expect(expectedItems).toHaveLength(12);
  for (const expected of expectedItems) {
    const actual = homologatedCatalog.items.find(item => item.id === expected.id);
    expect(actual).toMatchObject({ version: expected.version, logical_item_key: expected.logical_item_key, status: "active" });
    assertPublishedSourceCoverage(actual!);
  }
  const persisted = await page.evaluate(async () => {
    const { db } = await import("/src/lib/offline/db.ts");
    return { protocols: await db.catalog_sanitario_protocolos_v2.toArray(), items: await db.catalog_sanitario_protocolo_itens_versions_v2.toArray() };
  });
  const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  expect(byId(persisted.protocols)).toEqual(byId(homologatedCatalog.protocols));
  expect(byId(persisted.items)).toEqual(byId(homologatedCatalog.items));
  await page.getByRole("tab", { name: "Catálogo sanitário", exact: true }).click();
  await page.getByRole("button", { name: "Abrir catálogo sanitário", exact: true }).click();
  const approvedFamilies = homologatedCatalog.protocols.filter(protocol => protocol.status === "active" && protocol.approval_status === "approved");
  expect(approvedFamilies).toHaveLength(9);
  for (const protocol of approvedFamilies) {
    await assertPublishedProtocol(page, protocol, expectedItems);
  }
  expect(await counts(page)).toMatchObject({ agendas: 0, events: 0, queue: 0 });
  expect(unexpected).toEqual([]);
});

async function counts(page: Page) {
  return page.evaluate(async () => {
    const { db } = await import("/src/lib/offline/db.ts");
    return { agendas: await db.ops_sanitario_agenda_v2.count(), events: await db.event_eventos.count(),
      movements: await db.state_insumo_movimentacoes.count(), queue: await db.queue_ops.count(), products: await db.catalog_sanitario_produtos_v2.count() };
  });
}

for (const width of [390, 1280]) {
  test(`triagem → revisão manual → Agenda em ${width}px, offline, reload e isolamento`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 844 });
    const unexpected = await openPlanning(page);
    // Reading/filtering the triage never materializes an intention or a fact.
    expect(await counts(page)).toMatchObject({ agendas: 0, events: 0, movements: 0, queue: 0 });
    await selectAllForPlanning(page);
    await context.setOffline(true);
    await page.getByRole("button", { name: "Planejar selecionados", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Revisar planejamento sanitário", exact: true })).toBeVisible();
    const review = page.getByRole("dialog");
    await expect(review).toContainText("Bezerra teste 101");
    await expect(review).toContainText("Bezerra teste 102");
    await expect(review).not.toContainText("Bezerro teste 201");
    await expect(review).not.toContainText("Outra fazenda 301");
    expect(await counts(page)).toMatchObject({ agendas: 0, events: 0 });
    await page.getByRole("button", { name: "Voltar à seleção", exact: true }).click();
    expect(await counts(page)).toMatchObject({ agendas: 0, events: 0 });
    await page.getByRole("button", { name: "Planejar selecionados", exact: true }).click();
    await confirmPlanning(page);
    await expect.poll(() => counts(page)).toMatchObject({ agendas: 1, events: 0, movements: 0, queue: 0 });
    await page.getByLabel("Filtrar por situação", { exact: true }).selectOption("scheduled");
    await expect(page.getByRole("button", { name: /^Selecionar elegíveis no recorte/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Planejar selecionados", exact: true })).toBeDisabled();
    await context.setOffline(false);
    await page.reload();
    await page.getByRole("tab", { name: "Agenda sanitária", exact: true }).click();
    await page.getByRole("button", { name: "Ver agendas", exact: true }).first().click();
    await page.getByRole("button", { name: "Reagendar", exact: true }).first().click();
    await page.getByLabel("Nova data planejada").fill("2026-07-11");
    await page.getByRole("button", { name: "Salvar nova data" }).click();
    await expect(page.getByText("11/07/2026", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Trocar fazenda", exact: true }).click();
    await page.getByRole("button").filter({ hasText: "Outra fazenda" }).click();
    await page.getByRole("tab", { name: "Agenda sanitária", exact: true }).click();
    await expect(page.getByRole("button", { name: "Reagendar", exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Trocar fazenda", exact: true }).click();
    await page.getByRole("button").filter({ hasText: "Fazenda de teste" }).click();
    await page.getByRole("tab", { name: "Agenda sanitária", exact: true }).click();
    await page.getByRole("button", { name: "Ver agendas", exact: true }).first().click();
    await page.getByRole("button", { name: "Cancelar agenda", exact: true }).first().click();
    await expect(page.getByText("Cancelada", { exact: true })).toBeVisible();
    expect(await counts(page)).toMatchObject({ agendas: 1, events: 0, movements: 0, queue: 0 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(unexpected).toEqual([]);
  });
}

test("revisão coletiva revalida nascimento, sexo e data antes de gravar", async ({ page }) => {
  const unexpected = await openPlanning(page);
  await reviewSelection(page);
  await page.evaluate(async () => {
    const { db } = await import("/src/lib/offline/db.ts");
    await db.state_animais.update("female-test-2", { data_nascimento: null, sexo: null });
  });
  await expect(page.getByRole("button", { name: "Confirmar e gerar Agenda", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Remover excluídos e continuar", exact: true }).click();
  await page.getByLabel("Data planejada da Agenda", { exact: true }).fill("2026-12-04");
  await expect(page.getByRole("button", { name: "Confirmar e gerar Agenda", exact: true })).toBeDisabled();
  expect(await counts(page)).toMatchObject({ agendas: 0, events: 0, movements: 0 });
  await page.getByLabel("Data planejada da Agenda", { exact: true }).fill("2026-07-04");
  await confirmPlanning(page);
  const participants = await page.evaluate(async () => (await import("/src/lib/offline/db.ts")).db.ops_sanitario_agenda_animais_v2.toArray());
  expect(participants.map(row => row.animal_id)).toEqual(["female-test"]);
  expect(unexpected).toEqual([]);
});

type RecoveryWindow = Window & {
  sanitaryRecoveryAuth: { set(state: "valid" | "expired" | "signed_out"): void };
  sanitaryRecoveryContext: { refreshSettings(): Promise<void>; setActiveFarm(id: string): Promise<void> };
  sanitaryRecoveryPending?: Promise<void>;
};

async function openRecovery(page: Page, api?: (route: Route, unexpected: string[]) => Promise<void>) {
  const unexpected = await prepare(page, api);
  await page.goto("/select-fazenda?homologado&recovery");
  await page.getByRole("button").filter({ hasText: "Fazenda de teste" }).click();
  await expect(page.getByLabel("Fazenda ativa na fixture", { exact: true })).toHaveText(farm);
  await expect(page.getByRole("heading", { name: "Central Sanitária", exact: true })).toBeVisible();
  return unexpected;
}

async function recoveryAuth(page: Page, state: "valid" | "expired" | "signed_out") {
  await page.evaluate(state => (window as unknown as RecoveryWindow).sanitaryRecoveryAuth.set(state), state);
}

async function recoveryPreview(page: Page) {
  // Recovery exercises the current manually plannable B19 fixture. Published
  // rabies metadata remains available for the independent catalog assertions.
  await selectProtocol(page);
  await page.getByLabel("Filtrar por animal", { exact: true }).selectOption("00000000-0000-4000-8000-000000000101");
  await page.getByRole("button", { name: /^Selecionar elegíveis no recorte/ }).click();
  await page.getByRole("button", { name: "Planejar selecionados", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Revisar planejamento sanitário", exact: true })).toBeVisible();
}

async function recoverySnapshot(page: Page) {
  return page.evaluate(async () => {
    const { db } = await import("/src/lib/offline/db.ts");
    return { agendas: await db.ops_sanitario_agenda_v2.toArray(), animals: await db.ops_sanitario_agenda_animais_v2.toArray(),
      ops: await db.queue_ops.toArray(), gestures: await db.queue_gestures.toArray(),
      events: await db.event_eventos.count(), movements: await db.state_insumo_movimentacoes.count(),
      pushFlag: localStorage.getItem("rebanhosync:sanitario-v2-push"),
      rabies: (await db.catalog_sanitario_protocolo_itens_versions_v2.toArray()).filter(item => item.logical_item_key.startsWith("raiva_") && item.status === "active")
        .map(item => ({ id: item.id, limitations: item.limitations })),
    };
  });
}

async function confirmRecoveryPlanning(page: Page) {
  await page.evaluate(async farmId => {
    const cut = await import("/src/lib/offline/sanitarioV2Cutover.ts");
    await cut.applySanitarioV2Cutover(farmId, async () => {});
    cut.setSanitarioV2PushEnabled(true, "local");
  }, farm);
  try { await confirmPlanning(page); }
  finally {
    await page.evaluate(async () => (await import("/src/lib/offline/sanitarioV2Cutover.ts")).setSanitarioV2PushEnabled(false, "local"));
  }
}

async function queueRecoveryAgenda(page: Page) {
  await page.evaluate(async farmId => {
    const { db } = await import("/src/lib/offline/db.ts");
    const cut = await import("/src/lib/offline/sanitarioV2Cutover.ts");
    const manual = await import("/src/lib/sanitario/agenda/sanitaryManualAgendaV2.ts");
    if (await db.queue_ops.count()) return;
    if (await db.ops_sanitario_agenda_v2.count()) throw new Error("Expected an empty recovery fixture before manual creation");
    // Only synthetic local cutover; no backend or automatic-plan writer.
    await cut.applySanitarioV2Cutover(farmId, async () => {});
    cut.setSanitarioV2PushEnabled(true, "local");
    try {
      await manual.createManualSanitaryAgendaV2({
        target: { scope: "animal", id: "00000000-0000-4000-8000-000000000101", fazendaId: farmId },
        source: { kind: "sanitary_precheck_preview_v2", protocolId: "00000000-0000-4000-8000-000000000030",
          protocolItemVersionId: "00000000-0000-4000-8000-000000000040",
          familyCode: "brucelose_b19", itemKey: "b19_femeas_3_8_meses", itemLabel: "Avaliação B19", protocolName: "Brucelose B19 — teste",
          precheckStatus: "in_action_window" },
        plannedFor: "2026-07-05", clientOpId: crypto.randomUUID(), confirmed: true,
        syncContext: { projectRef: "local", clientId: "sanitary-recovery-fixture" },
      });
    } finally { cut.setSanitarioV2PushEnabled(false, "local"); }
  }, farm);
}

async function processRecoveryQueue(page: Page) {
  await page.evaluate(async () => {
    const { db } = await import("/src/lib/offline/db.ts");
    const { processGesture } = await import("/src/lib/offline/syncWorker.ts");
    for (const gesture of await db.queue_gestures.toArray()) await processGesture(gesture);
  });
}

function isHeldSettingsRead(route: Route, hold: boolean) {
  return hold && route.request().method() === "GET" && new URL(route.request().url()).pathname.endsWith("/user_settings");
}

test("VF3 sessão expirada preserva intenção e fila, bloqueia escrita e recupera a mesma conta", async ({ page, context }, testInfo) => {
  const batches: unknown[] = [];
  const unexpected = await openRecovery(page, async (route, violations) => {
    if (new URL(route.request().url()).pathname.endsWith("/sync-batch")) {
      batches.push(route.request().postDataJSON());
      return route.fulfill({ status: 503, json: { message: "Backend sintético indisponível; nenhuma operação aceita" } });
    }
    return fulfillSyntheticApi(route, violations);
  });
  // Dev-server modules must already be loaded before the browser goes offline.
  await page.evaluate(async () => { await import("/src/lib/offline/syncWorker.ts"); });
  await recoveryPreview(page);
  await context.setOffline(true);
  await confirmRecoveryPlanning(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await queueRecoveryAgenda(page);
  const queued = await recoverySnapshot(page);
  expect(queued.agendas).toHaveLength(1);
  expect(queued.ops).toHaveLength(1);
  await recoveryAuth(page, "expired");
  await expect(page.getByRole("button", { name: "Confirmar e gerar Agenda", exact: true })).toHaveCount(0);
  await processRecoveryQueue(page);
  expect(batches).toEqual([]);
  await context.setOffline(false);
  await processRecoveryQueue(page);
  expect(batches).toEqual([]);
  await recoveryAuth(page, "signed_out");
  await expect(page.getByText("Sessão encerrada — fixture VF3", { exact: true })).toBeVisible();
  const denied = await page.evaluate(async () => {
    const { requireTenantSensitiveWrite } = await import("/src/lib/offline/localReadBoundary.ts");
    try { await requireTenantSensitiveWrite(); return "UNEXPECTED_WRITE_AUTHORIZATION"; } catch (error) { return (error as Error).name; }
  });
  expect(denied).toBe("LocalOwnershipError");
  await processRecoveryQueue(page);
  expect(batches).toEqual([]);
  const signedOut = await recoverySnapshot(page);
  expect(signedOut.agendas).toEqual(queued.agendas);
  expect(signedOut.ops.map(op => op.client_op_id)).toEqual(queued.ops.map(op => op.client_op_id));
  await recoveryAuth(page, "valid");
  await page.goto("/select-fazenda?homologado&recovery");
  await page.getByRole("button").filter({ hasText: "Fazenda de teste" }).click();
  await expect(page.getByRole("heading", { name: "Central Sanitária", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const { recoverErroredGesturesOnce } = await import("/src/lib/offline/syncWorker.ts");
    await recoverErroredGesturesOnce();
  });
  await page.clock.fastForward(120_000);
  await processRecoveryQueue(page);
  expect(batches).toHaveLength(1);
  const restored = await recoverySnapshot(page);
  expect(restored.agendas).toEqual(queued.agendas);
  expect(restored.ops.map(op => op.client_op_id)).toEqual(queued.ops.map(op => op.client_op_id));
  expect(restored.gestures.every(gesture => gesture.status !== "DONE")).toBe(true);
  expect(restored).toMatchObject({ events: 0, movements: 0, pushFlag: null });
  expect(restored.rabies).toHaveLength(3);
  expect(restored.rabies.every(item => item.limitations.includes("no_agenda_auto"))).toBe(true);
  expect(unexpected).toEqual([]);
  await testInfo.attach("vf3-session-evidence", { body: JSON.stringify({ queued, signedOut, restored, syntheticBatchAttempts: batches.length }), contentType: "application/json" });
});

test("VF3 farm-switch descarta contexto regional e refreshSettings atrasados de A", async ({ page }, testInfo) => {
  let holdSettings = false;
  let settingsWaiting = false;
  let regionWaiting = false;
  let releaseSettings!: () => void;
  let releaseRegion!: () => void;
  const settingsBarrier = new Promise<void>(resolve => { releaseSettings = resolve; });
  const regionBarrier = new Promise<void>(resolve => { releaseRegion = resolve; });
  const unexpected = await openRecovery(page, async (route, violations) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/fazendas") && url.searchParams.get("select") === "municipio" && url.searchParams.get("id") === `eq.${farm}`) {
      regionWaiting = true; await regionBarrier;
      return route.fulfill({ json: { municipio: "Município antigo A" } });
    }
    if (isHeldSettingsRead(route, holdSettings)) {
      settingsWaiting = true; await settingsBarrier;
      return route.fulfill({ json: { active_fazenda_id: farm } });
    }
    if (url.pathname.endsWith("/user_fazendas") && syntheticSingleRequest(route)) {
      return route.fulfill({ json: { role: url.searchParams.get("fazenda_id") === `eq.${otherFarm}` ? "manager" : "owner" } });
    }
    return fulfillSyntheticApi(route, violations);
  });
  try {
    await page.evaluate(async farmId => {
      const { db } = await import("/src/lib/offline/db.ts");
      const animal = await db.state_animais.get("00000000-0000-4000-8000-000000000103");
      await db.state_animais.put({ ...animal!, id: "vf3-farm-b-animal", fazenda_id: farmId, identificacao: "VF3 animal B" });
      await db.state_fazenda_sanidade_config.put({ fazenda_id: farmId, uf: "SC", payload: {}, created_at: "2026-07-04", updated_at: "2026-07-04", deleted_at: null } as never);
    }, otherFarm);
    await expect.poll(() => regionWaiting).toBe(true);
    await recoveryPreview(page);
    holdSettings = true;
    await page.evaluate(() => { const scope = window as unknown as RecoveryWindow; scope.sanitaryRecoveryPending = scope.sanitaryRecoveryContext.refreshSettings(); });
    await expect.poll(() => settingsWaiting).toBe(true);
    // The real context setter also covers a switch arriving while a modal is open.
    await page.evaluate(farmId => (window as unknown as RecoveryWindow).sanitaryRecoveryContext.setActiveFarm(farmId), otherFarm);
    await expect(page.getByLabel("Fazenda ativa na fixture", { exact: true })).toHaveText(otherFarm);
    await expect(page.getByRole("dialog", { name: "Revisar planejamento sanitário", exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Selecionar Matriz integral para Agenda", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Planejar selecionados", exact: true })).toBeDisabled();
    releaseRegion();
    releaseSettings();
    await page.evaluate(() => (window as unknown as RecoveryWindow).sanitaryRecoveryPending);
    await expect(page.getByLabel("Fazenda ativa na fixture", { exact: true })).toHaveText(otherFarm);
    await expect(page.getByLabel("Papel ativo na fixture", { exact: true })).toHaveText("manager");
    await expect(page.getByLabel("Selecionar Matriz integral para Agenda", { exact: true })).toHaveCount(0);
    const state = await recoverySnapshot(page);
    expect(state).toMatchObject({ agendas: [], events: 0, movements: 0, pushFlag: null });
    expect(unexpected).toEqual([]);
    await testInfo.attach("vf3-farm-switch-evidence", { body: JSON.stringify({ state, activeFarm: otherFarm, delayedSettings: settingsWaiting, delayedRegion: regionWaiting }), contentType: "application/json" });
  } finally { releaseSettings(); releaseRegion(); }
});

test("VF3 restart real do contexto Chromium preserva Agenda e fila offline sem duplicidade", async ({ browserName }, testInfo) => {
  test.skip(browserName !== "chromium", "Perfil persistente deste cenário usa Chromium");
  test.setTimeout(120_000);
  const profile = await mkdtemp(resolve("scratch/sanitary-vf3-profile-"));
  const first = await chromium.launchPersistentContext(profile, { headless: true, baseURL: "http://127.0.0.1:4187" });
  let second: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined;
  try {
    const firstPage = first.pages()[0];
    const firstUnexpected = await openRecovery(firstPage);
    await first.setOffline(true);
    await recoveryPreview(firstPage);
    await confirmRecoveryPlanning(firstPage);
    await expect(firstPage.getByRole("dialog")).toHaveCount(0);
    await queueRecoveryAgenda(firstPage);
    const before = await recoverySnapshot(firstPage);
    expect(before.agendas).toHaveLength(1);
    expect(before.ops).toHaveLength(1);
    const originalBrowser = first.browser();
    await first.close();
    expect(originalBrowser?.isConnected()).toBe(false);
    second = await chromium.launchPersistentContext(profile, { headless: true, baseURL: "http://127.0.0.1:4187" });
    const secondPage = second.pages()[0];
    // Vite serves the app shell locally; no assertion of production PWA cold-cache support.
    const secondUnexpected = await prepare(secondPage);
    await secondPage.goto("/protocolos-sanitarios?homologado&recovery");
    await expect(secondPage.getByRole("heading", { name: "Central Sanitária", exact: true })).toBeVisible();
    const rehydrated = await recoverySnapshot(secondPage);
    expect(rehydrated.agendas).toEqual(before.agendas);
    expect(rehydrated.ops).toEqual(before.ops);
    await second.setOffline(true);
    await secondPage.getByRole("tab", { name: "Agenda sanitária", exact: true }).click();
    await expect.poll(() => recoverySnapshot(secondPage)).toMatchObject({ agendas: before.agendas, ops: before.ops });
    await second.setOffline(false);
    const after = await recoverySnapshot(secondPage);
    expect(after.agendas).toEqual(before.agendas);
    expect(after.ops.map(op => op.client_op_id)).toEqual(before.ops.map(op => op.client_op_id));
    expect(after).toMatchObject({ events: 0, movements: 0, pushFlag: null });
    expect(firstUnexpected).toEqual([]);
    expect(secondUnexpected).toEqual([]);
    await testInfo.attach("vf3-real-context-restart-evidence", { body: JSON.stringify({ profile, closedOriginalBrowser: !originalBrowser?.isConnected(), before, rehydrated, after }), contentType: "application/json" });
  } finally { await first.close(); await second?.close(); }
});

test("VF3 papel atrasado de A não sobrevive à troca para B e ao logout", async ({ page }, testInfo) => {
  let holdRole = false;
  let roleWaiting = false;
  let releaseRole!: () => void;
  const barrier = new Promise<void>(resolve => { releaseRole = resolve; });
  const unexpected = await openRecovery(page, async (route, violations) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/user_fazendas") && syntheticSingleRequest(route)) {
      const isA = url.searchParams.get("fazenda_id") === `eq.${farm}`;
      if (isA && holdRole) { roleWaiting = true; await barrier; }
      return route.fulfill({ json: { role: isA ? "owner" : "manager" } });
    }
    return fulfillSyntheticApi(route, violations);
  });
  try {
    holdRole = true;
    await page.evaluate(farmId => {
      const scope = window as unknown as RecoveryWindow;
      scope.sanitaryRecoveryPending = scope.sanitaryRecoveryContext.setActiveFarm(farmId);
    }, farm);
    await expect.poll(() => roleWaiting).toBe(true);
    await page.evaluate(farmId => (window as unknown as RecoveryWindow).sanitaryRecoveryContext.setActiveFarm(farmId), otherFarm);
    await expect(page.getByLabel("Papel ativo na fixture", { exact: true })).toHaveText("manager");
    await recoveryAuth(page, "signed_out");
    await expect(page.getByText("Sessão encerrada — fixture VF3", { exact: true })).toBeVisible();
    releaseRole();
    await page.evaluate(() => (window as unknown as RecoveryWindow).sanitaryRecoveryPending);
    await expect(page.getByLabel("Fazenda ativa na fixture", { exact: true })).toHaveText("nenhuma");
    await expect(page.getByLabel("Papel ativo na fixture", { exact: true })).toHaveText("nenhum");
    const state = await recoverySnapshot(page);
    expect(state).toMatchObject({ agendas: [], ops: [], events: 0, movements: 0, pushFlag: null });
    expect(unexpected).toEqual([]);
    await testInfo.attach("vf3-delayed-role-logout-evidence", { body: JSON.stringify({ roleWaiting, activeFarm: null, role: null, state }), contentType: "application/json" });
  } finally { releaseRole(); }
});

test("VF3 HTTP 401 sintético interrompe retry até reautenticação e preserva a identidade", async ({ page }, testInfo) => {
  const batches: { ops: { client_op_id: string }[] }[] = [];
  let expiredOnServer = true;
  const unexpected = await openRecovery(page, async (route, violations) => {
    if (new URL(route.request().url()).pathname.endsWith("/sync-batch")) {
      batches.push(route.request().postDataJSON());
      if (expiredOnServer) {
        await recoveryAuth(page, "expired");
        return route.fulfill({ status: 401, json: { message: "JWT sintético expirado; nenhuma operação aceita" } });
      }
      return route.fulfill({ status: 503, json: { message: "Backend sintético indisponível; nenhuma operação aceita" } });
    }
    return fulfillSyntheticApi(route, violations);
  });
  await queueRecoveryAgenda(page);
  const before = await recoverySnapshot(page);
  await processRecoveryQueue(page);
  expect(batches).toHaveLength(1);
  const blocked = await recoverySnapshot(page);
  expect(blocked.gestures[0]).toMatchObject({ status: "ERROR", diagnostics: { blocked: { code: "AUTH_UNAVAILABLE" } } });
  await processRecoveryQueue(page);
  expect(batches).toHaveLength(1);
  await recoveryAuth(page, "valid");
  expiredOnServer = false;
  await page.evaluate(async () => {
    const { recoverErroredGesturesOnce } = await import("/src/lib/offline/syncWorker.ts");
    await recoverErroredGesturesOnce();
  });
  await processRecoveryQueue(page);
  expect(batches).toHaveLength(2);
  expect(batches[1]).toEqual(batches[0]);
  const after = await recoverySnapshot(page);
  expect(after.ops.map(op => op.client_op_id)).toEqual(before.ops.map(op => op.client_op_id));
  expect(after.agendas).toEqual(before.agendas);
  expect(after).toMatchObject({ events: 0, movements: 0, pushFlag: null });
  expect(unexpected).toEqual([]);
  await testInfo.attach("vf3-http401-evidence", { body: JSON.stringify({ before, blocked, after, attempts: batches.length, samePayloadOnRetry: true }), contentType: "application/json" });
});

test("VF3 catálogo HTTP atrasado durante preview de A preserva contexto de B", async ({ page }, testInfo) => {
  let waiting = false;
  let delivered = false;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const unexpected = await openRecovery(page, async (route, violations) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/sanitario_protocolos_v2")) {
      waiting = true; await barrier;
      await route.fulfill({ json: homologatedCatalog.protocols });
      delivered = true;
      return;
    }
    if (pathname.endsWith("/sanitario_protocolo_itens_versions_v2")) return route.fulfill({ json: homologatedCatalog.items });
    return fulfillSyntheticApi(route, violations);
  });
  try {
    await page.locator("summary").filter({ hasText: "Catálogo sanitário" }).click();
    await page.getByRole("button", { name: "Atualizar catálogo", exact: true }).click();
    await expect.poll(() => waiting).toBe(true);
    await recoveryPreview(page);
    await page.evaluate(farmId => (window as unknown as RecoveryWindow).sanitaryRecoveryContext.setActiveFarm(farmId), otherFarm);
    await expect(page.getByLabel("Fazenda ativa na fixture", { exact: true })).toHaveText(otherFarm);
    await expect(page.getByRole("dialog", { name: "Revisar planejamento sanitário", exact: true })).toHaveCount(0);
    release();
    await expect.poll(() => delivered).toBe(true);
    await expect(page.getByText(/Nenhum animal ativo disponível nesta fazenda/)).toBeVisible();
    await expect(page.getByLabel("Selecionar Matriz integral para Agenda", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Fazenda ativa na fixture", { exact: true })).toHaveText(otherFarm);
    const state = await recoverySnapshot(page);
    expect(state).toMatchObject({ agendas: [], ops: [], events: 0, movements: 0, pushFlag: null });
    expect(unexpected).toEqual([]);
    await testInfo.attach("vf3-delayed-catalog-evidence", { body: JSON.stringify({ waiting, delivered, activeFarm: otherFarm, state }), contentType: "application/json" });
  } finally { release(); }
});

test("catálogo vazio informa indisponibilidade sem fabricar protocolos ou produtos", async ({ page }) => {
  const unexpected = await prepare(page);
  await page.goto("/select-fazenda?empty=1");
  await page.getByRole("button").filter({ hasText: "Fazenda de teste" }).click();
  await expect(page.getByText(/Nenhum item de protocolo disponível no catálogo local/)).toBeVisible();
  await page.getByRole("tab", { name: "Catálogo sanitário", exact: true }).click();
  await page.getByRole("button", { name: "Abrir catálogo sanitário", exact: true }).click();
  await page.getByRole("button", { name: "Atualizar catálogo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Atualizar catálogo", exact: true })).toBeEnabled();
  expect(await counts(page)).toEqual({ agendas: 0, events: 0, movements: 0, queue: 0, products: 0 });
  expect(unexpected).toEqual([]);
});

test("catálogo observa o primeiro download após leitura vazia sem recarregar", async ({ page }) => {
  let delivered = false;
  const unexpected = await prepare(page, async (route, requests) => {
    if (new URL(route.request().url()).pathname.endsWith("/sanitario_protocolos_v2")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(delivered ? [{
        id: protocol, family_code: "synthetic_reactive", name: "Download sintético reativo",
        scope: "global", fazenda_id: null, version: 1, status: "active", approval_status: "approved",
        metadata: { synthetic: true }, updated_at: "2026-07-04T12:00:00Z", deleted_at: null,
      }] : []) });
    }
    return fulfillSyntheticApi(route, requests);
  });
  await page.goto("/select-fazenda?empty");
  await page.getByRole("button").filter({ hasText: "Fazenda de teste" }).click();
  await page.goto("/protocolos-sanitarios/catalogo-v2?empty");
  await expect(page.getByRole("button", { name: "Atualizar catálogo", exact: true })).toBeEnabled();
  await expect(page.getByText("Nenhum protocolo disponível no catálogo global.")).toBeVisible();
  delivered = true;
  await page.getByRole("button", { name: "Atualizar catálogo", exact: true }).click();
  await expect(page.getByText("Consulta remota concluída.")).toBeVisible();
  await expect(page.getByText("Download sintético reativo").first()).toBeVisible();
  expect(unexpected).toEqual([]);
});
