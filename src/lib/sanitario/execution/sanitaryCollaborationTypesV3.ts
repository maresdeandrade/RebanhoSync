import type { ManageAgendaOperation } from "../../../../supabase/functions/sync-batch/sanitario-v2";
export type SanitaryActionV3 = ManageAgendaOperation["payload"]["action"];
export interface SanitaryParticipationV3 {
  id: string;
  fazenda_id: string;
  agenda_id: string;
  actor_user_id: string;
  client_id: string;
  final_sequence: number | null;
  created_at: string;
  updated_at: string;
}
export interface SanitaryParticipationDraftV3 {
  id: string;
  fazenda_id: string;
  agenda_id: string;
  actor_user_id: string;
  client_id: string;
  sequence: number;
  completed: boolean;
  superseded?: boolean;
}
export interface SanitaryDeclarationV3 {
  id: string;
  fazenda_id: string;
  agenda_id: string;
  participation_id: string;
  sequence: number;
  declaration: Record<string, unknown>;
  outcome: "confirmed" | "collision" | "late" | "dependency";
  evento_id: string | null;
  resolution: {
    decision: string;
    reason: string;
    evento_id?: string | null;
  } | null;
}
export interface SanitaryResultV3 {
  id: string;
  fazenda_id: string;
  agenda_id: string;
  revision: number;
  previous_result_id: string | null;
  snapshot: {
    animals: {
      animal_id: string;
      planned_status: string;
      execution_evento_id: string | null;
      not_executed_reason: string | null;
    }[];
    events: { evento_id: string; confirmation: string; animals: string[] }[];
  };
}
export interface SanitaryContinuationV3 {
  id: string;
  fazenda_id: string;
  agenda_id: string;
  result_id: string;
  reason: string;
  animals: { animal_id: string; reason: string }[];
  decision: "approved" | "rejected" | null;
  decision_reason: string | null;
  continuation_id: string | null;
}
