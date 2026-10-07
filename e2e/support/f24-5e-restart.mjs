import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// A real module reference lets tooling identify this spawned entry without suppression.
export const restartFixturePath = fileURLToPath(import.meta.url);

function fixtureModule(pathname, origin) {
  if (pathname === '/src/lib/env.ts') return `export const env = { supabaseFunctionsUrl: '${origin}/__fixture', supabasePublishableKey: 'fixture' }; export function validateEnv() {}`;
  if (pathname === '/src/lib/supabase.ts') return `const session = { access_token: 'synthetic-fixture', expires_at: 9999999999, user: { id: 'f24-5e-owner' } }; export const supabase = { auth: { getSession: async () => ({ data: { session }, error: null }), refreshSession: async () => ({ data: { session }, error: null }) } };`;
  if (pathname === '/src/lib/offline/pull.ts') return `export const DEFAULT_REMOTE_TABLES = []; export async function pullDataForFarm() { if (!globalThis.f24PullReady) throw new TypeError('Failed to fetch'); } export const pullInitialData = pullDataForFarm; export const pullSanitarioAgendaV2 = pullDataForFarm; export const pullSanitarioV2CutoverState = pullDataForFarm;`;
}

async function runRestartFixture() {

// Dedicated child process: the parent kills this tree, including Chromium.
const [profile, phase] = process.argv.slice(2);
const origin = 'http://127.0.0.1:4173';
const context = await chromium.launchPersistentContext(profile, { headless: true });
console.error('fixture: Chromium launched');
let transport = 'fail';
let telemetry = 'accept';
const deliveries = [];
await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.origin !== origin) return route.abort();
  if (url.pathname === '/__f24_5e') {
    return route.fulfill({ contentType: 'text/html', body: '<title>F24.5E isolated fixture</title>' });
  }
  const module = fixtureModule(url.pathname, origin);
  if (module) return route.fulfill({ contentType: 'application/javascript', body: module });
  if (url.pathname === '/__fixture/sync-batch') {
    if (transport === 'fail') return route.abort('failed');
    const { ops } = route.request().postDataJSON();
    return route.fulfill({ json: { results: ops.map(op => ({ op_id: op.client_op_id, client_op_id: op.client_op_id, status: 'APPLIED' })) } });
  }
  if (url.pathname === '/__fixture/telemetry-ingest') {
    const { events } = route.request().postDataJSON();
    if (telemetry === 'accept') deliveries.push(...events.map(event => ({ id: event.id, farm: event.fazenda_id })));
    return telemetry === 'accept'
      ? route.fulfill({ json: { success: true, inserted: events.length } })
      : route.abort('failed');
  }
  return route.continue();
});
const page = await context.newPage();
page.on('pageerror', error => console.error('fixture page error:', error.message));
await page.goto(`${origin}/__f24_5e`);
console.error('fixture: isolated page loaded');

async function snapshot() {
  return page.evaluate(async () => {
    const { db } = await import('/src/lib/offline/db.ts');
    const { loadFarmSyncSummary } = await import('/src/lib/offline/syncQueries.ts');
    const { getFarmSyncHealth, selectFarmSyncSummary } = await import('/src/lib/offline/syncPresentation.ts');
    const farms = ['pending', 'error', 'reconcile', 'healthy'];
    const summaries = await Promise.all(farms.map(farm => loadFarmSyncSummary(`f24-5e-${farm}`)));
    return {
      gestures: await db.queue_gestures.toArray(), ops: await db.queue_ops.toArray(),
      obligations: await db.sync_reconcile_obligations.toArray(), metrics: await db.metrics_events.toArray(),
      cursors: Object.fromEntries(await Promise.all(farms.map(async farm => [farm, (await db.telemetry_flush_cursors.get(`f24-5e-${farm}`)) ?? null]))),
      health: summaries.map(summary => getFarmSyncHealth(summary).stage),
      stale: getFarmSyncHealth(selectFarmSyncSummary(summaries[0], 'f24-5e-healthy')).stage,
    };
  });
}

async function processTx(tx) {
  await page.evaluate(async tx => {
    const { db } = await import('/src/lib/offline/db.ts');
    const { processGesture } = await import('/src/lib/offline/syncWorker.ts');
    await processGesture(await db.queue_gestures.get(tx));
  }, tx);
}

if (phase === 'seed') {
  const ids = await page.evaluate(async () => {
    const { establishLocalOwnership } = await import('/src/lib/offline/ownership.ts');
    const { createGesture } = await import('/src/lib/offline/ops.ts');
    const { db } = await import('/src/lib/offline/db.ts');
    await establishLocalOwnership({ user: { id: 'f24-5e-owner' } });
    const ids = {};
    for (const farm of ['pending', 'error', 'reconcile']) {
      const farmId = `f24-5e-${farm}`;
      ids[farm] = await createGesture(farmId, [{ table: 'insumo_movimentacoes', action: 'INSERT', record: { id: crypto.randomUUID(), fazenda_id: farmId } }]);
    }
    // Arrange exhaustion at the existing functional retry boundary.
    await db.queue_gestures.update(ids.error, { retry_count: 3 });
    return ids;
  });
  console.error('fixture: gestures created');
  await processTx(ids.pending);
  console.error('fixture: pending failure observed');
  await processTx(ids.error);
  console.error('fixture: exhaustion observed');
  transport = 'accept';
  await processTx(ids.reconcile);
  console.error('fixture: ACK observed');
  await page.evaluate(async () => {
    const { drainReconciliationObligations } = await import('/src/lib/offline/syncWorker.ts');
    const { flushPilotMetrics, trackPilotMetric } = await import('/src/lib/telemetry/pilotMetrics.ts');
    await drainReconciliationObligations('f24-5e-reconcile');
    await flushPilotMetrics();
    await trackPilotMetric({ fazendaId: 'f24-5e-pending', eventName: 'sync_backlog', quantity: 1 });
  });
  telemetry = 'fail';
  await page.evaluate(async () => {
    const { flushPilotMetrics } = await import('/src/lib/telemetry/pilotMetrics.ts');
    try { await flushPilotMetrics(); } catch { /* Unconfirmed must survive. */ }
  });
  console.log(JSON.stringify({ phase, browserVersion: context.browser().version(), snapshot: await snapshot(), deliveries }));
} else {
  const before = await snapshot();
  await page.evaluate(async () => {
    const { flushPilotMetrics } = await import('/src/lib/telemetry/pilotMetrics.ts');
    await flushPilotMetrics();
  });
  const replay = [...deliveries];
  transport = 'accept';
  await page.evaluate(async () => {
    const { db } = await import('/src/lib/offline/db.ts');
    const { processGesture, drainReconciliationObligations } = await import('/src/lib/offline/syncWorker.ts');
    globalThis.f24PullReady = true;
    const pending = await db.queue_gestures.where('fazenda_id').equals('f24-5e-pending').first();
    await db.queue_gestures.update(pending.client_tx_id, { next_attempt_at: undefined });
    await processGesture(await db.queue_gestures.get(pending.client_tx_id));
    await drainReconciliationObligations('f24-5e-pending');
    await drainReconciliationObligations('f24-5e-reconcile');
  });
  console.log(JSON.stringify({ phase, browserVersion: context.browser().version(), before, after: await snapshot(), replay }));
}
// Keep both the helper and Chromium alive until the parent forcibly terminates them.
setInterval(() => {}, 1000);
}

if (process.argv[1] === restartFixturePath) await runRestartFixture();
