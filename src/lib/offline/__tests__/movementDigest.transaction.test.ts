import "fake-indexeddb/auto";
import Dexie from "dexie";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { movementCommandDigest } from "../movementDigest";

const goldens = JSON.parse(
  readFileSync("src/lib/offline/__tests__/movementDigest.vectors.json", "utf8"),
) as Array<{ name: string; jsonInput: string; digest: string }>;
const database = new Dexie("movement-digest-transaction-regression");
database.version(1).stores({ writes: "id" });
afterEach(async () => {
  await database.delete();
});

describe("movement digest in an external Dexie transaction", () => {
  it.each(goldens)(
    "preserves PostgreSQL digest and commit: $name",
    async (golden) => {
      const input = JSON.parse(golden.jsonInput) as Record<string, unknown>;
      const outside = await movementCommandDigest(input);
      await database.open();
      const inside = await database.transaction(
        "rw",
        database.table("writes"),
        async () => {
          await database.table("writes").add({ id: "before" });
          const digest = await movementCommandDigest(input);
          await database.table("writes").add({ id: "after", digest });
          return digest;
        },
      );
      expect(inside).toBe(outside);
      expect(inside).toBe(golden.digest);
      expect(await database.table("writes").count()).toBe(2);
    },
  );
});
