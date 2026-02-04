import Dexie, { type Table } from 'dexie';
import { Gesture, Operation, Rejection } from './types';

export class OfflineDB extends Dexie {
  // State (Cópia local para leitura)
  state_animais!: Table<any>;
  state_lotes!: Table<any>;
  state_pastos!: Table<any>;
  state_agenda_itens!: Table<any>;
  state_contrapartes!: Table<any>;
  state_protocolos_sanitarios!: Table<any>;
  state_protocolos_sanitarios_itens!: Table<any>;

  // Events (Log local)
  event_eventos!: Table<any>;
  event_eventos_sanitario!: Table<any>;
  event_eventos_pesagem!: Table<any>;
  event_eventos_nutricao!: Table<any>;
  event_eventos_movimentacao!: Table<any>;
  event_eventos_reproducao!: Table<any>;
  event_eventos_financeiro!: Table<any>;

  // Queue (Sincronização)
  queue_gestures!: Table<Gesture>;
  queue_ops!: Table<Operation>;
  queue_rejections!: Table<Rejection>;

  constructor() {
    super('GestaoPecuariaDB');
    this.version(1).stores({
      // State
      state_animais: 'id, [fazenda_id+identificacao], [fazenda_id+lote_id], fazenda_id',
      state_lotes: 'id, fazenda_id',
      state_pastos: 'id, fazenda_id',
      state_agenda_itens: 'id, [fazenda_id+data_prevista], fazenda_id',
      state_contrapartes: 'id, fazenda_id',
      state_protocolos_sanitarios: 'id, fazenda_id',
      state_protocolos_sanitarios_itens: 'id, [fazenda_id+protocolo_id]',

      // Events
      event_eventos: 'id, [fazenda_id+animal_id+occurred_at], fazenda_id',
      event_eventos_sanitario: 'evento_id, fazenda_id',
      event_eventos_pesagem: 'evento_id, fazenda_id',
      event_eventos_nutricao: 'evento_id, fazenda_id',
      event_eventos_movimentacao: 'evento_id, fazenda_id',
      event_eventos_reproducao: 'evento_id, fazenda_id',
      event_eventos_financeiro: 'evento_id, fazenda_id',

      // Queue
      queue_gestures: 'client_tx_id, [status+created_at], fazenda_id',
      queue_ops: 'client_op_id, client_tx_id, fazenda_id',
      queue_rejections: 'id, client_tx_id, fazenda_id'
    });
  }
}

export const db = new OfflineDB();