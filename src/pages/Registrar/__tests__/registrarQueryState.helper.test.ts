import { describe, expect, it } from "vitest";
import { parseRegistrarQueryState } from "@/pages/Registrar/helpers/registrarQueryState";

const isQuickActionKey = (
  value: string | null,
): value is "vacinacao" | "vermifugacao" | "pesagem" | "movimentacao" | "compra" | "venda" =>
  value === "vacinacao" ||
  value === "vermifugacao" ||
  value === "pesagem" ||
  value === "movimentacao" ||
  value === "compra" ||
  value === "venda";

const isReproTipoEnum = (
  value: string | null,
): value is "cobertura" | "IA" | "diagnostico" | "parto" | "aborto" =>
  value === "cobertura" ||
  value === "IA" ||
  value === "diagnostico" ||
  value === "parto" ||
  value === "aborto";

describe("parseRegistrarQueryState", () => {
  it("normaliza quick action, domínio e prefill sanitário", () => {
    const searchParams = new URLSearchParams(
      "dominio=sanitario&quick=vacinacao&animalId=a-1&protocoloId=p-1&sanitarioTipo=vacinacao",
    );
    const parsed = parseRegistrarQueryState({
      searchParams,
      isQuickActionKey,
      isReproTipoEnum,
    });

    expect(parsed.domain).toBe("sanitario");
    expect(parsed.quickAction).toBe("vacinacao");
    expect(parsed.animalId).toBe("a-1");
    expect(parsed.sanitaryPrefill).toEqual({
      protocoloId: "p-1",
      protocoloItemId: null,
      produto: null,
      sanitarioTipo: "vacinacao",
    });
    expect(parsed.shouldOpenChooseActionStep).toBe(true);
  });

  it("ignora domínio e quick inválidos", () => {
    const searchParams = new URLSearchParams("dominio=invalido&quick=foo");
    const parsed = parseRegistrarQueryState({
      searchParams,
      isQuickActionKey,
      isReproTipoEnum,
    });

    expect(parsed.domain).toBeNull();
    expect(parsed.quickAction).toBeNull();
    expect(parsed.shouldOpenChooseActionStep).toBe(false);
  });
});
