import type { PostgrestError } from "@supabase/supabase-js";
import type { SanitarioTipoEnum } from "@/lib/offline/types";
import { supabase } from "@/lib/supabase";

const CLIENT_ID_STORAGE_KEY = "gestao_agro_client_id";
const FALLBACK_CLIENT_ID_PREFIX = "browser";

const getClientId = (): string => {
  const storage = globalThis.localStorage;
  if (!storage) {
    return `${FALLBACK_CLIENT_ID_PREFIX}:${crypto.randomUUID()}`;
  }

  const existing = storage.getItem(CLIENT_ID_STORAGE_KEY);
  if (existing) return existing;

  const next = `${FALLBACK_CLIENT_ID_PREFIX}:${crypto.randomUUID()}`;
  storage.setItem(CLIENT_ID_STORAGE_KEY, next);
  return next;
};

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
  const clientRecordedAt = input.clientRecordedAt ?? new Date().toISOString();
  const occurredAt = input.occurredAt ?? clientRecordedAt;
  const clientOpId = input.clientOpId ?? crypto.randomUUID();

  const { data, error } = await supabase.rpc(
    "sanitario_complete_agenda_with_event",
    {
      _agenda_item_id: input.agendaItemId,
      _occurred_at: occurredAt,
      _tipo: input.tipo ?? null,
      _produto: input.produto?.trim() || null,
      _observacoes: input.observacoes ?? null,
      _sanitario_payload: input.payload ?? {},
      _client_id: input.clientId ?? getClientId(),
      _client_op_id: clientOpId,
      _client_tx_id: input.clientTxId ?? null,
      _client_recorded_at: clientRecordedAt,
    },
  );

  throwIfError(error);

  if (!data || typeof data !== "string") {
    throw new Error("RPC sanitario_complete_agenda_with_event retornou vazio.");
  }

  return data;
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
