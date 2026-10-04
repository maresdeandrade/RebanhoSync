import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { readFileSync, writeFileSync } from "node:fs";
import {
  canonicalMovementJson,
  movementCommandDigest,
  normalizeMovementInput,
} from "../movementDigest";

const url = process.env.REBANHOSYNC_TEST_DB_URL;
const suite = url ? describe : describe.skip;
const base = {
  contract_version: 1,
  fazenda_id: "AAAAAAAA-0000-4000-8000-000000000001",
  subject_type: "animal",
  subject_id: "aaaaaaaa-0000-4000-8000-000000000002",
  event_id: "aaaaaaaa-0000-4000-8000-000000000003",
  client_op_id: "aaaaaaaa-0000-4000-8000-000000000004",
  client_tx_id: "aaaaaaaa-0000-4000-8000-000000000005",
  movement_mode: "operational",
  from_lote_id: null,
  to_lote_id: "aaaaaaaa-0000-4000-8000-000000000006",
  occurred_at: "2026-10-01T12:34:56.123456Z",
  movement_base: {
    kind: "snapshot",
    movement_version: "0",
    head_event_id: null,
  },
};
export const movementDigestVectors = [
  { name: "defaults/null", input: base },
  {
    name: "Unicode/C key ordering",
    input: {
      ...base,
      payload: {
        "😀": "ação\n\t",
        "\uE000": "á",
        z: null,
        a: [true, false, "雪"],
      },
    },
  },
  {
    name: "numeric exponent/scale/nested",
    input: {
      ...base,
      payload: {
        small: 1e-7,
        large: 1e21,
        max: Number.MAX_VALUE,
        min: Number.MIN_VALUE,
        zero: -0,
        nested: [{ n: 1.23 }, null],
      },
    },
  },
  {
    name: "timezone equivalent",
    input: {
      ...base,
      occurred_at: "2026-10-01T09:34:56.123456-03:00",
      detail_payload: { array: [null, { b: 2, a: 1 }] },
    },
  },
  {
    name: "after_movement",
    input: {
      ...base,
      movement_base: {
        kind: "after_movement",
        event_id: "aaaaaaaa-0000-4000-8000-000000000007",
        command_digest: "a".repeat(64),
      },
    },
  },
  {
    name: "history only",
    input: { ...base, movement_mode: "history_only", movement_base: null },
  },
];
const goldenPath = "src/lib/offline/__tests__/movementDigest.vectors.json";
const observed: Record<string, unknown>[] = [];
describe("movement PostgreSQL golden vectors without database", () => {
  const goldens = JSON.parse(readFileSync(goldenPath, "utf8")) as Array<{
    name: string;
    jsonInput: string;
    normalized: unknown;
    canonical: string;
    digest: string;
  }>;
  it.each(goldens)("$name", async (golden) => {
    const input = JSON.parse(golden.jsonInput) as Record<string, unknown>;
    expect(normalizeMovementInput(input)).toEqual(golden.normalized);
    expect(canonicalMovementJson(normalizeMovementInput(input))).toBe(
      golden.canonical,
    );
    expect(await movementCommandDigest(input)).toBe(golden.digest);
  });
});
suite("movement digest parity against real PostgreSQL", () => {
  let db: Client;
  beforeAll(async () => {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(url!).hostname))
      throw new Error("LOCAL_ONLY");
    db = new Client({ connectionString: url });
    await db.connect();
  });
  afterAll(async () => {
    if (process.env.REBANHOSYNC_GENERATE_MOVEMENT_VECTORS === "1")
      writeFileSync(goldenPath, JSON.stringify(observed, null, 2) + "\n");
    await db?.end();
  });
  for (const vector of movementDigestVectors)
    it(vector.name, async () => {
      const jsonInput = JSON.stringify(vector.input).replace(
        '"n":1.23',
        '"n":1.230000',
      );
      const { rows } = await db.query(
        `select public.normalize_animal_lot_movement_v1($1::jsonb) normalized,
      public.movement_command_canonical_json_v1(public.normalize_animal_lot_movement_v1($1::jsonb)) canonical,
      public.animal_lot_movement_command_digest_v1($1::jsonb) digest`,
        [jsonInput],
      );
      expect(normalizeMovementInput(vector.input)).toEqual(rows[0].normalized);
      expect(canonicalMovementJson(normalizeMovementInput(vector.input))).toBe(
        rows[0].canonical,
      );
      expect(await movementCommandDigest(vector.input)).toBe(rows[0].digest);
      const result = {
        name: vector.name,
        jsonInput,
        normalized: rows[0].normalized,
        canonical: rows[0].canonical,
        digest: rows[0].digest,
      };
      observed.push(result);
      if (process.env.REBANHOSYNC_GENERATE_MOVEMENT_VECTORS !== "1") {
        const goldens = JSON.parse(
          readFileSync(goldenPath, "utf8"),
        ) as typeof observed;
        expect(result).toEqual(goldens.find((row) => row.name === vector.name));
      }
    });
});
