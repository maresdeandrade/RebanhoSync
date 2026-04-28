/**
 * Resolução de Data de Ancoragem (Anchor Date)
 *
 * Para cada modo de calendário, determina a data de referência que
 * serve como ponto de partida para cálculos de janela, intervalo, etc.
 *
 * Contrato: Função é pura, sem I/O. History é passado de fora.
 */

import type {
  SanitaryProtocolItemDomain,
  SanitarySubjectContext,
  SanitaryExecutionRecord,
  SanitaryCalendarAnchor,
} from "@/lib/sanitario/models/domain";

/**
 * Resolve data de ancoragem conforme tipo de âncora.
 *
 * @param anchor - tipo de âncora (nascimento, entrada_fazenda, etc.)
 * @param subject - contexto do animal/lote/fazenda
 * @param history - histórico de execução de protocolos (eventos)
 * @returns ISO string (YYYY-MM-DD) ou null se não conseguir resolver
 */
export function resolveAnchorDate(
  anchor: SanitaryCalendarAnchor,
  subject: SanitarySubjectContext,
  history: SanitaryExecutionRecord[],
): string | null {
  switch (anchor) {
    case "sem_ancora":
      // Sem âncora = sem data de referência
      return null;

    case "nascimento":
      // Âncora = data de nascimento do animal
      if (subject.animal?.birthDate) {
        return normalizeToYYYYMMDD(subject.animal.birthDate);
      }
      return null;

    case "entrada_fazenda":
      // Âncora = primeira entrada na fazenda
      return findFirstEntryDate(subject.scopeId, history);

    case "desmama":
      // Âncora = data de desmama (buscar em history ou estimar)
      return findWeaningDate(subject.scopeId, history);

    case "parto_previsto":
      // Âncora = data prevista de parto (se prenhe)
      if (subject.animal?.payload?.taxonomy_facts?.data_prevista_parto) {
        return normalizeToYYYYMMDD(subject.animal.payload.taxonomy_facts.data_prevista_parto);
      }
      return null;

    case "conclusao_etapa_dependente":
      // Âncora = conclusão de protocolo dependente
      // Nota: a função chamadora deve passar dependsOnItemCode para busca
      // Esta função assume lookup via history (genérico)
      return findLastCompletion(subject.scopeId, history);

    case "ultima_conclusao_mesma_familia":
      // Âncora = última execução de outro item na mesma família
      // Nota: assumir que history contém execuções da mesma família
      return findLastFamilyCompletion(subject.scopeId, history);

    case "movimentacao":
      // Âncora = última movimentação registrada
      return findLastMovementDate(subject.scopeId, history);

    case "diagnostico_evento":
      // Âncora = data de diagnóstico de evento (ex: mastite)
      return findEventDiagnosisDate(subject.scopeId, history);

    case "recem_parida":
      // Âncora = data de último parto registrado
      if (subject.animal?.payload?.taxonomy_facts?.data_ultimo_parto) {
        return normalizeToYYYYMMDD(subject.animal.payload.taxonomy_facts.data_ultimo_parto);
      }
      return null;

    default:
      return null;
  }
}

/**
 * Normaliza data para formato YYYY-MM-DD.
 * Aceita: ISO string (2026-07-01), ISO datetime (2026-07-01T10:30), timestamp.
 */
