import { db } from "./db";

const FARM_SCOPED_TABLES = [
  db.state_animais,
  db.state_lotes,
  db.state_pastos,
  db.state_agenda_itens,
  db.state_contrapartes,
  db.state_animais_sociedade,
  db.state_categorias_zootecnicas,
  db.state_protocolos_sanitarios,
  db.state_protocolos_sanitarios_itens,
  db.event_eventos,
  db.event_eventos_sanitario,
  db.event_eventos_pesagem,
  db.event_eventos_nutricao,
  db.event_eventos_movimentacao,
  db.event_eventos_reproducao,
  db.event_eventos_financeiro,
  db.queue_gestures,
  db.queue_ops,
  db.queue_rejections,
  db.metrics_events,
] as const;

export async function resetOfflineFarmData(fazendaId: string) {
  await db.transaction("rw", [...FARM_SCOPED_TABLES], async () => {
    for (const table of FARM_SCOPED_TABLES) {
      await table.where("fazenda_id").equals(fazendaId).delete();
    }
  });
}
