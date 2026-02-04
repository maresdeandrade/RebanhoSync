import Dexie, { type Table } from 'dexie';
import { Gesture, Operation, Rejection } from './types';

export class OfflineDB extends Dexie {
  // State Stores (Cópia local para leitura)
  state_animais!: Table<any, string>;
  state_lotes!: Table<any, string>;
  state_pastos!: Table<any, string>;
  state_agenda_itens!: Table<any, string>;
  state_contrapartes!: Table<any, string>;
  state_protocolos_sanitarios!: Table<any, string>;
  state_protocolos_sanitarios_itens!: Table<any, string>;

  // Event Stores (Log local)
  event_eventos!: Table<any, string>;
  event_eventos_sanitario!: Table<any, string>;
  event_eventos_pesagem!: Table<any, string>;
  event_eventos_nutricao!: Table<any, string>;
  event_eventos_movimentacao!: Table<any, string>;
  event_eventos_reproducao!: Table<any, string>;
  event_eventos_financeiro!: Table<any, string>;

  // Queue Stores
  queue_gestures!: Table<Gesture, string>;
  queue_ops!: Table<Operation, string>;
  queue_rejections!: Table<Rejection, number>;

  constructor() {
    super('PecuariaOfflineDB');
    this.version(1).stores({
      // State: id é a PK. Índices para buscas comuns.
      state_animais: 'id, [fazenda_id+identificacao], [fazenda_id+lote_id], fazenda_id',
      state_lotes: 'id, fazenda_id',
      state_pastos: 'id, fazenda_id',
      state_agenda_itens: 'id, fazenda_id, [fazenda_id+data_prevista]',
      state_contrapartes: 'id, fazenda_id',
      state_protocolos_sanitarios: 'id, fazenda_id',
      state_protocolos_sanitarios_itens: 'id, fazenda_id, protocolo_id',

      // Events: PK é id (ou evento_id)
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
      queue_rejections: '++id, client_tx_id, fazenda_id'
    });
  }
}

export const db = new OfflineDB();