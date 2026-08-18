/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { buildCommercialOperationGesture } from "../commercialOperationCommand";

const farm = "10000000-0000-4000-8000-000000000001";
const animalId = "20000000-0000-4000-8000-000000000001";
const operationId = "30000000-0000-4000-8000-000000000001";

async function clearCommercialStores() {
  await db.transaction(
    "rw",
    [
      db.queue_gestures,
      db.queue_ops,
      db.state_animais,
      db.event_eventos,
      db.event_eventos_comercial,
    ],
    async () => {
      await db.queue_gestures.clear();
      await db.queue_ops.clear();
      await db.state_animais.clear();
      await db.event_eventos.clear();
      await db.event_eventos_comercial.clear();
    },
  );
}

describe("commercial operation local atomicity", () => {
  beforeEach(clearCommercialStores);
  afterEach(async () => {
    vi.restoreAllMocks();
    await clearCommercialStores();
  });

  it("rolls back animals, event, detail and queue when any local write fails", async () => {
    const gesture = buildCommercialOperationGesture({
      fazendaId: farm,
      operationType: "compra",
      scope: "animal",
      occurredAt: "2026-08-13T12:00:00.000Z",
      declaredQuantity: 1,
      loteId: null,
      selectedAnimalIds: [],
      animals: [],
      newAnimals: [
        {
          localId: "row-1",
          id: animalId,
          identificacao: "ATOMIC-001",
          sexo: "F",
          especie: "bovino",
          dataNascimento: "2025-01-01",
          dataEntrada: "2026-08-13",
        },
      ],
      lifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
      operationId,
      valorBruto: 1000,
    });
    const originalTable = db.table.bind(db);
    let detailLookups = 0;
    vi.spyOn(db, "table").mockImplementation((name: string) => {
      const table = originalTable(name);
      if (name !== "event_eventos_comercial" || detailLookups++ === 0) {
        return table;
      }
      return new Proxy(table, {
        get(target, property, receiver) {
          if (property === "put") {
            return async () => {
              throw new Error("forced detail failure");
            };
          }
          return Reflect.get(target, property, receiver);
        },
      });
    });

    await expect(createGesture(farm, gesture.ops)).rejects.toThrow(
      "forced detail failure",
    );
    expect(await db.state_animais.get(animalId)).toBeUndefined();
    expect(await db.event_eventos.get(operationId)).toBeUndefined();
    expect(await db.event_eventos_comercial.get(operationId)).toBeUndefined();
    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.queue_gestures.count()).toBe(0);
  });
});
