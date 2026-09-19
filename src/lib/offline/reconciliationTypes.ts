export type ReconciliationScope =
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
}
