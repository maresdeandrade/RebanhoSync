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

async function selectProtocol(page: Page) {
  await page.getByLabel("Selecionar protocolo", { exact: true }).selectOption(protocol);
  await page.getByLabel("Selecionar item do protocolo", { exact: true }).selectOption(item);
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

for (const scenario of [
  { key: "raiva_primovac_dose1", previous: null, occurredAt: null },
  { key: "raiva_primovac_reforco_30d", previous: "raiva_primovac_dose1", occurredAt: "2026-06-04" },
  { key: "raiva_reforco_anual_area_risco", previous: "raiva_primovac_reforco_30d", occurredAt: "2025-07-04" },
]) {
  test(`VF2 raiva manual homologada: ${scenario.key}`, async ({ page }) => {
    const unexpected = await openHomologated(page);
    const item = homologatedCatalog.items.find(item => item.logical_item_key === scenario.key && item.status === "active")!;
    expect(item).toMatchObject({ version: 2, allows_agenda_auto: false });
    expect(item.limitations).toContain("no_agenda_auto");
    await page.getByLabel("Selecionar protocolo", { exact: true }).selectOption(item.protocol_id);
    await page.getByLabel("Selecionar item do protocolo", { exact: true }).selectOption(item.id);
    await expect(page.getByLabel("Geração de Agenda", { exact: true })).toHaveValue("manual");
    const selectAnimal = page.getByLabel("Selecionar Matriz integral", { exact: true });
    if (scenario.previous) {
      await expect(selectAnimal).toBeDisabled();
      const previous = homologatedCatalog.items.find(row => row.logical_item_key === scenario.previous && row.status === "active")!;
      await page.evaluate(async ({ previous, target, farmId, occurredAt }) => {
        const { db } = await import("/src/lib/offline/db.ts");
        const source = target.source_refs_by_field.operational_window[0];
        const eventId = "vf2-synthetic-rabies-history";
        const productId = "vf2-synthetic-executed-product";
        const stamp = { created_at: "2026-07-04T12:00:00Z", updated_at: "2026-07-04T12:00:00Z", deleted_at: null };
        await db.event_eventos.put({ id: eventId, fazenda_id: farmId, animal_id: "adult", dominio: "sanitario", occurred_at: `${occurredAt}T12:00:00Z`, payload: {}, ...stamp } as never);
        await db.event_eventos_sanitario.put({ evento_id: eventId, fazenda_id: farmId, protocol_item_version_id: previous.id,
          protocol_item_logical_key: previous.logical_item_key, produto_veterinario_id: productId,
          protocol_item_snapshot: { protocolId: previous.protocol_id, itemKey: previous.logical_item_key },
          produto_snapshot: { executedProductId: productId, product_class: target.product_class,
            fieldEvidence: [{ fieldKey: "operational_window", coverageStatus: "covers", reason: "class_scheme_product_compatibility_verified",
              productSource: { productId }, sourceRef: source, sourceCoverageId: source.metadata.coverage_ids[0] }] },
          payload: {}, ...stamp } as never);
      }, { previous, target: item, farmId: farm, occurredAt: scenario.occurredAt });
    } else {
      // Regional information may be absent for national manual planning.
      await page.evaluate(async (farmId) => {
        const { db } = await import("/src/lib/offline/db.ts");
        await db.state_fazenda_sanidade_config.update(farmId, { uf: null });
      }, farm);
    }
    if (scenario.key === "raiva_reforco_anual_area_risco") {
      await page.getByLabel("Área de risco para raiva", { exact: true }).selectOption("yes");
    }
    await expect(selectAnimal).toBeEnabled();
    await selectAnimal.check();
    const before = await counts(page);
    await page.getByRole("button", { name: "Planejar agenda para selecionados", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Revisar planejamento sanitário", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByText(/^Cuidados técnicos do planejamento/).click();
    await expect(dialog.getByText(scenario.previous
      ? /Regra regional identificada;.*Não comprova obrigação individual/
      : /Cobertura regional não comprovada/)).toBeVisible();
    await dialog.getByRole("button", { name: "Confirmar e gerar Agenda", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Agenda sanitária", exact: true })).toHaveAttribute("aria-selected", "true");
    expect(await counts(page)).toMatchObject({ agendas: 1, events: before.events, movements: 0, queue: 0 });
    const saved = await page.evaluate(async () => {
      const { db } = await import("/src/lib/offline/db.ts");
      return { agendas: await db.ops_sanitario_agenda_v2.toArray(), animals: await db.ops_sanitario_agenda_animais_v2.toArray() };
    });
    expect(saved.agendas[0]).toMatchObject({ fazenda_id: farm, protocol_item_version_id: item.id,
      execution_evento_id: null, protocol_item_snapshot: { generationMode: "manual" },
      metadata: { createsEvent: false, createsStockMovement: false, automationKey: null } });
    expect(saved.animals).toEqual([expect.objectContaining({ fazenda_id: farm, animal_id: "adult" })]);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Central Sanitária", exact: true })).toBeVisible();
    expect(await counts(page)).toMatchObject({ agendas: 1, events: before.events, movements: 0, queue: 0 });
    expect(unexpected).toEqual([]);
  });
}

test("VF2 variantes incompletas, aftosa, automação de raiva e nascimento ausente ficam bloqueados", async ({ page }) => {
  const unexpected = await openHomologated(page);
  await page.getByText("Configurar plano automático", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /^Automatizar .*?(Raiva|aftosa)/i })).toHaveCount(0);
  for (const key of ["fmd_bloqueio_vacinacao_rotina", "lepto_primovac_dose2"]) {
    const item = homologatedCatalog.items.find(item => item.logical_item_key === key)!;
    await page.getByLabel("Selecionar protocolo", { exact: true }).selectOption(item.protocol_id);
    await page.getByLabel("Selecionar item do protocolo", { exact: true }).selectOption(item.id);
    await expect(page.getByLabel("Selecionar todos os elegíveis visíveis", { exact: true })).toBeDisabled();
    await expect(page.getByLabel("Selecionar Matriz integral", { exact: true })).toBeDisabled();
  }
  const rabies = homologatedCatalog.items.find(item => item.logical_item_key === "raiva_primovac_dose1" && item.status === "active")!;
  await page.getByLabel("Selecionar protocolo", { exact: true }).selectOption(rabies.protocol_id);
  await page.getByLabel("Selecionar item do protocolo", { exact: true }).selectOption(rabies.id);
  await page.getByLabel("Geração de Agenda", { exact: true }).selectOption("automatic");
  await expect(page.getByLabel("Selecionar Matriz integral", { exact: true })).toBeDisabled();
  await page.getByLabel("Geração de Agenda", { exact: true }).selectOption("manual");
  await expect(page.getByLabel("Selecionar Matriz integral", { exact: true })).toBeEnabled();
  await page.evaluate(async () => {
    const { db } = await import("/src/lib/offline/db.ts");
    await db.state_animais.update("adult", { data_nascimento: null });
  });
  await expect(page.getByLabel("Selecionar Matriz integral", { exact: true })).toBeDisabled();
  expect(await counts(page)).toMatchObject({ agendas: 0, events: 0, movements: 0, queue: 0 });
  expect(unexpected).toEqual([]);
});

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
  const rabies = homologatedCatalog.items.find(item => item.logical_item_key === "raiva_primovac_dose1" && item.status === "active")!;
  await page.getByLabel("Selecionar protocolo", { exact: true }).selectOption(rabies.protocol_id);
  await page.getByLabel("Selecionar item do protocolo", { exact: true }).selectOption(rabies.id);
  await page.getByLabel("Selecionar Matriz integral", { exact: true }).check();
  await page.getByRole("button", { name: "Planejar agenda para selecionados", exact: true }).click();
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
        .map(item => ({ id: item.id, auto: item.allows_agenda_auto, limitations: item.limitations })),
    };
  });
}

