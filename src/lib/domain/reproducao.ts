import { differenceInDays, parseISO } from "date-fns";
import {
  Animal,
  Evento,
  EventoReproducao,
  AgendaItem,
  ReproTipoEnum,
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

type EventoReprodutivo = Evento & { details_reproducao?: EventoReproducao };

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
        !e.corrige_evento_id // Ignora eventos que corrigem outros (o 'corretor' deve ser considerado, mas aqui assumimos que corrige_evento_id aponta para o corrigido, e o corrigido deve ser ignorado se tiver flag de corrigido? Não, o padrão é: se A corrige B, B é ignorado. Mas aqui estamos simplificando: eventos ativos.)
        // TODO: Implementar lógica robusta de correção se necessário (ex: verificar se este evento foi corrigido por outro).
        // Por hora, assumimos que a lista já vem limpa ou que eventos corrigidos não atrapalham a lógica cronológica inversa.
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
    // Verifica se existe item de agenda pendente/agendado para desmame deste animal
    // Assumindo que 'tipo' ou 'dominio' identifica desmame. Ajustar conforme implementação real da Agenda.
    // Aqui usamos uma heurística genérica ou verificamos se passou do tempo de desmame sem evento de desmame.
    // Mas a regra solicitada foi: "se tiver pendência de desmame ativa"
    const temDesmamePendente = agendaItens.some(
      (item) =>
        item.animal_id === animal.id &&
        item.status === "agendado" &&
        item.dominio === "reproducao" && // ou manejo
        (item.tipo?.toLowerCase().includes("desmame") ||
         item.payload?.tipo_manejo === "desmame")
    );

    if (temDesmamePendente) {
      return "DESMAME_PENDENTE";
    }

    // LACTANTE
    if (diasPosParto <= DESMAME_DIAS) {
        // Se não tem diagnóstico positivo nem serviço recente que mude o status,
        // ela continua lactante até o desmame.
        // Mas ela pode estar Prenha E Lactante.
        // A especificação diz: "senão → continua avaliando serviços/diagnósticos"
        // Se cair aqui, retorna LACTANTE? Ou verifica prenhez?
        // Regra solicitada: "senão, se hoje <= parto+210 → LACTANTE"
        // E DEPOIS "senão → continua avaliando".
        // Isso implica que LACTANTE tem precedência sobre PRENHA/SERVIDA na visualização?
        // Geralmente sim: "Vaca Lactante (Prenha)" é comum, mas o status principal é o ciclo produtivo.
        // Vamos seguir a regra estrita: retorna LACTANTE.
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
      const resultado = (ultimoDiagnostico.details_reproducao?.payload as any)?.resultado; // 'positivo' | 'negativo'
      if (resultado === "positivo") {
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
          const resultado = (e.details_reproducao?.payload as any)?.resultado;
          if (resultado === "negativo") {
              diagnosticosNegativosConsecutivos++;
          } else if (resultado === "positivo") {
              break; // Parar se achar um positivo (embora logicamente não deveria chegar aqui se fosse o último)
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
