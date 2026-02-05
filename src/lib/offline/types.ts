export type GestureStatus = 'PENDING' | 'SYNCING' | 'DONE' | 'ERROR' | 'SYNCED' | 'REJECTED';
export type OpAction = 'INSERT' | 'UPDATE' | 'DELETE';

export interface Animal {
  id: string;
  fazenda_id: string;
  identificacao: string;
  sexo: 'M' | 'F';
  status: string;
  lote_id: string | null;
  rfid?: string;
  nascimento_data?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Operation {
  client_op_id: string;
  client_tx_id: string;
  table: string;
  action: OpAction;
  /**
   * Generic record data. Shape depends on the target table.
   * Cannot be more specific without breaking operation flexibility.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: any;
  /**
   * Pre-modification snapshot for rollback.
   * Stored as-is from Dexie for idempotent rollback.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  before_snapshot?: any;
  created_at: string;
}

/**
 * OperationInput is used when creating gestures.
 * The fields client_op_id, client_tx_id, and created_at
 * are automatically added by createGesture().
 */
export type OperationInput = Omit<Operation, 'client_op_id' | 'client_tx_id' | 'created_at'>;

export interface Gesture {
  client_tx_id: string;
  fazenda_id: string;
  client_id: string;
  status: GestureStatus;
  last_error?: string;
  retry_count?: number; // P1.3: For exponential backoff retry strategy
  created_at: string;
}

export interface Rejection {
  id?: number;
  client_tx_id: string;
  client_op_id: string;
  fazenda_id: string;
  table: string;
  action: string;
  reason_code: string;
  reason_message: string;
  created_at: string;
}