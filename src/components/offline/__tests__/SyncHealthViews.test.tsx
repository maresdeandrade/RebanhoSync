/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TopBar } from "@/components/layout/TopBar";
import { SyncStatusBadge } from "@/components/ui/sync-status-badge";
import { SyncStatusPanel } from "../SyncStatusPanel";
import { db } from "@/lib/offline/db";
import { EMPTY_FARM_SYNC_SUMMARY } from "@/lib/offline/syncQueries";

let activeFarmId = "farm-a";
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ activeFarmId }) }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ is: () => ({ single: async () => ({ data: null }) }) }),
      }),
    }),
  },
}));

beforeEach(async () => {
  activeFarmId = "farm-a";
  await db.queue_gestures.clear();
  await db.queue_rejections.clear();
  await db.sync_reconcile_obligations.clear();
});
afterEach(async () => {
  cleanup();
  await db.queue_gestures.clear();
  await db.queue_rejections.clear();
  await db.sync_reconcile_obligations.clear();
});

describe("sync health views", () => {
  it("keeps both unloaded views in verification instead of showing empty counts as healthy", () => {
    render(
      <MemoryRouter>
        <SyncStatusBadge />
        <SyncStatusPanel />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Verificando sincronização")).toHaveLength(2);
    expect(screen.queryByText("Em dia")).not.toBeInTheDocument();
  });

  it.each([
    [{}, "Em dia"],
    [{ errorCount: 1 }, "Erro de sincronização"],
    [{ reconcileCount: 1 }, "Reconciliação pendente"],
    [{ syncingCount: 1 }, "Sincronizando"],
    [{ savedLocalCount: 1 }, "Salvo localmente"],
  ])(
    "keeps the compact badge and full panel consistent for %j",
    (counts, label) => {
      const summary = { ...EMPTY_FARM_SYNC_SUMMARY, ...counts };
      render(
        <MemoryRouter>
          <SyncStatusBadge summary={summary} />
          <SyncStatusPanel summary={summary} />
        </MemoryRouter>,
      );
      expect(screen.getByRole("button", { name: label })).toBeVisible();
      expect(screen.getAllByText(label)).toHaveLength(2);
      if (summary.errorCount)
        expect(screen.getByText("1 com erro")).toBeVisible();
      if (summary.reconcileCount)
        expect(screen.getByText("1 aguardando reconciliação")).toBeVisible();
    },
  );

  it("shows persisted ERROR only for A throughout A → B → A without stale health", async () => {
    await db.queue_gestures.add({
      client_tx_id: "gesture-a",
      fazenda_id: "farm-a",
      client_id: "client",
      status: "ERROR",
      created_at: "2026-10-07T10:00:00Z",
    });
    const ui = () => (
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>
    );
    const { rerender } = render(ui());
    await screen.findByRole("button", { name: "Erro de sincronização" });
    activeFarmId = "farm-b";
    rerender(ui());
    expect(
      screen.queryByRole("button", { name: "Erro de sincronização" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Verificando sincronização" }),
    ).toBeVisible();
    await screen.findByRole("button", { name: "Em dia" });
    activeFarmId = "farm-a";
    rerender(ui());
    expect(
      screen.queryByRole("button", { name: "Em dia" }),
    ).not.toBeInTheDocument();
    await screen.findByRole("button", { name: "Erro de sincronização" });
  });

  it("reacts to persisted reconciliation creation and completion with no queued gestures", async () => {
    const ui = () => (
      <MemoryRouter>
        <TopBar />
      </MemoryRouter>
    );
    const { rerender } = render(ui());
    await screen.findByRole("button", { name: "Em dia" });
    await act(async () => {
      await db.sync_reconcile_obligations.put({
        key: "farm-a:factual",
        fazenda_id: "farm-a",
        scope: "factual",
        generation_id: "generation-a",
        created_at: "2026-10-07T10:00:00Z",
        updated_at: "2026-10-07T10:00:00Z",
      });
    });
    await screen.findByRole("button", { name: "Reconciliação pendente" });
    activeFarmId = "farm-b";
    rerender(ui());
    expect(
      screen.getByRole("button", { name: "Verificando sincronização" }),
    ).toBeVisible();
    await screen.findByRole("button", { name: "Em dia" });
    activeFarmId = "farm-a";
    rerender(ui());
    expect(
      screen.queryByRole("button", { name: "Em dia" }),
    ).not.toBeInTheDocument();
    await screen.findByRole("button", { name: "Reconciliação pendente" });
    await act(async () => {
      await db.sync_reconcile_obligations.delete("farm-a:factual");
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Em dia" })).toBeVisible(),
    );
  });
});
