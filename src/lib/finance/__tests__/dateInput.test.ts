import { describe, expect, it } from "vitest";
import { validateFinanceDateInput } from "../dateInput";

describe("validateFinanceDateInput", () => {
  it.each(["", "   "])("rejeita data ausente %j", (value) => {
    expect(validateFinanceDateInput(value)).toBe("Informe a data do registro.");
  });

  it.each([
    "not-a-date",
    "17/10/2026",
    "2026-1-01",
    "2026-10-1",
    "2026-10-17T00:00:00Z",
    " 2026-10-17",
    "2026-13-01",
    "2026-00-01",
    "2026-01-00",
    "2026-02-30",
    "2025-02-29",
    "1900-02-29",
    "2026-04-31",
    "0000-01-01",
  ])("rejeita data inválida ou incompatível %s", (value) => {
    expect(validateFinanceDateInput(value)).toBe(
      "Informe uma data de registro válida.",
    );
  });

  it.each([
    "2026-10-17",
    "2024-02-29",
    "2000-02-29",
    "2018-11-04",
    "2026-12-31",
  ])("aceita data canônica %s sem mudar a semântica UTC", (value) => {
    expect(validateFinanceDateInput(value)).toBeNull();
    expect(new Date(value).toISOString()).toBe(`${value}T00:00:00.000Z`);
  });
});
