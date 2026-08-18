import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260813152618_harden_individual_animal_purchase_grants.sql",
  ),
  "utf8",
);

const signature = String.raw`public\.apply_individual_animal_purchase\(\s*uuid,\s*uuid,\s*uuid,\s*jsonb,\s*jsonb,\s*jsonb\s*\)`;

describe("commercial_purchase_v1 grant hardening migration", () => {
  it("fails closed on a missing or unexpected overload", () => {
    expect(migration).toContain(
      "public.apply_individual_animal_purchase(uuid,uuid,uuid,jsonb,jsonb,jsonb)",
    );
    expect(migration).toContain("v_overload_count <> 1");
    expect(migration).toContain("COMMERCIAL_PURCHASE_RPC_SIGNATURE_DRIFT");
  });

  it("revokes PUBLIC and anon while preserving authenticated execution", () => {
    expect(migration).toMatch(
      new RegExp(`revoke execute on function ${signature} from public`, "i"),
    );
    expect(migration).toMatch(
      new RegExp(`revoke execute on function ${signature} from anon`, "i"),
    );
    expect(migration).toMatch(
      new RegExp(
        `grant execute on function ${signature} to authenticated`,
        "i",
      ),
    );
  });

  it("changes grants only", () => {
    expect(migration).not.toMatch(/create\s+(or\s+replace\s+)?function/i);
    expect(migration).not.toMatch(/alter\s+table|create\s+table|drop\s+/i);
    expect(migration).not.toMatch(/apply_commercial_operation_v2/i);
    expect(migration).not.toMatch(/service_role/i);
  });
});
