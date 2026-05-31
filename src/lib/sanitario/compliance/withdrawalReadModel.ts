import type { ProdutoInsumoSnapshot } from "@/lib/inventory/snapshotBuilder";

export type WithdrawalStatus =
  | "sem_evento_sanitario"
  | "sem_snapshot"
  | "sem_carencia_configurada"
  | "carencia_ativa"
  | "carencia_expirada"
  | "carencia_indeterminada"
  | "parcial";

export interface WithdrawalItem {
  status: WithdrawalStatus;
  inicio?: string;          // YYYY-MM-DD
  fim?: string;             // YYYY-MM-DD
  dias?: number;
  produtoNome?: string;
  principioAtivo?: string | null;
  eventId?: string;
  source: "event_sanitario_snapshot";
  limitations: string[];
}

export interface WithdrawalReadModel {
  targetType: "animal" | "lote";
  targetId: string;
  status: WithdrawalStatus;
  carne?: WithdrawalItem;
  leite?: WithdrawalItem;
  evaluatedAt: string;     // ISO timestamp
}

export interface SanitaryEventInputForReadModel {
  id: string;
  animal_id: string | null;
  lote_id: string | null;
  occurred_at: string;     // ISO String
  deleted_at?: string | null;
  produto: string;         // Nome textual informado
  carencia_carne_dias?: number | null;
  carencia_leite_dias?: number | null;
  carencia_carne_ate?: string | null;
  carencia_leite_ate?: string | null;
  payload?: {
    insumo_snapshot?: ProdutoInsumoSnapshot | null;
    carencia_regra_json?: {
      carne_dias?: number | null;
      leite_dias?: number | null;
    } | null;
  } | null;
}

/**
 * Soma dias a uma data nominal "YYYY-MM-DD" de forma pura, usando UTC
 * para evitar qualquer translacao ou deslocamento de fuso local.
 */
