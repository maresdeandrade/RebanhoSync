import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/offline/db";
import { getLocalStoreName, getRemoteTableName } from "@/lib/offline/tableMap";
import type {
  SanitarioAgendaAnimalLocalV2,
  SanitarioAgendaClosureLocalV2,
  SanitarioAgendaLocalV2,
} from "@/lib/offline/types";

const stores = [
  "ops_sanitario_agenda_v2",
  "ops_sanitario_agenda_animais_v2",
  "ops_sanitario_agenda_closures_v2",
] as const;

const now = "2026-06-13T10:00:00.000Z";
const later = "2026-06-13T11:00:00.000Z";

describe("offline Agenda Sanitaria v2 stores", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all(stores.map((store) => db.table(store).clear()));
    await db.queue_ops.clear();
  });

  afterEach(async () => {
    await Promise.all(stores.map((store) => db.table(store).clear()));
    await db.queue_ops.clear();
  });

  it("registra stores ops_* da Agenda Sanitaria v2 no Dexie", () => {
    expect(db.verno).toBeGreaterThanOrEqual(25);
    expect(db.tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([...stores]),
    );
  });

  it("mapeia tabelas remotas Agenda v2 para stores locais ops_* sem usar state_*", () => {
    expect(getLocalStoreName("sanitario_agenda_v2")).toBe(
      "ops_sanitario_agenda_v2",
    );
    expect(getLocalStoreName("sanitario_agenda_animais_v2")).toBe(
      "ops_sanitario_agenda_animais_v2",
    );
    expect(getLocalStoreName("sanitario_agenda_closures_v2")).toBe(
      "ops_sanitario_agenda_closures_v2",
    );
    expect(getRemoteTableName("ops_sanitario_agenda_closures_v2")).toBe(
      "sanitario_agenda_closures_v2",
    );
  });

  it("preserva agenda local por fazenda, timestamps, deleted_at, metadata e snapshots", async () => {
    const agenda: SanitarioAgendaLocalV2 = {
      id: "agenda-v2-1",
      fazenda_id: "farm-agenda",
      status: "programada",
      dedup_key: "agenda:v2:1",
      client_id: "client-1",
      client_op_id: "op-agenda-1",
      client_tx_id: "tx-agenda-1",
      client_recorded_at: now,
      server_received_at: now,
      source_demand_key: null,
      preview_group_id: null,
      protocolo_id: null,
      protocol_item_version_id: null,
      protocol_item_snapshot: { planned: true },
      janela_inicio: "2026-06-20",
      janela_fim: "2026-06-25",
      data_programada: "2026-06-22",
      lote_id: null,
      produto_veterinario_id: null,
      produto_snapshot: { label: "sem produto executado" },
      produto_classe: "vacina",
      acao_sanitaria: "vacinacao",
      execution_evento_id: null,
      metadata: { phase: "12E4", tags: ["pull-cache"] },
      created_at: now,
      updated_at: later,
      deleted_at: "2026-06-13T12:00:00.000Z",
    };

    await db.ops_sanitario_agenda_v2.put(agenda);

    const stored = await db.ops_sanitario_agenda_v2.get(agenda.id);
    expect(stored).toMatchObject({
      fazenda_id: "farm-agenda",
      status: "programada",
      updated_at: later,
      deleted_at: "2026-06-13T12:00:00.000Z",
      execution_evento_id: null,
    });
    expect(stored?.metadata).toEqual({ phase: "12E4", tags: ["pull-cache"] });
    expect(stored?.protocol_item_snapshot).toEqual({ planned: true });
  });

  it("preserva agenda_animais por agenda_id e animal_id sem criar queue_ops", async () => {
    const agendaAnimal: SanitarioAgendaAnimalLocalV2 = {
      agenda_id: "agenda-v2-1",
      fazenda_id: "farm-agenda",
      animal_id: "animal-v2-1",
      planned_status: "planejado",
      execution_evento_id: null,
      not_executed_reason: null,
      metadata: { source: "remote" },
      created_at: now,
      updated_at: later,
    };

    await db.ops_sanitario_agenda_animais_v2.put(agendaAnimal);

    const stored = await db.ops_sanitario_agenda_animais_v2.get([
      agendaAnimal.agenda_id,
      agendaAnimal.animal_id,
    ]);
    expect(stored).toMatchObject({
      agenda_id: "agenda-v2-1",
      animal_id: "animal-v2-1",
      fazenda_id: "farm-agenda",
      updated_at: later,
    });
    expect(await db.queue_ops.count()).toBe(0);
  });

  it("preserva closure com client_op_id/idempotencia sem representar evento executado", async () => {
    const closure: SanitarioAgendaClosureLocalV2 = {
      id: "closure-v2-1",
      fazenda_id: "farm-agenda",
      agenda_id: "agenda-v2-1",
      closure_type: "closed_without_execution",
      dedup_key: "closure:v2:1",
      client_id: "client-1",
      client_op_id: "op-closure-1",
      client_tx_id: "tx-closure-1",
      client_recorded_at: now,
      server_received_at: now,
      closed_at: later,
      closed_by: null,
      execution_evento_id: null,
      reason: "Fechamento administrativo sem execucao sanitaria",
      partial_payload: {},
      metadata: { createsEvent: false, createsInventoryMovement: false },
      created_at: now,
      updated_at: later,
      deleted_at: null,
    };

    await db.ops_sanitario_agenda_closures_v2.put(closure);

    const stored = await db.ops_sanitario_agenda_closures_v2.get(closure.id);
    expect(stored).toMatchObject({
      agenda_id: "agenda-v2-1",
      client_op_id: "op-closure-1",
      execution_evento_id: null,
      updated_at: later,
      deleted_at: null,
    });
    expect(stored?.metadata).toEqual({
      createsEvent: false,
      createsInventoryMovement: false,
    });
    expect(await db.queue_ops.count()).toBe(0);
  });
});
