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
  tipo: "cobertura" | "IA" | "diagnostico" | "parto" | "aborto",
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

function calfRow(id: string, motherId: string, birthEventId: string): Row {
  return {
    id,
    fazenda_id: "farm-1",
    identificacao: id,
    sexo: "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: "2026-10-20",
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: motherId,
    nome: null,
    rfid: null,
    especie: "bovino",
    origem: "nascimento",
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: null,
    payload: {
      generated_from: "evento_parto",
      birth_event_id: birthEventId,
    },
    client_id: "client-remote",
    client_op_id: `op-${id}`,
    client_tx_id: `tx-${birthEventId}`,
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

function agendaRow(id: string, calfId: string, birthEventId: string): Row {
  return {
    id,
    fazenda_id: "farm-1",
    dominio: "sanitario",
    tipo: "cura_umbigo",
    status: "agendado",
    data_prevista: "2026-10-20",
    animal_id: calfId,
    lote_id: null,
    dedup_key: `umbigo:${calfId}`,
    source_kind: "automatico",
    source_ref: { birth_event_id: birthEventId },
    source_evento_id: birthEventId,
    source_tx_id: null,
    source_client_op_id: null,
    protocol_item_version_id: null,
    interval_days_applied: 0,
    payload: { birth_event_id: birthEventId },
    client_id: "client-remote",
    client_op_id: `op-${id}`,
    client_tx_id: `tx-${birthEventId}`,
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

function mockRemote(
  events: Row[],
  details: Row[],
  failTable?: string,
  calves: Row[] = [],
  agendas: Row[] = [],
) {
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
        let rows = table === "eventos"
          ? events
          : table === "eventos_reproducao"
          ? details
          : table === "animais"
          ? calves
          : agendas;
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
    await db.state_agenda_itens.clear();
    await db.state_animais.clear();
  });

  afterEach(async () => {
    await db.queue_ops.clear();
    await db.queue_gestures.clear();
    await db.sync_pull_cursors.clear();
    await db.event_eventos_reproducao.clear();
    await db.event_eventos.clear();
    await db.state_agenda_itens.clear();
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

  it("preserves pending birth calves and neonatal agendas during the generic initial pull", async () => {
    const localCalf = calfRow("calf-pending", "cow-pending", "birth-pending");
    const localAgenda = agendaRow(
      "agenda-pending",
      "calf-pending",
      "birth-pending",
    );
    await db.state_animais.put(localCalf as never);
    await db.state_agenda_itens.put(localAgenda as never);
    await db.queue_ops.bulkAdd([
      {
        client_op_id: "pending-calf-op",
        client_tx_id: "pending-birth-tx",
        op_order: 2,
        table: "animais",
        action: "INSERT",
        record: localCalf,
        created_at: now,
      },
      {
        client_op_id: "pending-agenda-op",
        client_tx_id: "pending-birth-tx",
        op_order: 3,
        table: "agenda_itens",
        action: "INSERT",
        record: localAgenda,
        created_at: now,
      },
    ]);
    mockRemote([], [], undefined, [
      { ...localCalf, mae_id: "remote-divergent" },
      calfRow("calf-remote", "cow-remote", "birth-remote"),
    ], [
      { ...localAgenda, animal_id: "remote-divergent" },
      agendaRow("agenda-remote", "calf-remote", "birth-remote"),
    ]);

    await pullDataForFarm("farm-1", ["animais", "agenda_itens"], {
      mode: "replace",
    });

    expect(await db.state_animais.get("calf-pending")).toMatchObject({
      mae_id: "cow-pending",
    });
    expect(await db.state_agenda_itens.get("agenda-pending")).toMatchObject({
      animal_id: "calf-pending",
    });
    expect(await db.state_animais.get("calf-remote")).toBeDefined();
    expect(await db.state_agenda_itens.get("agenda-remote")).toBeDefined();
  });

  it("pulls a complete twin birth and rebuilds mother, calves and neonatal agenda", async () => {
    await seedAnimal("cow-birth");
    const events = [
      eventRow("service-birth", "cow-birth", "2026-01-10T10:00:00.000Z"),
      eventRow("diagnosis-birth", "cow-birth", "2026-03-01T10:00:00.000Z"),
      eventRow("birth-1", "cow-birth", "2026-10-20T10:00:00.000Z"),
    ];
    const details = [
      detailRow("service-birth", "cobertura", {}),
      detailRow("diagnosis-birth", "diagnostico", {
        resultado: "positivo",
        episode_evento_id: "service-birth",
      }),
      detailRow("birth-1", "parto", {
        episode_evento_id: "service-birth",
        data_parto_real: "2026-10-20",
        numero_crias: 2,
      }),
    ];
    const calves = [
      calfRow("calf-1", "cow-birth", "birth-1"),
      calfRow("calf-2", "cow-birth", "birth-1"),
    ];
    const agendas = [
      agendaRow("agenda-calf-1", "calf-1", "birth-1"),
      agendaRow("agenda-calf-2", "calf-2", "birth-1"),
    ];
    mockRemote(events, details, undefined, calves, agendas);

    const pulled = await pullReproductionDiagnosisState("farm-1");

    expect(pulled.pulled).toBe(7);
    expect(await db.state_animais.get("calf-1")).toMatchObject({
      mae_id: "cow-birth",
      pai_id: null,
      payload: expect.objectContaining({ birth_event_id: "birth-1" }),
    });
    expect(await db.state_animais.get("calf-2")).toBeDefined();
    expect(await db.state_agenda_itens.count()).toBe(2);
    const birthFacts = (await db.state_animais.get("cow-birth"))?.payload
      .taxonomy_facts;
    expect(birthFacts).toMatchObject({
      prenhez_confirmada: false,
      data_ultimo_parto: "2026-10-20",
    });
    expect(birthFacts).not.toHaveProperty("data_prevista_parto");
  });

  it("pulls abortion without calf or agenda and clears the current pregnancy", async () => {
    await seedAnimal("cow-loss");
    const events = [
      eventRow("service-loss", "cow-loss", "2026-01-10T10:00:00.000Z"),
      eventRow("diagnosis-loss", "cow-loss", "2026-03-01T10:00:00.000Z"),
      eventRow("loss-1", "cow-loss", "2026-05-01T10:00:00.000Z"),
    ];
    const details = [
      detailRow("service-loss", "IA", {}),
      detailRow("diagnosis-loss", "diagnostico", {
        resultado: "positivo",
        episode_evento_id: "service-loss",
      }),
      detailRow("loss-1", "aborto", {
        episode_evento_id: "service-loss",
      }),
    ];
    mockRemote(events, details);

    await pullReproductionDiagnosisState("farm-1");

    expect(await db.state_animais.count()).toBe(1);
    expect(await db.state_agenda_itens.count()).toBe(0);
    const lossFacts = (await db.state_animais.get("cow-loss"))?.payload
      .taxonomy_facts;
    expect(lossFacts).toMatchObject({ prenhez_confirmada: false });
    expect(lossFacts).not.toHaveProperty("data_prevista_parto");
  });

  it("projects a linear correction and rejects a correction branch", async () => {
    await seedAnimal("cow-correction");
    const service = eventRow(
      "service-correction",
      "cow-correction",
      "2026-01-10T10:00:00.000Z",
    );
    const diagnosis = eventRow(
      "diagnosis-correction",
      "cow-correction",
      "2026-03-01T10:00:00.000Z",
    );
    const correction = {
      ...eventRow(
        "correction-1",
        "cow-correction",
        "2026-03-01T10:00:00.000Z",
      ),
      corrige_evento_id: "diagnosis-correction",
      payload: {
        reproduction_correction: {
          schema_version: 1,
          nature: "correction",
          corrected_event_id: "diagnosis-correction",
        },
      },
    };
    const details = [
      detailRow("service-correction", "cobertura", {}),
      detailRow("diagnosis-correction", "diagnostico", {
        resultado: "positivo",
        episode_evento_id: "service-correction",
      }),
      detailRow("correction-1", "diagnostico", {
        resultado: "negativo",
        episode_evento_id: "service-correction",
      }),
    ];
    mockRemote([service, diagnosis, correction], details);

    await pullReproductionDiagnosisState("farm-1");

    const correctionFacts = (await db.state_animais.get("cow-correction"))
      ?.payload.taxonomy_facts;
    expect(correctionFacts).toMatchObject({ prenhez_confirmada: false });
    expect(correctionFacts).not.toHaveProperty("data_prevista_parto");
    expect(await db.event_eventos.get("diagnosis-correction")).toBeDefined();

    await db.event_eventos.clear();
    await db.event_eventos_reproducao.clear();
    await db.sync_pull_cursors.clear();
    const branch = {
      ...correction,
      id: "correction-branch",
      client_op_id: "op-correction-branch",
    };
    mockRemote(
      [service, diagnosis, correction, branch],
      [...details, detailRow("correction-branch", "diagnostico", {
        resultado: "positivo",
        episode_evento_id: "service-correction",
      })],
    );
    await expect(
      pullReproductionDiagnosisState("farm-1"),
    ).rejects.toThrow("REPRO_PULL_CORRECTION_BRANCH_CONFLICT");
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
    ).rejects.toThrow("REPRO_PULL_EPISODE_CONTRACT_INVALID");
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
