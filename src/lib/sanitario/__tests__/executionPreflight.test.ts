import { describe, expect, it } from "vitest";
import { validateSanitaryExecutionPreflight } from "@/lib/sanitario/models/executionPreflight";

describe("validateSanitaryExecutionPreflight", () => {
  it("retorna skip para manejo nao sanitario por padrao", () => {
    const result = validateSanitaryExecutionPreflight({
      tipoManejo: "pesagem",
      sanitaryProductName: "",
      requireProduct: true,
    });

    expect(result).toEqual({ ok: true, status: "skip" });
  });

  it("permite execucao sanitaria valida", () => {
    const result = validateSanitaryExecutionPreflight({
      tipoManejo: "sanitario",
      sourceTaskId: "agenda-1",
      sanitaryType: "vacinacao",
      sanitaryProductName: "Vacina X",
      requireAgendaTask: true,
      requireSanitaryType: true,
      requireProduct: true,
      sanitaryProductMetadata: {
        protocolo_item_id: "item-1",
        regime_sanitario: { family_code: "raiva_herbivoros" },
      },
    });

    expect(result).toEqual({ ok: true, status: "ready" });
  });

  it("bloqueia sanitario sem tipo somente quando o fluxo exige tipo explicitamente", () => {
    const neutral = validateSanitaryExecutionPreflight({
      tipoManejo: "sanitario",
      sanitaryProductName: "Produto A",
    });
    const required = validateSanitaryExecutionPreflight({
      tipoManejo: "sanitario",
      sanitaryProductName: "Produto A",
      requireSanitaryType: true,
    });

    expect(neutral).toEqual({ ok: true, status: "ready" });
    expect(required).toMatchObject({
      ok: false,
      reason: "missing_type",
      message: "Tipo sanitario invalido.",
    });
  });

  it("bloqueia sanitario sem produto somente quando produto ja era obrigatorio", () => {
    const optional = validateSanitaryExecutionPreflight({
      tipoManejo: "sanitario",
      sanitaryProductName: "",
    });
    const required = validateSanitaryExecutionPreflight({
      tipoManejo: "sanitario",
      sanitaryProductName: "",
      requireProduct: true,
    });

    expect(optional).toEqual({ ok: true, status: "ready" });
    expect(required).toMatchObject({
      ok: false,
      reason: "missing_product",
      message: "Informe o produto sanitario antes de confirmar.",
    });
  });

  it("aceita agenda sanitaria com sourceTaskId quando agenda eh exigida", () => {
    const result = validateSanitaryExecutionPreflight({
      tipoManejo: "sanitario",
      sourceTaskId: "agenda-1",
      requireAgendaTask: true,
    });

    expect(result).toEqual({ ok: true, status: "ready" });
  });

  it("aceita metadata de protocolo e regime sem validar semantica nova", () => {
    const result = validateSanitaryExecutionPreflight({
      tipoManejo: "sanitario",
      sanitaryProductName: "Produto A",
      sanitaryProductMetadata: {
        protocolo_item_id: "item-1",
        protocolo_id: "protocolo-1",
        family_code: "brucelose",
        regimen_version: 1,
      },
    });

    expect(result).toEqual({ ok: true, status: "ready" });
  });

  it("preserva checklist/documental como bloqueio de preflight, sem virar execucao sanitaria", () => {
    const result = validateSanitaryExecutionPreflight({
      tipoManejo: "financeiro",
      transitChecklistIssues: ["Checklist faltando GTA."],
      issueScope: "all_flows",
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "transit_checklist",
      message: "Checklist faltando GTA.",
    });
  });

  it("entrada incompleta retorna fallback seguro sem exception", () => {
    const result = validateSanitaryExecutionPreflight({
      tipoManejo: undefined,
      sourceTaskId: null,
      sanitaryType: null,
      sanitaryProductName: null,
      sanitaryProductMetadata: null,
    });

    expect(result).toEqual({ ok: true, status: "skip" });
  });

  it("propaga primeira issue de protocolo selecionado incompativel", () => {
    const result = validateSanitaryExecutionPreflight({
      tipoManejo: "sanitario",
      protocolEligibilityIssues: [
        "O item de protocolo escolhido nao atende todos os animais selecionados.",
      ],
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "protocol_ineligible",
      message:
        "O item de protocolo escolhido nao atende todos os animais selecionados.",
    });
  });
});
