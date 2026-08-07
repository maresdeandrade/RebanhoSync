/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pullReproductionDiagnosisState: vi.fn(async () => undefined),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      })),
      refreshSession: vi.fn(),
    },
  },
}));

vi.mock("../pull", () => ({
  pullDataForFarm: vi.fn(async () => undefined),
  pullInitialData: vi.fn(async () => undefined),
  pullSanitarioAgendaV2: vi.fn(async () => undefined),
  pullSanitarioV2CutoverState: vi.fn(async () => undefined),
}));

vi.mock("@/lib/reproduction/remoteSync", () => ({
  pullReproductionDiagnosisState: mocks.pullReproductionDiagnosisState,
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(async () => undefined),
  flushPilotMetrics: vi.fn(async () => undefined),
}));

import { db } from "../db";
import { createGesture } from "../ops";
import { processGesture } from "../syncWorker";

describe("reproduction diagnosis sync worker", () => {
  async function createReproductionGesture(
    tipo: "diagnostico" | "parto" = "diagnostico",
  ) {
    const eventId = `${tipo}-worker`;
    return createGesture("farm-1", [
      {
        table: "eventos",
        action: "INSERT",
        record: {
          id: eventId,
          dominio: "reproducao",
          occurred_at: "2026-03-01T10:00:00.000Z",
          animal_id: "cow-1",
          lote_id: null,
          source_task_id: null,
          corrige_evento_id: null,
          observacoes: null,
          payload: {},
        },
      },
      {
        table: "eventos_reproducao",
        action: "INSERT",
        record: {
          evento_id: eventId,
          tipo,
          macho_id: null,
          payload: {
            schema_version: 1,
            ...(tipo === "diagnostico"
              ? {
                resultado: "positivo",
                episode_evento_id: "service-worker",
              }
              : { data_parto_real: "2026-03-01", numero_crias: 0 }),
          },
        },
      },
    ]);
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
    });
    vi.stubGlobal("fetch", vi.fn());
    await db.queue_ops.clear();
    await db.queue_gestures.clear();
    await db.event_eventos_reproducao.clear();
    await db.event_eventos.clear();
    await db.state_animais.clear();
    await db.ops_sanitario_agenda_animais_v2.clear();
    await db.ops_sanitario_agenda_v2.clear();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await db.queue_ops.clear();
    await db.queue_gestures.clear();
    await db.event_eventos_reproducao.clear();
    await db.event_eventos.clear();
    await db.state_animais.clear();
    await db.ops_sanitario_agenda_animais_v2.clear();
    await db.ops_sanitario_agenda_v2.clear();
  });

  it("pulls and reconciles diagnosis after event and detail are applied", async () => {
    const txId = await createReproductionGesture();
    const ops = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .sortBy("op_order");
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      results: ops.map((op) => ({
        op_id: op.client_op_id,
        status: "APPLIED",
      })),
    }), { status: 200 }));
    const gesture = await db.queue_gestures.get(txId);
    if (!gesture) throw new Error("gesture not found");

    await processGesture(gesture);

    expect(mocks.pullReproductionDiagnosisState).toHaveBeenCalledWith(
      "farm-1",
      { ignorePendingClientTxId: txId },
    );
    expect(await db.queue_gestures.get(txId)).toMatchObject({ status: "DONE" });
    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(0);
  });

  it("pulls the expanded reproduction history after a birth is applied", async () => {
    const txId = await createReproductionGesture("parto");
    const ops = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .sortBy("op_order");
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      results: ops.map((op) => ({
        op_id: op.client_op_id,
        status: "APPLIED",
      })),
    }), { status: 200 }));
    const gesture = await db.queue_gestures.get(txId);
    if (!gesture) throw new Error("gesture not found");

    await processGesture(gesture);

    expect(mocks.pullReproductionDiagnosisState).toHaveBeenCalledWith(
      "farm-1",
      { ignorePendingClientTxId: txId },
    );
    expect(await db.queue_gestures.get(txId)).toMatchObject({ status: "DONE" });
  });

  it("consumes applied birth ops together with a canonical neonatal agenda command", async () => {
    const agendaId = "10000000-0000-5000-8000-000000000001";
    const calfId = "20000000-0000-5000-8000-000000000001";
    const txId = await createGesture(
      "farm-1",
      [
        {
          table: "eventos",
          action: "INSERT",
          record: {
            id: "birth-mixed-worker",
            dominio: "reproducao",
            occurred_at: "2026-03-01T10:00:00.000Z",
            animal_id: "cow-1",
            lote_id: null,
            source_task_id: null,
            corrige_evento_id: null,
            observacoes: null,
            payload: {},
          },
        },
        {
          table: "animais",
          action: "INSERT",
          record: {
            id: calfId,
            identificacao: "CALF-MIXED",
            sexo: "F",
            status: "ativo",
            lote_id: null,
            data_nascimento: "2026-03-01",
            data_entrada: null,
            data_saida: null,
            pai_id: null,
            mae_id: "cow-1",
            nome: null,
            rfid: null,
            origem: "nascimento",
            raca: null,
            papel_macho: null,
            habilitado_monta: false,
            observacoes: null,
            payload: { birth_event_id: "birth-mixed-worker" },
          },
        },
      ],
      {
        sanitarioAgendaV2: [
          {
            agenda: {
              id: agendaId,
              status: "programada",
              dedup_key: "calf_journey:mixed:cura_umbigo:d0:manha",
              source_demand_key: "birth-mixed-worker:d0:manha",
              preview_group_id: "birth-mixed-worker:cura_umbigo",
              protocolo_id: null,
              protocol_item_version_id: null,
              protocol_item_snapshot: {},
              janela_inicio: "2026-03-01",
              janela_fim: "2026-03-01",
              data_programada: "2026-03-01",
              lote_id: null,
              produto_veterinario_id: null,
              produto_snapshot: {},
              produto_classe: null,
              acao_sanitaria: "cura_umbigo",
              execution_evento_id: null,
              metadata: { birth_event_id: "birth-mixed-worker" },
              deleted_at: null,
            },
            animal_id: calfId,
            animal_metadata: { birth_event_id: "birth-mixed-worker" },
          },
        ],
        enqueueSanitarioAgendaV2: true,
      },
    );
    const ops = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .sortBy("op_order");
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      results: ops.map((op) =>
        op.table === "sanitario_v2"
          ? {
              op_id: op.client_op_id,
              client_op_id: op.client_op_id,
              domain_op_id: op.domain_op_id,
              status: "APPLIED",
              canonical_entity_id: agendaId,
              canonical_result: {
                command: "create_agenda",
                agenda_id: agendaId,
              },
            }
          : { op_id: op.client_op_id, status: "APPLIED" },
      ),
    }), { status: 200 }));
    const gesture = await db.queue_gestures.get(txId);
    if (!gesture) throw new Error("gesture not found");

    await processGesture(gesture);

    expect(await db.queue_gestures.get(txId)).toMatchObject({ status: "DONE" });
    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(0);
  });

  it("rolls back local fact when the detail is blocked by its dependency", async () => {
    const txId = await createReproductionGesture();
    const ops = await db.queue_ops
      .where("client_tx_id")
      .equals(txId)
      .sortBy("op_order");
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      results: [
        {
          op_id: ops[0].client_op_id,
          status: "REJECTED",
          reason_code: "EVENT_INVALID",
        },
        {
          op_id: ops[1].client_op_id,
          status: "BLOCKED_DEPENDENCY",
          reason_code: "REPRODUCTION_EVENT_NOT_APPLIED",
        },
      ],
    }), { status: 200 }));
    const gesture = await db.queue_gestures.get(txId);
    if (!gesture) throw new Error("gesture not found");

    await processGesture(gesture);

    expect(await db.queue_gestures.get(txId)).toMatchObject({ status: "REJECTED" });
    expect(await db.event_eventos.get("diagnosis-worker")).toBeUndefined();
    expect(
      await db.event_eventos_reproducao.get("diagnosis-worker"),
    ).toBeUndefined();
    expect(mocks.pullReproductionDiagnosisState).not.toHaveBeenCalled();
  });
});