function normalizeToYYYYMMDD(dateValue: string | number | Date): string | null {
  try {
    let dateObj: Date;

    if (typeof dateValue === "string") {
      // ISO string ou ISO datetime
      dateObj = new Date(dateValue);
    } else if (typeof dateValue === "number") {
      // timestamp em ms
      dateObj = new Date(dateValue);
    } else if (dateValue instanceof Date) {
      dateObj = dateValue;
    } else {
      return null;
    }

    if (isNaN(dateObj.getTime())) {
      return null;
    }

    // Retornar em UTC (não considerar timezone local)
    const year = dateObj.getUTCFullYear();
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dateObj.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

/**
 * Busca primeira data de entrada na fazenda (entry event).
 */
function findFirstEntryDate(scopeId: string, history: SanitaryExecutionRecord[]): string | null {
  // Buscar no histórico por evento de "entrada_fazenda" ou similar
  // Por simplicidade, retornar data mais antiga
  const entries = history.filter(
    (h) => h.scopeId === scopeId && h.familyCode?.toLowerCase().includes("entrada"),
  );

  if (entries.length === 0) return null;

  // Ordenar por data e pegar primeira
  const sorted = entries.sort((a, b) => {
    const dateA = a.executionDate || a.completedAt || "";
    const dateB = b.executionDate || b.completedAt || "";
    return dateA.localeCompare(dateB);
  });

  return sorted[0]?.executionDate || sorted[0]?.completedAt || null;
}

/**
 * Busca data de desmama (weaning event).
 */
function findWeaningDate(scopeId: string, history: SanitaryExecutionRecord[]): string | null {
  const weaningEvents = history.filter(
    (h) => h.scopeId === scopeId && h.familyCode?.toLowerCase().includes("desmama"),
  );

  if (weaningEvents.length === 0) return null;

  // Retornar última desmama
  const sorted = weaningEvents.sort((a, b) => {
    const dateA = a.executionDate || a.completedAt || "";
    const dateB = b.executionDate || b.completedAt || "";
    return dateB.localeCompare(dateA); // Descentildo para pegar a mais recente
  });

  return sorted[0]?.executionDate || sorted[0]?.completedAt || null;
}

/**
 * Busca última conclusão de protocolo.
 */
function findLastCompletion(scopeId: string, history: SanitaryExecutionRecord[]): string | null {
  const completions = history.filter((h) => h.scopeId === scopeId && h.status === "completed");

  if (completions.length === 0) return null;

  // Ordenar por data (mais recente primeiro)
  const sorted = completions.sort((a, b) => {
    const dateA = a.completedAt || a.executionDate || "";
    const dateB = b.completedAt || b.executionDate || "";
    return dateB.localeCompare(dateA);
  });

  return sorted[0]?.completedAt || sorted[0]?.executionDate || null;
}

/**
 * Busca última conclusão de outro item na mesma família.
 */
function findLastFamilyCompletion(scopeId: string, history: SanitaryExecutionRecord[]): string | null {
  const familyCompletions = history.filter((h) => h.scopeId === scopeId && h.status === "completed");

  if (familyCompletions.length === 0) return null;

  // Ordenar por data (mais recente primeiro)
  const sorted = familyCompletions.sort((a, b) => {
    const dateA = a.completedAt || a.executionDate || "";
    const dateB = b.completedAt || b.executionDate || "";
    return dateB.localeCompare(dateA);
  });

  return sorted[0]?.completedAt || sorted[0]?.executionDate || null;
}

/**
 * Busca última data de movimentação (movement event).
 */
function findLastMovementDate(scopeId: string, history: SanitaryExecutionRecord[]): string | null {
  const movements = history.filter(
    (h) => h.scopeId === scopeId && h.familyCode?.toLowerCase().includes("movimenta"),
  );

  if (movements.length === 0) return null;

  // Ordenar por data (mais recente primeiro)
  const sorted = movements.sort((a, b) => {
    const dateA = a.executionDate || a.completedAt || "";
    const dateB = b.executionDate || b.completedAt || "";
    return dateB.localeCompare(dateA);
  });

  return sorted[0]?.executionDate || sorted[0]?.completedAt || null;
}

/**
 * Busca data de diagnóstico de evento (event diagnosis).
 */
function findEventDiagnosisDate(scopeId: string, history: SanitaryExecutionRecord[]): string | null {
  // Buscar por eventos de diagnóstico
  const diagnoses = history.filter(
    (h) =>
      h.scopeId === scopeId &&
      (h.familyCode?.toLowerCase().includes("diagnos") || h.familyCode?.toLowerCase().includes("evento")),
  );

  if (diagnoses.length === 0) return null;

  // Ordenar por data (mais recente primeiro)
  const sorted = diagnoses.sort((a, b) => {
    const dateA = a.executionDate || a.completedAt || "";
    const dateB = b.executionDate || b.completedAt || "";
    return dateB.localeCompare(dateA);
  });

  return sorted[0]?.executionDate || sorted[0]?.completedAt || null;
}

/**
 * Calcula diferença em dias entre duas datas ISO (YYYY-MM-DD).
 */
export function daysBetween(dateA: string, dateB: string): number {
  try {
    const a = new Date(dateA);
    const b = new Date(dateB);

    if (isNaN(a.getTime()) || isNaN(b.getTime())) {
      return 0;
    }

    const diffMs = Math.abs(b.getTime() - a.getTime());
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

/**
 * Adiciona dias a uma data ISO (YYYY-MM-DD).
 */
export function addDays(dateIso: string, days: number): string | null {
  try {
    const date = new Date(dateIso);

    if (isNaN(date.getTime())) {
      return null;
    }

    date.setUTCDate(date.getUTCDate() + days);

    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}
