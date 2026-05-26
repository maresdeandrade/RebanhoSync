import { describe, expect, it } from "vitest";
import { resolveCurrentWeight, type PesagemEvent } from "../pesoAtual";

const FARM_ID = "farm-1";
const ANIMAL_ID = "animal-1";

function makePesagem(
  overrides: Partial<PesagemEvent> & { peso_kg: number; occurred_at: string },
): PesagemEvent {
  return {
    animal_id: ANIMAL_ID,
    fazenda_id: FARM_ID,
    dominio: "pesagem",
    deleted_at: null,
    detail_deleted_at: null,
    ...overrides,
  };
}

describe("resolveCurrentWeight", () => {
  it("returns null when no events", () => {
    expect(resolveCurrentWeight([])).toBeNull();
  });

  it("returns null when all events are deleted", () => {
    const events = [
      makePesagem({
        peso_kg: 300,
        occurred_at: "2026-01-01T12:00:00Z",
        deleted_at: "2026-01-02T00:00:00Z",
      }),
    ];
    expect(resolveCurrentWeight(events)).toBeNull();
  });

  it("picks the latest event by occurred_at", () => {
    const events = [
      makePesagem({ peso_kg: 200, occurred_at: "2026-01-01T12:00:00Z" }),
      makePesagem({ peso_kg: 350, occurred_at: "2026-03-15T12:00:00Z" }),
      makePesagem({ peso_kg: 250, occurred_at: "2026-02-10T12:00:00Z" }),
    ];
    const asOf = new Date("2026-04-01T12:00:00Z");
    const result = resolveCurrentWeight(events, asOf);

    expect(result).not.toBeNull();
    expect(result!.peso_kg).toBe(350);
    expect(result!.pesado_em).toBe("2026-03-15T12:00:00Z");
  });

  it("calculates dias_desde_pesagem correctly", () => {
    const events = [
      makePesagem({ peso_kg: 400, occurred_at: "2026-03-01T12:00:00Z" }),
    ];
    const asOf = new Date("2026-03-31T12:00:00Z");
    const result = resolveCurrentWeight(events, asOf);

    expect(result!.dias_desde_pesagem).toBe(30);
    expect(result!.stale).toBe(false);
  });

  it("marks as stale when > 90 days", () => {
    const events = [
      makePesagem({ peso_kg: 400, occurred_at: "2025-12-01T12:00:00Z" }),
    ];
    const asOf = new Date("2026-04-01T12:00:00Z");
    const result = resolveCurrentWeight(events, asOf);

    expect(result!.stale).toBe(true);
    expect(result!.dias_desde_pesagem).toBeGreaterThan(90);
  });

  it("filters out events without animal_id", () => {
    const events = [
      makePesagem({
        peso_kg: 300,
        occurred_at: "2026-01-01T12:00:00Z",
        animal_id: null,
      }),
    ];
    expect(resolveCurrentWeight(events)).toBeNull();
  });

  it("filters out non-pesagem events", () => {
    const events = [
      makePesagem({
        peso_kg: 300,
        occurred_at: "2026-01-01T12:00:00Z",
        dominio: "sanitario",
      }),
    ];
    expect(resolveCurrentWeight(events)).toBeNull();
  });
});
