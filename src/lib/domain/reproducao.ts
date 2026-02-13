import { differenceInDays, parseISO } from "date-fns";
import {
  Animal,
  Evento,
  EventoReproducao,
  AgendaItem,
} from "@/lib/offline/types";

export type StatusReprodutivo =
  | "VAZIA"
  | "SERVIDA"
  | "PRENHA"
  | "PARIDA"
  | "LACTANTE"
  | "REPETIDORA"
  | "DESMAME_PENDENTE";

export const PUERPERIO_DIAS = 45;
export const DESMAME_DIAS = 210;

// Tipos para Payloads de Eventos Reprodutivos
interface DiagnosticoPayload {
    resultado?: "positivo" | "negativo";
}

interface AgendaPayload {
    tipo_manejo?: string;
}

/**
 * Calcula o Status Reprodutivo de um animal baseado em seu histórico de eventos.
 *
 * Lógica:
 * 1. Filtra eventos reprodutivos do animal.
 * 2. Remove eventos corrigidos (corrige_evento_id).
 * 3. Ordena por data decrescente.
 * 4. Aplica regras de precedência (Parto -> Diagnóstico -> Serviço).
 */
export function calcularStatusReprodutivo(
  animal: Animal,
  eventos: EventoWithReproDetails[],
  agendaItens: AgendaItem[] = []
): StatusReprodutivo {
  // Apenas fêmeas têm status reprodutivo relevante neste contexto
  if (animal.sexo !== "F") return "VAZIA";

  const hoje = new Date();

  // 1. Filtrar e Preparar Eventos
  const eventosRepro = eventos
    .filter(
      (e) =>
        e.animal_id === animal.id &&
        e.dominio === "reproducao" &&
        !e.corrige_evento_id // Ignora eventos que corrigem outros
    )
    .sort((a, b) => {
        const dateA = new Date(a.occurred_at).getTime();
        const dateB = new Date(b.occurred_at).getTime();
        return dateB - dateA; // Descending
    });

  // Encontrar eventos chave
  const ultimoParto = eventosRepro.find(
    (e) => e.details_reproducao?.tipo === "parto"
  );

  // Se tiver parto, avaliar status pós-parto
  if (ultimoParto) {
    const dataParto = parseISO(ultimoParto.occurred_at);
    const diasPosParto = differenceInDays(hoje, dataParto);

    // PARIDA (Puerpério)
    if (diasPosParto <= PUERPERIO_DIAS) {
      return "PARIDA";
    }

    // DESMAME PENDENTE (Agenda)
    const temDesmamePendente = agendaItens.some(
      (item) => {
          const payload = item.payload as AgendaPayload;
          return item.animal_id === animal.id &&
                 item.status === "agendado" &&
                 item.dominio === "reproducao" && // ou manejo
                 (item.tipo?.toLowerCase().includes("desmame") ||
                  payload?.tipo_manejo === "desmame");
      }
    );

    if (temDesmamePendente) {
      return "DESMAME_PENDENTE";
    }

    // LACTANTE
    if (diasPosParto <= DESMAME_DIAS) {
        return "LACTANTE";
    }
  }

  // Avaliar Diagnósticos e Serviços (após o último parto, se houver)
  const dataCorte = ultimoParto ? parseISO(ultimoParto.occurred_at) : new Date(0);

  const eventosPosParto = eventosRepro.filter(
    (e) => new Date(e.occurred_at) > dataCorte
  );

  const ultimoDiagnostico = eventosPosParto.find(
      (e) => e.details_reproducao?.tipo === "diagnostico"
  );

  // PRENHA
  if (ultimoDiagnostico) {
      const payload = ultimoDiagnostico.details_reproducao?.payload as DiagnosticoPayload;
      if (payload?.resultado === "positivo") {
          return "PRENHA";
      }
      // Se negativo, continua para verificar serviços posteriores ou cai em VAZIA/REPETIDORA
  }

  // SERVIDA
  const ultimoServico = eventosPosParto.find(
      (e) => e.details_reproducao?.tipo === "cobertura" || e.details_reproducao?.tipo === "IA"
  );

  if (ultimoServico) {
      // Se o serviço for mais recente que o último diagnóstico (ou se não houver diagnóstico)
      if (!ultimoDiagnostico || new Date(ultimoServico.occurred_at) > new Date(ultimoDiagnostico.occurred_at)) {
          return "SERVIDA";
      }
  }

  // REPETIDORA
  // Contar diagnósticos negativos consecutivos após o último parto
  let diagnosticosNegativosConsecutivos = 0;
  for (const e of eventosPosParto) {
      if (e.details_reproducao?.tipo === "diagnostico") {
          const payload = e.details_reproducao?.payload as DiagnosticoPayload;
          if (payload?.resultado === "negativo") {
              diagnosticosNegativosConsecutivos++;
          } else if (payload?.resultado === "positivo") {
              break; // Parar se achar um positivo
          }
      }
  }

  if (diagnosticosNegativosConsecutivos >= 2) {
      return "REPETIDORA";
  }

  return "VAZIA";
}

// Helper type para eventos com detalhes
export interface EventoWithReproDetails extends Evento {
  details_reproducao?: EventoReproducao;
}
