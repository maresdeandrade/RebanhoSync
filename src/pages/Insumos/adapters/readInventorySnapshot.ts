import { db, type OfflineDB } from "@/lib/offline/db";
import type { InventorySnapshot } from "../types";

type InventorySnapshotDatabase = Pick<
  OfflineDB,
  | "state_insumos"
  | "state_insumo_apresentacoes"
  | "state_insumo_lotes"
  | "state_insumo_movimentacoes"
  | "event_eventos"
  | "event_eventos_sanitario"
  | "event_eventos_nutricao"
  | "event_eventos_pasto_avaliacao"
  | "catalog_produtos_veterinarios"
  | "queue_gestures"
>;

// Called inside useLiveQuery so Dexie continues observing the same local reads.
export async function readInventorySnapshot(
  activeFarmId: string | null | undefined,
  database: InventorySnapshotDatabase = db,
): Promise<InventorySnapshot | null> {
  if (!activeFarmId) return null;
  const [
    insumos,
    apresentacoes,
    lotes,
    movimentacoes,
    eventos,
    sanitario,
    nutricao,
    pasto,
    produtos,
    gestures,
  ] = await Promise.all([
    database.state_insumos.where("fazenda_id").equals(activeFarmId).toArray(),
    database.state_insumo_apresentacoes
      .where("fazenda_id")
      .equals(activeFarmId)
      .toArray(),
    database.state_insumo_lotes
      .where("fazenda_id")
      .equals(activeFarmId)
      .toArray(),
    database.state_insumo_movimentacoes
      .where("fazenda_id")
      .equals(activeFarmId)
      .toArray(),
    database.event_eventos.where("fazenda_id").equals(activeFarmId).toArray(),
    database.event_eventos_sanitario
      .where("fazenda_id")
      .equals(activeFarmId)
      .toArray(),
    database.event_eventos_nutricao
      .where("fazenda_id")
      .equals(activeFarmId)
      .toArray(),
    database.event_eventos_pasto_avaliacao
      .where("fazenda_id")
      .equals(activeFarmId)
      .toArray(),
    database.catalog_produtos_veterinarios.toArray(),
    database.queue_gestures.where("fazenda_id").equals(activeFarmId).toArray(),
  ]);

  return {
    insumos: insumos.filter((item) => !item.deleted_at),
    apresentacoes: apresentacoes.filter((item) => !item.deleted_at),
    lotes: lotes.filter((item) => !item.deleted_at),
    movimentacoes: movimentacoes.filter((item) => !item.deleted_at),
    eventos,
    sanitario: sanitario.filter((item) => !item.deleted_at),
    nutricao: nutricao.filter((item) => !item.deleted_at),
    pasto: pasto.filter((item) => !item.deleted_at),
    produtos,
    pendingTxIds: new Set(
      gestures
        .filter(
          (gesture) => gesture.status !== "DONE" && gesture.status !== "SYNCED",
        )
        .map((gesture) => gesture.client_tx_id),
    ),
  };
}
