import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/offline/db";
import type { Animal, Lote, SanitarioAgendaLocalV2 } from "@/lib/offline/types";
import {
  cancelLocalSanitaryAgendaV2,
  filterLocalSanitaryAgendasV2,
  listLocalSanitaryAgendasV2,
  rescheduleLocalSanitaryAgendaV2,
} from "@/lib/sanitario/agenda/sanitaryLocalAgendaManagementV2";

const agenda = (overrides: Partial<SanitarioAgendaLocalV2> = {}): SanitarioAgendaLocalV2 => ({
  id: "agenda-1",
  fazenda_id: "farm-1",
  status: "programada",
  dedup_key: "dedup-1",
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: "2026-06-01T10:00:00.000Z",
  server_received_at: "2026-06-01T10:00:00.000Z",
  source_demand_key: null,
  preview_group_id: null,
  protocolo_id: "protocol-1",
  protocol_item_version_id: null,
  protocol_item_snapshot: { protocolName: "Brucelose B19", itemLabel: "Dose anual" },
  janela_inicio: "2026-07-01",
  janela_fim: null,
  data_programada: "2026-07-01",
  lote_id: "lot-1",
  produto_veterinario_id: null,
  produto_snapshot: {},
  produto_classe: null,
  acao_sanitaria: "agenda_manual_sanitaria",
  execution_evento_id: null,
  metadata: {},
  created_at: "2026-06-01T10:00:00.000Z",
  updated_at: "2026-06-01T10:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

const lot = {
  id: "lot-1",
  fazenda_id: "farm-1",
  nome: "Novilhas",
  deleted_at: null,
} as Lote;

const animal = {
  id: "animal-1",
  fazenda_id: "farm-1",
  nome: "Estrela",
  identificacao: "BR-101",
  deleted_at: null,
} as Animal;

async function clearScope() {
  await Promise.all([
    db.ops_sanitario_agenda_v2.clear(),
    db.ops_sanitario_agenda_animais_v2.clear(),
    db.state_animais.clear(),
    db.state_lotes.clear(),
    db.queue_ops.clear(),
    db.event_eventos.clear(),
    db.event_eventos_sanitario.clear(),
    db.state_insumo_movimentacoes.clear(),
  ]);
}

describe("sanitaryLocalAgendaManagementV2", () => {
  beforeEach(async () => {
    await db.open();
    await clearScope();
  });

  afterEach(clearScope);

  it("lista agendas locais com rótulos legíveis e atalho para a origem", async () => {
    await db.ops_sanitario_agenda_v2.bulkPut([
      agenda(),
      agenda({
        id: "agenda-2",
        lote_id: null,
        data_programada: "2026-06-20",
        metadata: { protocolName: "Raiva", itemLabel: "Reforço anual", target: { scope: "animal", id: "animal-1" } },
      }),
    ]);
    await db.state_lotes.put(lot);
    await db.state_animais.put(animal);

    const result = await listLocalSanitaryAgendasV2("farm-1", db);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      protocolLabel: "Raiva",
      itemLabel: "Reforço anual",
      target: { label: "Estrela", href: "/animais/animal-1" },
    });
    expect(result[1]).toMatchObject({
      protocolLabel: "Brucelose B19",
      itemLabel: "Dose anual",
      target: { label: "Novilhas", href: "/lotes/lot-1" },
    });
  });

  it("filtra por status, período e conteúdo visível", () => {
    const items = [
      { id: "1", plannedFor: "2026-07-01", status: "programada" as const, protocolLabel: "Brucelose B19", itemLabel: "Dose anual", target: { kind: "lote" as const, label: "Novilhas", href: "/lotes/1" }, canManage: true },
      { id: "2", plannedFor: "2026-08-01", status: "cancelada" as const, protocolLabel: "Raiva", itemLabel: "Reforço", target: { kind: "animal" as const, label: "Estrela", href: "/animais/1" }, canManage: false },
    ];

    expect(filterLocalSanitaryAgendasV2(items, { search: "novilhas", status: "programada", startDate: "2026-06-01", endDate: "2026-07-31" })).toEqual([items[0]]);
    expect(filterLocalSanitaryAgendasV2(items, { search: "estrela", status: "programada", startDate: "", endDate: "" })).toEqual([]);
  });

  it("reagenda alterando somente a data planejada e sem efeitos operacionais", async () => {
    const original = agenda();
    await db.ops_sanitario_agenda_v2.put(original);

    await rescheduleLocalSanitaryAgendaV2({ agendaId: original.id, fazendaId: original.fazenda_id, plannedFor: "2026-07-15" }, db);

    expect(await db.ops_sanitario_agenda_v2.get(original.id)).toEqual({ ...original, data_programada: "2026-07-15" });
    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.event_eventos_sanitario.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
  });

  it("cancela alterando somente o status e bloqueia agenda executada", async () => {
    const original = agenda();
    await db.ops_sanitario_agenda_v2.put(original);

    await cancelLocalSanitaryAgendaV2({ agendaId: original.id, fazendaId: original.fazenda_id }, db);
    expect(await db.ops_sanitario_agenda_v2.get(original.id)).toEqual({ ...original, status: "cancelada" });

    await db.ops_sanitario_agenda_v2.put(agenda({ id: "executed", execution_evento_id: "event-1" }));
    await expect(cancelLocalSanitaryAgendaV2({ agendaId: "executed", fazendaId: "farm-1" }, db)).rejects.toThrow("AGENDA_SANITARIA_NAO_GERENCIAVEL");
    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
  });
});
