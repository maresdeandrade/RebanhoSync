import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260813134853_commercial_operation_v2.sql",
  ),
  "utf8",
);

describe("commercial_operation_v2 migration contract", () => {
  it("uses authenticated tenant checks and a hardened SECURITY DEFINER surface", () => {
    expect(migration).toContain("v_user_id uuid := auth.uid()");
    expect(migration).toContain("public.has_membership(p_fazenda_id)");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = pg_catalog, public");
    expect(migration).toContain("revoke all on function");
    expect(migration).toMatch(/from public;[\s\S]*from anon;/);
    expect(migration).toContain("grant execute on function");
  });

  it("locks the full frozen snapshot and rejects lot composition drift", () => {
    expect(migration).toMatch(/from public\.lotes[\s\S]*for update;/);
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("array_agg(a.id order by a.id)");
    expect(migration).toContain("COMMERCIAL_OPERATION_LOT_COMPOSITION_CHANGED");
    expect(migration).toContain("COMMERCIAL_OPERATION_SALE_PARTIAL_UPDATE");
  });

  it("measures the compact command payload in UTF-8 bytes at the RPC boundary", () => {
    expect(migration).toContain("commercial_operation_compact_json");
    expect(migration).toContain("octet_length(convert_to(");
    expect(migration).toContain("'UTF8'");
    expect(migration).not.toContain("pg_column_size(p_operation)");
  });

  it("persists one event/detail and creates no financial fact", () => {
    expect(
      migration.match(/insert into public\.eventos \(/g) ?? [],
    ).toHaveLength(1);
    expect(
      migration.match(/insert into public\.eventos_comercial \(/g) ?? [],
    ).toHaveLength(1);
    expect(migration).not.toMatch(/insert into public\.finance_transactions/i);
    expect(migration).not.toMatch(/insert into public\.eventos_financeiro/i);
  });
});
