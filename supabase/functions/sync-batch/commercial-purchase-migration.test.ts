import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260808120000_individual_animal_purchase_sync.sql",
  "utf8",
);

describe("individual purchase transactional RPC migration", () => {
  it("keeps the three writes in one PostgreSQL function with rollback on constraints", () => {
    const body = sql.match(
      /create or replace function public\.apply_individual_animal_purchase[\s\S]*?\n\$\$;/i,
    )?.[0] ?? "";
    expect(body).toContain("insert into public.animais");
    expect(body).toContain("insert into public.eventos (");
    expect(body).toContain("insert into public.eventos_comercial");
    expect(body).toContain("(p_comercial->>'lote_id')::uuid, null");
    expect(body).toContain(
      "when unique_violation then",
    );
    expect(body).toContain("23505 isolado nunca prova replay idêntico");
    expect(body).toContain(
      "when foreign_key_violation or check_violation then",
    );
    expect(body).not.toContain("eventos_financeiro");
    expect(body).not.toContain("finance_transactions");
  });

  it("compares all three record fingerprints and reports specific conflicts", () => {
    expect(sql).toContain("commercial_purchase_record_fingerprint('animal'");
    expect(sql).toContain("commercial_purchase_record_fingerprint('event'");
    expect(sql).toContain("commercial_purchase_record_fingerprint('detail'");
    expect(sql).toContain("COMMERCIAL_PURCHASE_ANIMAL_DIVERGENT");
    expect(sql).toContain("COMMERCIAL_PURCHASE_EVENT_DIVERGENT");
    expect(sql).toContain("COMMERCIAL_PURCHASE_DETAIL_DIVERGENT");
    expect(sql).toContain("COMMERCIAL_PURCHASE_PARTIAL_EXISTING");
    expect(sql).toContain("COMMERCIAL_PURCHASE_CROSS_FARM");
    expect(sql.match(/COMMERCIAL_PURCHASE_DETAIL_DIVERGENT/g)).toHaveLength(2);
    expect(sql).toContain(
      "to_jsonb(coalesce((p_record->>'habilitado_monta')::boolean, false))",
    );
    expect(sql).toContain("coalesce(p_record->'payload', '{}'::jsonb)");
    expect(sql).toContain("coalesce(p_record->'issues', '[]'::jsonb)");
  });

  it("authorizes the authenticated farm member and never activates or removes the animal", () => {
    expect(sql).toContain(
      "auth.uid() is null or not public.has_membership(p_fazenda_id)",
    );
    expect(sql).toContain("'ativo'::public.animal_status_enum");
    expect(sql).not.toMatch(/delete\s+from\s+public\.animais/i);
  });
});
