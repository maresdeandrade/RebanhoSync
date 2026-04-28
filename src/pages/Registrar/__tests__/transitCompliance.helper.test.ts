import { describe, expect, it } from "vitest";
import { DEFAULT_TRANSIT_CHECKLIST_DRAFT } from "@/lib/sanitario/compliance/transit";
import {
  buildComplianceFlowIssues,
  buildTransitChecklistIssues,
  shouldShowTransitChecklist,
} from "@/pages/Registrar/helpers/transitCompliance";

describe("transitCompliance helpers", () => {
  it("ativa checklist para movimentacao e venda financeira", () => {
    expect(
      shouldShowTransitChecklist({
        tipoManejo: "movimentacao",
        financeiroNatureza: "compra",
      }),
    ).toBe(true);

    expect(
      shouldShowTransitChecklist({
        tipoManejo: "financeiro",
        financeiroNatureza: "venda",
      }),
    ).toBe(true);
    expect(
      shouldShowTransitChecklist({
        tipoManejo: "financeiro",
        financeiroNatureza: "doacao_saida",
      }),
    ).toBe(true);

    expect(
      shouldShowTransitChecklist({
        tipoManejo: "financeiro",
        financeiroNatureza: "compra",
      }),
    ).toBe(false);
  });

  it("retorna vazio quando checklist não é exigido", () => {
    const issues = buildTransitChecklistIssues({
      showsTransitChecklist: false,
      transitChecklist: DEFAULT_TRANSIT_CHECKLIST_DRAFT,
      asOfDate: "2026-04-16",
    });

    expect(issues).toEqual([]);
  });

  it("propaga validações do checklist quando exigido", () => {
    const issues = buildTransitChecklistIssues({
      showsTransitChecklist: true,
      transitChecklist: {
        ...DEFAULT_TRANSIT_CHECKLIST_DRAFT,
        enabled: true,
        gtaChecked: false,
      },
      asOfDate: "2026-04-16",
    });

    expect(issues[0]).toMatch(/checklist de GTA\/e-GTA/i);
  });

  it("prioriza blockers de nutricao no fluxo correspondente", () => {
    const issues = buildComplianceFlowIssues({
      tipoManejo: "nutricao",
      financeiroNatureza: "compra",
      nutritionBlockers: [{ message: "Bloqueio nutricional" }],
      movementBlockers: [{ message: "Bloqueio de movimento" }],
    });

    expect(issues).toEqual(["Bloqueio nutricional"]);
  });

  it("usa blockers de movimento para venda financeira", () => {
    const issues = buildComplianceFlowIssues({
      tipoManejo: "financeiro",
      financeiroNatureza: "doacao_saida",
      nutritionBlockers: [{ message: "Bloqueio nutricional" }],
      movementBlockers: [{ message: "Bloqueio de movimento" }],
    });

    expect(issues).toEqual(["Bloqueio de movimento"]);
  });
});
