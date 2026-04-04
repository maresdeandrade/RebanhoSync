import Dexie, { type Table } from "dexie";
import {
  type AgendaItem,
  type Animal,
  type AnimaisSociedade,
  type Contraparte,
  type Evento,
  type EventoFinanceiro,
  type EventoMovimentacao,
  type EventoNutricao,
  type EventoPesagem,
  type EventoReproducao,
  type EventoSanitario,
  type Gesture,
  type Lote,
  type Operation,
  type Pasto,
  type ProtocoloSanitario,
  type ProtocoloSanitarioItem,
  type CategoriaZootecnica,
  type PilotMetricEvent,
  type Rejection,
} from "./types";

export class OfflineDB extends Dexie {
  // State Stores (Cópia local para leitura)
  state_animais!: Table<Animal, string>;
  state_lotes!: Table<Lote, string>;
  state_pastos!: Table<Pasto, string>;
  state_agenda_itens!: Table<AgendaItem, string>;
  state_contrapartes!: Table<Contraparte, string>;
  state_animais_sociedade!: Table<AnimaisSociedade, string>; // FASE 2.2
  state_categorias_zootecnicas!: Table<CategoriaZootecnica, string>; // FASE 2.3
  state_protocolos_sanitarios!: Table<ProtocoloSanitario, string>;
  state_protocolos_sanitarios_itens!: Table<ProtocoloSanitarioItem, string>;

  // Event Stores (Log local)
  event_eventos!: Table<Evento, string>;
  event_eventos_sanitario!: Table<EventoSanitario, string>;
  event_eventos_pesagem!: Table<EventoPesagem, string>;
  event_eventos_nutricao!: Table<EventoNutricao, string>;
  event_eventos_movimentacao!: Table<EventoMovimentacao, string>;
  event_eventos_reproducao!: Table<EventoReproducao, string>;
  event_eventos_financeiro!: Table<EventoFinanceiro, string>;

  // Queue Stores
  queue_gestures!: Table<Gesture, string>;
  queue_ops!: Table<Operation, string>;
  queue_rejections!: Table<Rejection, number>;
  metrics_events!: Table<PilotMetricEvent, string>;

