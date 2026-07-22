import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationName = "20260722102038_sanitario_sync_v2_expand_foundation.sql";

function readMigration() {
  return readFileSync(join(process.cwd(), "supabase", "migrations", migrationName), "utf8");
}

describe("Sync Sanitario v2 expand foundation", () => {
  it("mantem as funcoes internas SECURITY INVOKER e exclusivas de service_role", () => {
    const sql = readMigration();
    const functions = [
      "internal_sanitario_sync_v2_create_agenda",
      "internal_sanitario_sync_v2_replace_agenda_animals",
      "internal_sanitario_sync_v2_apply_factual_core",
      "internal_sanitario_sync_v2_close_agenda",
    ];

    for (const functionName of functions) {
      expect(sql).toContain(`create or replace function public.${functionName}`);
      expect(sql).toContain(`grant execute on function public.${functionName}`);
    }
    expect(sql).not.toMatch(/security\s+definer/i);
    expect(sql).toContain("security invoker");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain("to service_role");
    expect(sql).toContain("set search_path = pg_catalog, public");
  });

  it("persiste o gate fail-closed e as identidades do contrato", () => {
    const sql = readMigration();

    expect(sql).toContain("create table if not exists public.sanitario_sync_v2_gates");
    expect(sql).toContain("enabled boolean not null default false");
    expect(sql).toContain("create table if not exists public.sanitario_sync_v2_operations");
    expect(sql).toContain("unique (fazenda_id, client_op_id)");
    expect(sql).toContain("unique (fazenda_id, operation_kind, domain_op_id)");
    expect(sql).toContain("ux_eventos_sanitario_agenda_primary_execution");
    expect(sql).toContain("ux_insumo_movimentacoes_source_lote_tipo");
  });

  it("nao ativa o push nem conecta as funcoes ao sync-batch", () => {
    const syncBatch = readFileSync(
      join(process.cwd(), "supabase", "functions", "sync-batch", "index.ts"),
      "utf8",
    );

    expect(syncBatch).not.toContain("internal_sanitario_sync_v2_");
    expect(syncBatch).not.toContain("sanitario_sync_v2_gates");
  });
});
