import { describe, expect, it } from "vitest";
import {
  computeActiveWithdrawals,
  type SanitaryEventForWithdrawal,
  type OfficialItemLookup,
} from "../compliance/activeWithdrawal";

const FARM_ID = "farm-1";
const ANIMAL_ID = "animal-1";

function makeEvent(
  overrides: Partial<SanitaryEventForWithdrawal> & {
    occurred_at: string;
    produto: string;
  },
): SanitaryEventForWithdrawal {
  return {
    animal_id: ANIMAL_ID,
    fazenda_id: FARM_ID,
    deleted_at: null,
    detail_deleted_at: null,
    ...overrides,
  };
}

describe("computeActiveWithdrawals", () => {
  it("returns empty when no events", () => {
    expect(computeActiveWithdrawals([], {})).toEqual([]);
  });

  it("returns empty when events have no withdrawal data", () => {
    const events = [
      makeEvent({
        occurred_at: "2026-05-01T12:00:00Z",
        produto: "Ivermectina",
      }),
    ];
    expect(computeActiveWithdrawals(events, {})).toEqual([]);
  });

  it("computes active withdrawal from structured event columns", () => {
    const events = [
      makeEvent({
        occurred_at: "2026-05-20T12:00:00Z",
        produto: "Oxitetraciclina L.A.",
        carencia_carne_dias: 28,
        carencia_leite_dias: 7,
        carencia_carne_ate: "2026-06-17",
        carencia_leite_ate: "2026-05-27",
      }),
    ];
    const asOf = new Date("2026-05-25T12:00:00Z");
    const result = computeActiveWithdrawals(events, {}, asOf);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      animal_id: ANIMAL_ID,
      produto: "Oxitetraciclina L.A.",
      tipo_carencia: "carne",
      inicio_carencia: "2026-05-20",
      fim_carencia: "2026-06-17",
      ativa: true,
    });
    expect(result[1]).toMatchObject({
      tipo_carencia: "leite",
      fim_carencia: "2026-05-27",
      ativa: true,
    });
  });

  it("filters out expired withdrawals", () => {
    const events = [
      makeEvent({
        occurred_at: "2026-01-01T12:00:00Z",
        produto: "Oxitetraciclina L.A.",
        carencia_carne_dias: 28,
        carencia_leite_dias: 7,
        carencia_carne_ate: "2026-01-29",
        carencia_leite_ate: "2026-01-08",
      }),
    ];
    const asOf = new Date("2026-05-01T12:00:00Z");
    const result = computeActiveWithdrawals(events, {}, asOf);

    expect(result).toEqual([]);
  });

  it("does not infer withdrawal from official catalog or event payload", () => {
    const events = [
      makeEvent({
        occurred_at: "2026-05-20T12:00:00Z",
        produto: "Oxitetraciclina L.A.",
        payload: {
          carencia_regra_json: { carne_dias: 10 },
        },
      }),
    ];
    const officialItems: OfficialItemLookup = {
      "Oxitetraciclina L.A.": {
        carencia_regra_json: { carne_dias: 28, leite_dias: 7 },
      },
    };
    const asOf = new Date("2026-05-25T12:00:00Z");
    const result = computeActiveWithdrawals(events, officialItems, asOf);

    expect(result).toEqual([]);
  });

  it("filters out deleted events", () => {
    const events = [
      makeEvent({
        occurred_at: "2026-05-20T12:00:00Z",
        produto: "Oxitetraciclina L.A.",
        deleted_at: "2026-05-21T00:00:00Z",
        payload: {
          carencia_regra_json: { carne_dias: 28 },
        },
      }),
    ];
    expect(computeActiveWithdrawals(events, {})).toEqual([]);
  });

  it("filters out events without animal_id", () => {
    const events = [
      makeEvent({
        occurred_at: "2026-05-20T12:00:00Z",
        produto: "Oxitetraciclina L.A.",
        animal_id: null,
        payload: {
          carencia_regra_json: { carne_dias: 28 },
        },
      }),
    ];
    expect(computeActiveWithdrawals(events, {})).toEqual([]);
  });
});
