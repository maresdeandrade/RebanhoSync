import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationName = "20260722102038_sanitario_sync_v2_expand_foundation.sql";

function readMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", migrationName),
    "utf8",
  );
}

describe("Sync Sanitario v2 expand foundation", () => {
  it("substitui somente os SQLSTATEs stale nas três RPCs autoritativas", () => {
    const migrationPath = join(process.cwd(), "supabase", "migrations");
    const patchName =
      "20261004210000_sanitario_sync_v2_revision_conflict_pt409.sql";
    const patch = readFileSync(join(migrationPath, patchName), "utf8");
    const functionPattern =
      /create or replace function public\.internal_sanitario_sync_v2_(?:replace_agenda_animals|apply_factual_core|close_agenda)\([\s\S]*?\n\$\$;/g;
    const originalFunctions = readMigration().match(functionPattern) ?? [];
    const patchedFunctions = patch.match(functionPattern) ?? [];
    expect(originalFunctions).toHaveLength(3);
    expect(patchedFunctions).toHaveLength(3);
    for (const [index, original] of originalFunctions.entries()) {
      expect(patchedFunctions[index]).toBe(
        original.replace("errcode = '40001'", "errcode = 'PT409'"),
      );
    }
    // No grant, policy, schema, data or other function changes in this migration.
    expect(
      patch
        .replace(functionPattern, "")
        .replace(/^--.*$/gm, "")
        .trim(),
    ).toBe("");

    const authoritative = new Map<string, string>();
    for (const name of readdirSync(migrationPath)
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      const sql = readFileSync(join(migrationPath, name), "utf8");
      for (const definition of sql.match(functionPattern) ?? []) {
        const name = definition.match(/function public\.(\w+)/)?.[1];
        if (name) authoritative.set(name, definition);
      }
    }
    expect(authoritative.size).toBe(3);
    for (const definition of authoritative.values()) {
      expect(definition).toContain(
        "'SANITARIO_AGENDA_REVISION_CONFLICT current_revision=%', v_agenda.revision using errcode = 'PT409'",
      );
      expect(definition).not.toContain("errcode = '40001'");
    }
  });
  it("mantem as funcoes internas SECURITY INVOKER e exclusivas de service_role", () => {
    const sql = readMigration();
    const functions = [
      "internal_sanitario_sync_v2_create_agenda",
      "internal_sanitario_sync_v2_replace_agenda_animals",
      "internal_sanitario_sync_v2_apply_factual_core",
      "internal_sanitario_sync_v2_close_agenda",
    ];

    for (const functionName of functions) {
      expect(sql).toContain(
        `create or replace function public.${functionName}`,
      );
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

    expect(sql).toContain(
      "create table if not exists public.sanitario_sync_v2_gates",
    );
    expect(sql).toContain("enabled boolean not null default false");
    expect(sql).toContain(
      "create table if not exists public.sanitario_sync_v2_operations",
    );
    expect(sql).toContain("unique (fazenda_id, client_op_id)");
    expect(sql).toContain("unique (fazenda_id, operation_kind, domain_op_id)");
    expect(sql).toContain("ux_eventos_sanitario_agenda_primary_execution");
    expect(sql).toContain("ux_insumo_movimentacoes_source_lote_tipo");
  });

  it("inclui evento, detalhe e relações completos no fingerprint factual", () => {
    const sql = readMigration();
    const start = sql.indexOf(
      "create or replace function public.internal_sanitario_sync_v2_apply_factual_core",
    );
    const end = sql.indexOf(
      "create or replace function public.internal_sanitario_sync_v2_close_agenda",
      start,
    );
    const factualFunction = sql.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(factualFunction).toContain("v_fingerprint := pg_catalog.md5");
    expect(factualFunction).toContain("'event', to_jsonb(event_payload)");
    expect(factualFunction).toContain("'detail', to_jsonb(detail_payload)");
    expect(factualFunction).toContain("'animals', to_jsonb(event_animals)");
    expect(factualFunction).toContain(
      "public.internal_sanitario_sync_v2_existing_result",
    );
    expect(sql).toContain("SANITARIO_IDEMPOTENCY_CONFLICT");
  });

  it("conecta as funcoes somente no backend e preserva JWT antes de service_role", () => {
    const syncBatch = readFileSync(
      join(process.cwd(), "supabase", "functions", "sync-batch", "index.ts"),
      "utf8",
    );
    const sanitarioSync = readFileSync(
      join(
        process.cwd(),
        "supabase",
        "functions",
        "sync-batch",
        "sanitario-v2.ts",
      ),
      "utf8",
    );

    expect(syncBatch).toContain("executeSanitarioSyncV2Operation");
    expect(syncBatch).toContain("sanitario_sync_v2_gates");
    expect(syncBatch.indexOf("await authClient.auth.getUser(jwt)"))
      .toBeLessThan(
        syncBatch.indexOf("SUPABASE_SERVICE_ROLE_KEY"),
      );
    for (
      const functionName of [
        "internal_sanitario_sync_v2_create_agenda",
        "internal_sanitario_sync_v2_replace_agenda_animals",
        "internal_sanitario_sync_v2_apply_factual_core",
        "internal_sanitario_sync_v2_close_agenda",
      ]
    ) {
      expect(sanitarioSync).toContain(functionName);
    }
  });
});
