import { describe, it, expect } from "vitest";
import { validateSanitarioInput } from "../validators/sanitario";
import type { SanitarioEventInput } from "../types";

describe("validateSanitarioInput", () => {
  const validBase: SanitarioEventInput = {
    dominio: "sanitario",
    fazendaId: "farm-1",
    tipo: "vacinacao",
    produto: "Vaccine X",
  };

  it("should return no issues for valid input", () => {
    const issues = validateSanitarioInput(validBase);
    expect(issues).toHaveLength(0);
  });

  it("should return REQUIRED issue when tipo is missing", () => {
    // @ts-expect-error - Testing invalid input
    const input: SanitarioEventInput = {
      ...validBase,
      tipo: undefined,
    };
    const issues = validateSanitarioInput(input);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: "REQUIRED",
      field: "tipo",
    });
  });

  it("should return REQUIRED issue when produto is missing", () => {
    // @ts-expect-error - Testing invalid input
    const input: SanitarioEventInput = {
      ...validBase,
      produto: "",
    };
    const issues = validateSanitarioInput(input);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: "REQUIRED",
      field: "produto",
    });
  });

  it("should return REQUIRED issue when produto is whitespace", () => {
    const input: SanitarioEventInput = {
      ...validBase,
      produto: "   ",
    };
    const issues = validateSanitarioInput(input);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: "REQUIRED",
      field: "produto",
    });
  });

  describe("protocoloItem validation", () => {
    it("should return REQUIRED issue when protocoloItem.id is missing", () => {
      const input: SanitarioEventInput = {
        ...validBase,
        // @ts-expect-error - Testing invalid input
        protocoloItem: {
          intervalDays: 10,
        },
      };
      const issues = validateSanitarioInput(input);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        code: "REQUIRED",
        field: "protocoloItem.id",
      });
    });

    it("should return INVALID_RANGE issue when protocoloItem.intervalDays is zero", () => {
      const input: SanitarioEventInput = {
        ...validBase,
        protocoloItem: {
          id: "proto-1",
          intervalDays: 0,
          geraAgenda: true,
        },
      };
      const issues = validateSanitarioInput(input);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        code: "INVALID_RANGE",
        field: "protocoloItem.intervalDays",
      });
    });

    it("should return INVALID_RANGE issue when protocoloItem.intervalDays is negative", () => {
      const input: SanitarioEventInput = {
        ...validBase,
        protocoloItem: {
          id: "proto-1",
          intervalDays: -5,
          geraAgenda: true,
        },
      };
      const issues = validateSanitarioInput(input);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        code: "INVALID_RANGE",
        field: "protocoloItem.intervalDays",
      });
    });

    it("should return multiple issues if both id is missing and interval is invalid", () => {
      const input: SanitarioEventInput = {
        ...validBase,
        // @ts-expect-error - Testing invalid input
        protocoloItem: {
          intervalDays: -1,
        },
      };
      const issues = validateSanitarioInput(input);
      expect(issues).toHaveLength(2);
      expect(issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "REQUIRED",
            field: "protocoloItem.id",
          }),
          expect.objectContaining({
            code: "INVALID_RANGE",
            field: "protocoloItem.intervalDays",
          }),
        ]),
      );
    });

    it("should accept valid protocoloItem", () => {
      const input: SanitarioEventInput = {
        ...validBase,
        protocoloItem: {
          id: "proto-1",
          intervalDays: 30,
          geraAgenda: true,
        },
      };
      const issues = validateSanitarioInput(input);
      expect(issues).toHaveLength(0);
    });
  });
});
