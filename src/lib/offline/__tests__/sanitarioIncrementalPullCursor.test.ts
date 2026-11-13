/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from "@/lib/supabase";
import { db } from "../db";
import {
  pullSanitarioAgendaV2,
  pullSanitarioProductClassV2Catalog,
  pullSanitarioProtocolCatalogV2,
  pullSanitarioTechnicalCatalogV2,
} from "../pull";

type FilterOp = "eq" | "is" | "gte" | "in";

const remoteRows: Record<string, Array<Record<string, unknown>>> = {};
const queryLog: Array<{
  table: string;
  op: FilterOp | "select";
  column: string;
  value: unknown;
}> = [];
const resultLog: Array<{ table: string; count: number }> = [];

function makeQuery(table: string) {
  const filters: Array<{ op: FilterOp; column: string; value: unknown }> = [];
  const query = {
    order: vi.fn(() => query),
    range: vi.fn((start: number, end: number) => Promise.resolve({ data: filterRows(table, filters).slice(start, end + 1), error: null })),
    select: vi.fn((column = "*") => {
      queryLog.push({ table, op: "select", column, value: null });
      return query;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      filters.push({ op: "eq", column, value });
      queryLog.push({ table, op: "eq", column, value });
      return query;
    }),
    is: vi.fn((column: string, value: unknown) => {
      filters.push({ op: "is", column, value });
      queryLog.push({ table, op: "is", column, value });
      return query;
    }),
    gte: vi.fn((column: string, value: unknown) => {
      filters.push({ op: "gte", column, value });
      queryLog.push({ table, op: "gte", column, value });
      return query;
    }),
    in: vi.fn((column: string, value: unknown[]) => {
      filters.push({ op: "in", column, value });
      queryLog.push({ table, op: "in", column, value });
      return query;
    }),
    then: (
      resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => {
      return Promise.resolve({ data: filterRows(table, filters), error: null })
        .then(resolve, reject);
    },
  };

  return query;
}

function filterRows(table: string, filters: Array<{ op: FilterOp; column: string; value: unknown }>) {
  const rows = remoteRows[table] ?? [];
  const result = rows.filter((row) =>
    filters.every((filter) => {
      if (filter.op === "eq") return row[filter.column] === filter.value;
      if (filter.op === "is") return row[filter.column] === filter.value;
      if (filter.op === "gte") {
        const value = row[filter.column];
        return typeof value === "string" && value >= String(filter.value);
      }
      if (filter.op === "in") {
        return Array.isArray(filter.value) && filter.value.includes(row[filter.column]);
      }
      return true;
    }),
  );
  resultLog.push({ table, count: result.length });
  return result;
}

describe("sanitario v2 incremental pull cursors", () => {
  it("recupera cache vazio com cursor antigo sem perder registros remotos anteriores ao cursor", async () => {
    remoteRows.sanitario_protocolos_v2 = [
      {
        id: "older-protocol",
        scope: "global",
        fazenda_id: null,
        updated_at: "2026-06-01",
        deleted_at: null,
      },
    ];
    remoteRows.sanitario_protocolo_itens_versions_v2 = [
      {
        id: "older-item",
        protocol_id: "older-protocol",
        updated_at: "2026-06-01",
        deleted_at: null,
      },
    ];
    remoteRows.sanitario_product_class_groups_v2 = [
      {
        id: "older-group",
        scope: "global",
        fazenda_id: null,
        updated_at: "2026-06-01",
        deleted_at: null,
      },
    ];
    for (const [remote, local] of [
      ["sanitario_protocolos_v2", "catalog_sanitario_protocolos_v2"],
      [
        "sanitario_protocolo_itens_versions_v2",
        "catalog_sanitario_protocolo_itens_versions_v2",
      ],
      [
        "sanitario_product_class_groups_v2",
        "catalog_sanitario_product_class_groups_v2",
      ],
    ]) {
      await db.sync_pull_cursors.put({
        key: `${remote}:global:null`,
        remote_table: remote,
        local_store: local,
        scope: "global",
        fazenda_id: null,
        last_updated_at: "2026-07-01",
        last_id: null,
        updated_at: "2026-07-01",
      });
    }
    const result = await pullSanitarioProtocolCatalogV2();
    expect(
      await db.catalog_sanitario_protocolos_v2.get("older-protocol"),
    ).toBeDefined();
    expect(
      await db.catalog_sanitario_protocolo_itens_versions_v2.get("older-item"),
    ).toBeDefined();
    expect(
      await db.catalog_sanitario_product_class_groups_v2.get("older-group"),
    ).toBeDefined();
    expect(result).toMatchObject({
      protocolsFullFetch: true,
      remoteEmpty: false,
    });
  });

  it("consulta incremental sem delta não comprova vazio remoto e pulls concorrentes compartilham a instalação", async () => {
    remoteRows.sanitario_protocolos_v2 = [
      {
        id: "global",
        scope: "global",
        fazenda_id: null,
        updated_at: "2026-06-01",
        deleted_at: null,
      },
    ];
    await pullSanitarioProtocolCatalogV2();
    remoteRows.sanitario_protocolos_v2 = [];
    queryLog.length = 0;
    const [first, second] = await Promise.all([
      pullSanitarioProtocolCatalogV2(),
      pullSanitarioProtocolCatalogV2(),
    ]);
    expect(
      queryLog.filter(
        (q) => q.table === "sanitario_protocolos_v2" && q.op === "select",
      ),
    ).toHaveLength(1);
    expect(first).toMatchObject({
      protocolsFullFetch: false,
      remoteEmpty: false,
    });
    expect(second).toEqual(first);
    expect(await db.catalog_sanitario_protocolos_v2.count()).toBe(1);
  });

  it("somente consulta completa sem protocolos comprova vazio visível à sessão", async () => {
    expect(await pullSanitarioProtocolCatalogV2()).toEqual({
      protocolsFullFetch: true,
      remoteEmpty: true,
    });
  });

  it("falha na última tabela preserva cache e cursor, libera pull compartilhado e permite retry", async () => {
    const row = {
      id: "global",
      scope: "global",
      fazenda_id: null,
      name: "Anterior",
      updated_at: "2026-06-01",
      deleted_at: null,
    };
    remoteRows.sanitario_protocolos_v2 = [row];
    await pullSanitarioProtocolCatalogV2();
    const cursor = await db.sync_pull_cursors.get(
      "sanitario_protocolos_v2:global:null",
    );
    remoteRows.sanitario_protocolos_v2 = [
      { ...row, name: "Atualizado", updated_at: "2026-07-01" },
    ];
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      const query = makeQuery(table);
      if (table === "sanitario_product_class_groups_v2") {
        query.then = (resolve, reject) =>
          Promise.reject(new Error("network failure")).then(resolve, reject);
      }
      return query as never;
    });
    const failed = await Promise.allSettled([
      pullSanitarioProtocolCatalogV2(),
      pullSanitarioProtocolCatalogV2(),
    ]);
    expect(failed.map((result) => result.status)).toEqual([
      "rejected",
      "rejected",
    ]);
    expect(
      await db.catalog_sanitario_protocolos_v2.get("global"),
    ).toMatchObject({ name: "Anterior" });
    expect(
      await db.sync_pull_cursors.get("sanitario_protocolos_v2:global:null"),
    ).toEqual(cursor);
    vi.mocked(supabase.from).mockImplementation(
      (table: string) => makeQuery(table) as never,
    );
    await pullSanitarioProtocolCatalogV2();
    expect(
      await db.catalog_sanitario_protocolos_v2.get("global"),
    ).toMatchObject({ name: "Atualizado" });
    expect(await db.catalog_sanitario_protocolos_v2.count()).toBe(1);
  });

  it("paginação/reconnect substitui vínculos completos e falha de rede preserva cache", async () => {
    const table = "sanitario_produto_carencia_fontes_v2";
    const store = db.catalog_sanitario_produto_carencia_fontes_v2;
    remoteRows[table] = Array.from({ length: 1001 }, (_, index) => ({
      withdrawal_rule_id: `rule-${index}`, source_id: "source", field_key: "withdrawal", created_at: "2026-10-29",
    }));
    await pullSanitarioTechnicalCatalogV2("farm-A");
    expect(await store.count()).toBe(1001);
    await pullSanitarioTechnicalCatalogV2("farm-A");
    expect(await store.count()).toBe(1001);
    remoteRows[table] = [remoteRows[table][0]];
    await pullSanitarioTechnicalCatalogV2("farm-A");
    const offline = await store.toArray();
    expect(offline).toHaveLength(1);
    vi.mocked(supabase.from).mockImplementation((name: string) => {
      if (name === table) throw new Error("offline-before-install");
      return makeQuery(name) as never;
    });
    await expect(pullSanitarioTechnicalCatalogV2("farm-B")).rejects.toThrow("offline-before-install");
    expect(await store.toArray()).toEqual(offline);
    expect(await db.sync_pull_cursors.get(`${table}:unscoped:null`)).toBeUndefined();
  });
  const fazendaId = "farm-cursor-12e5";
  async function addConflictEvidence(opId: string) {
    const op = await db.queue_ops.get(opId);
    if (!op) throw new Error("missing test operation");
    return db.queue_rejections.add({ client_op_id: opId, client_tx_id: op.client_tx_id, fazenda_id: fazendaId, table: "sanitario_v2", action: "INSERT", reason_code: "SANITARIO_AGENDA_REVISION_CONFLICT", reason_message: "conflict", result_status: "CONFLICT", current_revision: 2, created_at: "2026-11-01" });
  }
  it("usa o resultado durável do gesto se a rejeição temporária tiver expirado", async () => {
    const id = crypto.randomUUID(), opId = crypto.randomUUID(), tx = crypto.randomUUID();
    const local = { id, fazenda_id: fazendaId, status: "programada", data_programada: "2026-11-09", revision: 1, updated_at: "2026-11-01T00:00:00Z" };
    await db.ops_sanitario_agenda_v2.put(local as never);
    await db.queue_ops.put({ client_op_id: opId, client_tx_id: tx, table: "sanitario_v2", action: "INSERT", sync_state: "REJECTED", blocked_reason: "SANITARIO_AGENDA_REVISION_CONFLICT", created_at: "2026-11-01", record: { domain: "sanitario_v2", command: "reschedule_agenda", fazenda_id: fazendaId, expected_revision: 1, payload: { agenda_id: id, data_programada: "2026-11-09" } } });
    await db.queue_gestures.put({ client_tx_id: tx, fazenda_id: fazendaId, client_id: "client", status: "REJECTED", created_at: "2026-11-01", operation_results: [{ op_id: opId, status: "CONFLICT", current_revision: 2, matched: true, recorded_at: "2026-11-01" }] });
    remoteRows.sanitario_agenda_v2 = [{ ...local, revision: 2, data_programada: "2026-11-08" }];
    try {
      await pullSanitarioAgendaV2(fazendaId);
      expect(await db.ops_sanitario_agenda_v2.get(id)).toMatchObject({ data_programada: "2026-11-08", revision: 2 });
      expect(await db.queue_ops.get(opId)).toMatchObject({ sync_state: "REJECTED" });
    } finally { await db.queue_ops.delete(opId); await db.queue_gestures.delete(tx); }
  });
  it.each(["PENDING", "RETRYABLE", "BLOCKED_DEPENDENCY", "RECONCILE"] as const)("mantém reconciliação pendente quando intenção %s protege a mesma Agenda", async (pendingState) => {
    const id = crypto.randomUUID(), rejectedId = crypto.randomUUID(), pendingId = crypto.randomUUID(), tx = crypto.randomUUID();
    const local = { id, fazenda_id: fazendaId, status: "programada", data_programada: "2026-11-10", revision: 1, updated_at: "2026-11-01T00:00:00Z" };
    const record = { domain: "sanitario_v2", command: "reschedule_agenda", fazenda_id: fazendaId, expected_revision: 1, payload: { agenda_id: id, data_programada: "2026-11-09" } };
    await db.ops_sanitario_agenda_v2.put(local as never);
    await db.queue_ops.bulkPut([
      { client_op_id: rejectedId, client_tx_id: tx, table: "sanitario_v2", action: "INSERT", sync_state: "REJECTED", blocked_reason: "SANITARIO_AGENDA_REVISION_CONFLICT", created_at: "2026-11-01", record },
      { client_op_id: pendingId, client_tx_id: tx, table: "sanitario_v2", action: "INSERT", sync_state: pendingState, created_at: "2026-11-02", record: { ...record, payload: { agenda_id: id, data_programada: "2026-11-10" } } },
    ]);
    const rejectionId = await addConflictEvidence(rejectedId);
    remoteRows.sanitario_agenda_v2 = [{ ...local, revision: 2, data_programada: "2026-11-08" }];
    try {
      await expect(pullSanitarioAgendaV2(fazendaId)).rejects.toThrow("SANITARIO_CONFLICT_RECONCILIATION_PENDING_OPERATION");
      expect(await db.ops_sanitario_agenda_v2.get(id)).toMatchObject({ data_programada: "2026-11-10", revision: 1 });
      expect(await db.queue_ops.get(pendingId)).toMatchObject({ sync_state: pendingState });
    } finally { await db.queue_ops.bulkDelete([rejectedId, pendingId]); await db.queue_rejections.delete(rejectionId); }
  });
  it("não instala snapshot anterior à revisão informada no conflito", async () => {
    const id = crypto.randomUUID(), opId = crypto.randomUUID(), txId = crypto.randomUUID();
    const local = { id, fazenda_id: fazendaId, status: "programada", data_programada: "2026-11-09", revision: 1, updated_at: "2026-11-01T00:00:00Z" };
    await db.ops_sanitario_agenda_v2.put(local as never);
    await db.queue_ops.put({ client_op_id: opId, client_tx_id: txId, table: "sanitario_v2", action: "INSERT", sync_state: "REJECTED", blocked_reason: "SANITARIO_AGENDA_REVISION_CONFLICT", created_at: "2026-11-01", record: { domain: "sanitario_v2", command: "reschedule_agenda", fazenda_id: fazendaId, expected_revision: 1, payload: { agenda_id: id, data_programada: "2026-11-09" } } });
    const oldRejectionId = await addConflictEvidence(opId);
    const rejectionId = await db.queue_rejections.add({ client_op_id: opId, client_tx_id: txId, fazenda_id: fazendaId, table: "sanitario_v2", action: "INSERT", reason_code: "SANITARIO_AGENDA_REVISION_CONFLICT", reason_message: "conflict", result_status: "CONFLICT", current_revision: 3, created_at: "2026-11-01" });
    remoteRows.sanitario_agenda_v2 = [{ ...local, data_programada: "2026-11-08", revision: 2, updated_at: "2026-11-02T00:00:00Z" }];
    try {
      await expect(pullSanitarioAgendaV2(fazendaId)).rejects.toThrow("SANITARIO_CONFLICT_RECONCILIATION_SNAPSHOT_UNAVAILABLE");
      expect(await db.ops_sanitario_agenda_v2.get(id)).toMatchObject({ revision: 1, data_programada: "2026-11-09" });
    } finally { await db.queue_ops.delete(opId); await db.queue_rejections.bulkDelete([oldRejectionId, rejectionId]); }
  });
  it("protege intenção criada após o fetch e antes da instalação do pull", async () => {
    const id = crypto.randomUUID(), opId = crypto.randomUUID();
    const remote = { id, fazenda_id: fazendaId, status: "programada", data_programada: "2026-11-08", revision: 2, updated_at: "2026-11-02T00:00:00Z" };
    remoteRows.sanitario_agenda_v2 = [remote];
    const originalTransaction = db.transaction.bind(db);
    const transaction = vi.spyOn(db, "transaction").mockImplementationOnce((async (...args: unknown[]) => {
      await db.ops_sanitario_agenda_v2.put({ ...remote, data_programada: "2026-11-10" } as never);
      await db.queue_ops.put({ client_op_id: opId, client_tx_id: crypto.randomUUID(), table: "sanitario_v2", action: "INSERT", sync_state: "PENDING", created_at: "2026-11-02", record: { domain: "sanitario_v2", command: "reschedule_agenda", fazenda_id: fazendaId, expected_revision: 2, payload: { agenda_id: id, data_programada: "2026-11-10" } } });
      return (originalTransaction as (...values: unknown[]) => unknown)(...args);
    }) as typeof db.transaction);
    try {
      await pullSanitarioAgendaV2(fazendaId);
      expect(await db.ops_sanitario_agenda_v2.get(id)).toMatchObject({ data_programada: "2026-11-10", revision: 2 });
      expect(await db.queue_ops.get(opId)).toMatchObject({ sync_state: "PENDING" });
      expect(await db.sync_pull_cursors.get(`sanitario_agenda_v2:fazenda:${fazendaId}`)).toBeUndefined();
    } finally { transaction.mockRestore(); await db.queue_ops.delete(opId); }
  });
  it("não conclui pull sem snapshot vencedor e recupera a mesma rejeição quando ele reaparece", async () => {
    const id = crypto.randomUUID(), opId = crypto.randomUUID(), txId = crypto.randomUUID();
    const local = { id, fazenda_id: fazendaId, status: "programada", data_programada: "2026-11-09", revision: 1, updated_at: "2026-11-01T00:00:00Z" };
    const record = { domain: "sanitario_v2", command: "reschedule_agenda", fazenda_id: fazendaId, expected_revision: 1, payload: { agenda_id: id, data_programada: "2026-11-09" } };
    await db.ops_sanitario_agenda_v2.put(local as never);
    await db.queue_ops.put({ client_op_id: opId, client_tx_id: txId, table: "sanitario_v2", action: "INSERT", sync_state: "REJECTED", blocked_reason: "SANITARIO_AGENDA_REVISION_CONFLICT", created_at: "2026-11-01", record });
    const rejectionId = await addConflictEvidence(opId);
    try {
      await expect(pullSanitarioAgendaV2(fazendaId)).rejects.toThrow("SANITARIO_CONFLICT_RECONCILIATION_SNAPSHOT_UNAVAILABLE");
      expect(await db.ops_sanitario_agenda_v2.get(id)).toMatchObject({ data_programada: "2026-11-09", revision: 1 });
      expect(await db.sync_pull_cursors.get(`sanitario_agenda_v2:fazenda:${fazendaId}`)).toBeUndefined();
      expect(await db.queue_ops.get(opId)).toMatchObject({ client_tx_id: txId, sync_state: "REJECTED", record });
      remoteRows.sanitario_agenda_v2 = [{ ...local, data_programada: "2026-11-08", revision: 2, updated_at: "2026-11-02T00:00:00Z" }];
      await pullSanitarioAgendaV2(fazendaId);
      expect(await db.ops_sanitario_agenda_v2.get(id)).toMatchObject({ data_programada: "2026-11-08", revision: 2 });
      expect(await db.queue_ops.get(opId)).toMatchObject({ client_tx_id: txId, sync_state: "REJECTED", record });
    } finally { await db.queue_ops.delete(opId); await db.queue_rejections.delete(rejectionId); }
  });
  it("não troca uma Agenda de revisão superior por snapshot remoto obsoleto", async () => {
    const id = crypto.randomUUID();
    const newer = { id, fazenda_id: fazendaId, status: "programada", data_programada: "2026-11-10", revision: 3, updated_at: "2026-11-03T00:00:00Z" };
    await db.ops_sanitario_agenda_v2.put(newer as never);
    remoteRows.sanitario_agenda_v2 = [{ ...newer, data_programada: "2026-11-08", revision: 2, updated_at: "2026-11-02T00:00:00Z" }];
    await pullSanitarioAgendaV2(fazendaId);
    expect(await db.ops_sanitario_agenda_v2.get(id)).toMatchObject({ data_programada: "2026-11-10", revision: 3 });
    expect(await db.sync_pull_cursors.get(`sanitario_agenda_v2:fazenda:${fazendaId}`)).toBeUndefined();
  });
  it("recupera revisão vencedora mais antiga que o cursor da tabela após conflito", async () => {
    const agendaId = crypto.randomUUID(), opId = crypto.randomUUID();
    const local = { id: agendaId, fazenda_id: fazendaId, status: "programada", data_programada: "2026-11-09", revision: 1, updated_at: "2026-11-01T00:00:00Z" };
    await db.ops_sanitario_agenda_v2.put(local as never);
    await db.queue_ops.put({ client_op_id: opId, client_tx_id: crypto.randomUUID(), table: "sanitario_v2", action: "INSERT", sync_state: "REJECTED", blocked_reason: "SANITARIO_AGENDA_REVISION_CONFLICT", created_at: "2026-11-01", record: { domain: "sanitario_v2", command: "reschedule_agenda", fazenda_id: fazendaId, expected_revision: 1, payload: { agenda_id: agendaId, data_programada: "2026-11-09" } } });
    const rejectionId = await addConflictEvidence(opId);
    await db.sync_pull_cursors.put({ key: `sanitario_agenda_v2:fazenda:${fazendaId}`, remote_table: "sanitario_agenda_v2", local_store: "ops_sanitario_agenda_v2", scope: "fazenda", fazenda_id: fazendaId, last_updated_at: "2026-11-03T00:00:00Z", last_id: null, updated_at: "2026-11-03T00:00:00Z" });
    remoteRows.sanitario_agenda_v2 = [{ ...local, data_programada: "2026-11-08", revision: 2, updated_at: "2026-11-02T00:00:00Z" }];
    try {
      await pullSanitarioAgendaV2(fazendaId);
      expect(await db.ops_sanitario_agenda_v2.get(agendaId)).toMatchObject({ data_programada: "2026-11-08", revision: 2 });
      expect(await db.queue_ops.get(opId)).toMatchObject({ sync_state: "REJECTED" });
    } finally { await db.queue_ops.delete(opId); await db.queue_rejections.delete(rejectionId); }
  });
  it("reconcilia reagendamento em conflito sem perder evidência nem sobrescrever outra intenção pendente da mesma transação", async () => {
    const tx = crypto.randomUUID(), rejectedId = crypto.randomUUID(), pendingId = crypto.randomUUID();
    const rejectedAgenda = crypto.randomUUID(), pendingAgenda = crypto.randomUUID();
    const original = { domain: "sanitario_v2", command: "reschedule_agenda", fazenda_id: fazendaId,
      payload: { agenda_id: rejectedAgenda, data_programada: "2026-11-09" }, expected_revision: 1 };
    const row = (id: string, date: string, revision: number) => ({ id, fazenda_id: fazendaId,
      data_programada: date, revision, status: "programada", updated_at: "2026-11-11T10:00:00Z" });
    await db.ops_sanitario_agenda_v2.bulkPut([row(rejectedAgenda, "2026-11-09", 1), row(pendingAgenda, "2026-11-12", 1)] as never[]);
    await db.queue_ops.bulkPut([
      { client_op_id: rejectedId, client_tx_id: tx, domain_op_id: crypto.randomUUID(), table: "sanitario_v2", action: "INSERT", sync_state: "REJECTED", blocked_reason: "SANITARIO_AGENDA_REVISION_CONFLICT", created_at: "2026-11-11", record: original },
      { client_op_id: pendingId, client_tx_id: tx, domain_op_id: crypto.randomUUID(), table: "sanitario_v2", action: "INSERT", sync_state: "RETRYABLE", created_at: "2026-11-11", record: { ...original, payload: { agenda_id: pendingAgenda, data_programada: "2026-11-12" } } },
    ]);
    const rejectionId = await addConflictEvidence(rejectedId);
    remoteRows.sanitario_agenda_v2 = [row(rejectedAgenda, "2026-11-08", 2), row(pendingAgenda, "2026-11-10", 2)];
    try {
      await pullSanitarioAgendaV2(fazendaId);
      expect(await db.ops_sanitario_agenda_v2.get(rejectedAgenda)).toMatchObject({ data_programada: "2026-11-08", revision: 2 });
      expect(await db.ops_sanitario_agenda_v2.get(pendingAgenda)).toMatchObject({ data_programada: "2026-11-12", revision: 1 });
      expect(await db.queue_ops.get(rejectedId)).toMatchObject({ client_tx_id: tx, sync_state: "REJECTED", record: original });
      expect(await db.queue_ops.get(pendingId)).toMatchObject({ sync_state: "RETRYABLE" });
      expect(await db.sync_pull_cursors.get(`sanitario_agenda_v2:fazenda:${fazendaId}`)).toBeUndefined();
    } finally { await db.queue_ops.bulkDelete([rejectedId, pendingId]); await db.queue_rejections.delete(rejectionId); }
  });
  it("não avança cursor de participante dispensado antes do ACK e instala o remoto depois", async () => {
    const table = "sanitario_agenda_animais_v2", agendaId = crypto.randomUUID(), animalId = crypto.randomUUID();
    const opId = crypto.randomUUID();
    const local = { agenda_id: agendaId, animal_id: animalId, fazenda_id: fazendaId, planned_status: "nao_executado",
      not_executed_reason: "obito:death", updated_at: "2026-11-04T12:00:00Z" };
    await db.ops_sanitario_agenda_animais_v2.put(local as never);
    await db.queue_ops.put({ client_op_id: opId, client_tx_id: crypto.randomUUID(), table: "sanitario_v2", action: "INSERT",
      sync_state: "RETRYABLE", created_at: local.updated_at, record: { domain: "sanitario_v2", command: "death_participant",
        fazenda_id: fazendaId, payload: { agenda_id: agendaId, animal_id: animalId, death_event_id: "death" } } });
    remoteRows[table] = [{ ...local, planned_status: "planejado", not_executed_reason: null }];
    try {
      await pullSanitarioAgendaV2(fazendaId);
      expect((await db.ops_sanitario_agenda_animais_v2.get([agendaId, animalId]))?.not_executed_reason).toBe("obito:death");
      expect(await db.sync_pull_cursors.get(`${table}:fazenda:${fazendaId}`)).toBeUndefined();
      await db.queue_ops.delete(opId);
      await pullSanitarioAgendaV2(fazendaId);
      expect((await db.ops_sanitario_agenda_animais_v2.get([agendaId, animalId]))?.planned_status).toBe("planejado");
      expect(await db.sync_pull_cursors.get(`${table}:fazenda:${fazendaId}`)).toMatchObject({ last_updated_at: local.updated_at });
    } finally { await db.queue_ops.delete(opId); }
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    queryLog.length = 0;
    resultLog.length = 0;
    for (const key of Object.keys(remoteRows)) delete remoteRows[key];

    await Promise.all([
      db.sync_pull_cursors.clear(),
      db.catalog_sanitario_product_classes_v2.clear(),
      db.catalog_sanitario_product_class_groups_v2.clear(),
      db.catalog_sanitario_product_class_group_members_v2.clear(),
      db.catalog_sanitario_product_class_default_rules_v2.clear(),
      db.catalog_sanitario_fontes_tecnicas_v2.clear(),
      db.catalog_sanitario_fonte_cobertura_campos_v2.clear(),
      db.catalog_sanitario_produtos_v2.clear(),
      db.catalog_sanitario_produto_especie_autorizacao_v2.clear(),
      db.catalog_sanitario_produto_fontes_v2.clear(),
      db.catalog_sanitario_produto_dose_rules_v2.clear(),
      db.catalog_sanitario_produto_carencia_rules_v2.clear(),
      db.catalog_sanitario_protocolos_v2.clear(),
      db.catalog_sanitario_protocolo_itens_versions_v2.clear(),
      db.ops_sanitario_agenda_v2.clear(),
      db.ops_sanitario_agenda_animais_v2.clear(),
      db.ops_sanitario_agenda_closures_v2.clear(),
    ]);

    vi.mocked(supabase.from).mockImplementation((table: string) => makeQuery(table) as never);
  });

  afterEach(async () => {
    await db.sync_pull_cursors.clear();
  });

  it("faz full fetch inicial, salva cursor por tabela e depois usa updated_at incremental na Agenda v2", async () => {
    remoteRows.sanitario_agenda_v2 = [
      {
        id: "agenda-old",
        fazenda_id: fazendaId,
        status: "programada",
        updated_at: "2026-06-13T10:00:00.000Z",
        deleted_at: null,
      },
    ];
    remoteRows.sanitario_agenda_animais_v2 = [
      {
        agenda_id: "agenda-old",
        animal_id: "animal-1",
        fazenda_id: fazendaId,
        planned_status: "planejado",
        updated_at: "2026-06-13T10:01:00.000Z",
      },
    ];
    remoteRows.sanitario_agenda_closures_v2 = [
      {
        id: "closure-old",
        fazenda_id: fazendaId,
        agenda_id: "agenda-old",
        closure_type: "cancelled",
        execution_evento_id: null,
        updated_at: "2026-06-13T10:02:00.000Z",
        deleted_at: null,
      },
    ];

    await pullSanitarioAgendaV2(fazendaId);

    expect(queryLog.some((entry) => entry.op === "gte")).toBe(false);
    expect(await db.sync_pull_cursors.count()).toBe(3);
    expect(await db.ops_sanitario_agenda_v2.get("agenda-old")).toMatchObject({
      updated_at: "2026-06-13T10:00:00.000Z",
      deleted_at: null,
    });

    remoteRows.sanitario_agenda_v2.push({
      id: "agenda-deleted",
      fazenda_id: fazendaId,
      status: "cancelada",
      updated_at: "2026-06-13T11:00:00.000Z",
      deleted_at: "2026-06-13T11:05:00.000Z",
    });
    queryLog.length = 0;
    resultLog.length = 0;

    await pullSanitarioAgendaV2(fazendaId);

    expect(queryLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "sanitario_agenda_v2",
          op: "eq",
          column: "fazenda_id",
          value: fazendaId,
        }),
        expect.objectContaining({
          table: "sanitario_agenda_v2",
          op: "gte",
          column: "updated_at",
          value: "2026-06-13T10:00:00.000Z",
        }),
      ]),
    );
    expect(resultLog.find((entry) => entry.table === "sanitario_agenda_v2")?.count).toBe(2);
    expect(await db.ops_sanitario_agenda_v2.get("agenda-deleted")).toMatchObject({
      deleted_at: "2026-06-13T11:05:00.000Z",
      updated_at: "2026-06-13T11:00:00.000Z",
    });
    expect(await db.sync_pull_cursors.get("sanitario_agenda_v2:fazenda:farm-cursor-12e5"))
      .toMatchObject({
        remote_table: "sanitario_agenda_v2",
        local_store: "ops_sanitario_agenda_v2",
        scope: "fazenda",
        fazenda_id: fazendaId,
        last_updated_at: "2026-06-13T11:00:00.000Z",
        last_id: "agenda-deleted",
      });
  });

  it("nao faz catalogo global depender de fazenda_id e mantem tenant separado", async () => {
    remoteRows.sanitario_product_classes_v2 = [
      {
        id: "class-global",
        scope: "global",
        fazenda_id: null,
        class_key: "vacina",
        updated_at: "2026-06-13T09:00:00.000Z",
        deleted_at: null,
      },
      {
        id: "class-tenant",
        scope: "tenant",
        fazenda_id: fazendaId,
        class_key: "vacina-fazenda",
        updated_at: "2026-06-13T09:30:00.000Z",
        deleted_at: null,
      },
    ];
    remoteRows.sanitario_product_class_groups_v2 = [];
    remoteRows.sanitario_product_class_group_members_v2 = [];
    remoteRows.sanitario_product_class_default_rules_v2 = [];

    await pullSanitarioProductClassV2Catalog(fazendaId);

    const globalClassQuery = queryLog.filter(
      (entry) =>
        entry.table === "sanitario_product_classes_v2" &&
        queryLog.indexOf(entry) <= queryLog.findIndex(
          (candidate) =>
            candidate.table === "sanitario_product_classes_v2" &&
            candidate.op === "is" &&
            candidate.column === "fazenda_id",
        ),
    );
    expect(globalClassQuery).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: "eq", column: "scope", value: "global" }),
        expect.objectContaining({ op: "is", column: "fazenda_id", value: null }),
      ]),
    );
    expect(globalClassQuery).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: "eq", column: "fazenda_id", value: fazendaId }),
      ]),
    );
    expect(await db.catalog_sanitario_product_classes_v2.toArray()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "class-global", fazenda_id: null }),
        expect.objectContaining({ id: "class-tenant", fazenda_id: fazendaId }),
      ]),
    );
  });

  it("usa cursor nos catalogos tecnicos com updated_at e mantem produto_fontes em full fetch por nao ter updated_at", async () => {
    remoteRows.sanitario_fontes_tecnicas_v2 = [
      {
        id: "source-global",
        scope: "global",
        fazenda_id: null,
        updated_at: "2026-06-13T08:00:00.000Z",
        deleted_at: null,
      },
    ];
    remoteRows.sanitario_fonte_cobertura_campos_v2 = [
      {
        id: "coverage-1",
        source_id: "source-global",
        field_key: "dose",
        updated_at: "2026-06-13T08:01:00.000Z",
        deleted_at: null,
      },
    ];
    remoteRows.sanitario_produtos_v2 = [];
    remoteRows.sanitario_produto_especie_autorizacao_v2 = [];
    remoteRows.sanitario_produto_fontes_v2 = [
      {
        product_id: "product-1",
        source_id: "source-global",
        field_key: "dose",
        created_at: "2026-06-13T08:02:00.000Z",
      },
    ];
    remoteRows.sanitario_produto_dose_rules_v2 = [];
    remoteRows.sanitario_produto_carencia_rules_v2 = [];

    await pullSanitarioTechnicalCatalogV2(fazendaId);
    queryLog.length = 0;

    await pullSanitarioTechnicalCatalogV2(fazendaId);

    expect(queryLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "sanitario_fontes_tecnicas_v2",
          op: "gte",
          column: "updated_at",
          value: "2026-06-13T08:00:00.000Z",
        }),
        expect.objectContaining({
          table: "sanitario_fonte_cobertura_campos_v2",
          op: "gte",
          column: "updated_at",
          value: "2026-06-13T08:01:00.000Z",
        }),
      ]),
    );
    expect(
      queryLog.some(
        (entry) =>
          entry.table === "sanitario_produto_fontes_v2" &&
          entry.op === "gte",
      ),
    ).toBe(false);
    expect(await db.sync_pull_cursors.get("sanitario_produto_fontes_v2:unscoped:null"))
      .toBeUndefined();
  });

  it("usa cursor incremental no catalogo de protocolos sanitarios v2 e preserva tombstones", async () => {
    remoteRows.sanitario_protocolos_v2 = [
      {
        id: "protocol-b19",
        family_code: "brucelose_b19",
        scope: "global",
        fazenda_id: null,
        status: "draft",
        approval_status: "draft",
        updated_at: "2026-06-15T08:00:00.000Z",
        deleted_at: null,
      },
    ];
    remoteRows.sanitario_protocolo_itens_versions_v2 = [
      {
        id: "item-b19",
        protocol_id: "protocol-b19",
        logical_item_key: "b19_femeas_3_8_meses",
        version: 1,
        updated_at: "2026-06-15T08:01:00.000Z",
        deleted_at: null,
      },
    ];
    remoteRows.sanitario_product_class_groups_v2 = [
      {
        id: "group-antiparasitario",
        group_key: "pcg_antiparasitarios_recria_estrategicos",
        scope: "global",
        fazenda_id: null,
        curation_status: "needs_review",
        updated_at: "2026-06-15T08:02:00.000Z",
        deleted_at: null,
      },
    ];

    await pullSanitarioProtocolCatalogV2();

    expect(queryLog.some((entry) => entry.op === "gte")).toBe(false);
    expect(await db.catalog_sanitario_protocolos_v2.get("protocol-b19"))
      .toMatchObject({
        family_code: "brucelose_b19",
        deleted_at: null,
      });

    remoteRows.sanitario_protocolos_v2.push({
      id: "protocol-aftosa",
      family_code: "febre_aftosa",
      scope: "global",
      fazenda_id: null,
      status: "retired",
      approval_status: "draft",
      updated_at: "2026-06-15T09:00:00.000Z",
      deleted_at: "2026-06-15T09:05:00.000Z",
    });
    queryLog.length = 0;

    await pullSanitarioProtocolCatalogV2();

    expect(queryLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "sanitario_protocolos_v2",
          op: "gte",
          column: "updated_at",
          value: "2026-06-15T08:00:00.000Z",
        }),
        expect.objectContaining({
          table: "sanitario_protocolo_itens_versions_v2",
          op: "gte",
          column: "updated_at",
          value: "2026-06-15T08:01:00.000Z",
        }),
        expect.objectContaining({
          table: "sanitario_product_class_groups_v2",
          op: "gte",
          column: "updated_at",
          value: "2026-06-15T08:02:00.000Z",
        }),
      ]),
    );
    expect(await db.catalog_sanitario_protocolos_v2.get("protocol-aftosa"))
      .toMatchObject({
        status: "retired",
        deleted_at: "2026-06-15T09:05:00.000Z",
      });
    expect(await db.sync_pull_cursors.get("sanitario_protocolos_v2:global:null"))
      .toMatchObject({
        remote_table: "sanitario_protocolos_v2",
        local_store: "catalog_sanitario_protocolos_v2",
        scope: "global",
        fazenda_id: null,
        last_updated_at: "2026-06-15T09:00:00.000Z",
        last_id: "protocol-aftosa",
      });
  });
});
