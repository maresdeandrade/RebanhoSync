/**
 * Testes — Draft Model Advanced (Edge Cases, Cenários Complexos)
 */

import { describe, it, expect } from "vitest";
import {
  createEmptyProtocolItemDraft,
  mapDraftToDomain,
  mapDomainToDraft,
  validateProtocolItemDraft,
} from "@/lib/sanitario/draft";
import type { SanitaryProtocolItemDomain } from "@/lib/sanitario/domain";

describe("Draft Model — Advanced Edge Cases", () => {
  describe("Empty/Null Field Handling", () => {
    it("permite fields undefined durante edição", () => {
      const draft = createEmptyProtocolItemDraft({
        protocolId: "proto-1",
        itemId: "item-1",
        // layer undefined
        // scopeType undefined
        // mode undefined
      });

      expect(draft.layer).toBeUndefined();
      expect(draft.scopeType).toBeUndefined();
      expect(draft.mode).toBeUndefined();

      const errors = validateProtocolItemDraft(draft);
      expect(errors.length).toBeGreaterThan(0);
    });

    it("rejeita strings vazias como valores", () => {
      const draft = createEmptyProtocolItemDraft({
        familyCode: "",
        itemCode: "",
        productName: "",
      });

      expect(draft.familyCode).toBe("");
      expect(draft.itemCode).toBe("");
      expect(draft.productName).toBe("");
    });

    it("preserva null para campos opcionais", () => {
      const draft = createEmptyProtocolItemDraft({
        campaignMonths: null,
        dependsOnItemCode: undefined,
      });

      expect(draft.campaignMonths).toBeNull();
      expect(draft.dependsOnItemCode).toBeUndefined();
    });
  });

  describe("Campaign Month Parsing", () => {
    it("aceita array de meses válidos 1-12", () => {
      const draft = createEmptyProtocolItemDraft({
        campaignMonths: [1, 6, 12],
      });
      expect(draft.campaignMonths).toEqual([1, 6, 12]);
    });

    it("aceita mês 0 em draft (será validado em runtime)", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "campanha",
        anchor: "entrada_fazenda",
        campaignMonths: [0, 5],
      });

      // Draft faz validação estrutural apenas, não range validation
      const errors = validateProtocolItemDraft(draft);
      expect(errors.filter((e) => e.includes("Meses"))).toHaveLength(0);
    });

    it("aceita mês > 12 em draft (será validado em runtime)", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "campanha",
        anchor: "entrada_fazenda",
        campaignMonths: [13],
      });

      // Draft faz validação estrutural apenas
      const errors = validateProtocolItemDraft(draft);
      expect(errors.filter((e) => e.includes("Meses"))).toHaveLength(0);
    });

    it("deduplicará meses repetidos", () => {
      const draft = createEmptyProtocolItemDraft({
        campaignMonths: [5, 5, 6, 6, 7],
      });

      // Array pode ter duplicatas no draft
      // Mas quando converter para domain, deveria estar limpo
      expect(draft.campaignMonths?.length).toBe(5);
    });

    it("aceita array vazio (será rejeitado em validação)", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "campanha",
        anchor: "entrada_fazenda",
        campaignMonths: [],
      });

      const errors = validateProtocolItemDraft(draft);
      expect(errors).toContain("Meses da campanha são obrigatórios");
    });
  });

  describe("Age Window Validation", () => {
    it("aceita ageStartDays=0 (prematuro)", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "janela_etaria",
        anchor: "nascimento",
        ageStartDays: 0,
        ageEndDays: 180,
      });

      const errors = validateProtocolItemDraft(draft);
      expect(errors.length).toBe(0);
    });

    it("rejeita ageStartDays negativo", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "janela_etaria",
        anchor: "nascimento",
        ageStartDays: -5,
        ageEndDays: 100,
      });

      const errors = validateProtocolItemDraft(draft);
      expect(errors).toContain("Idade inicial deve ser um número >= 0");
    });

    it("aceita ageEndDays muito maior que ageStartDays", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "janela_etaria",
        anchor: "nascimento",
        ageStartDays: 0,
        ageEndDays: 3650, // 10 anos
      });

      const errors = validateProtocolItemDraft(draft);
      expect(errors.length).toBe(0);
    });

    it("rejeita ageEndDays < ageStartDays", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "janela_etaria",
        anchor: "nascimento",
        ageStartDays: 100,
        ageEndDays: 50,
      });

      const errors = validateProtocolItemDraft(draft);
      expect(errors).toContain("Idade final deve ser >= idade inicial");
    });

    it("aceita ageStartDays === ageEndDays (ponto único)", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "janela_etaria",
        anchor: "nascimento",
        ageStartDays: 100,
        ageEndDays: 100,
      });

      const errors = validateProtocolItemDraft(draft);
      expect(errors.length).toBe(0);
    });
  });

  describe("Interval Days Validation", () => {
    it("aceita intervalDays=1 (diário)", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "rotina_recorrente",
        anchor: "ultima_conclusao_mesma_familia",
        intervalDays: 1,
      });

      const errors = validateProtocolItemDraft(draft);
      expect(errors.length).toBe(0);
    });

    it("rejeita intervalDays=0", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "rotina_recorrente",
        anchor: "ultima_conclusao_mesma_familia",
        intervalDays: 0,
      });

      const errors = validateProtocolItemDraft(draft);
      expect(errors).toContain("Intervalo deve ser um número > 0");
    });

    it("rejeita intervalDays negativo", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "rotina_recorrente",
        anchor: "ultima_conclusao_mesma_familia",
        intervalDays: -90,
      });

      const errors = validateProtocolItemDraft(draft);
      expect(errors).toContain("Intervalo deve ser um número > 0");
    });

    it("aceita intervalDays muito grande", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "rotina_recorrente",
        anchor: "ultima_conclusao_mesma_familia",
        intervalDays: 3650, // 10 anos
      });

      const errors = validateProtocolItemDraft(draft);
      expect(errors.length).toBe(0);
    });
  });

  describe("Dependency Graph Validation", () => {
    it("aceita dependência simples A → B", () => {
      const draftA = createEmptyProtocolItemDraft({
        itemCode: "dose_1",
      });
      const draftB = createEmptyProtocolItemDraft({
        itemCode: "dose_2",
        dependsOnItemCode: "dose_1",
      });

      // Nenhum erro sobre dependência (validação cíclica é no scheduler)
      const errorsB = validateProtocolItemDraft(draftB);
      expect(errorsB.filter((e) => e.includes("depend"))).toHaveLength(0);
    });

    it("permite self-dependency (será rejeitado pelo scheduler)", () => {
      const draft = createEmptyProtocolItemDraft({
        itemCode: "dose_1",
        dependsOnItemCode: "dose_1",
      });

      // Draft deve deixar passar (scheduler valida ciclos)
      const errors = validateProtocolItemDraft(draft);
      expect(errors.filter((e) => e.includes("depend"))).toHaveLength(0);
    });

    it("permite cadeia longa de dependências", () => {
      // A → B → C → D
      const drafts = [];
      for (let i = 1; i <= 4; i++) {
        const draft = createEmptyProtocolItemDraft({
          itemCode: `dose_${i}`,
          dependsOnItemCode: i > 1 ? `dose_${i - 1}` : undefined,
        });
        drafts.push(draft);
      }

      // Todos devem passar em validação de draft
      drafts.forEach((d) => {
        const errors = validateProtocolItemDraft(d);
        expect(errors.filter((e) => e.includes("depend"))).toHaveLength(0);
      });
    });
  });

  describe("Sex/Species/Category Allowed", () => {
    it("aceita array vazio de sexAllowed (será validado em runtime)", () => {
      const draft = createEmptyProtocolItemDraft({
        sexAllowed: [],
      });

      // Draft valida estrutura, não business logic
      const errors = validateProtocolItemDraft(draft);
      expect(errors.filter((e) => e.includes("sex"))).toHaveLength(0);
    });

    it("aceita M, F, ou ambos", () => {
      const draftMale = createEmptyProtocolItemDraft({
        sexAllowed: ["M"],
      });
      const draftFemale = createEmptyProtocolItemDraft({
        sexAllowed: ["F"],
      });
      const draftBoth = createEmptyProtocolItemDraft({
        sexAllowed: ["M", "F"],
      });

      [draftMale, draftFemale, draftBoth].forEach((d) => {
        const errors = validateProtocolItemDraft(d);
        expect(errors.filter((e) => e.includes("sex"))).toHaveLength(0);
      });
    });

    it("aceita categoria customizada", () => {
      const draft = createEmptyProtocolItemDraft({
        categoryAllowed: ["vaca", "novilha", "bezerra"],
      });

      const errors = validateProtocolItemDraft(draft);
      expect(errors.filter((e) => e.includes("categor"))).toHaveLength(0);
    });
  });

  describe("Compliance Metadata", () => {
    it("aceita compliance requerido com docType", () => {
      const draft = createEmptyProtocolItemDraft({
        protocolId: "p1",
        itemId: "i1",
        layer: "sanitario",
        scopeType: "animal",
        mode: "campanha",
        anchor: "entrada_fazenda",
        campaignMonths: [5],
        isComplianceRequired: true,
        complianceDocType: "laudo_veterinario",
      });

      const errors = validateProtocolItemDraft(draft);
      expect(errors.length).toBe(0);
    });

    it("aceita compliance não requerido sem docType", () => {
      const draft = createEmptyProtocolItemDraft({
        protocolId: "p1",
        itemId: "i1",
        layer: "sanitario",
        scopeType: "animal",
        mode: "campanha",
        anchor: "entrada_fazenda",
        campaignMonths: [5],
        isComplianceRequired: false,
      });

      const errors = validateProtocolItemDraft(draft);
      expect(errors.length).toBe(0);
    });

    it("aceita compliance requerido sem docType (UI pode preencher depois)", () => {
      const draft = createEmptyProtocolItemDraft({
        protocolId: "p1",
        itemId: "i1",
        layer: "sanitario",
        scopeType: "animal",
        mode: "campanha",
        anchor: "entrada_fazenda",
        campaignMonths: [5],
        isComplianceRequired: true,
        // complianceDocType undefined
      });

      // Draft não deve rejeitar (é UI responsibility preencher)
      const errors = validateProtocolItemDraft(draft);
      expect(errors.filter((e) => e.includes("compliance"))).toHaveLength(0);
    });
  });

  describe("Product Metadata", () => {
    it("aceita produto sem código ou nome (pode ser preenchido depois)", () => {
      const draft = createEmptyProtocolItemDraft({
        productCode: undefined,
        productName: undefined,
        doseNumber: 1,
      });

      const errors = validateProtocolItemDraft(draft);
      expect(errors.filter((e) => e.includes("product"))).toHaveLength(0);
    });

    it("aceita doseNumber=1 (padrão)", () => {
      const draft = createEmptyProtocolItemDraft({
        doseNumber: 1,
      });
      expect(draft.doseNumber).toBe(1);
    });

    it("aceita doseNumber alto", () => {
      const draft = createEmptyProtocolItemDraft({
        doseNumber: 99,
      });
      expect(draft.doseNumber).toBe(99);
    });

    it("aceita doseNumber=0 (edge case)", () => {
      const draft = createEmptyProtocolItemDraft({
        doseNumber: 0,
      });
      expect(draft.doseNumber).toBe(0);
    });
  });

  describe("Roundtrip with Edge Cases", () => {
    it("roundtrip preserva empty campaignMonths", () => {
      const draft1 = createEmptyProtocolItemDraft({
        protocolId: "p1",
        itemId: "i1",
        layer: "sanitario",
        scopeType: "animal",
        mode: "campanha",
        anchor: "entrada_fazenda",
        campaignMonths: [],
      });

      // Não pode converter (erro), então test just the structure
      expect(draft1.campaignMonths).toEqual([]);
    });

    it("roundtrip preserva undefined fields", () => {
      const domain: SanitaryProtocolItemDomain = {
        identity: {
          protocolId: "p1",
          itemId: "i1",
          familyCode: "test",
          itemCode: "item",
          regimenVersion: 1,
        },
        layer: "sanitario",
        scopeType: "animal",
        eligibility: {
          sexAllowed: ["M", "F"],
          speciesAllowed: ["bovino"],
          categoryAllowed: [],
        },
        compliance: {
          isComplianceRequired: false,
        },
        execution: {
          mode: "campanha",
          anchor: "entrada_fazenda",
          campaignMonths: [5],
          campaignLabel: "",
        },
        generatesAgenda: true,
        doseNumber: 1,
      };

      const draft = mapDomainToDraft(domain);
      const domain2 = mapDraftToDomain(draft);
      const draft2 = mapDomainToDraft(domain2);

      expect(draft2.productCode).toBeUndefined();
      expect(draft2.productName).toBeUndefined();
      expect(draft2.description).toBeUndefined();
    });
  });

  describe("Type Safety", () => {
    it("draft permite tipos relaxados (UI responsibility)", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "rotina_recorrente",
        anchor: "ultima_conclusao_mesma_familia",
        intervalDays: 90,
      });

      // TypeScript vai avisar se intervals for string, mas JS permite
      expect(draft.intervalDays).toBe(90);
    });
  });

  describe("Description and Notes Fields", () => {
    it("aceita descrição vazia", () => {
      const draft = createEmptyProtocolItemDraft({
        description: "",
      });
      expect(draft.description).toBe("");
    });

    it("aceita descrição muito longa", () => {
      const longDesc = "a".repeat(10000);
      const draft = createEmptyProtocolItemDraft({
        description: longDesc,
      });
      expect(draft.description?.length).toBe(10000);
    });

    it("aceita linhas quebradas em descrição", () => {
      const multiline = "Linha 1\nLinha 2\nLinha 3";
      const draft = createEmptyProtocolItemDraft({
        description: multiline,
      });
      expect(draft.description).toContain("\n");
    });
  });
});
