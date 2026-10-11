import { seedLocalFixture } from './performance-local-fixture.mjs';
const check = (value, code) => { if (!value) throw new Error(code); };
export async function provePostAck({ browser, url, connection, options }) {
  const owner = await seedLocalFixture(connection, { ...options, gestures: 10, animals: 10 });
  const contexts = [], pages = [];
  const report = { clients: 2, checks: {}, cleanup: {} };
  const cmd = (page, input) => page.evaluate(async input => (await import('/scripts/codex/performance-post-ack-proof.ts')).command(input), input);
  const row = (state, id) => state.animals.find(r => r.id === id);
  const init = async (page, warm = true) => {
    await page.goto(new URL('/__f24_benchmark', url).href);
    await page.evaluate(async ({ fixture, options }) => (await import('/scripts/codex/performance-browser.ts')).seed(options, fixture), { fixture: owner.fixture, options: { ...options, workload: warm ? 'reconnect' : 'pull', gestures: 10, animals: 10 } });
  };
  let release;
  try {
    for (let i = 0; i < 2; i++) {
      const context = await browser.newContext(); contexts.push(context);
      await context.route('**/*', route => [new URL(url).origin, new URL(connection.api).origin].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort());
      const page = await context.newPage(); pages.push(page); await init(page);
    }
    const [a, b] = pages;
    const farm = owner.fixture.farms[0], otherFarm = owner.fixture.farms[1];
    const [target, different] = owner.fixture.animals.filter(r => r.fazenda_id === farm);
    await cmd(a, { kind: 'active', farm });
    await cmd(b, { kind: 'active', farm });
    // Different ID is deliberately stale on A until its durable full drain.
    const bOther = await cmd(b, { kind: 'enqueue', farm, id: different.id, note: 'device-B-other' });
    await cmd(b, { kind: 'process', tx: bOther.tx });
    const aTx = await cmd(a, { kind: 'enqueue', farm, id: target.id, note: 'device-A-target' });
    let reached;
    const blocked = new Promise(resolve => { reached = resolve; });
    const barrier = new Promise(resolve => { release = resolve; });
    let intercepted = false;
    const routePattern = '**/rest/v1/animais*';
    await a.route(routePattern, async route => {
      if (!intercepted && route.request().url().includes('id=in.')) { intercepted = true; reached(); await barrier; }
      await route.continue();
    });
    const processing = cmd(a, { kind: 'process', tx: aTx.tx });
    await Promise.race([blocked, new Promise((_, reject) => setTimeout(() => reject(new Error('PARTIAL_REFRESH_NOT_OBSERVED')), 15000))]);
    const afterAck = await cmd(a, { kind: 'state' });
    check(afterAck.gestures.find(g => g.tx === aTx.tx)?.status === 'DONE' && afterAck.ops.length === 0 && afterAck.obligations.length === 1, 'ACK_NOT_DURABLE_BEFORE_REFRESH');
    await cmd(b, { kind: 'pull', farm });
    const bTarget = await cmd(b, { kind: 'enqueue', farm, id: target.id, note: 'device-B-target' });
    check(bTarget.expected_revision === 2, 'SECOND_CLIENT_REVISION_NOT_REFRESHED');
    await cmd(b, { kind: 'process', tx: bTarget.tx });
    release(); await processing; await a.unroute(routePattern);
    const partial = await cmd(a, { kind: 'state' });
    check(row(partial, target.id)?.revision === 3 && row(partial, target.id)?.note === 'device-B-target', 'TARGET_MULTI_DEVICE_NOT_OBSERVED');
    check(row(partial, different.id)?.note === 'F24.6 benchmark baseline' && partial.obligations.length === 1, 'PARTIAL_COMPLETED_FULL_OBLIGATION');
    report.checks.multi_device_target_and_other = 'PASS';
    report.checks.ack_before_refresh = 'PASS';
    // Reload after installation: pending full obligation survives module/connection restart.
    await init(a, false);
    const restarted = await cmd(a, { kind: 'state' });
    check(restarted.obligations.length === 1 && row(restarted, different.id)?.note === 'F24.6 benchmark baseline', 'RESTART_LOST_OBLIGATION');
    const converged = await cmd(a, { kind: 'drain', farm });
    check(row(converged, different.id)?.note === 'device-B-other' && converged.obligations.length === 0, 'FULL_DRAIN_NOT_CONVERGED');
    report.checks.restart_after_install = 'PASS';
    // Intent created after refresh gets the actual server revision.
    const fresh = await cmd(a, { kind: 'enqueue', farm, id: target.id, note: 'after-refresh' });
    check(fresh.expected_revision === 3, 'NEXT_INTENT_STALE');
    await cmd(a, { kind: 'process', tx: fresh.tx });
    // Two already queued intents retain the original revision and conflict explicitly.
    const first = await cmd(a, { kind: 'enqueue', farm, id: target.id, note: 'offline-first' });
    const second = await cmd(a, { kind: 'enqueue', farm, id: target.id, note: 'offline-second' });
    check(first.expected_revision === 4 && second.expected_revision === 4, 'CAPTURED_REVISION_CHANGED');
    await cmd(a, { kind: 'process', tx: first.tx });
    const conflict = await cmd(a, { kind: 'process', tx: second.tx });
    check(conflict.gestures.find(g => g.tx === first.tx)?.status === 'DONE' && conflict.gestures.find(g => g.tx === second.tx)?.results?.includes('CONFLICT'), 'OFFLINE_CONFLICT_NOT_PRESERVED');
    report.checks.two_same_animal_cas = 'PASS';
    // A -> B -> A, process A while B active, with durable obligation still scoped A.
    await cmd(a, { kind: 'active', farm: otherFarm });
    const inactive = await cmd(a, { kind: 'enqueue', farm, id: different.id, note: 'inactive-farm' });
    const inactiveState = await cmd(a, { kind: 'process', tx: inactive.tx });
    check(inactiveState.gestures.find(g => g.tx === inactive.tx)?.status === 'DONE' && inactiveState.animals.length === 10, 'INACTIVE_FARM_FAILED');
    await cmd(a, { kind: 'drain', farm: otherFarm });
    check((await cmd(a, { kind: 'state' })).obligations.some(o => o.farm === farm), 'OTHER_FARM_CONSUMED_OBLIGATION');
    await cmd(a, { kind: 'active', farm });
    await cmd(a, { kind: 'drain', farm });
    report.checks.farm_switch_inactive_isolation = 'PASS';
    // Network interruption after atomic ACK, before the target can be installed.
    const interrupted = await cmd(a, { kind: 'enqueue', farm, id: different.id, note: 'recover-after-ack' });
    await a.route(routePattern, route => route.request().url().includes('id=in.') ? route.abort('connectionreset') : route.continue());
    const failedRefresh = await cmd(a, { kind: 'process', tx: interrupted.tx });
    check(failedRefresh.gestures.find(g => g.tx === interrupted.tx)?.status === 'DONE' && failedRefresh.obligations.some(o => o.farm === farm), 'REFRESH_FAILURE_LOST_ACK_OR_OBLIGATION');
    await a.unroute(routePattern);
    await init(a, false);
    const recovered = await cmd(a, { kind: 'drain', farm });
    check(row(recovered, different.id)?.note === 'recover-after-ack' && recovered.obligations.length === 0, 'RECOVERY_AFTER_ACK_FAILED');
    report.checks.restart_after_ack_failed_refresh = 'PASS';
    // Close the real page while its target GET is suspended after ACK.
    const crashTx = await cmd(a, { kind: 'enqueue', farm, id: different.id, note: 'page-crash-during-pull' });
    let crashReached;
    const crashBlocked = new Promise(resolve => { crashReached = resolve; });
    const crashBarrier = new Promise(resolve => { release = resolve; });
    await a.route(routePattern, async route => {
      if (route.request().url().includes('id=in.')) { crashReached(); await crashBarrier; }
      try { await route.continue(); } catch { /* Closed owned page: no retry. */ }
    });
    const interruptedProcess = cmd(a, { kind: 'process', tx: crashTx.tx }).catch(() => null);
    await Promise.race([crashBlocked, new Promise((_, reject) => setTimeout(() => reject(new Error('CRASH_BOUNDARY_NOT_REACHED')), 15000))]);
    const crashBoundary = await cmd(a, { kind: 'state' });
    check(crashBoundary.gestures.find(g => g.tx === crashTx.tx)?.status === 'DONE' && crashBoundary.obligations.some(o => o.farm === farm), 'CRASH_BOUNDARY_NOT_DURABLE');
    await a.close(); release(); await interruptedProcess;
    const restartedA = await contexts[0].newPage(); pages[0] = restartedA;
    await init(restartedA, false);
    const afterCrash = await cmd(restartedA, { kind: 'state' });
    check(row(afterCrash, different.id)?.revision === row(crashBoundary, different.id)?.revision && afterCrash.obligations.some(o => o.farm === farm), 'CRASH_INSTALLED_UNOBSERVED_SNAPSHOT');
    const crashRecovery = await cmd(restartedA, { kind: 'drain', farm });
    check(row(crashRecovery, different.id)?.revision === crashTx.expected_revision + 1 && row(crashRecovery, different.id)?.note === 'page-crash-during-pull' && crashRecovery.obligations.length === 0, 'PAGE_CRASH_RECOVERY_FAILED');
    report.checks.page_close_during_pull_and_reopen = 'PASS';
    report.status = 'PASS';
    return report;
  } catch (error) {
    report.status = 'FAILED'; report.failure_code = /^[A-Z_]+$/.test(error.message) ? error.message : 'PROOF_FAILURE';
    error.proofReport = report;
    throw error;
  } finally {
    release?.();
    for (const page of pages) if (!page.isClosed()) await page.evaluate(async () => (await import('/scripts/codex/performance-browser.ts')).cleanup());
    for (const context of contexts) await context.close();
    report.cleanup = await owner.cleanup();
    report.cleanup.indexeddb_deleted = true;
  }
}
