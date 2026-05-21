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
      "dominio=sanitario&quick=vacinacao&animalId=a-1&loteId=l-1&pastoId=pasto-1&protocoloId=p-1&sanitarioTipo=vacinacao",
    );
    const parsed = parseRegistrarQueryState({
      searchParams,
      isQuickActionKey,
      isReproTipoEnum,
    });

    expect(parsed.domain).toBe("sanitario");
    expect(parsed.quickAction).toBe("vacinacao");
    expect(parsed.animalId).toBe("a-1");
    expect(parsed.loteId).toBe("l-1");
    expect(parsed.pastoId).toBe("pasto-1");
    expect(parsed.sanitaryPrefill).toEqual({
      protocoloId: "p-1",
      protocoloItemId: null,
      produto: null,
      sanitarioTipo: "vacinacao",
      sanitarioCasoId: null,
      abrirCasoClinico: false,
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
    expect(parsed.sourceTaskId).toBeNull();
    expect(parsed.animalId).toBeNull();
    expect(parsed.loteId).toBeNull();
    expect(parsed.pastoId).toBeNull();
    expect(parsed.shouldOpenChooseActionStep).toBe(false);
  });

  it("abre etapa de acao quando a agenda informa sourceTaskId sem animal", () => {
    const searchParams = new URLSearchParams(
      "sourceTaskId=agenda-1&dominio=sanitario&loteId=lote-1",
    );

    const parsed = parseRegistrarQueryState({
      searchParams,
      isQuickActionKey,
      isReproTipoEnum,
    });

    expect(parsed.sourceTaskId).toBe("agenda-1");
    expect(parsed.domain).toBe("sanitario");
    expect(parsed.animalId).toBeNull();
    expect(parsed.loteId).toBe("lote-1");
    expect(parsed.shouldOpenChooseActionStep).toBe(true);
  });

  it("normaliza parametros de caso clinico sanitario", () => {
    const searchParams = new URLSearchParams(
      "dominio=sanitario&animalId=a-1&sanitarioCasoId=caso-1&abrirCasoClinico=1",
    );
    const parsed = parseRegistrarQueryState({
      searchParams,
      isQuickActionKey,
      isReproTipoEnum,
    });

    expect(parsed.sanitaryPrefill.sanitarioCasoId).toBe("caso-1");
    expect(parsed.sanitaryPrefill.abrirCasoClinico).toBe(true);
  });
});
