import type { Table } from "dexie";

import { db } from "@/lib/offline/db";
import type { Animal, Lote, Pasto } from "@/lib/offline/types";

type FarmScopedRecord = {
  fazenda_id: string;
};

async function readRecordInActiveFarm<T extends FarmScopedRecord>(
  table: Table<T, string>,
  id: string | null | undefined,
  activeFarmId: string | null | undefined,
): Promise<T | null> {
  if (!id || !activeFarmId) return null;

  const record = await table.get(id);
  return record?.fazenda_id === activeFarmId ? record : null;
}

export function readAnimalInActiveFarm(
  id: string | null | undefined,
  activeFarmId: string | null | undefined,
): Promise<Animal | null> {
  return readRecordInActiveFarm(db.state_animais, id, activeFarmId);
}

export function readLoteInActiveFarm(
  id: string | null | undefined,
  activeFarmId: string | null | undefined,
): Promise<Lote | null> {
  return readRecordInActiveFarm(db.state_lotes, id, activeFarmId);
}

export function readPastoInActiveFarm(
  id: string | null | undefined,
  activeFarmId: string | null | undefined,
): Promise<Pasto | null> {
  return readRecordInActiveFarm(db.state_pastos, id, activeFarmId);
}
