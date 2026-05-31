import { describe, expect, it } from "vitest";

import type { ProtocoloSanitarioItem } from "@/lib/offline/types";
import {
  buildProtocolItemRevisionOps,
  classifyProtocolItemChange,
  createEmptyProtocolItemDraft,
  deterministicUuidFromText,
  readProtocolItemDraft,
} from "@/lib/sanitario/customization/customization";

function item(overrides: Partial<ProtocoloSanitarioItem> = {}): ProtocoloSanitarioItem {
  return {
    id: "item-v1",
    fazenda_id: "farm-1",
    protocolo_id: "protocol-1",
    logical_item_key: "11111111-1111-4111-8111-111111111111",
    item_code: "dose-1",
    version: 1,
    ativo: true,
    superseded_by_id: null,
    superseded_at: null,
    tipo: "vacinacao",
    produto: "Produto A",
    intervalo_dias: 30,
    dose_num: 1,
    gera_agenda: true,
    dedup_template: "dedup-a",
    payload: {
      item_code: "dose-1",
      depends_on_item_code: "dose-0",
      indicacao: "Indicacao",
      observacoes: "Obs",
      calendario_base: {
        mode: "rolling_interval",
        anchor: "last_event",
        interval_days: 30,
      },
    },
    client_id: "client",
    client_op_id: "op",
    client_tx_id: null,
    client_recorded_at: "2026-05-31T00:00:00.000Z",
    server_received_at: "2026-05-31T00:00:00.000Z",
    created_at: "2026-05-31T00:00:00.000Z",
    updated_at: "2026-05-31T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("immutable sanitary protocol item revisions", () => {
  it("classifies description and notes as simple_update", () => {
    const previous = item();
    const draft = {
      ...readProtocolItemDraft(previous),
      indicacao: "Nova indicacao visual",
      observacoes: "Nova observacao",
    };

    expect(classifyProtocolItemChange(previous, draft)).toBe("simple_update");
  });

  it.each([
    ["produto", { produto: "Produto B" }],
    ["intervalo", { intervaloDias: "45" }],
    ["geraAgenda", { geraAgenda: false }],
    ["dependencia", { dependsOnItemCode: "dose-x" }],
    ["itemCode", { itemCode: "dose-x" }],
  ])("classifies %s changes as semantic_revision", (_caseName, patch) => {
    const previous = item();
    const draft = {
      ...readProtocolItemDraft(previous),
      ...patch,
    };

    expect(classifyProtocolItemChange(previous, draft)).toBe(
      "semantic_revision",
    );
  });

  it("builds the three offline ops for a semantic immutable revision", () => {
    const previous = item();
    const draft = {
      ...readProtocolItemDraft(previous),
      produto: "Produto B",
    };

    const ops = buildProtocolItemRevisionOps(previous, draft, {
      now: "2026-05-31T12:00:00.000Z",
      newItemId: "item-v2",
      protocolPayload: { family_code: "familia-a", regimen_version: 1 },
    });

    expect(ops).toHaveLength(3);
    expect(ops[0]).toMatchObject({
      table: "protocolos_sanitarios_itens",
      action: "UPDATE",
      record: {
        id: "item-v1",
        ativo: false,
        superseded_at: "2026-05-31T12:00:00.000Z",
      },
    });
    expect(ops[1]).toMatchObject({
      table: "protocolos_sanitarios_itens",
      action: "INSERT",
      record: {
        id: "item-v2",
        protocolo_id: "protocol-1",
        logical_item_key: "11111111-1111-4111-8111-111111111111",
        version: 2,
        ativo: true,
        produto: "Produto B",
      },
    });
    expect(ops[2]).toMatchObject({
      table: "protocolos_sanitarios_itens",
      action: "UPDATE",
      record: {
        id: "item-v1",
        superseded_by_id: "item-v2",
      },
    });
  });

  it("creates stable deterministic uuids for official logical item keys", () => {
    expect(deterministicUuidFromText("brucelose-pncebt:brucelose-b19")).toBe(
      deterministicUuidFromText("BRUCELOSE-PNCEBT:BRUCELOSE-B19"),
    );
  });

  it("rejects legacy items without logical_item_key during revision planning", () => {
    const previous = item({ logical_item_key: undefined });
    const draft = createEmptyProtocolItemDraft({ produto: "Produto B" });

    expect(() =>
      buildProtocolItemRevisionOps(previous, draft, {
        now: "2026-05-31T12:00:00.000Z",
        newItemId: "item-v2",
      }),
    ).toThrow(/logical_item_key/);
  });
});
