/**
 * sanitaryProductClassV2.ts
 *
 * Fase 12D5 — Contratos TypeScript de ProductClass, ProductClassGroup e
 * Política de Execução.
 *
 * Escopo: tipos puros, validadores puros e guards de tipo.
 * Sem IO, sem banco, sem agenda real, sem evento real, sem carência ativa.
 *
 * Decisões documentadas em:
 *   docs/review/RELATORIO_12D4_PRODUCTCLASS_STATUS_CURATORIAL_POLITICA_EXECUCAO.md
 */

// ---------------------------------------------------------------------------
// Chave de classe de produto
// ---------------------------------------------------------------------------

/**
 * Identificador semântico de uma classe técnica sanitária.
 *
 * Exemplos:
 *   "vacina_brucelose_b19"
 *   "vacina_clostridial_multivalente"
 *   "endectocida_lactona_macrocilica"
 *   "benzimidazol_oral"
 *   "eprinomectina_pour_on"
 */
export type SanitaryProductClassKeyV2 = string;

// ---------------------------------------------------------------------------
// Tipo de produto sanitário
// ---------------------------------------------------------------------------

export type SanitaryProductTypeV2 =
  | "vacina"
  | "antiparasitario"
  | "antibiotico"
  | "anti_inflamatorio"
  | "hormonio"
  | "diagnostico"
  | "outro";

// ---------------------------------------------------------------------------
// Status curatorial (curadoria do dado/registro)
// ---------------------------------------------------------------------------

/**
 * Estado do processo de curadoria de um registro sanitário
 * (protocolo, item, produto, classe técnica, fonte).
 *
 * NÃO confundir com SanitaryAutomationStatusV2, que controla o que o
 * sistema pode fazer automaticamente com o registro.
 *
 * candidate          — candidato, ainda não validado por curador técnico.
 * needs_review       — exige revisão técnica/regulatória antes de uso.
 * approved_for_catalog — curador aprovou: dados consistentes e fontes verificadas.
 *                      NÃO implica agenda_allowed.
 * blocked            — não usar operacionalmente (norma veda, produto retirado,
 *                      erro crítico detectado).
 * archived           — histórico preservado, sem uso operacional ativo.
 */
export type SanitaryCurationStatusV2 =
  | "candidate"
  | "needs_review"
  | "approved_for_catalog"
  | "blocked"
  | "archived";

// ---------------------------------------------------------------------------
// Status de automação (o que o sistema pode fazer no fluxo operacional)
// ---------------------------------------------------------------------------

/**
 * Controla o que o sistema pode fazer automaticamente com este registro
 * em fluxo operacional.
 *
 * manual_only     — apenas registro manual retroativo; sem preview, sem agenda.
 * preview_allowed — pode aparecer em SanitaryPreviewGroup como sugestão.
 *                   NÃO cria agenda, evento, baixa de estoque, carência ou
 *                   autorização operacional.
 * agenda_allowed  — pode materializar SanitaryAgendaMaterializationCommand
 *                   (intenção de agenda). NÃO prova execução.
 * blocked         — não pode aparecer em nenhum fluxo operacional padrão.
 *
 * Decisão por item (SanitaryProtocolItemVersionV2.allowsAgendaAuto),
 * não pelo protocolo inteiro.
 */
export type SanitaryAutomationStatusV2 =
  | "manual_only"
  | "preview_allowed"
  | "agenda_allowed"
  | "blocked";

// ---------------------------------------------------------------------------
// Política de execução (quando e como o produto é exigido)
// ---------------------------------------------------------------------------

/**
 * Define quando e como um produto sanitário é exigido em um item de protocolo.
 *
 * not_required          — exame, manejo ou alerta sem produto.
 * required_at_execution — padrão para vacinação e antiparasitário.
 *                         Produto real obrigatório no evento executado.
 * required_at_agenda    — agenda deve planejar produto específico antecipadamente.
 * fixed_by_protocol     — produto único fixado pelo protocolo
 *                         (ex.: vacina autógena, Brucelose B19 por PNCEBT).
 *
 * Regra padrão: vacinação e antiparasitário usam required_at_execution,
 * salvo exceção justificada com fonte técnica.
 */