async function queueRecoveryPlan(page: Page) {
  await page.evaluate(async farmId => {
    const { saveSanitaryAutomationPlanV2 } = await import("/src/lib/sanitario/agenda/sanitaryAutomationPlanV2.ts");
    const { EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2 } = await import("/src/lib/sanitario/windows/sanitaryProtocolWindowsV2.ts");
    await saveSanitaryAutomationPlanV2({ fazendaId: farmId, actorId: "00000000-0000-4000-8000-000000000001", expectedRevision: 0,
      draft: { rules: [], context: EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2 }, enabled: false, confirmed: false });
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
  await recoveryAuth(page, "expired");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Confirmar e gerar Agenda", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Agenda sanitária", exact: true })).toHaveAttribute("aria-selected", "true");
  await queueRecoveryPlan(page);
  const queued = await recoverySnapshot(page);
  expect(queued.agendas).toHaveLength(1);
  expect(queued.ops).toHaveLength(1);
  await processRecoveryQueue(page);
  expect(batches).toEqual([]);
  await context.setOffline(false);
  await processRecoveryQueue(page);
  expect(batches).toEqual([]);
  await page.getByRole("tab", { name: "Catálogo sanitário", exact: true }).click();
  await page.getByRole("button", { name: "Abrir catálogo sanitário", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catálogo sanitário v2", exact: true })).toBeVisible();
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
  expect(restored.rabies.every(item => !item.auto)).toBe(true);
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
      const animal = await db.state_animais.get("adult");
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
    await expect(page.getByLabel("Selecionar Matriz integral", { exact: true })).toHaveCount(0);
    const rabies = homologatedCatalog.items.find(item => item.logical_item_key === "raiva_primovac_dose1" && item.status === "active")!;
    await page.getByLabel("Selecionar protocolo", { exact: true }).selectOption(rabies.protocol_id);
    await page.getByLabel("Selecionar item do protocolo", { exact: true }).selectOption(rabies.id);
    await expect(page.getByLabel("Selecionar VF3 animal B", { exact: true })).not.toBeChecked();
    releaseRegion();
    releaseSettings();
    await page.evaluate(() => (window as unknown as RecoveryWindow).sanitaryRecoveryPending);
    await expect(page.getByLabel("Fazenda ativa na fixture", { exact: true })).toHaveText(otherFarm);
    await expect(page.getByLabel("Papel ativo na fixture", { exact: true })).toHaveText("manager");
    await expect(page.getByLabel("Selecionar Matriz integral", { exact: true })).toHaveCount(0);
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
    await firstPage.getByRole("button", { name: "Confirmar e gerar Agenda", exact: true }).click();
    await expect(firstPage.getByRole("tab", { name: "Agenda sanitária", exact: true })).toHaveAttribute("aria-selected", "true");
    await queueRecoveryPlan(firstPage);
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
    const rabies = homologatedCatalog.items.find(item => item.logical_item_key === "raiva_primovac_dose1" && item.status === "active")!;
    await secondPage.getByLabel("Selecionar protocolo", { exact: true }).selectOption(rabies.protocol_id);
    await secondPage.getByLabel("Selecionar item do protocolo", { exact: true }).selectOption(rabies.id);
    await expect(secondPage.getByLabel("Selecionar Matriz integral", { exact: true })).toBeDisabled();
    await expect(secondPage.getByLabel("Selecionar Bezerra integral", { exact: true })).not.toBeChecked();
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
  await queueRecoveryPlan(page);
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
  expect(after).toMatchObject({ agendas: [], events: 0, movements: 0, pushFlag: null });
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
    await page.getByRole("button", { name: "Atualizar catálogo", exact: true }).click();
    await expect.poll(() => waiting).toBe(true);
    await recoveryPreview(page);
    await page.evaluate(farmId => (window as unknown as RecoveryWindow).sanitaryRecoveryContext.setActiveFarm(farmId), otherFarm);
    await expect(page.getByLabel("Fazenda ativa na fixture", { exact: true })).toHaveText(otherFarm);
    await expect(page.getByRole("dialog", { name: "Revisar planejamento sanitário", exact: true })).toHaveCount(0);
    release();
    await expect.poll(() => delivered).toBe(true);
    const rabies = homologatedCatalog.items.find(item => item.logical_item_key === "raiva_primovac_dose1" && item.status === "active")!;
    await page.getByLabel("Selecionar protocolo", { exact: true }).selectOption(rabies.protocol_id);
    await page.getByLabel("Selecionar item do protocolo", { exact: true }).selectOption(rabies.id);
    await expect(page.getByText("Nenhum animal corresponde aos filtros selecionados.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Selecionar Matriz integral", { exact: true })).toHaveCount(0);
    await expect(page.getByLabel("Fazenda ativa na fixture", { exact: true })).toHaveText(otherFarm);
    const state = await recoverySnapshot(page);
    expect(state).toMatchObject({ agendas: [], ops: [], events: 0, movements: 0, pushFlag: null });
    expect(unexpected).toEqual([]);
    await testInfo.attach("vf3-delayed-catalog-evidence", { body: JSON.stringify({ waiting, delivered, activeFarm: otherFarm, state }), contentType: "application/json" });
  } finally { release(); }
});

