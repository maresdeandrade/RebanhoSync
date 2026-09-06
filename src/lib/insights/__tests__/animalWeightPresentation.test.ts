import { describe, expect, it } from "vitest";
import type { Animal, Evento, EventoPesagem } from "@/lib/offline/types";
import { selectAnimalWeightPresentation } from "../animalWeightPresentation";

const animal = { id: "animal-1", fazenda_id: "farm-1", deleted_at: null } as Animal;
const event = (id: string, day: number) => ({
  id, fazenda_id: "farm-1", animal_id: "animal-1", dominio: "pesagem",
  occurred_at: `2026-01-${String(day).padStart(2, "0")}T12:00:00.000Z`, deleted_at: null,
}) as Evento;
const detail = (id: string, weight: number) => ({
  evento_id: id, fazenda_id: "farm-1", peso_kg: weight, deleted_at: null,
}) as EventoPesagem;

function select(weights: number[]) {
  return selectAnimalWeightPresentation({
    fazendaId: "farm-1", animalId: "animal-1", animal,
    events: weights.map((_, index) => event(`event-${index}`, index + 1)),
    weightDetails: weights.map((weight, index) => detail(`event-${index}`, weight)),
    referenceDate: "2026-02-01T12:00:00.000Z",
  });
}

describe("selectAnimalWeightPresentation", () => {
  it.each([[300, 310, 10], [310, 300, -10], [300, 300, 0]])(
    "preserva GMD qualificado positivo, negativo e zero", (initial, final, delta) => {
      const result = select([initial, final]);
      expect(result.latestObservedWeight).toMatchObject({ status: "available", value: { weight: final } });
      expect(result.gmd).toMatchObject({
        status: "CALCULATED", weightDeltaKg: delta, gmdKgPerDay: delta,
        reliability: "UNCLASSIFIED", operationalUse: "NOT_AUTHORIZED",
      });
    },
  );

  it("mantém ausência indisponível em vez de convertê-la em zero", () => {
    const result = select([]);
    expect(result.latestObservedWeight.status).toBe("unavailable");
    expect(result.gmd).toMatchObject({ status: "NOT_CALCULATED", reason: "INSUFFICIENT_OBSERVATIONS" });
    expect(result.observations).toEqual([]);
  });

  it("bloqueia peso e GMD quando há conflito factual", () => {
    const result = selectAnimalWeightPresentation({
      fazendaId: "farm-1", animalId: "animal-1", animal,
      events: [event("event-a", 1), event("event-b", 1)],
      weightDetails: [detail("event-a", 300), detail("event-b", 310)],
      referenceDate: "2026-02-01T12:00:00.000Z",
    });
    expect(result.latestObservedWeight.status).toBe("conflict");
    expect(result.gmd).toMatchObject({ status: "NOT_CALCULATED", reason: "CONFLICT" });
    expect(result.observations).toEqual([]);
  });
});
