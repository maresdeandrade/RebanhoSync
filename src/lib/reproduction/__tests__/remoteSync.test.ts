import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/offline/db";
import { pullDataForFarm } from "@/lib/offline/pull";
import { supabase } from "@/lib/supabase";
import { pullReproductionDiagnosisState } from "../remoteSync";

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}));

type Row = Record<string, unknown>;

const now = "2026-03-01T10:00:00.000Z";

function eventRow(id: string, animalId: string, occurredAt: string): Row {
  return {
    id,
    fazenda_id: "farm-1",
    dominio: "reproducao",
    occurred_at: occurredAt,
    animal_id: animalId,
    lote_id: null,
    source_task_id: null,
    source_tx_id: null,
    source_client_op_id: null,
    corrige_evento_id: null,
    observacoes: null,
    payload: {},
    client_id: "client-remote",
    client_op_id: `op-${id}`,
    client_tx_id: `tx-${id}`,
    client_recorded_at: occurredAt,
    server_received_at: now,
    created_at: occurredAt,
    updated_at: now,
    deleted_at: null,
  };
}

function detailRow(
  id: string,
  tipo: "cobertura" | "IA" | "diagnostico",
  payload: Row,
): Row {
  return {
    evento_id: id,
    fazenda_id: "farm-1",
    tipo,
    macho_id: tipo === "diagnostico" ? null : "bull-1",
    payload: { schema_version: 1, ...payload },
    client_id: "client-remote",
    client_op_id: `op-detail-${id}`,
    client_tx_id: `tx-${id}`,
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

async function seedAnimal(id: string) {
  await db.state_animais.add({
    id,
    fazenda_id: "farm-1",
    identificacao: id,
    sexo: "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: "2024-01-01",
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    origem: null,
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: null,
    payload: {},
    client_id: "client-local",
    client_op_id: `op-animal-${id}`,
    client_tx_id: `tx-animal-${id}`,
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });
}

function mockRemote(events: Row[], details: Row[], failTable?: string) {
  const observedFilters: Array<{
    table: string;
    kind: "eq" | "in" | "gte";
    column: string;
    value: unknown;
  }> = [];
  vi.mocked(supabase.from).mockImplementation((table: string) => {
    const filters: Array<{ kind: "eq" | "in" | "gte"; column: string; value: unknown }> = [];
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        filters.push({ kind: "eq", column, value });
        observedFilters.push({ table, kind: "eq", column, value });
        return query;
      },
      in: (column: string, value: unknown[]) => {
        filters.push({ kind: "in", column, value });
        observedFilters.push({ table, kind: "in", column, value });
        return query;
      },
      gte: (column: string, value: unknown) => {
        filters.push({ kind: "gte", column, value });
        observedFilters.push({ table, kind: "gte", column, value });
        return query;
      },
      then: (
        resolve: (value: { data: Row[] | null; error: Row | null }) => unknown,
      ) => {
        if (table === failTable) {
          return Promise.resolve(resolve({ data: null, error: { message: "remote failure" } }));
        }
        let rows = table === "eventos" ? events : details;
        for (const filter of filters) {
          if (filter.kind === "eq") {
            rows = rows.filter((row) => row[filter.column] === filter.value);
          } else if (filter.kind === "in") {
            rows = rows.filter((row) => (filter.value as unknown[]).includes(row[filter.column]));
          } else {
            rows = rows.filter((row) => String(row[filter.column]) >= String(filter.value));
          }
        }
        return Promise.resolve(resolve({ data: rows, error: null }));
      },
    };
    return query as never;
  });
  return observedFilters;
}

