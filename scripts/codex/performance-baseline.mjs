import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { BASELINE_SHA, parseOptions, summarize } from "./performance-contract.mjs";
import { readLocalConnection, seedLocalFixture } from "./performance-local-fixture.mjs";
import { diagnosticTransform, DIAGNOSTIC_LIMITS, receiptSummary, snapshotDigest, transportCode, identity } from './performance-diagnostics.mjs';
import { safeSeedError } from './performance-seed-diagnostics.mjs';
const seedSeries = process.env.REBANHOSYNC_SEED_AB_SERIES ?? null;
const diagnosticMode = process.env.REBANHOSYNC_ACK_DIAGNOSIS === '1';

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
process.chdir(root);
const git = args => execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
const sha = git(["rev-parse", "HEAD"]);
const postAckVariant = process.env.REBANHOSYNC_POST_ACK_VARIANT;
const patchFiles = ["src/lib/offline/pull.ts", "src/lib/offline/syncWorker.ts"];
const patchTests = ["src/lib/offline/__tests__/postAckPull.test.ts", "src/lib/offline/__tests__/postAckSelector.test.ts"];
let patchManifest;
if (postAckVariant) {
  if (!["original", "optimized"].includes(postAckVariant)) throw new Error("INVALID_POST_ACK_VARIANT");
  patchManifest = JSON.parse(readFileSync(resolve(root, "test-results/f24-6/f24-6a1-e1-patch-manifest.json"), "utf8"));
  if (patchManifest.baseline !== BASELINE_SHA || JSON.stringify(Object.keys(patchManifest.files).sort()) !== JSON.stringify([...patchFiles, ...patchTests].sort())) throw new Error("INVALID_PATCH_MANIFEST");
  for (const [file, expected] of Object.entries(patchManifest.files)) {
    if (createHash("sha256").update(readFileSync(resolve(root, file))).digest("hex") !== expected) throw new Error("PATCH_HASH_CHANGED");
  }
}
// CLI update-notice cache is generated tooling metadata, never product config.
const productPaths = ["src", "supabase", "package.json", "pnpm-lock.yaml", "vite.config.ts", ":(exclude)supabase/.temp/cli-latest"];
git(["merge-base", "--is-ancestor", BASELINE_SHA, sha]);
if (git(["diff", BASELINE_SHA, sha, "--name-only", "--", ...productPaths])) throw new Error("BENCHMARK_REBASELINE_REQUIRED");
// Product/config/lockfile must remain byte-identical to the adopted baseline.
const modified = git(["diff", "HEAD", "--name-only", "--", ...productPaths]).split(/\r?\n/).filter(Boolean);
if (modified.some(file => !postAckVariant || !patchFiles.includes(file))) throw new Error("PRODUCT_PATCH_NOT_ALLOWED");
const untracked = git(["ls-files", "--others", "--exclude-standard", "--", ...productPaths]).split(/\r?\n/).filter(Boolean);
if (untracked.some(file => !postAckVariant || !patchTests.includes(file))) throw new Error("UNTRACKED_PRODUCT_PATCH_NOT_ALLOWED");
const options = parseOptions(process.argv.slice(2));
const flow = ["pull", "reconnect"].includes(options.workload);
const connection = flow ? readLocalConnection() : { api: "http://127.0.0.1:1", anon: "synthetic-harness" };
const artifactDir = resolve(root, "test-results/f24-6");
mkdirSync(artifactDir, { recursive: true });
const output = resolve(artifactDir, `${options.workload}-${options.mode}-${Date.now()}.json`);
const report = {
  independent_series: seedSeries,
  effective_product_sha256: Object.fromEntries(patchFiles.map(file => [file, createHash('sha256').update(postAckVariant === 'original' ? git(['show', BASELINE_SHA + ':' + file]) : readFileSync(resolve(root, file))).digest('hex')])),
  git_sha: sha, benchmark_baseline_sha: BASELINE_SHA,
  post_ack_variant: postAckVariant ?? null, patch_manifest: patchManifest ?? null,
  environment: flow ? (options.workload === "pull" ? "LOCAL_AUTH_POSTGREST_POSTGRES" : "LOCAL_AUTH_EDGE_POSTGRES") : "NATIVE_INDEXEDDB_STORAGE_ONLY",
  browser: null, node: process.version,
  pnpm: execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["--version"], { encoding: "utf8", shell: process.platform === "win32", windowsHide: true }).trim(),
  harness_sha256: createHash("sha256").update(["performance-baseline.mjs", "performance-browser.ts", "performance-contract.mjs", "performance-local-fixture.mjs", "performance-seed-diagnostics.mjs", "performance-diagnostics.mjs"].map(name => readFileSync(resolve(root, "scripts/codex", name))).join("\n")).digest("hex"),
  dependency_versions: Object.fromEntries(["dexie", "vite", "@playwright/test"].map(name => [name, JSON.parse(readFileSync(resolve(root, "node_modules", name, "package.json"), "utf8")).version])),
  server: "vite-transform-only; no app bootstrap", dataset: options, farm_count: options.farms,
  telemetry_state: "worker scheduler stopped; flow diagnostics unchanged; no periodic flush",
  logging_state: "product console retained, counted, not exported", results: [], summary: null, status: "RUNNING",
};
let server;
let browser;
let fixtureOwner;
let context;
let page;
let browserSeeded = false;
let cleanupFailed = false;
const call = async (method, argument) => {
  const result = await page.evaluate(async ({ method, argument }) => {
    if (method === 'seed') globalThis.__f24Seed = { stage: 'harness_module_import', start: performance.now(), events: [] };
    try {
      const harness = await import("/scripts/codex/performance-browser.ts");
      if (method === "seed") {
        const value = await harness.seed(argument.options, argument.fixture);
        if (argument.controlledFault) { globalThis.__f24Seed.stage = 'controlled_after_seed'; throw new DOMException('Controlled seed quota failure', 'QuotaExceededError'); }
        return { ...value, seed_trace: globalThis.__f24Seed };
      }
      if (method === "enqueue") return await harness.enqueueReconnect();
      if (method === "execute") return await harness.execute();
      if (method === "diagnostics") return harness.diagnostics();
      if (method === "enableDiagnostics") return harness.enableDiagnostics() ?? {};
      return await harness.cleanup();
    } catch (error) {
      return { harness_failure: /^[A-Z_]+$/.test(error?.message ?? "") ? error.message : "BROWSER_OPERATION_FAILURE", error_type: error?.name, error_detail: { name: error?.name, code: error?.code, message: error?.message, stack: error?.stack }, seed_trace: globalThis.__f24Seed };
    }
  }, { method, argument });
  if (method === 'seed' && report.active_run) report.active_run.seed_diagnosis.browser = result.seed_trace;
  if (result.harness_failure) {
    const failure = new Error(result.harness_failure);
    failure.seedError = safeSeedError(result.error_detail, [connection.anon, connection.service, fixtureOwner?.fixture?.password, fixtureOwner?.fixture?.email]);
    throw failure;
  }
  return result;
};

