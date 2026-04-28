/**
 * Testes — Draft Model (mapDraftToDomain, mapDomainToDraft)
 */

import { describe, it, expect } from "vitest";
import {
  createEmptyProtocolItemDraft,
  mapDraftToDomain,
  mapDomainToDraft,
  validateProtocolItemDraft,
  getVisibleFieldsByMode,
} from "@/lib/sanitario/models/draft";
import type { ProtocolItemDraft, SanitaryProtocolItemDomain } from "@/lib/sanitario/models/domain";

describe("Draft Model", () => {
  describe("createEmptyProtocolItemDraft", () => {
    it("retorna draft vazio com defaults", () => {
      const draft = createEmptyProtocolItemDraft();
      expect(draft.protocolId).toBe("");
      expect(draft.itemId).toBe("");
      expect(draft.generatesAgenda).toBe(true);
      expect(draft.sexAllowed).toEqual(["M", "F"]);
      expect(draft.regimenVersion).toBe(1);
    });

    it("aplica overrides", () => {
      const draft = createEmptyProtocolItemDraft({
        protocolId: "proto-1",
        itemId: "item-1",
      });
      expect(draft.protocolId).toBe("proto-1");
      expect(draft.itemId).toBe("item-1");
    });
  });

  describe("validateProtocolItemDraft", () => {
    it("retorna erro quando layer está faltando", () => {
      const draft = createEmptyProtocolItemDraft();
      const errors = validateProtocolItemDraft(draft);
      expect(errors).toContain("Layer é obrigatório");
    });

    it("retorna erro quando mode está faltando", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
      });
      const errors = validateProtocolItemDraft(draft);
      expect(errors).toContain("Modo de agendamento é obrigatório");
    });

    it("retorna erro quando campaignMonths está vazio para modo campanha", () => {
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

    it("retorna erro quando ageStartDays inválido para janela_etaria", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "janela_etaria",
        anchor: "nascimento",
        ageStartDays: -1,
      });
      const errors = validateProtocolItemDraft(draft);
      expect(errors).toContain("Idade inicial deve ser um número >= 0");
    });

    it("retorna erro quando ageEndDays < ageStartDays", () => {
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

    it("retorna erro quando intervalDays <= 0", () => {
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

    it("retorna vazio para draft válido de campanha", () => {
      const draft = createEmptyProtocolItemDraft({
        protocolId: "proto-1",
        itemId: "item-1",
        layer: "sanitario",
        scopeType: "animal",
        mode: "campanha",
        anchor: "entrada_fazenda",
        campaignMonths: [5, 6, 7],
      });
      const errors = validateProtocolItemDraft(draft);
      expect(errors.length).toBe(0);
    });
  });

  describe("mapDraftToDomain", () => {
    it("converte draft campanha para domínio", () => {
      const draft = createEmptyProtocolItemDraft({
        protocolId: "proto-1",
        itemId: "item-1",
        familyCode: "brucelose",
        itemCode: "dose_unica",
        regimenVersion: 1,
        layer: "sanitario",
        scopeType: "animal",
        mode: "campanha",
        anchor: "entrada_fazenda",
        campaignMonths: [5, 6, 7],
        campaignLabel: "Campanha maio-julho",
        productCode: "brucelose-viva",
        productName: "Brucevac",
        doseNumber: 1,
      });

      const domain = mapDraftToDomain(draft);
      expect(domain.identity.familyCode).toBe("brucelose");
      expect(domain.execution.mode).toBe("campanha");
      expect(domain.execution.campaignMonths).toEqual([5, 6, 7]);
      expect(domain.productCode).toBe("brucelose-viva");
    });

    it("converte draft janela_etaria para domínio", () => {
      const draft = createEmptyProtocolItemDraft({
        protocolId: "proto-1",
        itemId: "item-1",
        layer: "sanitario",
        scopeType: "animal",
        mode: "janela_etaria",
        anchor: "nascimento",
        ageStartDays: 100,
        ageEndDays: 180,
      });

      const domain = mapDraftToDomain(draft);
      expect(domain.execution.mode).toBe("janela_etaria");
      expect(domain.execution.ageStartDays).toBe(100);
      expect(domain.execution.ageEndDays).toBe(180);
    });

    it("converte draft rotina_recorrente para domínio", () => {
      const draft = createEmptyProtocolItemDraft({
        protocolId: "proto-1",
        itemId: "item-1",
        layer: "sanitario",
        scopeType: "animal",
        mode: "rotina_recorrente",
        anchor: "ultima_conclusao_mesma_familia",
        intervalDays: 90,
      });

      const domain = mapDraftToDomain(draft);
      expect(domain.execution.mode).toBe("rotina_recorrente");
      expect(domain.execution.intervalDays).toBe(90);
    });

    it("converte draft procedimento_imediato para domínio", () => {
      const draft = createEmptyProtocolItemDraft({
        protocolId: "proto-1",
        itemId: "item-1",
        layer: "sanitario",
        scopeType: "fazenda",
        mode: "procedimento_imediato",
        triggerEvent: "notificacao_svo",
      });

      const domain = mapDraftToDomain(draft);
      expect(domain.execution.mode).toBe("procedimento_imediato");
      expect(domain.execution.triggerEvent).toBe("notificacao_svo");
    });

    it("lança erro quando layer falta", () => {
      const draft = createEmptyProtocolItemDraft();
      expect(() => mapDraftToDomain(draft)).toThrow("layer é obrigatório");
    });

    it("lança erro quando mode falta", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        anchor: "nascimento",
      });
      expect(() => mapDraftToDomain(draft)).toThrow("schedulingMode é obrigatório");
    });

    it("lança erro quando campaignMonths vazio para campanha", () => {
      const draft = createEmptyProtocolItemDraft({
        layer: "sanitario",
        scopeType: "animal",
        mode: "campanha",
        anchor: "entrada_fazenda",
        campaignMonths: [],
      });
      expect(() => mapDraftToDomain(draft)).toThrow(
        "campaignMonths é obrigatório"
      );
    });

    it("preenche defaults para campos opcionais", () => {
      const draft = createEmptyProtocolItemDraft({
        protocolId: "proto-1",
        itemId: "item-1",
        layer: "sanitario",
        scopeType: "animal",
        mode: "campanha",
        anchor: "entrada_fazenda",
        campaignMonths: [5],
        // familyCode omitido — deve gerar default
      });

      const domain = mapDraftToDomain(draft);
      expect(domain.identity.familyCode).toBe("family-item-1");
      expect(domain.execution.campaignLabel).toBe("");
    });
  });

  describe("mapDomainToDraft", () => {
    it("converte domínio campanha para draft", () => {
      const domain: SanitaryProtocolItemDomain = {
        identity: {
          protocolId: "proto-1",
          itemId: "item-1",
          familyCode: "brucelose",
          itemCode: "dose_unica",
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
          campaignMonths: [5, 6, 7],
          campaignLabel: "Campanha maio-julho",
        },
        generatesAgenda: true,
        productCode: "brucelose-viva",
        productName: "Brucevac",
        doseNumber: 1,
      };

      const draft = mapDomainToDraft(domain);
      expect(draft.mode).toBe("campanha");
      expect(draft.campaignMonths).toEqual([5, 6, 7]);
      expect(draft.productCode).toBe("brucelose-viva");
    });

    it("converte domínio janela_etaria para draft", () => {
      const domain: SanitaryProtocolItemDomain = {
        identity: {
          protocolId: "proto-1",
          itemId: "item-1",
          familyCode: "raiva",
          itemCode: "dose_1",
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
          mode: "janela_etaria",
          anchor: "nascimento",
          ageStartDays: 100,
          ageEndDays: 180,
        },
        generatesAgenda: true,
        doseNumber: 1,
      };

      const draft = mapDomainToDraft(domain);
      expect(draft.mode).toBe("janela_etaria");
      expect(draft.ageStartDays).toBe(100);
      expect(draft.ageEndDays).toBe(180);
    });

    it("preserva campos identity", () => {
      const domain: SanitaryProtocolItemDomain = {
        identity: {
          protocolId: "proto-123",
          itemId: "item-456",
          familyCode: "test-family",
          itemCode: "test-item",
          regimenVersion: 2,
        },
        layer: "sanitario",
        scopeType: "animal",
        eligibility: {
          sexAllowed: ["M"],
          speciesAllowed: ["bovino"],
          categoryAllowed: ["vaca"],
        },
        compliance: {
          isComplianceRequired: true,
          complianceDocType: "laudo_veterinario",
        },
        execution: {
          mode: "campanha",
          anchor: "entrada_fazenda",
          campaignMonths: [1],
          campaignLabel: "",
        },
        generatesAgenda: true,
        productCode: "prod-123",
        productName: "Product Name",
        doseNumber: 2,
        description: "Test description",
      };

      const draft = mapDomainToDraft(domain);
      expect(draft.protocolId).toBe("proto-123");
      expect(draft.itemId).toBe("item-456");
      expect(draft.familyCode).toBe("test-family");
      expect(draft.regimenVersion).toBe(2);
      expect(draft.sexAllowed).toEqual(["M"]);
      expect(draft.categoryAllowed).toEqual(["vaca"]);
      expect(draft.isComplianceRequired).toBe(true);
      expect(draft.complianceDocType).toBe("laudo_veterinario");
      expect(draft.description).toBe("Test description");
    });
  });

  describe("Roundtrip Tests", () => {
    it("draft → domain → draft preserva dados campanha", () => {
      const originalDraft = createEmptyProtocolItemDraft({
        protocolId: "proto-1",
        itemId: "item-1",
        familyCode: "brucelose",
        itemCode: "dose_unica",
        layer: "sanitario",
        scopeType: "animal",
        mode: "campanha",
        anchor: "entrada_fazenda",
        campaignMonths: [5, 6, 7],
        campaignLabel: "Campanha maio-julho",
        sexAllowed: ["F"],
      });

      const domain = mapDraftToDomain(originalDraft);
      const reconstructedDraft = mapDomainToDraft(domain);

      expect(reconstructedDraft.familyCode).toBe(originalDraft.familyCode);
      expect(reconstructedDraft.mode).toBe(originalDraft.mode);
      expect(reconstructedDraft.campaignMonths).toEqual(originalDraft.campaignMonths);
      expect(reconstructedDraft.sexAllowed).toEqual(originalDraft.sexAllowed);
    });

    it("draft → domain → draft preserva dados janela_etaria", () => {
      const originalDraft = createEmptyProtocolItemDraft({
        protocolId: "proto-1",
        itemId: "item-1",
        layer: "sanitario",
        scopeType: "animal",
        mode: "janela_etaria",
        anchor: "nascimento",
        ageStartDays: 100,
        ageEndDays: 200,
        speciesAllowed: ["bovino"],
      });

      const domain = mapDraftToDomain(originalDraft);
      const reconstructedDraft = mapDomainToDraft(domain);

      expect(reconstructedDraft.mode).toBe(originalDraft.mode);
      expect(reconstructedDraft.ageStartDays).toBe(originalDraft.ageStartDays);
      expect(reconstructedDraft.ageEndDays).toBe(originalDraft.ageEndDays);
      expect(reconstructedDraft.speciesAllowed).toEqual(originalDraft.speciesAllowed);
    });
  });

  describe("getVisibleFieldsByMode", () => {
    it("retorna true para campaignFields quando mode é campanha", () => {
      const fields = getVisibleFieldsByMode("campanha");
      expect(fields.campaignFields).toBe(true);
      expect(fields.ageWindowFields).toBe(false);
      expect(fields.intervalFields).toBe(false);
      expect(fields.triggerEventField).toBe(false);
    });

    it("retorna true para ageWindowFields quando mode é janela_etaria", () => {
      const fields = getVisibleFieldsByMode("janela_etaria");
      expect(fields.ageWindowFields).toBe(true);
      expect(fields.campaignFields).toBe(false);
      expect(fields.intervalFields).toBe(false);
      expect(fields.triggerEventField).toBe(false);
    });

    it("retorna true para intervalFields quando mode é rotina_recorrente", () => {
      const fields = getVisibleFieldsByMode("rotina_recorrente");
      expect(fields.intervalFields).toBe(true);
      expect(fields.campaignFields).toBe(false);
      expect(fields.ageWindowFields).toBe(false);
      expect(fields.triggerEventField).toBe(false);
    });

    it("retorna true para triggerEventField quando mode é procedimento_imediato", () => {
      const fields = getVisibleFieldsByMode("procedimento_imediato");
      expect(fields.triggerEventField).toBe(true);
      expect(fields.campaignFields).toBe(false);
      expect(fields.ageWindowFields).toBe(false);
      expect(fields.intervalFields).toBe(false);
    });

    it("retorna todos false quando mode é undefined", () => {
      const fields = getVisibleFieldsByMode(undefined);
      expect(fields.campaignFields).toBe(false);
      expect(fields.ageWindowFields).toBe(false);
      expect(fields.intervalFields).toBe(false);
      expect(fields.triggerEventField).toBe(false);
    });
  });
});
