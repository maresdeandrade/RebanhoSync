import { requireSanitaryAdmissionV3 } from "@/lib/sanitario/execution/sanitaryAdmissionV3";
import type { PostgrestError } from "@supabase/supabase-js";
import type { SanitarioTipoEnum } from "@/lib/offline/types";
import { supabase } from "@/lib/supabase";

const throwIfError = (error: PostgrestError | null) => {
  if (!error) return;
  throw new Error(error.message);
};

export interface ConcluirPendenciaSanitariaInput {
  agendaItemId: string;
  occurredAt?: string;
  tipo?: SanitarioTipoEnum;
  produto?: string;
  observacoes?: string | null;
  payload?: Record<string, unknown>;
  clientId?: string;
  clientOpId?: string;
  clientTxId?: string | null;
  clientRecordedAt?: string;
}

export interface SanitarioPendenciaRow {
  agenda_item_id: string;
  fazenda_id: string;
  animal_id: string | null;
  animal_identificacao: string | null;
  animal_nome: string | null;
  data_prevista: string;
  dias_em_atraso: number;
  agenda_tipo: string;
  sanitario_tipo: SanitarioTipoEnum | null;
  produto: string | null;
  protocolo_id: string | null;
  protocolo_nome: string | null;
  dose_num: number;
  intervalo_dias: number | null;
}

export interface SanitarioHistoricoRow {
  evento_id: string;
  fazenda_id: string;
  animal_id: string | null;
  animal_identificacao: string | null;
  animal_nome: string | null;
  occurred_at: string;
  occurred_on: string;
  agenda_item_id: string | null;
  sanitario_tipo: SanitarioTipoEnum;
  produto: string;
  protocolo_id: string | null;
  protocolo_nome: string | null;
  dose_num: number;
}

export interface SanitarioUpcomingRow {
  agenda_item_id: string;
  fazenda_id: string;
  animal_id: string | null;
  animal_identificacao: string | null;
  animal_nome: string | null;
  data_prevista: string;
  dias_para_vencimento: number;
  sanitario_tipo: SanitarioTipoEnum | null;
  produto: string | null;
  protocolo_id: string | null;
  protocolo_nome: string | null;
  dose_num: number;
}

export const concluirPendenciaSanitaria = async (
  input: ConcluirPendenciaSanitariaInput,
): Promise<string> => {
  requireSanitaryAdmissionV3({ intent: "agenda_execution", fazendaId: "", agendaId: input.agendaItemId,
    clientOpId: input.clientOpId ?? "", clientTxId: input.clientTxId ?? "", domainOpId: "", payload: {} });
  throw new Error("SANITARIO_V3_EXECUTION_NOT_ENABLED");
};

export const fetchSanitarioPendencias = async (
  fazendaId: string,
  options?: { animalId?: string; onlyOverdue?: boolean; limit?: number },
): Promise<SanitarioPendenciaRow[]> => {
  let query = supabase
    .from("vw_sanitario_pendencias")
    .select("*")
    .eq("fazenda_id", fazendaId);

  if (options?.animalId) {
    query = query.eq("animal_id", options.animalId);
  }
  if (options?.onlyOverdue) {
    query = query.gt("dias_em_atraso", 0);
  }

  const { data, error } = await query
    .order("data_prevista", { ascending: true })
    .limit(options?.limit ?? 500);

  throwIfError(error);
  return (data ?? []) as SanitarioPendenciaRow[];
};

export const fetchSanitarioHistorico = async (
  fazendaId: string,
  options?: { animalId?: string; limit?: number },
): Promise<SanitarioHistoricoRow[]> => {
  let query = supabase
    .from("vw_sanitario_historico")
    .select("*")
    .eq("fazenda_id", fazendaId);

  if (options?.animalId) {
    query = query.eq("animal_id", options.animalId);
  }

  const { data, error } = await query
    .order("occurred_at", { ascending: false })
    .limit(options?.limit ?? 500);

  throwIfError(error);
  return (data ?? []) as SanitarioHistoricoRow[];
};

export const fetchSanitarioUpcoming = async (
  fazendaId: string,
  options?: { animalId?: string; limit?: number },
): Promise<SanitarioUpcomingRow[]> => {
  let query = supabase
    .from("vw_sanitario_upcoming")
    .select("*")
    .eq("fazenda_id", fazendaId);

  if (options?.animalId) {
    query = query.eq("animal_id", options.animalId);
  }

  const { data, error } = await query
    .order("data_prevista", { ascending: true })
    .limit(options?.limit ?? 500);

  throwIfError(error);
  return (data ?? []) as SanitarioUpcomingRow[];
};
