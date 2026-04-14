/**
 * Validação Estrutural de Domínio Sanitário
 *
 * Valida invariantes estruturais por modo de calendário, contexto de sujeito,
 * registros de execução, e ciclos de dependência.
 *
 * Nota: Validações temporais (janelas, assinaturas) são responsabilidade do scheduler.
 */

import type {
  SanitaryProtocolItemDomain,
  SanitarySubjectContext,
  SanitaryExecutionRecord,
  SanitaryCalendarMode,
} from "./domain";

// ============================================================================
// VALIDAÇÃO DE PROTOCOL ITEM DOMAIN
// ============================================================================

export function validateSanitaryItemDomain(
  item: SanitaryProtocolItemDomain,
): string[] {
  const errors: string[] = [];
  const { schedule, eligibility, applicability } = item;

  if (schedule.mode === "campanha") {
    if (!schedule.generatesAgenda) {
      errors.push("Campanha deve gerar agenda (generatesAgenda = true).");
    }
    if (!schedule.campaignMonths || schedule.campaignMonths.length === 0) {
      errors.push("Campanha deve ter pelo menos um mês especificado em campaignMonths.");
    } else if (schedule.campaignMonths.some((m) => m < 1 || m > 12)) {
      errors.push("Meses de campanha devem estar entre 1 e 12.");
    }
  }

  if (schedule.mode === "janela_etaria") {
    if (schedule.ageStartDays == null) {
      errors.push("Janela etária exige idade mínima (ageStartDays) preenchida.");
    }
    if (
      schedule.ageStartDays != null &&
      schedule.ageEndDays != null &&
      schedule.ageEndDays < schedule.ageStartDays
    ) {
      errors.push(
        `Idade máxima (${schedule.ageEndDays}) não pode ser menor que mínima (${schedule.ageStartDays}).`
      );
    }
  }

  if (schedule.mode === "rotina_recorrente") {
    if (schedule.intervalDays == null || schedule.intervalDays <= 0) {
      errors.push(
        "Rotina recorrente exige intervalo de dias válido (intervalDays > 0)."
      );
    }
    if (
      ![
        "conclusao_etapa_dependente",
        "ultima_conclusao_mesma_familia",
        "entrada_fazenda",
      ].includes(schedule.anchor)
    ) {
      errors.push(
        "Rotina recorrente exige anchor em [conclusao_etapa_dependente, ultima_conclusao_mesma_familia, entrada_fazenda], recebeu: " +
          schedule.anchor
      );
    }
  }

  if (schedule.mode === "procedimento_imediato") {
    if (schedule.generatesAgenda) {
      errors.push("Procedimento imediato não deve gerar agenda recorrente (generatesAgenda = false).");
    }
  }

  // Modo legado: sem âncora é permitido
  if (schedule.mode !== "procedimento_imediato" && schedule.mode !== "nao_estruturado") {
    if (schedule.anchor === "sem_ancora") {
      errors.push(
        `Modo ${schedule.mode} não permite sem_ancora. Apenas procedimento_imediato e nao_estruturado aceitam sem_ancora.`
      );
    }
  }

  // ---- VALIDAÇÕES DE ELEGIBILIDADE ----

  if (
    eligibility.ageMinDays != null &&
    eligibility.ageMaxDays != null &&
    eligibility.ageMaxDays < eligibility.ageMinDays
  ) {
    errors.push(
      `Idade máxima de elegibilidade (${eligibility.ageMaxDays}) não pode ser menor que idade mínima (${eligibility.ageMinDays}).`
    );
  }

  // ---- VALIDAÇÕES DE APLICABILIDADE ----

  if (applicability.type === "jurisdicao" && !applicability.jurisdiction) {
    errors.push("Tipo jurisdicao requer campo jurisdiction preenchido.");
  }
  if (applicability.type === "risco" && !applicability.risk) {
    errors.push("Tipo risco requer campo risk preenchido.");
  }
  if (applicability.type === "evento" && !applicability.event) {
    errors.push("Tipo evento requer campo event preenchido.");
  }
  if (applicability.type === "perfil_animal" && !applicability.animalProfile) {
    errors.push("Tipo perfil_animal requer campo animalProfile preenchido.");
  }

  return errors;
}

// ============================================================================
// VALIDAÇÃO DE SUBJECT CONTEXT
// ============================================================================

