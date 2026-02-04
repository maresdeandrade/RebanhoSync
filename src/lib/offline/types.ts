export type GestureStatus = 'PENDING' | 'SYNCING' | 'DONE' | 'ERROR';
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
  record: any;
  before_snapshot?: any;
  created_at: string;
}

export interface Gesture {
  client_tx_id: string;
  fazenda_id: string;
  client_id: string;
  status: GestureStatus;
  last_error?: string;
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