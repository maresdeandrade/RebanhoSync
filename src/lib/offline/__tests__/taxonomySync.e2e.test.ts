/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-1",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      })),
      refreshSession: vi.fn(async () => ({
        data: {
          session: {
            access_token: "token-2",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      })),
    },
  },
}));

vi.mock("../pull", () => ({
  pullDataForFarm: vi.fn(async () => undefined),
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  trackPilotMetric: vi.fn(async () => undefined),
}));

import { buildAnimalTaxonomyFactsPayload, deriveAnimalTaxonomy } from "@/lib/animals/taxonomy";
import { createGesture } from "../ops";
import { db } from "../db";
import { processGesture } from "../syncWorker";

function dateDaysAgo(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function dateDaysAhead(days: number) {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

async function seedAnimal(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date().toISOString();
  const id = String(overrides.id ?? crypto.randomUUID());
  await db.state_animais.put({
    id,
    fazenda_id: "farm-1",
    identificacao: String(overrides.identificacao ?? "A-001"),
    sexo: (overrides.sexo as "F" | "M" | undefined) ?? "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: String(overrides.data_nascimento ?? dateDaysAgo(500)),
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
    payload: (overrides.payload as Record<string, unknown> | undefined) ?? {},
    client_id: "client-1",
    client_op_id: `op-${id}`,
    client_tx_id: `tx-${id}`,
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  });

  return id;
}

async function getGesture(txId: string) {
  const gesture = await db.queue_gestures.get(txId);
  if (!gesture) {
    throw new Error(`Gesture ${txId} not found`);
  }
  return gesture;
}

describe("taxonomy sync flow", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    vi.stubGlobal("fetch", vi.fn());
    await Promise.all([
      db.state_animais.clear(),
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
    ]);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await Promise.all([
      db.state_animais.clear(),
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
    ]);
  });

  it("keeps a novilha prenhe consistent after offline write and APPLIED sync", async () => {
    const animalId = await seedAnimal({
      id: "novilha-1",
      payload: {
        weaning: {
          completed_at: dateDaysAgo(250),
        },
      },
    });

    const payload = buildAnimalTaxonomyFactsPayload(
      {
        weaning: {
          completed_at: dateDaysAgo(250),
        },
      },
      {
        puberdade_confirmada: true,
        prenhez_confirmada: true,
        data_prevista_parto: dateDaysAhead(90),
      },
      "reproduction_event",
    );

    const txId = await createGesture("farm-1", [
      {
        table: "animais",
        action: "UPDATE",
        record: {
          id: animalId,
          payload,
          updated_at: new Date().toISOString(),
        },
      },
    ]);

    const op = await db.queue_ops.where("client_tx_id").equals(txId).first();

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [{ op_id: op?.client_op_id, status: "APPLIED" }],
        }),
        { status: 200 },
      ),
    );

    const gesture = await getGesture(txId);
    await processGesture(gesture);

    const animal = await db.state_animais.get(animalId);
    const taxonomy = deriveAnimalTaxonomy(animal!);
    expect(taxonomy.categoria_zootecnica).toBe("novilha");
    expect(taxonomy.estado_produtivo_reprodutivo).toBe("prenhe");
  });

  it("projects parto as vaca recem_parida after APPLIED sync", async () => {
    const animalId = await seedAnimal({
      id: "vaca-1",
      data_nascimento: dateDaysAgo(1400),
      payload: {
        weaning: {
          completed_at: dateDaysAgo(1200),
        },
      },
    });

    const payload = buildAnimalTaxonomyFactsPayload(
      {
        weaning: {
          completed_at: dateDaysAgo(1200),
        },
      },
      {
        data_ultimo_parto: dateDaysAgo(5),
        em_lactacao: true,
        prenhez_confirmada: false,
      },
      "reproduction_event",
    );

    const txId = await createGesture("farm-1", [
      {
        table: "animais",
        action: "UPDATE",
        record: {
          id: animalId,
          payload,
          updated_at: new Date().toISOString(),
        },
      },
    ]);

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [{ op_id: "op-any", status: "APPLIED" }],
        }),
        { status: 200 },
      ),
    );

    await processGesture(await getGesture(txId));

    const animal = await db.state_animais.get(animalId);
    const taxonomy = deriveAnimalTaxonomy(animal!);
    expect(taxonomy.categoria_zootecnica).toBe("vaca");
    expect(taxonomy.estado_produtivo_reprodutivo).toBe("recem_parida");
  });

  it("projects secagem as vaca seca after APPLIED sync", async () => {
    const basePayload = buildAnimalTaxonomyFactsPayload(
      {
        weaning: {
          completed_at: dateDaysAgo(1200),
        },
      },
      {
        data_ultimo_parto: dateDaysAgo(180),
      },
      "reproduction_event",
    );
    const animalId = await seedAnimal({
      id: "seca-1",
      data_nascimento: dateDaysAgo(1600),
      payload: basePayload,
    });

    const payload = buildAnimalTaxonomyFactsPayload(
      basePayload,
      {
        secagem_realizada: true,
        prenhez_confirmada: true,
        data_prevista_parto: dateDaysAhead(20),
      },
      "reproduction_event",
    );

    const txId = await createGesture("farm-1", [
      {
        table: "animais",
        action: "UPDATE",
        record: {
          id: animalId,
          payload,
          updated_at: new Date().toISOString(),
        },
      },
    ]);

    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [{ op_id: "op-any", status: "APPLIED" }],
        }),
        { status: 200 },
      ),
    );

    await processGesture(await getGesture(txId));

    const animal = await db.state_animais.get(animalId);
    const taxonomy = deriveAnimalTaxonomy(animal!);
    expect(taxonomy.categoria_zootecnica).toBe("vaca");
    expect(taxonomy.estado_produtivo_reprodutivo).toBe("seca");
  });

  it("rolls back local taxonomy state when sync returns REJECTED", async () => {
    const animalId = await seedAnimal({
      id: "rollback-1",
      data_nascimento: dateDaysAgo(1400),
      payload: {
        weaning: {
          completed_at: dateDaysAgo(1200),
        },
      },
    });

    const payload = buildAnimalTaxonomyFactsPayload(
      {
        weaning: {
          completed_at: dateDaysAgo(1200),
        },
      },
      {
        em_lactacao: true,
      },
      "manual",
    );

    const txId = await createGesture("farm-1", [
      {
        table: "animais",
        action: "UPDATE",
        record: {
          id: animalId,
          payload,
          updated_at: new Date().toISOString(),
        },
      },
    ]);

    const updatedLocally = await db.state_animais.get(animalId);
    expect(
      deriveAnimalTaxonomy(updatedLocally!).facts.em_lactacao,
    ).toBe(true);

    const op = await db.queue_ops.where("client_tx_id").equals(txId).first();
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              op_id: op?.client_op_id,
              status: "REJECTED",
              reason_code: "INVALID_TAXONOMY_FACTS_PAYLOAD",
              reason_message: "payload invalido",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await processGesture(await getGesture(txId));

    const rolledBack = await db.state_animais.get(animalId);
    expect(deriveAnimalTaxonomy(rolledBack!).facts.em_lactacao).toBe(false);
    const rejectionCount = await db.queue_rejections.count();
    expect(rejectionCount).toBe(1);
  });
});