  constructor() {
    super("RebanhoSync");

    // Versão 1 - Schema inicial
    this.version(1).stores({
      // State: id é a PK. Índices para buscas comuns.
      state_animais:
        "id, [fazenda_id+identificacao], [fazenda_id+lote_id], fazenda_id",
      state_lotes: "id, fazenda_id",
      state_pastos: "id, fazenda_id",
      state_agenda_itens: "id, fazenda_id, [fazenda_id+data_prevista]",
      state_contrapartes: "id, fazenda_id",
      state_protocolos_sanitarios: "id, fazenda_id",
      state_protocolos_sanitarios_itens: "id, fazenda_id, protocolo_id",

      // Events: PK é id (ou evento_id)
      event_eventos: "id, [fazenda_id+animal_id+occurred_at], fazenda_id",
      event_eventos_sanitario: "evento_id, fazenda_id",
      event_eventos_pesagem: "evento_id, fazenda_id",
      event_eventos_nutricao: "evento_id, fazenda_id",
      event_eventos_movimentacao: "evento_id, fazenda_id",
      event_eventos_reproducao: "evento_id, fazenda_id",
      event_eventos_financeiro: "evento_id, fazenda_id",

      // Queue
      queue_gestures: "client_tx_id, [status+created_at], fazenda_id",
      queue_ops: "client_op_id, client_tx_id, fazenda_id",
      queue_rejections: "++id, client_tx_id, fazenda_id",
    });

    // Versão 2 - Adicionar índice animal_id para queries diretas
    this.version(2).stores({
      // Event: Adicionar animal_id como índice simples em event_eventos
      event_eventos:
        "id, [fazenda_id+animal_id+occurred_at], fazenda_id, animal_id",
      // Agenda: Adicionar animal_id em state_agenda_itens
      state_agenda_itens:
        "id, fazenda_id, [fazenda_id+data_prevista], animal_id",
      // Manter índices existentes das tabelas state
      state_animais:
        "id, [fazenda_id+identificacao], [fazenda_id+lote_id], fazenda_id",
      state_lotes: "id, fazenda_id",
      state_pastos: "id, fazenda_id",
      state_contrapartes: "id, fazenda_id",
      state_protocolos_sanitarios: "id, fazenda_id",
      state_protocolos_sanitarios_itens: "id, fazenda_id, protocolo_id",
      // Manter índices existentes das tabelas event
      event_eventos_sanitario: "evento_id, fazenda_id",
      event_eventos_pesagem: "evento_id, fazenda_id",
      event_eventos_nutricao: "evento_id, fazenda_id",
      event_eventos_movimentacao: "evento_id, fazenda_id",
      event_eventos_reproducao: "evento_id, fazenda_id",
      event_eventos_financeiro: "evento_id, fazenda_id",
      // Manter índices existentes da queue
      queue_gestures: "client_tx_id, [status+created_at], fazenda_id",
      queue_ops: "client_op_id, client_tx_id, fazenda_id",
      queue_rejections: "++id, client_tx_id, fazenda_id",
    });

    // Versão 3 - Adicionar índices lote_id e pasto_id para navegação
    this.version(3).stores({
      // Adicionar lote_id em state_animais para query de animais por lote
      state_animais:
        "id, [fazenda_id+identificacao], [fazenda_id+lote_id], fazenda_id, lote_id",
      // Adicionar pasto_id em state_lotes para query de lotes por pasto
      state_lotes: "id, fazenda_id, pasto_id",
      // Manter índices existentes das demais tabelas
      state_pastos: "id, fazenda_id",
      state_agenda_itens:
        "id, fazenda_id, [fazenda_id+data_prevista], animal_id",
      state_contrapartes: "id, fazenda_id",
      state_protocolos_sanitarios: "id, fazenda_id",
      state_protocolos_sanitarios_itens: "id, fazenda_id, protocolo_id",
      event_eventos:
        "id, [fazenda_id+animal_id+occurred_at], fazenda_id, animal_id",
      event_eventos_sanitario: "evento_id, fazenda_id",
      event_eventos_pesagem: "evento_id, fazenda_id",
      event_eventos_nutricao: "evento_id, fazenda_id",
      event_eventos_movimentacao: "evento_id, fazenda_id",
      event_eventos_reproducao: "evento_id, fazenda_id",
      event_eventos_financeiro: "evento_id, fazenda_id",
      queue_gestures: "client_tx_id, [status+created_at], fazenda_id",
      queue_ops: "client_op_id, client_tx_id, fazenda_id",
      queue_rejections: "++id, client_tx_id, fazenda_id",
    });

    // Version 6: Clean schema with all features (requires IndexedDB reset)
    // Includes: sociedade, categorias_zootecnicas, and working queue tables
    this.version(6).stores({
      state_animais:
        "id, fazenda_id, [fazenda_id+lote_id], [fazenda_id+status], lote_id, deleted_at",
      state_lotes: "id, fazenda_id, pasto_id, deleted_at",
      state_pastos: "id, fazenda_id, deleted_at",
      state_agenda_itens:
        "id, fazenda_id, [fazenda_id+data_prevista], [fazenda_id+status], animal_id, lote_id, deleted_at",
      state_contrapartes: "id, fazenda_id, deleted_at",
      state_animais_sociedade:
        "id, [fazenda_id+animal_id], fazenda_id, animal_id, contraparte_id, deleted_at, fim",
      state_categorias_zootecnicas: "id, fazenda_id, deleted_at",
      state_protocolos_sanitarios: "id, fazenda_id, deleted_at",
      state_protocolos_sanitarios_itens:
        "id, fazenda_id, protocolo_id, deleted_at",

      event_eventos:
        "id, fazenda_id, [fazenda_id+dominio], [fazenda_id+occurred_at], animal_id, lote_id, deleted_at",
      event_eventos_sanitario: "evento_id, fazenda_id, deleted_at",
      event_eventos_pesagem: "evento_id, fazenda_id, deleted_at",
      event_eventos_nutricao: "evento_id, fazenda_id, deleted_at",
      event_eventos_movimentacao: "evento_id, fazenda_id, deleted_at",
      event_eventos_reproducao: "evento_id, fazenda_id, deleted_at",
      event_eventos_financeiro: "evento_id, fazenda_id, deleted_at",

      queue_gestures: "client_tx_id, status, [status+created_at], fazenda_id",
      queue_ops: "client_op_id, client_tx_id, fazenda_id",
      queue_rejections: "++id, client_tx_id, fazenda_id",
    });

    // Version 7: Add created_at + compound [fazenda_id+created_at] index on queue_rejections
    // Enables efficient TTL purge (created_at < cutoff) and per-farm date-ordered queries
    this.version(7).stores({
      state_animais:
        "id, fazenda_id, [fazenda_id+lote_id], [fazenda_id+status], lote_id, deleted_at",
      state_lotes: "id, fazenda_id, pasto_id, deleted_at",
      state_pastos: "id, fazenda_id, deleted_at",
      state_agenda_itens:
        "id, fazenda_id, [fazenda_id+data_prevista], [fazenda_id+status], animal_id, lote_id, deleted_at",
      state_contrapartes: "id, fazenda_id, deleted_at",
      state_animais_sociedade:
        "id, [fazenda_id+animal_id], fazenda_id, animal_id, contraparte_id, deleted_at, fim",
      state_categorias_zootecnicas: "id, fazenda_id, deleted_at",
      state_protocolos_sanitarios: "id, fazenda_id, deleted_at",
      state_protocolos_sanitarios_itens:
        "id, fazenda_id, protocolo_id, deleted_at",

      event_eventos:
        "id, fazenda_id, [fazenda_id+dominio], [fazenda_id+occurred_at], animal_id, lote_id, deleted_at",
      event_eventos_sanitario: "evento_id, fazenda_id, deleted_at",
      event_eventos_pesagem: "evento_id, fazenda_id, deleted_at",
      event_eventos_nutricao: "evento_id, fazenda_id, deleted_at",
      event_eventos_movimentacao: "evento_id, fazenda_id, deleted_at",
      event_eventos_reproducao: "evento_id, fazenda_id, deleted_at",
      event_eventos_financeiro: "evento_id, fazenda_id, deleted_at",

      queue_gestures: "client_tx_id, status, [status+created_at], fazenda_id",
      queue_ops: "client_op_id, client_tx_id, fazenda_id",
      queue_rejections:
        "++id, client_tx_id, fazenda_id, created_at, [fazenda_id+created_at]",
    }).upgrade((tx) => {
      // Backfill: old records without created_at get epoch (will be treated as "oldest" → auto-purged)
      return tx.table("queue_rejections").toCollection().modify((rej) => {
        if (!rej.created_at) {
          rej.created_at = new Date(0).toISOString(); // 1970-01-01T00:00:00.000Z
        }
      });
    });

    // Version 8: local pilot metrics for usage/failure instrumentation
    this.version(8).stores({
      state_animais:
        "id, fazenda_id, [fazenda_id+lote_id], [fazenda_id+status], lote_id, deleted_at",
      state_lotes: "id, fazenda_id, pasto_id, deleted_at",
      state_pastos: "id, fazenda_id, deleted_at",
      state_agenda_itens:
        "id, fazenda_id, [fazenda_id+data_prevista], [fazenda_id+status], animal_id, lote_id, deleted_at",
      state_contrapartes: "id, fazenda_id, deleted_at",
      state_animais_sociedade:
        "id, [fazenda_id+animal_id], fazenda_id, animal_id, contraparte_id, deleted_at, fim",
      state_categorias_zootecnicas: "id, fazenda_id, deleted_at",
      state_protocolos_sanitarios: "id, fazenda_id, deleted_at",
      state_protocolos_sanitarios_itens:
        "id, fazenda_id, protocolo_id, deleted_at",

      event_eventos:
        "id, fazenda_id, [fazenda_id+dominio], [fazenda_id+occurred_at], animal_id, lote_id, deleted_at",
      event_eventos_sanitario: "evento_id, fazenda_id, deleted_at",
      event_eventos_pesagem: "evento_id, fazenda_id, deleted_at",
      event_eventos_nutricao: "evento_id, fazenda_id, deleted_at",
      event_eventos_movimentacao: "evento_id, fazenda_id, deleted_at",
      event_eventos_reproducao: "evento_id, fazenda_id, deleted_at",
      event_eventos_financeiro: "evento_id, fazenda_id, deleted_at",

      queue_gestures: "client_tx_id, status, [status+created_at], fazenda_id",
      queue_ops: "client_op_id, client_tx_id, fazenda_id",
      queue_rejections:
        "++id, client_tx_id, fazenda_id, created_at, [fazenda_id+created_at]",
      metrics_events:
        "id, fazenda_id, event_name, route, entity, created_at, [fazenda_id+created_at]",
    });
  }
}

export const db = new OfflineDB();
