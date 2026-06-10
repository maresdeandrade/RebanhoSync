import { describe, expect, it } from "vitest";
import {
  isProductClassGroupRequirementV2,
  isSpecificProductRequirementV2,
  isNoneProductRequirementV2,
  validateProductRequirementRuleV2,
  validateProductClassGroupV2,
  validateProductClassV2,
  automationAllowsAgenda,
  curationApprovedImpliesAgenda,
  type SanitaryProductRequirementRuleV2,
  type SanitaryProductClassGroupV2,
  type SanitaryProductClassV2,
} from "../sanitaryProductClassV2";

describe("sanitaryProductClassV2", () => {
  describe("Type Guards", () => {
    it("isProductClassGroupRequirementV2 identifies product_class_group correctly", () => {
      const ruleGroup: SanitaryProductRequirementRuleV2 = {
        kind: "product_class_group",
        productClassGroupKey: "group-1",
        allowedProductClasses: ["class-1"],
        requiresMvForOtherClass: false,
        executionProductPolicy: "required_at_execution",
      };
      const ruleNone: SanitaryProductRequirementRuleV2 = {
        kind: "none",
        executionProductPolicy: "not_required",
      };

      expect(isProductClassGroupRequirementV2(ruleGroup)).toBe(true);
      expect(isProductClassGroupRequirementV2(ruleNone)).toBe(false);
    });

    it("isSpecificProductRequirementV2 identifies specific_product correctly", () => {
      const ruleSpecific: SanitaryProductRequirementRuleV2 = {
        kind: "specific_product",
        productId: "prod-123",
        executionProductPolicy: "required_at_execution",
      };
      const ruleNone: SanitaryProductRequirementRuleV2 = {
        kind: "none",
        executionProductPolicy: "not_required",
      };

      expect(isSpecificProductRequirementV2(ruleSpecific)).toBe(true);
      expect(isSpecificProductRequirementV2(ruleNone)).toBe(false);
    });

    it("isNoneProductRequirementV2 identifies none correctly", () => {
      const ruleNone: SanitaryProductRequirementRuleV2 = {
        kind: "none",
        executionProductPolicy: "not_required",
      };
      const ruleSpecific: SanitaryProductRequirementRuleV2 = {
        kind: "specific_product",
        productId: "prod-123",
        executionProductPolicy: "required_at_execution",
      };

      expect(isNoneProductRequirementV2(ruleNone)).toBe(true);
      expect(isNoneProductRequirementV2(ruleSpecific)).toBe(false);
    });
  });

  describe("validateProductRequirementRuleV2", () => {
    it("kind 'none' is valid if executionProductPolicy is 'not_required'", () => {
      const valid: SanitaryProductRequirementRuleV2 = {
        kind: "none",
        executionProductPolicy: "not_required",
      };
      expect(validateProductRequirementRuleV2(valid)).toEqual({ ok: true });

      const invalid = {
        kind: "none",
        executionProductPolicy: "required_at_execution",
      } as any;
      expect(validateProductRequirementRuleV2(invalid).ok).toBe(false);
    });

    it("kind 'specific_product' is valid with non-empty productId and appropriate policy", () => {
      const valid: SanitaryProductRequirementRuleV2 = {
        kind: "specific_product",
        productId: "prod-123",
        executionProductPolicy: "required_at_execution",
      };
      expect(validateProductRequirementRuleV2(valid)).toEqual({ ok: true });

      const invalidId: SanitaryProductRequirementRuleV2 = {
        kind: "specific_product",
        productId: "  ",
        executionProductPolicy: "required_at_execution",
      };
      expect(validateProductRequirementRuleV2(invalidId).ok).toBe(false);

      const invalidPolicy: SanitaryProductRequirementRuleV2 = {
        kind: "specific_product",
        productId: "prod-123",
        executionProductPolicy: "not_required" as any,
      };
      expect(validateProductRequirementRuleV2(invalidPolicy).ok).toBe(false);
    });

    it("kind 'product_class' is valid with non-empty class and appropriate policy", () => {
      const valid: SanitaryProductRequirementRuleV2 = {
        kind: "product_class",
        productClass: "class-123",
        executionProductPolicy: "required_at_execution",
      };
      expect(validateProductRequirementRuleV2(valid)).toEqual({ ok: true });

      const invalidClass: SanitaryProductRequirementRuleV2 = {
        kind: "product_class",
        productClass: " ",
        executionProductPolicy: "required_at_execution",
      };
      expect(validateProductRequirementRuleV2(invalidClass).ok).toBe(false);

      const invalidPolicy: SanitaryProductRequirementRuleV2 = {
        kind: "product_class",
        productClass: "class-123",
        executionProductPolicy: "not_required" as any,
      };
      expect(validateProductRequirementRuleV2(invalidPolicy).ok).toBe(false);
    });

    it("kind 'product_class_group' is valid with group key, allowed classes, and appropriate policy", () => {
      const valid: SanitaryProductRequirementRuleV2 = {
        kind: "product_class_group",
        productClassGroupKey: "group-123",
        allowedProductClasses: ["class-1", "class-2"],
        requiresMvForOtherClass: true,
        executionProductPolicy: "required_at_execution",
      };
      expect(validateProductRequirementRuleV2(valid)).toEqual({ ok: true });

      const invalidKey: SanitaryProductRequirementRuleV2 = {
        kind: "product_class_group",
        productClassGroupKey: " ",
        allowedProductClasses: ["class-1"],
        requiresMvForOtherClass: false,
        executionProductPolicy: "required_at_execution",
      };
      expect(validateProductRequirementRuleV2(invalidKey).ok).toBe(false);

      const invalidClasses: SanitaryProductRequirementRuleV2 = {
        kind: "product_class_group",
        productClassGroupKey: "group-123",
        allowedProductClasses: [],
        requiresMvForOtherClass: false,
        executionProductPolicy: "required_at_execution",
      };
      expect(validateProductRequirementRuleV2(invalidClasses).ok).toBe(false);

      const invalidPolicy: SanitaryProductRequirementRuleV2 = {
        kind: "product_class_group",
        productClassGroupKey: "group-123",
        allowedProductClasses: ["class-1"],
        requiresMvForOtherClass: false,
        executionProductPolicy: "not_required" as any,
      };
      expect(validateProductRequirementRuleV2(invalidPolicy).ok).toBe(false);
    });

    it("product_class rejeita fixed_by_protocol em runtime", () => {
      const result = validateProductRequirementRuleV2({
        kind: "product_class",
        productClass: "vacina_clostridial_multivalente",
        executionProductPolicy: "fixed_by_protocol",
      } as any);

      expect(result.ok).toBe(false);
    });

    it("product_class_group rejeita fixed_by_protocol em runtime", () => {
      const result = validateProductRequirementRuleV2({
        kind: "product_class_group",
        productClassGroupKey: "antiparasitarios_permitidos_recria",
        allowedProductClasses: ["endectocida_lactona_macrocilica"],
        requiresMvForOtherClass: true,
        executionProductPolicy: "fixed_by_protocol",
      } as any);

      expect(result.ok).toBe(false);
    });
  });

  describe("validateProductClassV2", () => {
    it("valid product class passes", () => {
      const valid: SanitaryProductClassV2 = {
        key: "class-123",
        name: "Class 123",
        productType: "vacina",
        speciesScope: ["bovino"],
        curationStatus: "approved_for_catalog",
        automationStatus: "agenda_allowed",
        limitations: [],
      };
      expect(validateProductClassV2(valid)).toEqual({ ok: true });
    });

    it("validateProductClassV2 rejeita ProductClass sem key", () => {
      const result = validateProductClassV2({
        key: " ",
        name: "Vacina clostridial multivalente",
        productType: "vacina",
        speciesScope: ["bovino"],
        curationStatus: "candidate",
        automationStatus: "manual_only",
        limitations: [],
      });

      expect(result.ok).toBe(false);
    });

    it("validateProductClassV2 rejeita ProductClass com nome ou escopo invalidos", () => {
      const invalidName: SanitaryProductClassV2 = {
        key: "class-123",
        name: "",
        productType: "vacina",
        speciesScope: ["bovino"],
        curationStatus: "approved_for_catalog",
        automationStatus: "agenda_allowed",
        limitations: [],
      };
      expect(validateProductClassV2(invalidName).ok).toBe(false);

      const invalidScope: SanitaryProductClassV2 = {
        key: "class-123",
        name: "Class 123",
        productType: "vacina",
        speciesScope: [],
        curationStatus: "approved_for_catalog",
        automationStatus: "agenda_allowed",
        limitations: [],
      };
      expect(validateProductClassV2(invalidScope).ok).toBe(false);
    });
  });

  describe("validateProductClassGroupV2", () => {
    it("valid group passes", () => {
      const valid: SanitaryProductClassGroupV2 = {
        key: "group-123",
        name: "Group 123",
        allowedProductClasses: ["class-1"],
        requiresMvForOtherClass: false,
        curationStatus: "approved_for_catalog",
        automationStatus: "agenda_allowed",
        limitations: [],
      };
      expect(validateProductClassGroupV2(valid)).toEqual({ ok: true });
    });

    it("group with empty key fails", () => {
      const group: SanitaryProductClassGroupV2 = {
        key: " ",
        name: "Group 123",
        allowedProductClasses: ["class-1"],
        requiresMvForOtherClass: false,
        curationStatus: "approved_for_catalog",
        automationStatus: "agenda_allowed",
        limitations: [],
      };
      expect(validateProductClassGroupV2(group).ok).toBe(false);
    });

    it("group with empty classes fails", () => {
      const group: SanitaryProductClassGroupV2 = {
        key: "group-123",
        name: "Group 123",
        allowedProductClasses: [],
        requiresMvForOtherClass: false,
        curationStatus: "approved_for_catalog",
        automationStatus: "agenda_allowed",
        limitations: [],
      };
      expect(validateProductClassGroupV2(group).ok).toBe(false);
    });

    it("group containing empty class name fails", () => {
      const group: SanitaryProductClassGroupV2 = {
        key: "group-123",
        name: "Group 123",
        allowedProductClasses: ["class-1", " "],
        requiresMvForOtherClass: false,
        curationStatus: "approved_for_catalog",
        automationStatus: "agenda_allowed",
        limitations: [],
      };
      expect(validateProductClassGroupV2(group).ok).toBe(false);
    });
  });

  describe("Automation & Curation Helpers", () => {
    it("automationAllowsAgenda resolves correctly", () => {
      expect(automationAllowsAgenda("agenda_allowed")).toBe(true);
      expect(automationAllowsAgenda("preview_allowed")).toBe(false);
      expect(automationAllowsAgenda("manual_only")).toBe(false);
      expect(automationAllowsAgenda("blocked")).toBe(false);
    });

    it("curationApprovedImpliesAgenda resolves to false", () => {
      expect(curationApprovedImpliesAgenda("approved_for_catalog")).toBe(false);
      expect(curationApprovedImpliesAgenda("candidate")).toBe(false);
    });
  });
});
