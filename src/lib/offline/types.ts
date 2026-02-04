export type GestureStatus = 'PENDING' | 'SYNCING' | 'DONE' | 'ERROR';
export type OpAction = 'INSERT' | 'UPDATE' | 'DELETE';

export interface Animal {
  id: string;
  fazenda_id: string;
  identificacao: string;
  sexo: 'M' | 'F';
  status: string;
  lote_id: string | null; // Explicitamente nullable
  rfid?: string;
  nascimento_data?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// ... (restante dos tipos Operation, Gesture, Rejection permanecem iguais)