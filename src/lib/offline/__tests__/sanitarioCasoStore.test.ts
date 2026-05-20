import { describe, expect, it } from "vitest";

import { db } from "@/lib/offline/db";
import { getLocalStoreName, getRemoteTableName } from "@/lib/offline/tableMap";

describe("offline sanitary case store", () => {
  it("registra store state_sanitario_casos no Dexie", () => {
    expect(db.tables.map((table) => table.name)).toContain(
      "state_sanitario_casos",
    );
  });

  it("mapeia sanitario_casos entre Supabase e Dexie", () => {
    expect(getLocalStoreName("sanitario_casos")).toBe(
      "state_sanitario_casos",
    );
    expect(getRemoteTableName("state_sanitario_casos")).toBe(
      "sanitario_casos",
    );
  });
});
