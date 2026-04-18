import { describe, expect, it } from "vitest";
import { EventValidationError } from "@/lib/events/validators";
import {
  buildRegistrarReproducaoIneligibleIssue,
  resolveRegistrarFinalizeCatchIssue,
  resolveRegistrarFinalizeOpsIssue,
  resolveRegistrarFinancialNatureIssue,
} from "@/pages/Registrar/helpers/finalizeGuards";

describe("resolveRegistrarFinancialNatureIssue", () => {
  it("retorna erro para natureza de sociedade no fluxo financeiro direto", () => {
    const issue = resolveRegistrarFinancialNatureIssue({
      tipoManejo: "financeiro",
      isFinanceiroSociedade: false,
      natureza: "sociedade_saida",
    });

    expect(issue).toBe("Natureza financeira invalida para este fluxo.");
  });

  it("retorna null para compra no fluxo financeiro", () => {
    const issue = resolveRegistrarFinancialNatureIssue({
      tipoManejo: "financeiro",
      isFinanceiroSociedade: false,
      natureza: "compra",
    });

    expect(issue).toBeNull();
  });
});

describe("buildRegistrarReproducaoIneligibleIssue", () => {
  it("monta mensagem com categoria atual do animal", () => {
    const issue = buildRegistrarReproducaoIneligibleIssue({
      animalIdentificacao: "BR-001",
      categoriaLabel: "bezerro",
    });

    expect(issue).toBe(
      "Reproducao disponivel apenas para novilhas e vacas. BR-001 esta como bezerro.",
    );
  });
});

describe("resolveRegistrarFinalizeOpsIssue", () => {
  it("retorna erro quando nao ha operacoes", () => {
    expect(resolveRegistrarFinalizeOpsIssue(0)).toBe(
      "Nenhuma operacao valida para envio.",
    );
  });
});

describe("resolveRegistrarFinalizeCatchIssue", () => {
  it("prioriza mensagem de EventValidationError", () => {
    const issue = resolveRegistrarFinalizeCatchIssue(
      new EventValidationError([{ path: "x", message: "erro de dominio" }]),
    );

    expect(issue).toBe("erro de dominio");
  });

  it("retorna fallback generico para erro desconhecido", () => {
    const issue = resolveRegistrarFinalizeCatchIssue(new Error("boom"));
    expect(issue).toBe("Erro ao registrar manejo.");
  });
});
