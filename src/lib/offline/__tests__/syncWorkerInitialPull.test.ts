/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeFarmId: "farm-runtime",
  pullInitialData: vi.fn(async () => undefined),
}));

vi.mock("@/lib/storage", () => ({
  getActiveFarmId: vi.fn(() => mocks.activeFarmId),
}));

vi.mock("../pull", () => ({
  pullDataForFarm: vi.fn(async () => undefined),
  pullInitialData: mocks.pullInitialData,
  pullSanitarioAgendaV2: vi.fn(async () => undefined),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
    },
  },
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(async () => undefined),
  flushPilotMetrics: vi.fn(async () => undefined),
}));

import { runInitialOfflinePullForActiveFarmOnce } from "../syncWorker";

describe("sync worker initial offline pull", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeFarmId = `farm-runtime-${crypto.randomUUID()}`;
  });

  it("executa pullInitialData para a fazenda ativa do runtime", async () => {
    await runInitialOfflinePullForActiveFarmOnce();

    expect(mocks.pullInitialData).toHaveBeenCalledTimes(1);
    expect(mocks.pullInitialData).toHaveBeenCalledWith(mocks.activeFarmId);
  });

  it("nao executa pull sem fazenda ativa", async () => {
    mocks.activeFarmId = "";

    await runInitialOfflinePullForActiveFarmOnce();

    expect(mocks.pullInitialData).not.toHaveBeenCalled();
  });

  it("mantem o pull inicial idempotente por fazenda no processo", async () => {
    await runInitialOfflinePullForActiveFarmOnce();
    await runInitialOfflinePullForActiveFarmOnce();

    expect(mocks.pullInitialData).toHaveBeenCalledTimes(1);
  });
});
