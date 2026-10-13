import { db, OfflineDB } from "../../src/lib/offline/db";

type Options = { workload: string; animals: number; events: number; gestures: number; farms: number; mode: string; baseline?: string };
type Fixture = { farms: string[]; animals?: { id: string; fazenda_id: string }[]; email?: string; password?: string };
let store: OfflineDB;
let fixture: Fixture;
let options: Options;
let worker: typeof import("../../src/lib/offline/syncWorker") | undefined;
let createGesture: typeof import("../../src/lib/offline/ops")["createGesture"] | undefined;
const check = (condition: boolean, code: string) => { if (!condition) throw new Error(code); };
const uuid = (kind: number, index: number) => `${kind.toString(16).padStart(8, "0")}-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const seedStage = (stage: string) => {
  const state = (globalThis as unknown as { __f24Seed?: { stage: string; start: number; events: { stage: string; at_ms: number }[] } }).__f24Seed;
  if (state) { state.stage = stage; state.events.push({ stage, at_ms: performance.now() - state.start }); }
};

export async function seed(input: Options, remote: Fixture | null) {
  options = input;
  const flow = input.workload === "pull" || input.workload === "reconnect";
  store = flow ? db : new OfflineDB(`f24_6_${crypto.randomUUID()}`);
  seedStage('indexeddb_open');
  await store.open();
  fixture = remote ?? { farms: Array.from({ length: input.farms }, (_, i) => uuid(1, i + 1)) };
  if (flow) {
    seedStage('auth_module_import');
    const { supabase } = await import("../../src/lib/supabase");
    const { establishLocalOwnership } = await import("../../src/lib/offline/ownership");
    seedStage('auth_sign_in');
    const { data, error } = await supabase.auth.signInWithPassword({ email: fixture.email!, password: fixture.password! });
    check(!error && Boolean(data.session), "LOCAL_AUTH_REQUIRED");
    seedStage('ownership_installation');
    check((await establishLocalOwnership(data.session!)).status === "OWNED", "LOCAL_OWNERSHIP_REQUIRED");
    seedStage('worker_module_import');
    worker = await import("../../src/lib/offline/syncWorker");
    worker.stopSyncWorker();
    seedStage('pull_module_import');
    const { pullDataForFarm } = await import("../../src/lib/offline/pull");
    // Explicit warm-up of module compilation/Auth excluded from workload timing.
    if (input.workload === "reconnect") {
      seedStage('initial_full_pull');
      for (const farm of fixture.farms) await pullDataForFarm(farm, ["animais"], { mode: "merge" });
      ({ createGesture } = await import("../../src/lib/offline/ops"));
    }
    if (input.baseline === 'integrated') check(await store.state_agenda_itens.count() === 0, 'AGENDA_NOT_EMPTY');
    seedStage('count_verification');
    return { animals: await store.state_animais.count(), gestures: await store.queue_gestures.count(), operations: await store.queue_ops.count() };
  }
  const timestamp = "2026-10-01T00:00:00.000Z";
  // Synthetic storage-only records; no domain execution or remote writer is simulated.
  const animals = Array.from({ length: input.animals }, (_, i) => ({ id: uuid(2, i + 1), fazenda_id: fixture.farms[i % input.farms], identificacao: `BENCH-${i}`, sexo: "F", status: "ativo", lote_id: null, revision: 1, created_at: timestamp, updated_at: timestamp, deleted_at: null }));
  const animalsByFarm = fixture.farms.map(farm => animals.filter(animal => animal.fazenda_id === farm));
  const events = Array.from({ length: input.events }, (_, i) => {
    const farmIndex = i % input.farms;
    const animal = animalsByFarm[farmIndex][Math.floor(i / input.farms) % animalsByFarm[farmIndex].length];
    return { id: uuid(3, i + 1), fazenda_id: animal.fazenda_id, animal_id: animal.id, dominio: "pesagem", occurred_at: timestamp, payload: { synthetic_storage_fixture: true }, created_at: timestamp, updated_at: timestamp, deleted_at: null };
  });
  await store.transaction("rw", store.state_animais, store.event_eventos, async () => {
    await store.table("state_animais").bulkPut(animals);
    await store.table("event_eventos").bulkPut(events);
  });
  if (input.workload === "queue") {
    const gestures = Array.from({ length: input.gestures }, (_, i) => ({ client_tx_id: uuid(4, i + 1), fazenda_id: fixture.farms[i % input.farms], client_id: "benchmark-storage-only", status: "PENDING", created_at: timestamp }));
    const operations = gestures.map((gesture, i) => ({ client_op_id: uuid(5, i + 1), client_tx_id: gesture.client_tx_id, table: "animais", action: "UPDATE", expected_revision: 1, op_order: 0, record: { id: animalsByFarm[i % input.farms][Math.floor(i / input.farms) % animalsByFarm[i % input.farms].length].id, fazenda_id: gesture.fazenda_id, client_id: gesture.client_id, client_tx_id: gesture.client_tx_id, client_op_id: uuid(5, i + 1), client_recorded_at: timestamp, observacoes: "synthetic-storage-only" }, created_at: timestamp }));
    await store.transaction("rw", store.queue_gestures, store.queue_ops, async () => {
      await store.table("queue_gestures").bulkPut(gestures);
      await store.table("queue_ops").bulkPut(operations);
    });
  }
  check(await store.state_animais.count() === input.animals, "SEED_ANIMAL_COUNT");
  check(await store.event_eventos.count() === input.events, "SEED_EVENT_COUNT");
  if (input.mode === "cold") { store.close(); await store.open(); }
  return { animals: input.animals, events: input.events, gestures: await store.queue_gestures.count(), operations: await store.queue_ops.count() };
}

export async function enqueueReconnect() {
  check(!navigator.onLine && Boolean(createGesture), "OFFLINE_QUEUE_SETUP_REQUIRED");
  for (const animal of fixture.animals!) {
    await createGesture!(animal.fazenda_id, [{ table: "animais", action: "UPDATE", record: { id: animal.id, observacoes: "F24.6 benchmark updated" } }]);
  }
  if (options.baseline === 'integrated') {
    const ops = await store.queue_ops.toArray();
    const expected = new Map(fixture.animals!.map(a => [a.id,a.fazenda_id]));
    check(new Set(ops.map(op => op.record.id)).size === options.gestures && ops.every(op => op.table === 'animais' && op.action === 'UPDATE' && expected.get(op.record.id) === op.record.fazenda_id && op.record.observacoes === 'F24.6 benchmark updated'), 'QUEUE_IDENTITY_OR_SCOPE');
  }
  check(await store.queue_gestures.count() === options.gestures && await store.queue_ops.count() === options.gestures, "OFFLINE_QUEUE_COUNT");
  return { gestures: await store.queue_gestures.count(), operations: await store.queue_ops.count() };
}

type DiagnosticEvent = Record<string, unknown>;
let diagnostic: { events: DiagnosticEvent[]; current: Record<string, unknown>; start: number; overhead_ms: number } | undefined;
export function diagnostics() { return diagnostic; }
export function enableDiagnostics() {
  diagnostic = { events: [], current: {}, start: performance.now(), overhead_ms: 0 };
  const event = (stage: string, details: DiagnosticEvent = {}) => { const t = performance.now(); diagnostic!.events.push({ stage, at_ms: t - diagnostic!.start, ...diagnostic!.current, ...details }); diagnostic!.overhead_ms += performance.now() - t; };
  (globalThis as unknown as { __f24Diagnostic: unknown }).__f24Diagnostic = { event, span: async (stage: string, fn: () => Promise<unknown>, details: DiagnosticEvent) => { const t = performance.now(); event(stage + '_start', details); try { return await fn(); } finally { event(stage + '_end', { ...details, duration_ms: performance.now() - t }); } } };
}
export async function execute() {
  const target = fixture.farms[0];
  let transactionDuration: number | null = null;
  let queueSelectionDuration: number | null = null;
  let retryAttempts = 0;
  let ackDuration: number | null = null;
  let convergenceDuration: number | null = null;
  const rowsReceived: number | null = null;
  let rowsExpected = 0;
  let rowsInstalled = 0;
  let operations = 0;
  let gestures = 0;
  let queueBytes = 0;
  let ackConfirmed = 0;
  let localRows: Record<string, unknown>[] = [];
  const flow = options.workload === "pull" || options.workload === "reconnect";
  const backlogBefore = await store.queue_gestures.where("status").equals("PENDING").count();
  const controlBefore = await store.state_animais.where("fazenda_id").equals(fixture.farms[1]).toArray();
  const pendingBefore = await store.queue_gestures.where("status").equals("PENDING").toArray();
  const maxAge = pendingBefore.length ? Math.max(...pendingBefore.map(g => Date.now() - Date.parse(g.created_at))) : 0;
  const start = performance.now();
  if (!flow) {
    const txStart = performance.now();
    await store.transaction("r", store.state_animais, store.event_eventos, store.queue_gestures, store.queue_ops, async () => {
      const animals = await store.state_animais.where("fazenda_id").equals(target).toArray();
      const events = await store.event_eventos.where("fazenda_id").equals(target).toArray();
      check(animals.every(row => row.fazenda_id === target) && events.every(row => row.fazenda_id === target), "CROSS_FARM_READ");
      rowsInstalled = animals.length + events.length;
      rowsExpected = Math.ceil(options.animals / options.farms) + Math.ceil(options.events / options.farms);
      if (options.workload === "queue") {
        const selectionStart = performance.now();
        const pending = await store.queue_gestures.where("status").equals("PENDING").sortBy("created_at");
        const farmGestures = pending.filter(g => g.fazenda_id === target);
        // Production operations carry farm in record, not an indexed top-level field.
        const ops = (await Promise.all(farmGestures.map(g => store.queue_ops.where("client_tx_id").equals(g.client_tx_id).toArray()))).flat();
        gestures = farmGestures.length;
        operations = ops.length;
        queueSelectionDuration = performance.now() - selectionStart;
        queueBytes = bytes(ops);
        check(ops.every(op => op.record.fazenda_id === target), "CROSS_FARM_QUEUE_READ");
        check(gestures === Math.ceil(options.gestures / options.farms) && operations === gestures, "QUEUE_COUNT");
      }
    });
    transactionDuration = performance.now() - txStart;
  } else {
    const { pullDataForFarm } = await import("../../src/lib/offline/pull");
    if (options.workload === "reconnect") {
      const pending = await store.queue_gestures.where("status").equals("PENDING").sortBy("created_at");
      operations = await store.queue_ops.count(); gestures = pending.length;
      queueBytes = bytes(await store.queue_ops.toArray());
      for (const gesture of pending) {
        const diagnosticReadStart = performance.now();
        if (diagnostic) {
          const op = await store.queue_ops.where('client_tx_id').equals(gesture.client_tx_id).first();
          diagnostic.current = { client_tx_id: gesture.client_tx_id, client_op_id: op?.client_op_id };
          const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
          if (performance.now() - start > 240000 || (heap ?? 0) > 512 * 1048576) throw new Error('DIAGNOSTIC_RESOURCE_LIMIT');
          if ((globalThis as unknown as { __f24WireLimit?: boolean }).__f24WireLimit) throw new Error('DIAGNOSTIC_WIRE_LIMIT');
        }
        if (diagnostic) diagnostic.overhead_ms += performance.now() - diagnosticReadStart;
        const gestureStart = performance.now();
        await worker!.processGesture(gesture);
        const completed = await store.queue_gestures.get(gesture.client_tx_id);
        retryAttempts += completed?.retry_count ?? 0;
        const diagnosticTerminalStart = performance.now();
        if (diagnostic) diagnostic.events.push({ stage: 'gesture_terminal', at_ms: performance.now() - diagnostic.start, ...diagnostic.current, duration_ms: performance.now() - gestureStart, status: completed?.status, sync_result: completed?.sync_result, retry_count: completed?.retry_count, next_attempt_scheduled: Boolean(completed?.next_attempt_at), diagnostics: completed?.diagnostics, operation_statuses: completed?.operation_results?.map(r => ({ status: r.status, reason_code: r.reason_code })), pending: await store.queue_gestures.where('status').equals('PENDING').count(), operations_remaining: await store.queue_ops.count(), obligations_remaining: await store.sync_reconcile_obligations.count() });
        if (diagnostic) diagnostic.overhead_ms += performance.now() - diagnosticTerminalStart;
        check(completed?.status === "DONE", "ACK_NOT_CONFIRMED");
        if (options.baseline === 'integrated') check(completed?.operation_results?.length === 1 && completed.operation_results[0].status === 'APPLIED', 'ACK_RESULT_NOT_APPLIED');
        ackConfirmed++;
      }
      // Upper bound: processGesture may include inline refresh; not server ACK latency.
      ackDuration = performance.now() - start;
      const drainStart = performance.now();
      if (diagnostic) diagnostic.current = { origin: 'final_reconciliation' };
      for (const farm of fixture.farms) await worker!.drainReconciliationObligations(farm);
      if (diagnostic) diagnostic.events.push({ stage: 'reconciliation', duration_ms: performance.now() - drainStart });
    }
    for (const farm of options.workload === "reconnect" ? fixture.farms : [target]) {
      await pullDataForFarm(farm, ["animais"], { mode: "merge" });
    }
    const installed = await store.state_animais.where("fazenda_id").equals(target).toArray();
    rowsExpected = fixture.animals!.filter(animal => animal.fazenda_id === target).length;
    rowsInstalled = installed.length;
    // Received counts are filled by the runner from successful HTTP response bodies.
    if (options.workload === "reconnect") {
      check(await store.queue_ops.count() === 0 && await store.sync_reconcile_obligations.count() === 0, "CONVERGENCE_BACKLOG");
      for (const animal of fixture.animals!) check((await store.state_animais.get(animal.id))?.observacoes === "F24.6 benchmark updated", "CONVERGENCE_VALUE");
      if (options.baseline === 'integrated') {
        const animals = await store.state_animais.toArray();
        check(animals.length === options.animals && await store.state_agenda_itens.count() === 0, 'LOCAL_DATASET_INTEGRITY');
        const expected = new Map(fixture.animals!.map(a => [a.id,a.fazenda_id]));
        check(animals.every(a => expected.get(a.id) === a.fazenda_id), 'CROSS_FARM_CONVERGENCE');
        localRows = animals.map(a => ({ id: a.id, fazenda_id: a.fazenda_id, observacoes: a.observacoes, revision: a.revision, client_op_id: a.client_op_id, client_tx_id: a.client_tx_id }));
      }
      convergenceDuration = performance.now() - start;
    }
  }
  const duration = performance.now() - start;
  check(rowsInstalled === rowsExpected, "INCOMPLETE_DATASET");
  const controlAfter = await store.state_animais.where("fazenda_id").equals(fixture.farms[1]).toArray();
  if (options.workload !== "reconnect") check(JSON.stringify(controlBefore) === JSON.stringify(controlAfter), "CONTROL_FARM_CHANGED");
  return {
    duration_ms: duration, sample_count: 1, operations, gestures,
    ...(options.baseline === 'integrated' ? { ack_confirmed: ackConfirmed, local_rows: localRows, local_convergence_verified: true } : {}), queue_serialized_bytes: queueBytes,
    rows_expected: rowsExpected, rows_received: rowsReceived, rows_installed: rowsInstalled,
    backlog_before: backlogBefore, backlog_after: await store.queue_gestures.where("status").equals("PENDING").count(),
    max_backlog_age_ms: maxAge, ack_duration_upper_bound_ms: ackDuration, convergence_duration_ms: convergenceDuration,
    indexeddb_transaction_duration_ms: transactionDuration, queue_selection_duration_ms: queueSelectionDuration,
    retry_counter_after_processing: retryAttempts,
    reconciliation_obligations_remaining: await store.sync_reconcile_obligations.count(),
    isolation_verified: true, clock: "performance.now",
  };
}

export async function cleanup() {
  worker?.stopSyncWorker();
  await store.delete();
  check(!(await OfflineDB.exists(store.name)), "DATABASE_CLEANUP_FAILED");
  return { indexeddb_deleted: true };
}
