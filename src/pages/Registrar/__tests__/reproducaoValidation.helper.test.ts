import { describe, expect, it } from "vitest";
import { resolveRegistrarReproducaoValidationIssue } from "@/pages/Registrar/helpers/reproducaoValidation";
import type { ReproductionEventData } from "@/components/events/ReproductionForm";

function makeData(
  overrides: Partial<ReproductionEventData>,
): ReproductionEventData {
  return {
    tipo: "cobertura",
    machoId: null,
    observacoes: "",
    ...overrides,
  };
}

describe("resolveRegistrarReproducaoValidationIssue", () => {
  it("bloqueia parto sem vínculo quando método é unlinked", () => {
    const issue = resolveRegistrarReproducaoValidationIssue(
      makeData({
        tipo: "parto",
        episodeLinkMethod: "unlinked",
      }),
    );

    expect(issue).toMatch(/Parto exige vínculo/i);
  });

  it("bloqueia parto manual sem episodeEventoId", () => {
    const issue = resolveRegistrarReproducaoValidationIssue(
      makeData({
        tipo: "parto",
        episodeLinkMethod: "manual",
        episodeEventoId: undefined,
      }),
    );

    expect(issue).toMatch(/Selecione o evento de serviço/i);
  });

  it("bloqueia cobertura sem macho", () => {
    const issue = resolveRegistrarReproducaoValidationIssue(
      makeData({
        tipo: "cobertura",
        machoId: null,
      }),
    );

    expect(issue).toBe("Macho e obrigatorio para Cobertura/IA.");
  });

  it("não retorna erro em cenário válido", () => {
    const issue = resolveRegistrarReproducaoValidationIssue(
      makeData({
        tipo: "IA",
        machoId: "macho-1",
      }),
    );

    expect(issue).toBeNull();
  });
});