describe("reproduction diagnosis remote pull", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.queue_ops.clear();
    await db.queue_gestures.clear();
    await db.sync_pull_cursors.clear();
    await db.event_eventos_reproducao.clear();
    await db.event_eventos.clear();
    await db.state_animais.clear();
  });

  afterEach(async () => {
    await db.queue_ops.clear();
    await db.queue_gestures.clear();
    await db.sync_pull_cursors.clear();
    await db.event_eventos_reproducao.clear();
    await db.event_eventos.clear();
    await db.state_animais.clear();
  });

  it.each([
    ["positivo", true, "2026-10-30", "2026-10-30"],
    ["positivo", true, null, "2026-10-20"],
    ["negativo", false, null, null],
  ] as const)("reconstructs %s diagnosis after event-detail round-trip", async (
    result,
    expectedPregnancy,
    explicitDpp,
    expectedDpp,
  ) => {
    await seedAnimal(`cow-${result}`);
    const animalId = `cow-${result}`;
    const service = eventRow("service-1", animalId, "2026-01-10T10:00:00.000Z");
    const diagnosis = {
      ...eventRow("diagnosis-1", animalId, "2026-03-01T10:00:00.000Z"),
      observacoes: "Diagnostico factual remoto.",
    };
    const details = [
      detailRow("service-1", "cobertura", {}),
      detailRow("diagnosis-1", "diagnostico", {
        resultado: result,
        episode_evento_id: "service-1",
        ...(explicitDpp ? { data_prevista_parto: explicitDpp } : {}),
      }),
    ];
    const filters = mockRemote([service, diagnosis], details);

    const pulled = await pullReproductionDiagnosisState("farm-1");

    expect(pulled.pulled).toBe(2);
    expect(await db.event_eventos.get("diagnosis-1")).toMatchObject({
      animal_id: animalId,
      observacoes: "Diagnostico factual remoto.",
    });
    expect(await db.event_eventos_reproducao.get("diagnosis-1")).toMatchObject({
      tipo: "diagnostico",
      payload: expect.objectContaining({
        resultado: result,
        episode_evento_id: "service-1",
      }),
    });
    expect(
      (await db.state_animais.get(animalId))?.payload.taxonomy_facts,
    ).toMatchObject({
      prenhez_confirmada: expectedPregnancy,
      ...(expectedDpp ? { data_prevista_parto: expectedDpp } : {}),
    });
    const eventCount = await db.event_eventos.count();
    await pullReproductionDiagnosisState("farm-1");
    expect(await db.event_eventos.count()).toBe(eventCount);
    expect(filters).toContainEqual(expect.objectContaining({
      table: "eventos_reproducao",
      kind: "gte",
      column: "updated_at",
    }));
  });

  it("preserves a pending local fact and does not advance its cursor", async () => {
    await seedAnimal("cow-pending");
    const localEvent = eventRow("diagnosis-pending", "cow-pending", now);
    const localDetail = detailRow("diagnosis-pending", "diagnostico", {
      resultado: "positivo",
      episode_evento_id: "service-pending",
    });
    await db.event_eventos.put(localEvent as never);
    await db.event_eventos_reproducao.put(localDetail as never);
    await db.queue_ops.add({
      client_op_id: "pending-op",
      client_tx_id: "pending-tx",
      op_order: 1,
      table: "eventos_reproducao",
      action: "INSERT",
      record: localDetail,
      created_at: now,
    });
    const service = eventRow("service-pending", "cow-pending", "2026-01-01T10:00:00.000Z");
    mockRemote(
      [service, { ...localEvent, observacoes: "remote divergent" }],
      [
        detailRow("service-pending", "cobertura", {}),
        { ...localDetail, payload: { ...localDetail.payload as Row, resultado: "negativo" } },
      ],
    );

    await pullReproductionDiagnosisState("farm-1");

    expect(await db.event_eventos.get("diagnosis-pending")).toMatchObject({
      observacoes: null,
    });
    expect(await db.sync_pull_cursors.count()).toBe(0);
  });

  it("preserves a pending reproductive event during the generic initial pull", async () => {
    const localEvent = eventRow("diagnosis-initial-pending", "cow-pending", now);
    await db.event_eventos.put(localEvent as never);
    await db.queue_ops.add({
      client_op_id: "pending-event-op",
      client_tx_id: "pending-event-tx",
      op_order: 0,
      table: "eventos",
      action: "INSERT",
      record: localEvent,
      created_at: now,
    });
    mockRemote([
      { ...localEvent, observacoes: "remote divergent" },
      eventRow("remote-existing-event", "cow-remote", now),
    ], []);

    await pullDataForFarm("farm-1", ["eventos"], { mode: "replace" });

    expect(await db.event_eventos.get("diagnosis-initial-pending")).toMatchObject({
      observacoes: null,
    });
    expect(await db.event_eventos.get("remote-existing-event")).toBeDefined();
  });

  it("rejects divergent collision or tenant/episode mismatch without partial writes", async () => {
    await seedAnimal("cow-conflict");
    const service = eventRow("service-conflict", "cow-conflict", "2026-01-01T10:00:00.000Z");
    const diagnosis = eventRow("diagnosis-conflict", "cow-conflict", now);
    const details = [
      detailRow("service-conflict", "cobertura", {}),
      detailRow("diagnosis-conflict", "diagnostico", {
        resultado: "positivo",
        episode_evento_id: "service-conflict",
      }),
    ];
    await db.event_eventos.put({ ...diagnosis, observacoes: "local divergent" } as never);
    mockRemote([service, diagnosis], details);
    await expect(
      pullReproductionDiagnosisState("farm-1"),
    ).rejects.toThrow("REPRO_PULL_EVENT_CONFLICT");
    expect(await db.event_eventos_reproducao.count()).toBe(0);

    await db.event_eventos.clear();
    const crossTenantService = { ...service, fazenda_id: "farm-other" };
    mockRemote([crossTenantService, diagnosis], details);
    await expect(
      pullReproductionDiagnosisState("farm-1"),
    ).rejects.toThrow("REPRO_PULL_FACT_CONTRACT_INVALID");
    expect(await db.event_eventos.count()).toBe(0);
  });

  it("does not persist an orphan detail when a remote fetch fails", async () => {
    await seedAnimal("cow-failure");
    mockRemote([], [detailRow("diagnosis-failure", "diagnostico", {
      resultado: "negativo",
      episode_evento_id: "service-failure",
    })], "eventos");

    await expect(
      pullReproductionDiagnosisState("farm-1"),
    ).rejects.toMatchObject({ message: "remote failure" });
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.event_eventos_reproducao.count()).toBe(0);
  });
});
