import { describe, expect, it } from "vitest";
import { resolveWithdrawalRule } from "../compliance/withdrawalPeriod";

describe("resolveWithdrawalRule", () => {
  it("returns null when no sources have withdrawal data", () => {
    expect(resolveWithdrawalRule({})).toBeNull();
    expect(
      resolveWithdrawalRule({
        officialItem: null,
        protocolItem: null,
        eventPayload: null,
      }),
    ).toBeNull();
  });

  it("returns null when all carencia values are zero or null", () => {
    expect(
      resolveWithdrawalRule({
        officialItem: {
          carencia_regra_json: { carne_dias: 0, leite_dias: null },
        },
      }),
    ).toBeNull();
  });

  it("prefers official catalog item over protocol and event", () => {
    const result = resolveWithdrawalRule({
      officialItem: {
        carencia_regra_json: { carne_dias: 28, leite_dias: 7 },
      },
      protocolItem: {
        payload: {
          carencia_regra_json: { carne_dias: 14, leite_dias: 3 },
        },
      },
      eventPayload: {
        carencia_regra_json: { carne_dias: 10, leite_dias: 2 },
      },
    });

    expect(result).toEqual({
      carne_dias: 28,
      leite_dias: 7,
      ovos_dias: null,
      mel_dias: null,
      source: "catalogo_oficial",
    });
  });

  it("falls back to protocol item when official is empty", () => {
    const result = resolveWithdrawalRule({
      officialItem: { carencia_regra_json: {} },
      protocolItem: {
        payload: {
          carencia_regra_json: { carne_dias: 14, leite_dias: 3 },
        },
      },
    });

    expect(result).toEqual({
      carne_dias: 14,
      leite_dias: 3,
      ovos_dias: null,
      mel_dias: null,
      source: "protocolo_fazenda",
    });
  });

  it("falls back to event payload when protocol is empty", () => {
    const result = resolveWithdrawalRule({
      officialItem: null,
      protocolItem: { payload: null },
      eventPayload: {
        carencia_regra_json: { carne_dias: 10 },
      },
    });

    expect(result).toEqual({
      carne_dias: 10,
      leite_dias: null,
      ovos_dias: null,
      mel_dias: null,
      source: "evento_payload",
    });
  });

  it("normalizes all withdrawal types", () => {
    const result = resolveWithdrawalRule({
      officialItem: {
        carencia_regra_json: {
          carne_dias: 28,
          leite_dias: 7,
          ovos_dias: 5,
          mel_dias: 14,
        },
      },
    });

    expect(result).toEqual({
      carne_dias: 28,
      leite_dias: 7,
      ovos_dias: 5,
      mel_dias: 14,
      source: "catalogo_oficial",
    });
  });
});
