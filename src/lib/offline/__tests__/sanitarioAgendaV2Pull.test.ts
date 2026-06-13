/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  DEFAULT_REMOTE_TABLES,
  pullSanitarioAgendaV2,
  SANITARIO_AGENDA_V2_REMOTE_TABLES,
} from "../pull";
import { supabase } from "@/lib/supabase";
import { db } from "../db";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

const { localStores } = vi.hoisted(() => ({
  localStores: [
    "ops_sanitario_agenda_v2",
    "ops_sanitario_agenda_animais_v2",
    "ops_sanitario_agenda_closures_v2",
  ] as const,
}));

vi.mock("../db", () => ({
  db: {
    tables: localStores.map((name) => ({ name })),
    table: vi.fn(),
    transaction: vi.fn(),
  },
}));

const rowsByTable: Record<string, unknown[]> = {};
const queryLog: Array<{
  table: string;
  op: "eq" | "select";
  column: string;
  value: unknown;
}> = [];
const writeLog: Array<{ store: string; rows: unknown[] }> = [];
const storesByName = new Map<string, { clear: Mock; bulkPut: Mock }>();

const makeQuery = (table: string) => {
  const query = {
    select: vi.fn((column: string) => {
      queryLog.push({ table, op: "select", column, value: null });
      return query;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      queryLog.push({ table, op: "eq", column, value });
      return Promise.resolve({ data: rowsByTable[table] ?? [], error: null });
    }),
  };

  return query;
};

describe("pullSanitarioAgendaV2", () => {
  const fazendaId = "fazenda-agenda-v2";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    queryLog.length = 0;
    writeLog.length = 0;
    storesByName.clear();

    rowsByTable.sanitario_agenda_v2 = [
      {
        id: "agenda-1",
        fazenda_id: fazendaId,
        status: "programada",
        client_op_id: "op-agenda-remote",
        metadata: { remote: true },
        updated_at: "2026-06-13T10:00:00Z",
        deleted_at: "2026-06-13T12:00:00Z",
      },
    ];
    rowsByTable.sanitario_agenda_animais_v2 = [
      {
        agenda_id: "agenda-1",
        fazenda_id: fazendaId,
        animal_id: "animal-1",
        planned_status: "planejado",
        updated_at: "2026-06-13T10:30:00Z",
      },
    ];
    rowsByTable.sanitario_agenda_closures_v2 = [
      {
        id: "closure-1",
        fazenda_id: fazendaId,
        agenda_id: "agenda-1",
        closure_type: "cancelled",
        client_op_id: "op-closure-remote",
        execution_evento_id: null,
        metadata: { closure: true },
        updated_at: "2026-06-13T11:00:00Z",
        deleted_at: null,
      },
    ];

    (supabase.from as unknown as Mock).mockImplementation((table: string) =>
      makeQuery(table),
    );
    (db.transaction as unknown as Mock).mockImplementation(
      async (_mode: string, _stores: string[], callback: () => Promise<void>) => {
        await callback();
      },
    );
    (db.table as unknown as Mock).mockImplementation((storeName: string) => {
      const store = {
        clear: vi.fn(),
        bulkPut: vi.fn((rows: unknown[]) => {
          writeLog.push({ store: storeName, rows });
          return Promise.resolve();
        }),
      };
      storesByName.set(storeName, store);
      return store;
    });
  });

  it("puxa Agenda v2 por fazenda na ordem agenda -> animais -> closures e faz merge local", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await pullSanitarioAgendaV2(fazendaId);

    expect(supabase.from).toHaveBeenCalledTimes(3);
    expect((supabase.from as unknown as Mock).mock.calls.map(([table]) => table)).toEqual([
      "sanitario_agenda_v2",
      "sanitario_agenda_animais_v2",
      "sanitario_agenda_closures_v2",
    ]);

    for (const table of SANITARIO_AGENDA_V2_REMOTE_TABLES) {
      expect(queryLog).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table,
            op: "eq",
            column: "fazenda_id",
            value: fazendaId,
          }),
        ]),
      );
    }

    expect(db.transaction).toHaveBeenCalledWith(
      "rw",
      localStores,
      expect.any(Function),
    );
    expect(writeLog.map((entry) => entry.store)).toEqual(localStores);
    expect(writeLog[0].rows).toEqual([
      expect.objectContaining({
        id: "agenda-1",
        fazenda_id: fazendaId,
        updated_at: "2026-06-13T10:00:00Z",
        deleted_at: "2026-06-13T12:00:00Z",
        metadata: { remote: true },
      }),
    ]);
    expect(writeLog[1].rows).toEqual([
      expect.objectContaining({
        agenda_id: "agenda-1",
        animal_id: "animal-1",
      }),
    ]);
    expect(writeLog[2].rows).toEqual([
      expect.objectContaining({
        id: "closure-1",
        agenda_id: "agenda-1",
        client_op_id: "op-closure-remote",
        execution_evento_id: null,
      }),
    ]);

    for (const store of storesByName.values()) {
      expect(store.clear).not.toHaveBeenCalled();
    }
    expect(db.table).not.toHaveBeenCalledWith("queue_ops");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("mantem Agenda v2 fora do pull tenant generico legado", () => {
    expect(DEFAULT_REMOTE_TABLES).not.toEqual(
      expect.arrayContaining([...SANITARIO_AGENDA_V2_REMOTE_TABLES]),
    );
  });
});