try {
  server = await createServer({
    configFile: false, root, envDir: false, logLevel: "silent",
    optimizeDeps: { noDiscovery: true, include: ["dexie"] },
    resolve: { alias: { "@": resolve(root, "src") } },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(connection.api),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(connection.anon),
      "import.meta.env.VITE_SUPABASE_FUNCTIONS_URL": JSON.stringify(`${connection.api}/functions/v1`),
    },
    server: { host: "127.0.0.1", port: 0 },
    plugins: [{ name: 'f24-diagnostic-observer', enforce: 'pre', transform(source, id) {
      const file = patchFiles.find(file => id.replaceAll('\\', '/').endsWith('/' + file));
      if (postAckVariant === 'original' && file) source = git(['show', `${BASELINE_SHA}:${file}`]);
      return diagnosticMode ? (diagnosticTransform(source, id) ?? source) : source;
    } }, { name: "f24-empty-page", configureServer(s) { s.middlewares.use((req, res, next) => {
      if (req.url !== "/__f24_benchmark") return next();
      res.setHeader("Content-Type", "text/html"); res.end("<!doctype html><title>F24.6 isolated benchmark</title>");
    }); } }],
  });
  await server.listen();
  console.log("HARNESS_SERVER_READY");
  browser = await chromium.launch({ headless: true });
  console.log("HARNESS_BROWSER_READY");
  browser.on('disconnected', () => { if (report.active_run?.phase === 'seed') report.active_run.seed_diagnosis.events.push({ stage: 'browser_disconnected' }); });
  report.browser = { name: "chromium", version: browser.version() };
  if (process.env.REBANHOSYNC_POST_ACK_PROOF === '1') {
    const { provePostAck } = await import('./performance-post-ack-proof.mjs');
    report.post_ack_proof = await provePostAck({ browser, url: server.resolvedUrls.local[0], connection, options });
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  }
  for (let run = 1; run <= options.runs; run++) {
    report.active_run = { run_number: run, phase: 'seed', seed_diagnosis: { stage: 'remote_fixture_creation', started_monotonic_ms: performance.now(), events: [] } };
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    const seedStart = performance.now();
    if (flow) {
      fixtureOwner = await seedLocalFixture(connection, options);
      report.local_backend = fixtureOwner.environment;
    }
    report.active_run.seed_diagnosis.stage = 'browser_context_creation';
    context = await browser.newContext();
    // Deny any accidentally configured remote request, including redirects.
    const allowedOrigins = new Set([new URL(server.resolvedUrls.local[0]).origin, new URL(connection.api).origin]);
    await context.route("**/*", route => allowedOrigins.has(new URL(route.request().url()).origin) ? route.continue() : route.abort());
    page = await context.newPage();
    const seedObservation = report.active_run.seed_diagnosis;
    const seedEvent = (stage, details = {}) => { const t = performance.now(); if (report.active_run?.phase === 'seed') seedObservation.events.push({ stage, at_ms: t - seedObservation.started_monotonic_ms, ...details }); seedObservation.observer_ms = (seedObservation.observer_ms ?? 0) + performance.now() - t; };
    const seedListeners = [];
    const listenSeed = (surface, event, callback) => { surface.on(event, callback); seedListeners.push([surface,event,callback]); };
    listenSeed(page, 'crash', () => seedEvent('page_crash'));
    listenSeed(page, 'close', () => seedEvent('page_close'));
    listenSeed(context, 'close', () => seedEvent('context_close'));
    listenSeed(page, 'pageerror', error => seedEvent('page_error', { error: safeSeedError(error, [connection.anon, fixtureOwner?.fixture?.password, fixtureOwner?.fixture?.email]) }));
    listenSeed(page, 'response', response => { if (response.url().startsWith(connection.api + '/')) seedEvent('http_response', { endpoint: new URL(response.url()).pathname, status: response.status() }); });
    listenSeed(page, 'requestfailed', request => seedEvent('transport_failure', { endpoint: new URL(request.url()).pathname, error: safeSeedError({name:'TransportError',message:request.failure()?.errorText}) }));
    seedObservation.stage = 'page_navigation';
    await page.goto(new URL("/__f24_benchmark", server.resolvedUrls.local[0]).href);
    page.setDefaultTimeout(60000);
    console.log(`HARNESS_SEED_START ${run}`);
    let logs = 0;
    page.on("console", () => logs++);
    browserSeeded = true; // cleanup also attempted if seed only partially succeeds
    seedObservation.stage = 'browser_seed';
    const seedResult = await call("seed", { options, fixture: fixtureOwner?.fixture ?? null, controlledFault: process.env.REBANHOSYNC_CONTROLLED_SEED_FAILURE === '1' });
    seedObservation.stage = 'offline_enqueue';
    report.active_run.seed = seedResult;
    if (options.workload === 'reconnect' && seedResult.animals !== options.gestures) throw new Error('RECONNECT_INITIAL_PULL_INCOMPLETE');
    if (options.workload === "reconnect") {
      await context.setOffline(true);
      Object.assign(seedResult, await call("enqueue"));
      await context.setOffline(false);
    }
    console.log(`HARNESS_SEED_COMPLETE ${run}`);
    if (options.mode === "warm" && options.workload !== "reconnect") await call("execute");
    const seedDuration = performance.now() - seedStart;
    seedObservation.duration_ms = seedDuration;
    for (const [surface,event,callback] of seedListeners) surface.off(event, callback);
    delete seedResult.seed_trace;
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    const before = await cdp.send("Performance.getMetrics");
    const wire = { requests: 0, payload_bytes_sent: 0, payload_bytes_received: 0, rows_received_total: 0, errors: 0, timeouts: 0, repeated_operation_submissions: 0 };
    const network = []; const requestTimes = new WeakMap(); const requestIdentities = new WeakMap(); const previousSnapshots = new Map(); let observerCost = 0;
    const endpoint = request => new URL(request.url()).pathname;
    const submitted = new Set();
    const responseTasks = [];
    const onRequest = request => {
      if (!request.url().startsWith(`${connection.api}/`)) return;
      if (diagnosticMode) requestTimes.set(request, performance.now());
      wire.requests++; wire.payload_bytes_sent += request.postDataBuffer()?.length ?? 0;
      if (request.url().includes('/functions/v1/sync-batch')) {
        if (diagnosticMode) { try { const value = JSON.parse(request.postData() ?? '{}'); requestIdentities.set(request, { client_tx_id: identity(value.client_tx_id), client_op_ids: (value.ops ?? []).map(op => identity(op.client_op_id ?? op.record?.client_op_id)) }); } catch { /* No raw data exported. */ } }
        try { for (const op of JSON.parse(request.postData() ?? '{}').ops ?? []) {
          const id = op.client_op_id ?? op.record?.client_op_id;
          if (!id) continue;
          if (submitted.has(id)) wire.repeated_operation_submissions++; else submitted.add(id);
        } } catch { /* No payload or identities are exported. */ }
      }
    };
    const onResponse = response => {
      if (!response.url().startsWith(`${connection.api}/`)) return;
      responseTasks.push((async () => {
        const observed = performance.now(); const request = response.request();
        const record = { stage: 'http_response', endpoint: endpoint(request), ...requestIdentities.get(request), http_status: response.status(), request_to_headers_ms: observed - (requestTimes.get(request) ?? observed) };
        if (diagnosticMode) network.push(record);
        const body = await response.body(); wire.payload_bytes_received += body.length;
        if (diagnosticMode) {
          const observerStart = performance.now();
          record.response_bytes = body.length; record.request_to_body_ms = performance.now() - (requestTimes.get(request) ?? observed);
          if (record.endpoint === '/functions/v1/sync-batch') { try { record.receipt = receiptSummary(body.toString()); } catch { record.parse_error = 'INVALID_JSON'; } }
          if (record.endpoint.startsWith('/rest/v1/')) { try {
            const rows = JSON.parse(body.toString()); record.rows = Array.isArray(rows) ? rows.length : null; record.snapshot_sha256 = snapshotDigest(body);
            const scope = `${record.endpoint}:${new URL(response.url()).searchParams.get('fazenda_id')}`;
            if (Array.isArray(rows)) {
              const previous = previousSnapshots.get(scope); const current = new Map(rows.map(row => [row.id, snapshotDigest(JSON.stringify(row))]));
              record.previous_snapshot_present = Boolean(previous);
              record.unchanged_rows = previous ? [...current].filter(([id, hash]) => previous.get(id) === hash).length : 0;
              record.changed_or_new_rows = current.size - record.unchanged_rows;
              record.removed_rows = previous ? [...previous.keys()].filter(id => !current.has(id)).length : 0;
              previousSnapshots.set(scope, current);
            }
          } catch { record.parse_error = 'INVALID_JSON'; } }
          observerCost += performance.now() - observerStart;
          if (wire.requests > DIAGNOSTIC_LIMITS.requests || wire.payload_bytes_received > DIAGNOSTIC_LIMITS.received_bytes) await page.evaluate(() => { globalThis.__f24WireLimit = true; });
        }
        if (response.status() >= 400) wire.errors++;
        if (response.url().includes("/rest/v1/animais") && response.ok()) {
          const rows = JSON.parse(body.toString()); if (Array.isArray(rows)) wire.rows_received_total += rows.length;
        }
      })().catch(error => { wire.errors++; if (diagnosticMode) network.push({ stage: 'body_observation_failure', endpoint: endpoint(response.request()), ...requestIdentities.get(response.request()), http_status: response.status(), error_type: error.name, transport_code: transportCode(error.message) }); }));
    };
    const onFailure = request => { if (request.url().startsWith(`${connection.api}/`)) { wire.errors++; if (request.failure()?.errorText.includes("TIMED_OUT")) wire.timeouts++; if (diagnosticMode) network.push({ stage: 'transport_failure', endpoint: endpoint(request), ...requestIdentities.get(request), transport_code: transportCode(request.failure()?.errorText) }); } };
    page.on("request", onRequest); page.on("response", onResponse); page.on("requestfailed", onFailure);
    const logsBefore = logs;
    report.active_run.phase = 'execute'; report.active_run.wire = wire;
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`HARNESS_ARTIFACT ${output}`);
    if (process.env.REBANHOSYNC_CONTROLLED_TRANSPORT_FAILURE === '1') await page.route('**/functions/v1/sync-batch', route => route.abort('connectionreset'));
    if (diagnosticMode) { await call('enableDiagnostics'); report.active_run.diagnostic = { network, limits: DIAGNOSTIC_LIMITS }; }
    let result;
    try { result = await call("execute"); }
    finally {
      if (diagnosticMode) { await Promise.all(responseTasks); Object.assign(report.active_run.diagnostic, { browser: await call('diagnostics'), observer_cost_ms: observerCost }); writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`); }
    }
    page.off("request", onRequest); page.off("response", onResponse); page.off("requestfailed", onFailure);
    await Promise.all(responseTasks);
    const after = await cdp.send("Performance.getMetrics");
    const metric = (snapshot, name) => snapshot.metrics.find(entry => entry.name === name)?.value ?? null;
    if (options.workload === "pull") {
      result.rows_received = wire.rows_received_total;
      if (result.rows_received !== result.rows_expected) throw new Error("PULL_RECEIVED_COUNT_MISMATCH");
    }
    if (wire.errors) throw new Error("WORKLOAD_NETWORK_ERROR");
    const cleanupStart = performance.now();
    const cleanup = await call("cleanup"); browserSeeded = false;
    await context.close(); context = null;
    if (fixtureOwner) { Object.assign(cleanup, await fixtureOwner.cleanup()); fixtureOwner = null; }
    const cleanupDuration = performance.now() - cleanupStart;
    const cpuBefore = metric(before, "TaskDuration");
    const cpuAfter = metric(after, "TaskDuration");
    report.results.push({ run_number: run, cold_warm: options.mode, seed: seedResult,
      seed_diagnosis: seedObservation,
      phase_timings: { seed_and_preparation_ms: seedDuration, cleanup_ms: cleanupDuration }, ...result, ...wire,
      heap_before_bytes: metric(before, "JSHeapUsedSize"), heap_after_bytes: metric(after, "JSHeapUsedSize"),
      cpu_task_duration_ms: cpuBefore === null || cpuAfter === null ? null : (cpuAfter - cpuBefore) * 1000,
      long_tasks: null, console_events: logs - logsBefore, cleanup, ...(diagnosticMode ? { diagnostic: report.active_run.diagnostic } : {}) });
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`HARNESS_RUN_COMPLETE ${run}`);
  }
  report.summary = summarize(report.results.map(result => result.duration_ms));
  delete report.active_run;
  report.status = "PROOF_PASSED";
} catch (error) {
  report.failure_detail = error.seedError ?? safeSeedError(error, [connection.anon, connection.service, fixtureOwner?.fixture?.password, fixtureOwner?.fixture?.email]);
  if (report.active_run?.phase === 'seed') {
    report.active_run.seed_diagnosis.duration_ms = performance.now() - report.active_run.seed_diagnosis.started_monotonic_ms;
    if (page && !page.isClosed()) { try { report.active_run.seed_diagnosis.browser = await page.evaluate(() => globalThis.__f24Seed ?? null); } catch { /* Outer error and lifecycle events retained. */ } }
  }
  if (error.proofReport) report.post_ack_proof = error.proofReport;
  report.failure_code = /^[A-Z_]+$/.test(error?.message ?? "") ? error.message : error?.name ?? "HARNESS_FAILURE";
  report.status = "FAILED"; process.exitCode = 1;
} finally {
  if (browserSeeded && page) { try { report.failure_cleanup = await call("cleanup"); } catch { cleanupFailed = true; } }
  if (context) await context.close().catch(() => { cleanupFailed = true; });
  if (fixtureOwner) { try { report.failure_cleanup = { ...report.failure_cleanup, ...await fixtureOwner.cleanup() }; } catch { cleanupFailed = true; } }
  if (browser) await browser.close().catch(() => { cleanupFailed = true; });
  if (server) await server.close().catch(() => { cleanupFailed = true; });
  if (cleanupFailed) { report.status = "FAILED_CLEANUP"; process.exitCode = 1; }
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  report.cleanup_completed = !cleanupFailed;
  writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, output, summary: report.summary }));
}