test("nascimento e sexo ausentes impedem seleção e não criam intenção ou fato", async ({ page }) => {
  const unexpected = await prepare(page);
  await page.goto("/select-fazenda");
  await expect(page.getByRole("button").filter({ hasText: "Fazenda de teste" })).toBeVisible();
  await page.evaluate(async () => {
    const { db } = await import("/src/lib/offline/db.ts");
    const changedBirth = await db.state_animais.update("female-test", { data_nascimento: null });
    const changedSex = await db.state_animais.update("female-test-2", { sexo: null });
    if (changedBirth !== 1 || changedSex !== 1) throw new Error("Fixture ainda não disponível");
  });
  await page.getByRole("button").filter({ hasText: "Fazenda de teste" }).click();
  await selectProtocol(page);
  await expect(page.getByLabel("Selecionar Bezerra teste 101", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Selecionar Bezerra teste 102", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Selecionar todos os elegíveis visíveis", { exact: true })).toBeDisabled();
  expect(await counts(page)).toMatchObject({ agendas: 0, events: 0, movements: 0, queue: 0 });
  expect(unexpected).toEqual([]);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  test(`catálogo navegável offline, raiva restrita e aftosa retirada em ${viewport.width}px`, async ({ page, context }) => {
    const unexpected = await prepare(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize(viewport);
    await page.goto("/select-fazenda?integral");
    await page.getByRole("button").filter({ hasText: "Fazenda de teste" }).click();
    await expect(page.getByRole("heading", { name: "Central Sanitária", exact: true })).toBeVisible();
    const before = await counts(page);
    await page.getByRole("tab", { name: "Catálogo sanitário", exact: true }).click();
    await page.getByRole("button", { name: "Abrir catálogo sanitário", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Catálogo sanitário v2", exact: true })).toBeVisible();
    await context.setOffline(true);
    for (const family of ["brucelose_b19", "clostridioses", "raiva_herbivoros", "leptospirose", "ibr_bvd",
      "controle_parasitario_recria_5_7_9", "vermifugacao_pre_desmama", "vermifugacao_pre_confinamento_pasto_vedado", "matrizes_pre_parto"]) {
      await page.getByRole("button").filter({ hasText: family }).click();
      await expect(page.getByRole("button", { name: "Limitações e detalhes técnicos", exact: true }).first()).toBeVisible();
    }
    await page.getByRole("button").filter({ hasText: "raiva_herbivoros" }).click();
    await page.getByRole("button", { name: "Limitações e detalhes técnicos", exact: true }).first().click();
    await expect(page.getByText("Agenda automática", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("Agenda automática", { exact: true }).last().locator("..").getByText("Não", { exact: true })).toBeVisible();
    await page.getByRole("button").filter({ hasText: "febre_aftosa" }).click();
    await expect(page.getByText("Bloqueado/retirado", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Confirmar e gerar Agenda|Registrar execução/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `scratch/sanitary-functional-catalog-${viewport.width}.png`, fullPage: true });
    expect(await counts(page)).toEqual(before);
    await context.setOffline(false);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Catálogo sanitário v2", exact: true })).toBeVisible();
    expect(await counts(page)).toEqual(before);
    expect(errors).toEqual([]);
    expect(unexpected).toEqual([]);
  });
}

test("plano confirmado gera sozinho, recupera offline e respeita cancelamento e farm-switch", async ({ page, context }) => {
  const unexpected = await prepare(page);
  await page.goto("/select-fazenda?approved");
  await page.getByRole("button").filter({ hasText: "Fazenda de teste" }).click();
  await page.getByText("Configurar plano automático", { exact: true }).click();
  await page.getByRole("checkbox", { name: /^Automatizar Brucelose B19/ }).check();
  await expect(page.getByText(/2 Agenda\(s\) serão criadas/)).toBeVisible();
  await context.setOffline(true);
  await page.getByLabel("Confirmar ativação do plano", { exact: true }).check();
  await page.getByRole("button", { name: "Ativar plano automático", exact: true }).click();
  await expect(page.getByText("Plano automático ativo", { exact: true })).toBeVisible();
  await page.getByText("Configurar plano automático", { exact: true }).click();
  await expect(page.getByText("Agendas geradas automaticamente (2)", { exact: true })).toBeVisible();
  expect(await counts(page)).toMatchObject({ agendas: 2, events: 0, movements: 0, queue: 1 });
  await page.getByRole("button", { name: "Reavaliar plano", exact: true }).click();
  expect(await counts(page)).toMatchObject({ agendas: 2, events: 0 });
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByText("Plano automático ativo", { exact: true })).toBeVisible();
  await page.getByText("Configurar plano automático", { exact: true }).click();
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

test("plano integral exclui itens restritos e automatiza vários protocolos com histórico e recuperação offline", async ({ page, context }) => {
  const unexpected = await prepare(page);
  await page.goto("/select-fazenda?integral");
  await page.getByRole("button").filter({ hasText: "Fazenda de teste" }).click();
  await page.getByText("Configurar plano automático", { exact: true }).click();
  const checkboxes = page.getByRole("checkbox", { name: /^Automatizar / });
  // Six restricted/blocked items are excluded from automatic rule choices.
  await expect(checkboxes).toHaveCount(14);
  await expect(page.getByText("Plano automático desativado", { exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /^Automatizar .*?(Raiva|aftosa)/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Consultar catálogo sanitário", exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.getByLabel("Confirmar ativação do plano", { exact: true }).check();
  await page.getByRole("button", { name: "Ativar plano automático", exact: true }).click();
  await expect(page.getByText("Plano automático ativo", { exact: true })).toBeVisible();
  await page.getByText("Configurar plano automático", { exact: true }).click();
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