export function addDaysNominal(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

/**
 * Extrai a data nominal "YYYY-MM-DD" de uma string ISO ajustada para o fuso
 * 'America/Sao_Paulo' para garantir paridade absoluta com a view Postgres.
 */
export function getNominalDate(isoStr: string): string {
  try {
    const date = new Date(isoStr);
    if (Number.isFinite(date.getTime())) {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const parts = formatter.formatToParts(date);
      const year = parts.find((p) => p.type === "year")?.value;
      const month = parts.find((p) => p.type === "month")?.value;
      const day = parts.find((p) => p.type === "day")?.value;
      if (year && month && day) {
        return `${year}-${month}-${day}`;
      }
    }
  } catch {
    // fallback se falhar
  }
  return isoStr.split("T")[0];
}

/**
 * Calcula a carencia de uma modalidade especifica (carne ou leite) para um unico evento sanitario.
 */
function evaluateEventModalidade(
  event: SanitaryEventInputForReadModel,
  modalidade: "carne" | "leite",
  referenceDateStr: string,
): WithdrawalItem {
  const insumoSnapshot = event.payload?.insumo_snapshot;
  const nominalDate = getNominalDate(event.occurred_at);
  const structuredDias =
    modalidade === "carne"
      ? event.carencia_carne_dias
      : event.carencia_leite_dias;
  const structuredFim =
    modalidade === "carne"
      ? event.carencia_carne_ate
      : event.carencia_leite_ate;

  if (typeof structuredDias === "number" && structuredDias > 0 && structuredFim) {
    const fim = structuredFim.split("T")[0];
    const isAtiva = referenceDateStr <= fim;
    return {
      status: isAtiva ? "carencia_ativa" : "carencia_expirada",
      inicio: nominalDate,
      fim,
      dias: structuredDias,
      produtoNome: event.produto,
      eventId: event.id,
      source: "event_sanitario_snapshot",
      limitations: [],
    };
  }

  if (structuredDias === null || structuredDias === 0) {
    return {
      status: "sem_carencia_configurada",
      produtoNome: event.produto,
      source: "event_sanitario_snapshot",
      limitations: [],
    };
  }

  // 1. Caso sem snapshot (evento antigo)
  if (!insumoSnapshot) {
    return {
      status: "sem_snapshot",
      source: "event_sanitario_snapshot",
      limitations: ["Evento sem campos estruturados de carencia"],
    };
  }

  // 2. Extrai dias e limitações do snapshot novo
  const dias =
    modalidade === "carne"
      ? insumoSnapshot.carencia_carne_dias_snapshot
      : insumoSnapshot.carencia_leite_dias_snapshot;

  const productLabel = insumoSnapshot.produto_nome_snapshot || event.produto;
  const limitations = insumoSnapshot.limitacoes ? [...insumoSnapshot.limitacoes] : [];

  // Se a rastreabilidade do snapshot for parcial, adiciona às limitações
  if (insumoSnapshot.rastreabilidade === "parcial") {
    limitations.push("Rastreabilidade parcial (lote ou custo unitario ausente)");
  }

  // 3. Caso produto cadastrado manualmente/livre
  if (insumoSnapshot.rastreabilidade === "manual") {
    return {
      status: "carencia_indeterminada",
      produtoNome: productLabel,
      source: "event_sanitario_snapshot",
      limitations: ["Produto manual/livre sem vinculo estruturado de catalogo"],
    };
  }

  // 4. Caso sem carencia configurada
  if (dias === undefined || dias === null || dias <= 0) {
    return {
      status: "sem_carencia_configurada",
      produtoNome: productLabel,
      principioAtivo: insumoSnapshot.principio_ativo_snapshot ?? null,
      source: "event_sanitario_snapshot",
      limitations,
    };
  }

  // 5. Caso carencia ativa ou expirada
  const fim = addDaysNominal(nominalDate, dias);
  const isAtiva = referenceDateStr <= fim;

  return {
    status: isAtiva ? "carencia_ativa" : "carencia_expirada",
    inicio: nominalDate,
    fim,
    dias,
    produtoNome: productLabel,
    principioAtivo: insumoSnapshot.principio_ativo_snapshot ?? null,
    eventId: event.id,
    source: "event_sanitario_snapshot",
    limitations: insumoSnapshot.rastreabilidade === "parcial" ? ["parcial", ...limitations] : limitations,
  };
}

/**
 * Consolida multiplas avaliacoes de carencias de eventos para uma modalidade,
 * prevalecendo a de maior data final estimada para carencia ativa.
 */
function consolidateModalidade(
  items: WithdrawalItem[],
): WithdrawalItem {
  if (items.length === 0) {
    return {
      status: "sem_evento_sanitario",
      source: "event_sanitario_snapshot",
      limitations: [],
    };
  }

  // Filtrar ativas
  const activeItems = items.filter((item) => item.status === "carencia_ativa" && item.fim);

  if (activeItems.length > 0) {
    // A maior data de expiração (fim) prevalece
    activeItems.sort((a, b) => b.fim!.localeCompare(a.fim!));
    const winner = activeItems[0];
    
    // Junta as limitações dos itens ativos sem duplicar
    const allLimitations = Array.from(
      new Set(activeItems.flatMap((i) => i.limitations)),
    );

    return {
      ...winner,
      limitations: allLimitations,
    };
  }

  // Se não houver ativas, verificar indeterminadas
  const indeterminate = items.find((item) => item.status === "carencia_indeterminada");
  if (indeterminate) return indeterminate;

  // Se não houver indeterminadas, verificar expiradas
  const expiredItems = items.filter((item) => item.status === "carencia_expirada" && item.fim);
  if (expiredItems.length > 0) {
    expiredItems.sort((a, b) => b.fim!.localeCompare(a.fim!)); // pega o de maior fim nominal
    return expiredItems[0];
  }

  // Verificar sem carencia configurada
  const noConfig = items.find((item) => item.status === "sem_carencia_configurada");
  if (noConfig) return noConfig;

  // Verificar sem snapshot
  const noSnapshot = items.find((item) => item.status === "sem_snapshot");
  if (noSnapshot) return noSnapshot;

  return {
    status: "sem_evento_sanitario",
    source: "event_sanitario_snapshot",
    limitations: [],
  };
}

/**
 * Computa o read model de carencia assistiva de um unico Animal a partir dos seus eventos.
 */
export function computeAnimalWithdrawal(
  animalId: string,
  events: SanitaryEventInputForReadModel[],
  referenceDateStr: string,
): WithdrawalReadModel {
  // Ignora eventos soft-deletados
  const activeEvents = events.filter((e) => !e.deleted_at && e.animal_id === animalId);

  const carneEvaluations = activeEvents.map((e) =>
    evaluateEventModalidade(e, "carne", referenceDateStr),
  );
  const leiteEvaluations = activeEvents.map((e) =>
    evaluateEventModalidade(e, "leite", referenceDateStr),
  );

  const carne = consolidateModalidade(carneEvaluations);
  const leite = consolidateModalidade(leiteEvaluations);

  // Consolida o status do animal
  let status: WithdrawalStatus = "sem_evento_sanitario";
  if (carne.status === "carencia_ativa" || leite.status === "carencia_ativa") {
    status = "carencia_ativa";
  } else if (carne.status === "carencia_indeterminada" || leite.status === "carencia_indeterminada") {
    status = "carencia_indeterminada";
  } else if (carne.status === "carencia_expirada" || leite.status === "carencia_expirada") {
    status = "carencia_expirada";
  } else if (carne.status === "sem_carencia_configurada" || leite.status === "sem_carencia_configurada") {
    status = "sem_carencia_configurada";
  } else if (carne.status === "sem_snapshot" || leite.status === "sem_snapshot") {
    status = "sem_snapshot";
  }

  return {
    targetType: "animal",
    targetId: animalId,
    status,
    carne,
    leite,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Computa o read model de carencia combinada de um Lote a partir dos read models de seus animais ativos.
 */
export function computeLoteWithdrawal(
  loteId: string,
  animalReadModels: WithdrawalReadModel[],
): WithdrawalReadModel {
  if (animalReadModels.length === 0) {
    return {
      targetType: "lote",
      targetId: loteId,
      status: "sem_evento_sanitario",
      carne: { status: "sem_evento_sanitario", source: "event_sanitario_snapshot", limitations: [] },
      leite: { status: "sem_evento_sanitario", source: "event_sanitario_snapshot", limitations: [] },
      evaluatedAt: new Date().toISOString(),
    };
  }

  const carneItems = animalReadModels.map((arm) => arm.carne).filter((c): c is WithdrawalItem => !!c);
  const leiteItems = animalReadModels.map((arm) => arm.leite).filter((l): l is WithdrawalItem => !!l);

  const carne = consolidateModalidade(carneItems);
  const leite = consolidateModalidade(leiteItems);

  let status: WithdrawalStatus = "sem_evento_sanitario";
  if (carne.status === "carencia_ativa" || leite.status === "carencia_ativa") {
    status = "carencia_ativa";
  } else if (carne.status === "carencia_indeterminada" || leite.status === "carencia_indeterminada") {
    status = "carencia_indeterminada";
  } else if (carne.status === "carencia_expirada" || leite.status === "carencia_expirada") {
    status = "carencia_expirada";
  } else if (carne.status === "sem_carencia_configurada" || leite.status === "sem_carencia_configurada") {
    status = "sem_carencia_configurada";
  } else if (carne.status === "sem_snapshot" || leite.status === "sem_snapshot") {
    status = "sem_snapshot";
  }

  return {
    targetType: "lote",
    targetId: loteId,
    status,
    carne,
    leite,
    evaluatedAt: new Date().toISOString(),
  };
}
