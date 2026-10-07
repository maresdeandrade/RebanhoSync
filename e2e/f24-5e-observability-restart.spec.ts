import { expect, test } from '@playwright/test';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import type { Gesture, Operation, PilotMetricEvent, TelemetryFlushCursor } from '../src/lib/offline/types';
import type { ReconciliationObligation } from '../src/lib/offline/reconciliationTypes';
import { restartFixturePath } from './support/f24-5e-restart.mjs';

type Delivery = { id: string; farm: string };
type Snapshot = {
  gestures: Gesture[]; ops: Operation[]; obligations: ReconciliationObligation[];
  metrics: PilotMetricEvent[]; cursors: Record<string, TelemetryFlushCursor | null>;
  health: string[]; stale: string;
};
type PhaseResult = {
  snapshot: Snapshot; before: Snapshot; after: Snapshot;
  deliveries: Delivery[]; replay: Delivery[]; browserVersion: string;
};

function killTree(child: ChildProcess) {
  if (!child.pid || child.exitCode !== null) return;
  // Only the dedicated fixture child and its descendants are targets.
  return execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { encoding: 'utf8', windowsHide: true });
}

async function runPhase(profile: string, phase: string) {
  const child = spawn(process.execPath, [restartFixturePath, profile, phase], {
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let output = '';
  let errors = '';
  child.stderr!.on('data', chunk => { errors += String(chunk); });
  const timer = setTimeout(() => killTree(child), 60_000);
  try {
    const result = await new Promise<PhaseResult>((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', code => reject(new Error(`Fixture exited ${code}: ${errors}`)));
      child.stdout!.on('data', chunk => {
        output += String(chunk);
        const line = output.split('\n').find(line => line.startsWith('{"phase":'));
        if (line) resolve(JSON.parse(line));
      });
    });
    const exit = once(child, 'exit');
    const termination = killTree(child);
    await exit;
    return { ...result, helperPid: child.pid, termination };
  } finally {
    clearTimeout(timer);
    killTree(child);
  }
}

test('F24.5E: forced Chromium process restart preserves observability and recovery', async ({ browserName }, testInfo) => {
  expect(browserName).toBe('chromium');
  test.skip(process.platform !== 'win32', 'Dedicated Windows process-tree kill harness');
  test.setTimeout(150_000);
  const profile = await mkdtemp(path.join(tmpdir(), 'rebanhosync-f24-5e-'));
  try {
    const seed = await runPhase(profile, 'seed');
    const reopened = await runPhase(profile, 'reopen');
    const before = seed.snapshot;
    const restored = reopened.before;
    const evidencePath = testInfo.outputPath('process-restart-evidence.json');
    await writeFile(evidencePath, JSON.stringify({ seed, reopened }, null, 2));
    await testInfo.attach('f24-5e-process-restart-evidence', { path: evidencePath, contentType: 'application/json' });
    expect(reopened.helperPid).not.toBe(seed.helperPid);
    expect(before.health).toEqual(['pending', 'error', 'reconcile', 'healthy']);
    const { cursors: originalCursors, ...originalDurableState } = before;
    const { cursors: restoredCursors, ...restoredDurableState } = restored;
    expect(restoredDurableState).toEqual(originalDurableState);
    // Keep the unmet checkpoint acceptance visible; continue certifying recovery.
    expect.soft(restoredCursors, 'Confirmed telemetry checkpoints must survive forced restart').toEqual(originalCursors);
    expect(restored.stale).toBe('checking');
    const error = restored.gestures.find(gesture => gesture.fazenda_id === 'f24-5e-error');
    expect(error?.status).toBe('ERROR');
    expect(error?.diagnostics?.last_failure?.code).toBe('RETRY_EXHAUSTED');
    expect(error?.diagnostics?.last_failure?.cause_code).toBe('NETWORK_FAILURE');
    const pending = restored.gestures.find(gesture => gesture.fazenda_id === 'f24-5e-pending');
    expect(pending?.diagnostics?.last_failure?.code).toBe('NETWORK_FAILURE');
    expect(restored.obligations[0].diagnostics?.last_error?.code).toBe('NETWORK_FAILURE');
    expect(restored.obligations[0].diagnostics?.origins).toHaveLength(1);
    const confirmed = new Set(seed.deliveries.map(delivery => delivery.id));
    const unconfirmed = reopened.replay.filter(delivery => !confirmed.has(delivery.id));
    expect(unconfirmed).toHaveLength(1);
    expect(unconfirmed[0].farm).toBe('f24-5e-pending');
    expect.soft(reopened.replay.filter(delivery => confirmed.has(delivery.id)), 'Confirmed IDs must not be resent after restart').toEqual([]);
    expect(reopened.after.health).toEqual(['healthy', 'error', 'healthy', 'healthy']);
    expect(reopened.after.obligations).toEqual([]);
    const recovered = reopened.after.gestures.find(gesture => gesture.client_tx_id === pending?.client_tx_id);
    expect(recovered?.status).toBe('DONE');
    expect(recovered?.diagnostics?.reconciliation?.[0].completed_at).toBeTruthy();
    expect(reopened.after.metrics.some(metric => metric.fazenda_id === 'f24-5e-pending' && metric.event_name === 'sync_success')).toBe(true);
  } finally {
    // mkdtemp created this isolated profile beneath tmpdir; never target user profiles.
    expect(path.dirname(profile)).toBe(tmpdir());
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
