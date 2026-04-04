
import type { ReproTipoEnum } from "@/lib/offline/types";

// =========================================================
// ENUMS & CONSTANTS
// =========================================================

export type ReproLinkMethod = 
  | 'auto_A'  // Diagnostic linked to Service (Date match)
  | 'auto_B'  // Parto linked to Service (via Positive Diag or Open Service)
  | 'manual'  // User selected specific Service
  | 'orphan'  // Explicitly orphan (Block for Parto in V1, allow for Diag/Legacy)
  | 'legacy'; // Pre-V1 data

export type ReproStatus = 
  | 'VAZIA'             // Open / Empty (Default)
  | 'SERVIDA'           // Inseminated / Mated (Waiting for diagnosis)
  | 'PRENHA'            // Pregnant (Confirmed)
  | 'PARIDA_PUERPERIO'  // Calved recently (< 60 days)
  | 'PARIDA_ABERTA';    // Calved > 60 days (waiting for service)

export const PUERPERIO_DAYS = 60;

// =========================================================
// PAYLOAD V1 CONTRACT
// =========================================================

export interface ReproductionEventPayloadV1 {
  schema_version: 1;
  
  // Common Fields
  observacoes_estruturadas?: Record<string, unknown>;
  
  // Service Fields (Cobertura/IA)
  tecnica_livre?: string;        // IA / TETF / MN
  reprodutor_tag?: string;       // Tag visual do touro
  lote_semen?: string;           // Para IA
  dose_semen_ref?: string;       // Para IA
  
  // Diagnosis Fields
  resultado?: 'positivo' | 'negativo' | 'inconclusivo';
  data_prevista_parto?: string; // YYYY-MM-DD
  
  // Parto Fields
  data_parto_real?: string;     // YYYY-MM-DD
  numero_crias?: number;
  sexo_crias?: ('M'|'F')[];     // Array de sexos
  
  // Linking / Episode Management
  episode_evento_id?: string | null; // ID do evento de SERVIÇO (Root do episódio)
  episode_link_method?: ReproLinkMethod;
}

// Helper to check for V1
export function isPayloadV1(
  payload: unknown,
): payload is ReproductionEventPayloadV1 {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "schema_version" in payload &&
    payload.schema_version === 1
  );
}
