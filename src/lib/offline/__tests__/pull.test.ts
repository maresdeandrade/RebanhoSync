/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { pullDataForFarm } from "../pull";
// Import the modules being mocked to access the spies
import { supabase } from "@/lib/supabase";
import { db } from "../db";

// Mock Supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock DB
vi.mock("../db", () => {
  return {
    db: {
      tables: [{ name: "state_animais" }, { name: "state_lotes" }],
      table: vi.fn(),
      transaction: vi.fn(),
    },
  };
});

describe("pullDataForFarm", () => {
  const mockFrom = supabase.from as unknown as Mock;
  const mockEq = vi.fn();
  const mockSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
  });

  it("aborts immediately if any table fetch fails", async () => {
    mockEq
      .mockResolvedValueOnce({ data: [{ id: 1 }], error: null }) // first call success
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Network Error" },
      }); // second call failure

    const remoteTables = ["animais", "lotes"];
    const fazendaId = "fazenda-1";

    await expect(
      pullDataForFarm(fazendaId, remoteTables),
    ).rejects.toMatchObject({
      message: "Network Error",
    });

    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(mockFrom).toHaveBeenCalledWith("animais");
    expect(mockFrom).toHaveBeenCalledWith("lotes");

    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("proceeds to transaction if all fetches succeed", async () => {
    mockEq.mockResolvedValue({ data: [{ id: 1 }], error: null });

    const remoteTables = ["animais", "lotes"];
    const fazendaId = "fazenda-1";
    const storeNameAnimais = "state_animais";
    const storeNameLotes = "state_lotes";

    (db.transaction as unknown as Mock).mockImplementation(
      async (
        _mode: string,
        _tables: string[],
        callback: () => Promise<void>,
      ) => {
        await callback();
      },
    );

    const mockStore = {
      clear: vi.fn(),
      bulkPut: vi.fn(),
    };
    (db.table as unknown as Mock).mockReturnValue(mockStore);

    await pullDataForFarm(fazendaId, remoteTables, { mode: "replace" });

    expect(db.transaction).toHaveBeenCalledWith(
      "rw",
      [storeNameAnimais, storeNameLotes],
      expect.any(Function),
    );

    expect(db.table).toHaveBeenCalledWith(storeNameAnimais);
    expect(db.table).toHaveBeenCalledWith(storeNameLotes);
    expect(mockStore.clear).toHaveBeenCalledTimes(2);
    expect(mockStore.bulkPut).toHaveBeenCalledTimes(2);
  });

  it("filters out invalid tables and logs warning", async () => {
    mockEq.mockResolvedValue({ data: [], error: null });

    const remoteTables = ["animais", "invalid_table"];
    const fazendaId = "fazenda-1";

    // db.tables mocked above has only state_animais and state_lotes
    // invalid_table maps to itself which is not in mocked db.tables

    (db.transaction as unknown as Mock).mockImplementation(
      async (
        _mode: string,
        _tables: string[],
        callback: () => Promise<void>,
      ) => {
        await callback();
      },
    );

    const mockStore = { clear: vi.fn(), bulkPut: vi.fn() };
    (db.table as unknown as Mock).mockReturnValue(mockStore);

    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await pullDataForFarm(fazendaId, remoteTables);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Store invalid_table not found"),
    );

    expect(db.transaction).toHaveBeenCalledWith(
      "rw",
      ["state_animais"],
      expect.any(Function),
    );
  });
});
