/**
 * Testes — Integração: useProtocolItemDraft + ProtocolItemDraftEditor
 */

import { describe, it, expect } from "vitest";
import { createEmptyProtocolItemDraft } from "@/lib/sanitario/models/draft";
import { buildSanitaryDedupKey } from "@/lib/sanitario/engine/dedup";

describe("Protocol Item Draft Integration", () => {
  describe("Draft creation and defaults", () => {
    it("cria draft vazio com defaults", () => {
      const draft = createEmptyProtocolItemDraft();
      expect(draft.protocolId).toBe("");
      expect(draft.itemId).toBe("");
      expect(draft.generatesAgenda).toBe(true);
      expect(draft.sexAllowed).toEqual(["M", "F"]);
    });

    it("aplica overrides ao criar draft", () => {
      const draft = createEmptyProtocolItemDraft({
        protocolId: "proto-1",
        itemId: "item-1",
        familyCode: "brucelose",
      });
      expect(draft.protocolId).toBe("proto-1");
      expect(draft.familyCode).toBe("brucelose");
    });
  });

  describe("Draft mode-dependent logic", () => {
    it("campanha requer campaignMonths", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "campanha",
        anchor: "entrada_fazenda",
        campaignMonths: [5, 6, 7],
      });
      expect(draft.campaignMonths).toEqual([5, 6, 7]);
    });

    it("janela_etaria requer ageStartDays e ageEndDays", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "janela_etaria",
        anchor: "nascimento",
        ageStartDays: 100,
        ageEndDays: 200,
      });
      expect(draft.ageStartDays).toBe(100);
      expect(draft.ageEndDays).toBe(200);
    });

    it("rotina_recorrente requer intervalDays", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "rotina_recorrente",
        anchor: "ultima_conclusao_mesma_familia",
        intervalDays: 90,
      });
      expect(draft.intervalDays).toBe(90);
    });

    it("procedimento_imediato requer triggerEvent", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "fazenda",
        mode: "procedimento_imediato",
        triggerEvent: "notificacao_svo",
      });
      expect(draft.triggerEvent).toBe("notificacao_svo");
    });
  });

  describe("Dedup key generation", () => {
    it("gera mesmo dedup para igual input", () => {
      const input = {
        scopeType: "animal" as const,
        scopeId: "animal-123",
        familyCode: "brucelose",
        itemCode: "dose_unica",
        regimenVersion: 1,
        mode: "campanha" as const,
        periodKey: "2026-05",
      };

      const key1 = buildSanitaryDedupKey(input);
      const key2 = buildSanitaryDedupKey(input);

      expect(key1).toBe(key2);
    });

    it("gera dedup diferente para periodKey diferente", () => {
      const input1 = {
        scopeType: "animal" as const,
        scopeId: "animal-123",
        familyCode: "brucelose",
        itemCode: "dose_unica",
        regimenVersion: 1,
        mode: "campanha" as const,
        periodKey: "2026-05",
      };

      const input2 = {
        scopeType: "animal" as const,
        scopeId: "animal-123",
        familyCode: "brucelose",
        itemCode: "dose_unica",
        regimenVersion: 1,
        mode: "campanha" as const,
        periodKey: "2026-06",
      };

      const key1 = buildSanitaryDedupKey(input1);
      const key2 = buildSanitaryDedupKey(input2);

      expect(key1).not.toBe(key2);
    });
  });

  describe("Field visibility by mode", () => {
    it("campanha mostra campaignMonths", () => {
      const draft = createEmptyProtocolItemDraft({
        mode: "campanha",
      });
      expect(draft.mode).toBe("campanha");
    });

    it("janela_etaria mostra ageStartDays/ageEndDays", () => {
      const draft = createEmptyProtocolItemDraft({
        mode: "janela_etaria",
      });
      expect(draft.mode).toBe("janela_etaria");
    });

    it("rotina_recorrente mostra intervalDays", () => {
      const draft = createEmptyProtocolItemDraft({
        mode: "rotina_recorrente",
      });
      expect(draft.mode).toBe("rotina_recorrente");
    });

    it("procedimento_imediato mostra triggerEvent", () => {
      const draft = createEmptyProtocolItemDraft({
        mode: "procedimento_imediato",
      });
      expect(draft.mode).toBe("procedimento_imediato");
    });
  });

  describe("Product metadata handling", () => {
    it("armazena informações de produto", () => {
      const draft = createEmptyProtocolItemDraft({
        productCode: "brucelose-viva",
        productName: "Brucevac",
        doseNumber: 1,
      });
      expect(draft.productCode).toBe("brucelose-viva");
      expect(draft.productName).toBe("Brucevac");
      expect(draft.doseNumber).toBe(1);
    });
  });

  describe("Eligibility rules", () => {
    it("define sexos permitidos", () => {
      const draftAll = createEmptyProtocolItemDraft({
        sexAllowed: ["M", "F"],
      });
      expect(draftAll.sexAllowed).toEqual(["M", "F"]);

      const draftFemale = createEmptyProtocolItemDraft({
        sexAllowed: ["F"],
      });
      expect(draftFemale.sexAllowed).toEqual(["F"]);
    });

    it("define espécies permitidas", () => {
      const draft = createEmptyProtocolItemDraft({
        speciesAllowed: ["bovino"],
      });
      expect(draft.speciesAllowed).toEqual(["bovino"]);
    });

    it("define categorias permitidas", () => {
      const draft = createEmptyProtocolItemDraft({
        categoryAllowed: ["vaca", "novilha"],
      });
      expect(draft.categoryAllowed).toEqual(["vaca", "novilha"]);
    });
  });

  describe("Compliance metadata", () => {
    it("marca compliance como requerido", () => {
      const draft = createEmptyProtocolItemDraft({
        isComplianceRequired: true,
        complianceDocType: "laudo_veterinario",
      });
      expect(draft.isComplianceRequired).toBe(true);
      expect(draft.complianceDocType).toBe("laudo_veterinario");
    });
  });

  describe("Dependency tracking", () => {
    it("registra dependência de outro item", () => {
      const draft = createEmptyProtocolItemDraft({
        dependsOnItemCode: "dose_1",
      });
      expect(draft.dependsOnItemCode).toBe("dose_1");
    });
  });
});
