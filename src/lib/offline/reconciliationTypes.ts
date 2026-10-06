export type ReconciliationScope =
  | "movement-v1"
  | "factual"
  | "sanitario-v2"
  | "agenda-v2"
  | "reproduction";

export interface ReconciliationObligation {
  key: string;
  fazenda_id: string;
  scope: ReconciliationScope;
  tables?: string[];
  generation_id: string;
  created_at: string;
  updated_at: string;
  diagnostics?: {
    origins: { client_tx_id: string; client_op_ids: string[] }[];
    drain_attempts?: number;
    last_attempt_at?: string;
    last_error_at?: string;
    last_error?: { code: string; message: string };
  };
}

export interface GestureDiagnostics {
  client_op_ids?: string[];
  last_attempt_started_at?: string;
  result_received_at?: string;
  ack_installed_at?: string;
  blocked?: { code: "AUTH_UNAVAILABLE"; observed_at: string };
  reconciliation?: {
    key: string;
    scope: ReconciliationScope;
    generation_id: string;
    required_at: string;
    completed_at?: string;
  }[];
}
