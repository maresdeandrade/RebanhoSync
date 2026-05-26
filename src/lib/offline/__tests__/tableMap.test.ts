import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { TABLE_MAP, getLocalStoreName, getRemoteTableName } from "../tableMap";

describe("tableMap", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("getLocalStoreName", () => {
    it("returns correct local store name for a known remote table", () => {
      expect(getLocalStoreName("animais")).toBe("state_animais");
      expect(getLocalStoreName("eventos")).toBe("event_eventos");
    });

    it("returns input as-is if it already starts with state_ or event_", () => {
      expect(getLocalStoreName("state_animais")).toBe("state_animais");
      expect(getLocalStoreName("event_eventos")).toBe("event_eventos");
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("returns input as-is and warns if remote table is unknown", () => {
      const unknownTable = "unknown_table";
      expect(getLocalStoreName(unknownTable)).toBe(unknownTable);
      expect(consoleSpy).toHaveBeenCalledWith(
        `[table-map] No local store found for remote table: ${unknownTable}. Using as-is.`,
      );
    });
  });

  describe("getRemoteTableName", () => {
    it("returns correct remote table name for a known local store", () => {
      expect(getRemoteTableName("state_animais")).toBe("animais");
      expect(getRemoteTableName("event_eventos")).toBe("eventos");
    });

    it("returns input as-is if it is already a known remote table name", () => {
      expect(getRemoteTableName("animais")).toBe("animais");
      expect(getRemoteTableName("eventos")).toBe("eventos");
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("returns input as-is and warns if local store is unknown but looks like one (starts with state_ or event_)", () => {
      const unknownLocal = "state_unknown";
      expect(getRemoteTableName(unknownLocal)).toBe(unknownLocal);
      expect(consoleSpy).toHaveBeenCalledWith(
        `[table-map] No remote table found for local store: ${unknownLocal}. Using as-is.`,
      );
    });

    it("returns input as-is without warning if it doesn't look like a local store and is not in TABLE_MAP", () => {
      const unknownString = "unknown_string";
      expect(getRemoteTableName(unknownString)).toBe(unknownString);
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });
});
