import { describe, expect, it } from "vitest";

import { db } from "@/lib/offline/db";

describe("offline pasture evaluation store", () => {
  it("registra store event_eventos_pasto_avaliacao no Dexie", () => {
    expect(db.tables.map((table) => table.name)).toContain(
      "event_eventos_pasto_avaliacao",
    );
  });
});
