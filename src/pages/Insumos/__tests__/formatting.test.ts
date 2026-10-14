import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  formatDate,
  formatEventDate,
  formatNumber,
} from "../helpers/formatting";

describe("Insumos presentation formatters", () => {
  beforeAll(() => {
    vi.stubEnv("TZ", "America/Sao_Paulo");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  describe("formatNumber", () => {
    it.each([
      [0, "0"],
      [-0, "-0"],
      [12, "12"],
      [1234.5, "1.234,5"],
      [1234.5678, "1.234,568"],
      [-1.2346, "-1,235"],
      [Number.NaN, "NaN"],
      [Number.POSITIVE_INFINITY, "∞"],
      [Number.NEGATIVE_INFINITY, "-∞"],
    ])("formats %s as %s", (value, expected) => {
      expect(formatNumber(value)).toBe(expected);
    });
  });

  describe("formatDate", () => {
    it.each([null, ""])("preserves the fallback for %s", (value) => {
      expect(formatDate(value)).toBe("Sem validade");
    });

    it("keeps a date-only value on its local calendar day", () => {
      expect(formatDate("2026-03-29")).toBe("29/03/2026");
    });

    it("preserves invalid date output without adding a fallback", () => {
      expect(formatDate("invalid")).toBe("Invalid Date");
    });
  });

  describe("formatEventDate", () => {
    it("uses the local calendar day when a timestamp crosses UTC midnight", () => {
      expect(formatEventDate("2026-03-29T01:30:00.000Z")).toBe("28/03/2026");
    });

    it("formats a timestamp within the same local and UTC day", () => {
      expect(formatEventDate("2026-03-29T12:00:00.000Z")).toBe("29/03/2026");
    });

    it.each(["invalid", ""])(
      "preserves invalid date output for %s",
      (value) => {
        expect(formatEventDate(value)).toBe("Invalid Date");
      },
    );
  });
});
