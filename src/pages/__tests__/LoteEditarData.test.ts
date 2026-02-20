/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import Dexie, { type Table } from "dexie";
import { indexedDB, IDBKeyRange } from "fake-indexeddb";
import { type Animal, type Pasto, type Lote } from "@/lib/offline/types";

// Explicitly set globals for Dexie to use
globalThis.indexedDB = indexedDB;
globalThis.IDBKeyRange = IDBKeyRange;

// Define the schema as in src/lib/offline/db.ts
class TestDB extends Dexie {
  state_animais!: Table<Animal, string>;
  state_pastos!: Table<Pasto, string>;
  state_lotes!: Table<Lote, string>;

  constructor() {
    super("TestDB", { indexedDB: indexedDB, IDBKeyRange: IDBKeyRange });
    this.version(6).stores({
      state_animais:
        "id, fazenda_id, [fazenda_id+lote_id], [fazenda_id+status], lote_id, deleted_at",
      state_lotes: "id, fazenda_id, pasto_id, deleted_at",
      state_pastos: "id, fazenda_id, deleted_at",
    });
  }
}

describe("LoteEditar Data Access", () => {
  let db: TestDB;
  const targetFarmId = "target-farm";
  const otherFarmId = "other-farm";

  beforeEach(async () => {
    // Reset DB
    db = new TestDB();
    await db.delete();
    db = new TestDB();
    await db.open();

    // Populate DB
    const animals: Animal[] = [];
    const pastos: Pasto[] = [];

    // Create 5000 animals for other farm
    for (let i = 0; i < 5000; i++) {
      animals.push({
        id: `other-animal-${i}`,
        fazenda_id: otherFarmId,
        identificacao: `Bull ${i}`,
        sexo: "M",
        status: "ativo",
        lote_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      } as Animal);
    }

    // Create 100 animals for target farm
    for (let i = 0; i < 100; i++) {
      animals.push({
        id: `target-animal-${i}`,
        fazenda_id: targetFarmId,
        identificacao: `Target Bull ${i}`,
        sexo: "M",
        status: "ativo",
        lote_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      } as Animal);
    }

    // Create 1000 pastos for other farm
    for (let i = 0; i < 1000; i++) {
      pastos.push({
        id: `other-pasto-${i}`,
        fazenda_id: otherFarmId,
        nome: `Pasto ${i}`,
        tipo_pasto: "nativo",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      } as Pasto);
    }

    // Create 20 pastos for target farm
    for (let i = 0; i < 20; i++) {
      pastos.push({
        id: `target-pasto-${i}`,
        fazenda_id: targetFarmId,
        nome: `Target Pasto ${i}`,
        tipo_pasto: "nativo",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      } as Pasto);
    }

    await db.state_animais.bulkAdd(animals);
    await db.state_pastos.bulkAdd(pastos);
  });

  it("retrieves only data for the target farm (optimized query)", async () => {
    // Optimized Implementation logic
    const targetPastos = await db.state_pastos
      .where("fazenda_id")
      .equals(targetFarmId)
      .toArray();
    
    const targetBulls = await db.state_animais
      .where("fazenda_id")
      .equals(targetFarmId)
      .filter((a) => a.sexo === "M" && (!a.deleted_at || a.deleted_at === null))
      .toArray();

    // Assertions for Correctness
    expect(targetPastos.length).toBe(20);
    expect(targetPastos.every(p => p.fazenda_id === targetFarmId)).toBe(true);
    
    expect(targetBulls.length).toBe(100);
    expect(targetBulls.every(a => a.fazenda_id === targetFarmId)).toBe(true);
  });
});
