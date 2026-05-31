import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260531000000_protocolos_sanitarios_itens_immutable_versions.sql",
  ),
  "utf8",
);

describe("protocol item immutable schema contract", () => {
  it("requires logical_item_key and one active version per logical item", () => {
    expect(migration).toContain("alter column logical_item_key set not null");
    expect(migration).toContain(
      "protocolos_sanitarios_itens_logical_version_unique",
    );
    expect(migration).toContain(
      "idx_protocolos_sanitarios_itens_active_partial",
    );
    expect(migration).toContain("where ativo = true and deleted_at is null");
  });

  it("adds agenda version snapshot columns and fills them from protocol_item_version_id", () => {
    expect(migration).toContain("protocol_item_version_id");
    expect(migration).toContain("protocol_item_logical_key uuid");
    expect(migration).toContain("protocol_item_version integer");
    expect(migration).toContain("protocol_item_code text");
    expect(migration).toContain(
      "fill_sanitario_agenda_protocol_item_snapshot",
    );
  });

  it("adds event version snapshot columns and fills historical protocol snapshots", () => {
    expect(migration).toContain("protocol_item_snapshot jsonb");
    expect(migration).toContain(
      "fill_eventos_sanitario_protocol_item_snapshot",
    );
    expect(migration).toContain("'payload', v_item.payload");
  });
});