export function validateSanitarySubjectContext(subject: SanitarySubjectContext): string[] {
  const errors: string[] = [];

  // Validações obrigatórias
  if (!subject.scopeId) {
    errors.push("scopeId é obrigatório.");
  }

  if (!subject.fazenda || !subject.fazenda.id) {
    errors.push("fazenda.id é obrigatório.");
  }

  // Validações por scopeType
  if (subject.scopeType === "animal") {
    if (!subject.animal || !subject.animal.id) {
      errors.push("animal scope requer dados de animal (animal.id obrigatório).");
    }
    if (subject.scopeId !== subject.animal?.id) {
      errors.push("scopeId deve corresponder ao animal.id quando scopeType=animal.");
    }
  } else if (subject.scopeType === "lote") {
    if (!subject.lote || !subject.lote.id) {
      errors.push("scopeType=lote requer subject.lote.id preenchido.");
    }
    if (subject.scopeId !== subject.lote?.id) {
      errors.push("scopeId deve corresponder ao lote.id quando scopeType=lote.");
    }
  } else if (subject.scopeType === "fazenda") {
    if (subject.scopeId !== subject.fazenda.id) {
      errors.push("scopeId deve corresponder ao fazenda.id quando scopeType=fazenda.");
    }
  }

  // Validar dados de animal se presente
  if (subject.animal) {
    const animal = subject.animal;
    if (
      animal.birthDate &&
      typeof animal.birthDate === "string" &&
      !/^\d{4}-\d{2}-\d{2}$/.test(animal.birthDate)
    ) {
      errors.push(`animal.birthDate deve estar no formato YYYY-MM-DD, recebeu: ${animal.birthDate}`);
    }
    if (!["macho", "femea"].includes(animal.sex ?? "")) {
      errors.push(`animal.sex deve ser 'macho' ou 'femea', recebeu: ${animal.sex}`);
    }
    if (!["bovino", "bubalino"].includes(animal.species ?? "")) {
      errors.push(`animal.species deve ser 'bovino' ou 'bubalino', recebeu: ${animal.species}`);
    }
  }

  // Validar eventos ativos
  if (subject.activeEvents) {
    for (const evt of subject.activeEvents) {
      if (!evt.eventId || !evt.eventCode) {
        errors.push("Eventos ativos devem ter eventId e eventCode.");
      }
      if (
        typeof evt.openedAt === "string" &&
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(evt.openedAt)
      ) {
        errors.push(`Evento ${evt.eventId}: openedAt deve estar em ISO 8601.`);
      }
      if (
        evt.closedAt &&
        typeof evt.closedAt === "string" &&
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(evt.closedAt)
      ) {
        errors.push(`Evento ${evt.eventId}: closedAt deve estar em ISO 8601.`);
      }
    }
  }

  return errors;
}

// ============================================================================
// VALIDAÇÃO DE EXECUTION RECORD
// ============================================================================

export function validateSanitaryExecutionRecord(record: SanitaryExecutionRecord): string[] {
  const errors: string[] = [];

  if (!record.occurrenceId) {
    errors.push("occurrenceId é obrigatório.");
  }
  if (!record.familyCode) {
    errors.push("familyCode é obrigatório.");
  }
  if (!record.itemCode) {
    errors.push("itemCode é obrigatório.");
  }
  if (!record.dedupKey) {
    errors.push("dedupKey é obrigatório.");
  }
  if (!record.scopeId) {
    errors.push("scopeId é obrigatório.");
  }

  // Validar formato de dedupKey (deve conter 'sanitario:')
  if (record.dedupKey && !record.dedupKey.startsWith("sanitario:")) {
    errors.push("dedupKey inválido: deve começar com 'sanitario:'");
  }

  // Validar transições de status
  const validStatuses = ["pending", "completed", "blocked", "expired", "cancelled"];
  if (!validStatuses.includes(record.status)) {
    errors.push(
      `status deve ser um de [${validStatuses.join(", ")}], recebeu: ${record.status}`
    );
  }

  // Validar datas se presentes
  if (record.completedAt && typeof record.completedAt === "string") {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(record.completedAt)) {
      errors.push("completedAt deve estar em ISO 8601.");
    }
  }
  if (record.executionDate && typeof record.executionDate === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.executionDate)) {
      errors.push("executionDate deve estar no formato YYYY-MM-DD.");
    }
  }

  return errors;
}

// ============================================================================
// DETECÇÃO DE CICLO DE DEPENDÊNCIA
// ============================================================================

/**
 * Detectar ciclo de dependência simples entre itens de protocolo.
 * Usa DFS (Depth-First Search) para detectar ciclos.
 *
 * Exemplo: protocolo A depende de B, B depende de C, C depende de A → ciclo detectado.
 */
export function detectDependencyCycle(items: SanitaryProtocolItemDomain[]): string[] {
  const errors: string[] = [];

  // Construir mapa de dependências por itemCode (simplificado para teste)
  const depMap = new Map<string, string | null>();
  for (const item of items) {
    const itemKey = item.identity.itemCode; // Use apenas itemCode como chave
    const dependency = item.schedule.dependsOnItemCode;
    depMap.set(itemKey, dependency || null);
  }

  // DFS para detectar ciclos
  function hasCycle(startKey: string, current: string, visited: Set<string>): boolean {
    if (visited.has(current)) {
      return true; // Ciclo detectado
    }

    const nextKey = depMap.get(current);
    if (!nextKey || !depMap.has(nextKey)) {
      return false; // Sem dependência ou dependência inexistente
    }

    visited.add(current);
    const result = hasCycle(startKey, nextKey, visited);
    visited.delete(current);

    return result;
  }

  // Verificar ciclo a partir de cada nó
  for (const startKey of depMap.keys()) {
    if (hasCycle(startKey, startKey, new Set())) {
      errors.push(`Ciclo de dependência detectado envolvendo: ${startKey}`);
    }
  }

  return errors;
}

// ============================================================================
// COMBINAÇÃO: VALIDAR CONJUNT DE ITENS
// ============================================================================

/**
 * Validar conjunto de itens de protocolo juntos.
 * Inclui detecção de ciclos e validação individual.
 */
export function validateSanitaryProtocolItemCollection(
  items: SanitaryProtocolItemDomain[],
): string[] {
  const errors: string[] = [];

  // Validar cada item individualmente
  for (const item of items) {
    const itemErrors = validateSanitaryItemDomain(item);
    errors.push(...itemErrors);
  }

  // Detectar ciclos de dependência
  const cycleErrors = detectDependencyCycle(items);
  errors.push(...cycleErrors);

  return errors;
}
