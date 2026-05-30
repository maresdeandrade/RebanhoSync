import { describe, expect, it } from "vitest";
import {
  createEmptyProtocolItemDraft,
  validateProtocolItemDraft,
  createEmptyProtocolDraft,
  validateProtocolDraft,
} from "@/lib/sanitario/customization/customization";

describe("Regressao - Risco F: Defaults Seguros e Validacoes de Agenda", () => {
  it("REGRESSÃO FASE 1A: createEmptyProtocolItemDraft define geraAgenda = false e intervaloDias = '' por padrao", () => {
    const draft = createEmptyProtocolItemDraft();
    expect(draft.geraAgenda).toBe(false);
    expect(draft.intervaloDias).toBe("");
  });

  it("REGRESSÃO FASE 1A: validateProtocolItemDraft BLOQUEIA salvamento com geraAgenda = true se nao houver regra de agendamento resolvel", () => {
    const draft = createEmptyProtocolItemDraft({
      produto: "Vacina A",
      geraAgenda: true,
      intervaloDias: "1",
      calendarMode: "", // Sem modo de calendario-base estruturado
      calendarAnchor: "", // Sem ancora estruturada
      dependsOnItemCode: "", // Sem dependencia
      itemCode: "", // Sem codigo da etapa
    });

    const error = validateProtocolItemDraft(draft);
    expect(error).toBe("Etapa com agenda ativada exige calendario-base, codigo da etapa ou dependencia configurados.");
  });

  it("REGRESSÃO FASE 1A: validateProtocolItemDraft PERMITE geraAgenda = true se houver dependecia sequencial resolvel", () => {
    const draft = createEmptyProtocolItemDraft({
      produto: "Vacina A",
      geraAgenda: true,
      dependsOnItemCode: "dose_1", // Dependencia setada!
      itemCode: "dose_2", // Codigo da etapa setado!
    });

    const error = validateProtocolItemDraft(draft);
    expect(error).toBeNull(); // Valido!
  });

  it("REGRESSÃO FASE 1A: validateProtocolItemDraft BLOQUEIA rotina recorrente sem intervalo valido", () => {
    const draft = createEmptyProtocolItemDraft({
      produto: "Vermifugo",
      geraAgenda: true,
      calendarMode: "rotina_recorrente",
      calendarAnchor: "ultima_conclusao_mesma_familia",
      intervaloDias: "", // Sem intervalo!
    });

    const error = validateProtocolItemDraft(draft);
    expect(error).toBe("Rotina recorrente exige intervalo em dias valido.");
  });
});