export type ExecutionProductPolicyV2 =
  | "not_required"
  | "required_at_execution"
  | "required_at_agenda"
  | "fixed_by_protocol";

// ---------------------------------------------------------------------------
// ProductClass
// ---------------------------------------------------------------------------

/**
 * Classe técnica sanitária que satisfaz o requisito geral de um item
 * de protocolo.
 *
 * NÃO é produto comercial.
 * NÃO é protocolo.
 * NÃO é item/fase.
 * NÃO valida carência ativa.
 * NÃO autoriza execução sem regra e fonte suficientes.
 */
export type SanitaryProductClassV2 = {
  /** Chave semântica única. ex: "vacina_brucelose_b19" */
  key: SanitaryProductClassKeyV2;
  /** Nome legível para exibição. */
  name: string;
  /** Tipo geral do produto. */
  productType: SanitaryProductTypeV2;
  /** Subtipo técnico adicional (opcional). ex: "cepa_b19_viva_atenuada" */
  productSubtype?: string | null;
  /** Condição-alvo (doença, parasita etc.) — opcional. */
  targetCondition?: string | null;
  /**
   * Espécies para as quais esta classe é relevante.
   * Não implica autorização individual — cada produto/espécie exige
   * SpeciesAuthorizationV2 com fonte forte.
   */
  speciesScope: Array<"bovino" | "bubalino">;
  /** Estado de curadoria do dado desta classe. */
  curationStatus: SanitaryCurationStatusV2;
  /**
   * O que o sistema pode fazer automaticamente com esta classe.
   * Definido por item (SanitaryProtocolItemVersionV2), não pelo protocolo.
   */
  automationStatus: SanitaryAutomationStatusV2;
  /** Limitações técnicas/regulatórias conhecidas. */
  limitations: string[];
  /** Metadados adicionais livres. */
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// ProductClassGroup
// ---------------------------------------------------------------------------

/**
 * Grupo de classes técnicas intercambiáveis aceitas por um item de protocolo.
 *
 * Usar quando o item pode aceitar múltiplas classes sem exigir uma única.
 * Caso obrigatório: controle parasitário.
 *
 * NÃO criar classe fake (ex.: "antiparasitario_geral") — usar ProductClassGroup.
 */
export type SanitaryProductClassGroupV2 = {
  /** Chave semântica única do grupo. ex: "antiparasitarios_permitidos_recria" */
  key: string;
  /** Nome legível para exibição. */
  name: string;
  /**
   * Classes técnicas aceitas neste grupo.
   * Deve ter ao menos um elemento.
   */
  allowedProductClasses: SanitaryProductClassKeyV2[];
  /**
   * Se true: uso de produto de classe fora da lista exige MV responsável
   * e fonte técnica auditada explícita.
   */
  requiresMvForOtherClass: boolean;
  /** Estado de curadoria do dado deste grupo. */
  curationStatus: SanitaryCurationStatusV2;
  /** O que o sistema pode fazer automaticamente com este grupo. */
  automationStatus: SanitaryAutomationStatusV2;
  /** Limitações técnicas/regulatórias conhecidas. */
  limitations: string[];
  /** Metadados adicionais livres. */
  metadata?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// ProductRequirementRule — union discriminada por kind
// ---------------------------------------------------------------------------

/**
 * Regra de exigência de produto para um item de protocolo sanitário.
 *
 * Union discriminada por kind:
 *   none              — exame, manejo ou alerta sem produto.
 *   specific_product  — produto comercial único por ID.
 *   product_class     — classe técnica única.
 *   product_class_group — grupo de classes intercambiáveis aceitas.
 *
 * Regra padrão (vacinação/antiparasitário): required_at_execution.
 * Exceção justificada (ex.: Brucelose B19 por PNCEBT): fixed_by_protocol.
 */
export type SanitaryProductRequirementRuleV2 =
  | {
      kind: "none";
      /** Exame, manejo ou alerta sem produto. */
      executionProductPolicy: "not_required";
    }
  | {
      kind: "specific_product";
      /** ID do produto comercial único exigido. */
      productId: string;
      executionProductPolicy:
        | "fixed_by_protocol"
        | "required_at_execution"
        | "required_at_agenda";
    }
  | {
      kind: "product_class";
      /** Chave da classe técnica única exigida. */
      productClass: SanitaryProductClassKeyV2;
      executionProductPolicy: "required_at_execution" | "required_at_agenda";
    }
  | {
      kind: "product_class_group";
      /** Chave semântica do grupo de classes aceitas. */
      productClassGroupKey: string;
      /**
       * Classes técnicas aceitas neste requisito.
       * Deve ter ao menos um elemento.
       */
      allowedProductClasses: SanitaryProductClassKeyV2[];
      /**
       * Se true: uso de produto de classe fora da lista exige MV responsável.
       */
      requiresMvForOtherClass: boolean;
      executionProductPolicy: "required_at_execution" | "required_at_agenda";
    };

// ---------------------------------------------------------------------------
// ProductRequirementKind (extraído da union para uso isolado)
// ---------------------------------------------------------------------------

/**
 * Tipo do requisito de produto em um item de protocolo sanitário.
 * Mapeado diretamente da union SanitaryProductRequirementRuleV2.
 */
export type ProductRequirementKindV2 = SanitaryProductRequirementRuleV2["kind"];

// ---------------------------------------------------------------------------
// Guards de tipo
// ---------------------------------------------------------------------------

/** Verifica se a regra é de grupo de classes intercambiáveis. */
export function isProductClassGroupRequirementV2(
  rule: SanitaryProductRequirementRuleV2,
): rule is Extract<SanitaryProductRequirementRuleV2, { kind: "product_class_group" }> {
  return rule.kind === "product_class_group";
}

/** Verifica se a regra exige produto comercial específico. */
export function isSpecificProductRequirementV2(
  rule: SanitaryProductRequirementRuleV2,
): rule is Extract<SanitaryProductRequirementRuleV2, { kind: "specific_product" }> {
  return rule.kind === "specific_product";
}

/** Verifica se a regra não exige produto. */
export function isNoneProductRequirementV2(
  rule: SanitaryProductRequirementRuleV2,
): rule is Extract<SanitaryProductRequirementRuleV2, { kind: "none" }> {
  return rule.kind === "none";
}

// ---------------------------------------------------------------------------
// Validadores puros
// ---------------------------------------------------------------------------

export type ProductRequirementRuleValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Valida uma SanitaryProductRequirementRuleV2 sem IO.
 *
 * Regras:
 *  - none exige executionProductPolicy = "not_required".
 *  - specific_product exige productId não vazio.
 *  - specific_product não pode ter executionProductPolicy = "not_required".
 *  - product_class exige productClass não vazio.
 *  - product_class não pode ter executionProductPolicy = "not_required" ou "fixed_by_protocol".
 *  - product_class_group exige productClassGroupKey e allowedProductClasses não vazio.
 *  - product_class_group não pode ter executionProductPolicy = "not_required" ou "fixed_by_protocol".
 *  - fixed_by_protocol é válido apenas com specific_product.
 */
export function validateProductRequirementRuleV2(
  rule: SanitaryProductRequirementRuleV2,
): ProductRequirementRuleValidationResult {
  switch (rule.kind) {
    case "none": {
      if (rule.executionProductPolicy !== "not_required") {
        return {
          ok: false,
          reason: `Requisito "none" exige executionProductPolicy "not_required", recebeu "${rule.executionProductPolicy}".`,
        };
      }
      return { ok: true };
    }

    case "specific_product": {
      if (!rule.productId.trim()) {
        return {
          ok: false,
          reason: `Requisito "specific_product" exige productId não vazio.`,
        };
      }
      if (rule.executionProductPolicy === "not_required") {
        return {
          ok: false,
          reason: `Requisito "specific_product" não pode ter executionProductPolicy "not_required".`,
        };
      }
      return { ok: true };
    }

    case "product_class": {
      if (!rule.productClass.trim()) {
        return {
          ok: false,
          reason: `Requisito "product_class" exige productClass não vazio.`,
        };
      }

      if (
        rule.executionProductPolicy === "not_required" ||
        rule.executionProductPolicy === "fixed_by_protocol"
      ) {
        return {
          ok: false,
          reason: `Requisito "product_class" exige executionProductPolicy "required_at_execution" ou "required_at_agenda".`,
        };
      }

      return { ok: true };
    }

    case "product_class_group": {
      if (!rule.productClassGroupKey.trim()) {
        return {
          ok: false,
          reason: `Requisito "product_class_group" exige productClassGroupKey não vazio.`,
        };
      }

      if (rule.allowedProductClasses.length === 0) {
        return {
          ok: false,
          reason: `Requisito "product_class_group" exige ao menos uma classe em allowedProductClasses.`,
        };
      }

      const emptyClass = rule.allowedProductClasses.find((cls) => !cls.trim());
      if (emptyClass !== undefined) {
        return {
          ok: false,
          reason: `Requisito "product_class_group" contém classe vazia em allowedProductClasses.`,
        };
      }

      if (
        rule.executionProductPolicy === "not_required" ||
        rule.executionProductPolicy === "fixed_by_protocol"
      ) {
        return {
          ok: false,
          reason: `Requisito "product_class_group" exige executionProductPolicy "required_at_execution" ou "required_at_agenda".`,
        };
      }

      return { ok: true };
    }
  }
}

/**
 * Valida uma SanitaryProductClassV2 sem IO.
 */
export function validateProductClassV2(
  productClass: SanitaryProductClassV2,
): ProductRequirementRuleValidationResult {
  if (!productClass.key.trim()) {
    return { ok: false, reason: "ProductClass exige key não vazia." };
  }

  if (!productClass.name.trim()) {
    return { ok: false, reason: `ProductClass "${productClass.key}" exige name não vazio.` };
  }

  if (productClass.speciesScope.length === 0) {
    return {
      ok: false,
      reason: `ProductClass "${productClass.key}" exige ao menos uma espécie em speciesScope.`,
    };
  }

  if (!Array.isArray(productClass.limitations)) {
    return {
      ok: false,
      reason: `ProductClass "${productClass.key}" exige limitations como array.`,
    };
  }

  return { ok: true };
}

/**
 * Valida um SanitaryProductClassGroupV2 sem IO.
 *
 * Regras:
 *  - key não pode ser vazia.
 *  - allowedProductClasses deve ter ao menos um elemento.
 *  - allowedProductClasses não pode conter strings vazias.
 */
export function validateProductClassGroupV2(
  group: SanitaryProductClassGroupV2,
): ProductRequirementRuleValidationResult {
  if (!group.key.trim()) {
    return { ok: false, reason: `ProductClassGroup exige key não vazia.` };
  }
  if (group.allowedProductClasses.length === 0) {
    return {
      ok: false,
      reason: `ProductClassGroup "${group.key}" exige ao menos uma classe em allowedProductClasses.`,
    };
  }
  const emptyClass = group.allowedProductClasses.find((cls) => !cls.trim());
  if (emptyClass !== undefined) {
    return {
      ok: false,
      reason: `ProductClassGroup "${group.key}" contém classe técnica vazia em allowedProductClasses.`,
    };
  }
  return { ok: true };
}

/**
 * Verifica se um automationStatus implica permissão de agenda automática.
 *
 * Apenas "agenda_allowed" implica agenda.
 * "preview_allowed" NÃO implica agenda_allowed.
 * "approved_for_catalog" NÃO implica agenda_allowed.
 */
export function automationAllowsAgenda(status: SanitaryAutomationStatusV2): boolean {
  return status === "agenda_allowed";
}

/**
 * Verifica se um curationStatus aprovado para catálogo implica agenda automática.
 *
 * approved_for_catalog NÃO implica agenda_allowed.
 * A decisão de agenda fica em SanitaryAutomationStatusV2.
 */
export function curationApprovedImpliesAgenda(
  _curationStatus: SanitaryCurationStatusV2,
): false {
  // Por design: status curatorial nunca implica automação de agenda.
  return false;
}
