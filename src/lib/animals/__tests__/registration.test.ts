import { describe, expect, it } from "vitest";
import { validateAnimalRegistrationDraft } from "../registration";

describe("animal registration date validation", () => {
  const draft = { identificacao: "BR-001", sexo: "F" as const };

  describe.each(["dataNascimento", "dataEntrada"] as const)("%s", (field) => {
    it.each(["00:00:00.000", "08:59:59.999", "12:00:00.000", "23:59:59.999"])(
      "aceita a data de hoje às %s UTC",
      (time) => {
        expect(
          validateAnimalRegistrationDraft(
            { ...draft, [field]: "2026-10-16" },
            new Date(`2026-10-16T${time}Z`),
          ),
        ).toBeNull();
      },
    );

    it("continua rejeitando amanhã no fim do dia atual", () => {
      expect(
        validateAnimalRegistrationDraft(
          { ...draft, [field]: "2026-10-17" },
          new Date("2026-10-16T23:59:59.999Z"),
        ),
      ).toContain("não pode ser inválida ou futura");
    });

    it("continua rejeitando uma data ilegível", () => {
      expect(
        validateAnimalRegistrationDraft(
          { ...draft, [field]: "invalida" },
          new Date("2026-10-16T08:00:00.000Z"),
        ),
      ).toContain("não pode ser inválida ou futura");
    });
  });

  it("preserva datas anteriores e datas opcionais ausentes", () => {
    const reference = new Date("2026-10-16T00:00:00.000Z");
    expect(validateAnimalRegistrationDraft(draft, reference)).toBeNull();
    expect(
      validateAnimalRegistrationDraft(
        { ...draft, dataNascimento: "2025-01-01", dataEntrada: "2026-10-15" },
        reference,
      ),
    ).toBeNull();
  });
});
