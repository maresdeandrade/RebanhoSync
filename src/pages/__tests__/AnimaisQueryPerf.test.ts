import { describe, it, expect, beforeAll, afterAll } from "vitest";
import "fake-indexeddb/auto";
import { db } from "@/lib/offline/db";
import { type Animal } from "@/lib/offline/types";

describe("Animais query semantics", () => {
  const FARM_A = "farm_a";
  const FARM_B = "farm_b";
  const TOTAL_ANIMALS = 2500;

  beforeAll(async () => {
    if (!db.isOpen()) {
      await db.open();
    }
    await db.state_animais.clear();

    const animals: Animal[] = [];
    for (let i = 0; i < TOTAL_ANIMALS; i++) {
      const farmId = i < TOTAL_ANIMALS * 0.1 ? FARM_A : FARM_B;
      animals.push({
        id: `animal_${i}`,
        fazenda_id: farmId,
        identificacao: `BOI-${i}`,
        lote_id: i % 10 === 0 ? `lote_${farmId}_1` : undefined,
        sexo: i % 2 === 0 ? 'M' : 'F',
        status: 'ativo',
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        observacoes: "fixture",
      } as unknown as Animal);
    }

    await db.state_animais.bulkAdd(animals);
  });

  afterAll(async () => {
    await db.state_animais.clear();
  });

  it("uses fazenda index consistently with in-memory filtering", async () => {
    await db.state_animais.where('fazenda_id').equals(FARM_A).count();

    const allAnimals = await db.state_animais.toCollection().toArray();
    const farmAAnimalsBaseline = allAnimals.filter(
      (animal) => animal.fazenda_id === FARM_A,
    );
    const farmAAnimalsOptimized = await db.state_animais
      .where("fazenda_id")
      .equals(FARM_A)
      .toArray();

    expect(allAnimals).toHaveLength(TOTAL_ANIMALS);
    expect(farmAAnimalsOptimized.length).toBe(farmAAnimalsBaseline.length);
    expect(farmAAnimalsOptimized.every((animal) => animal.fazenda_id === FARM_A)).toBe(true);
  });

  it("keeps lote query isolated by fazenda with compound index", async () => {
    const TARGET_LOTE = `lote_${FARM_A}_1`;

    const animalsBaseline = await db.state_animais
      .where("lote_id")
      .equals(TARGET_LOTE)
      .toArray();

    const animalsOptimized = await db.state_animais
      .where("[fazenda_id+lote_id]")
      .equals([FARM_A, TARGET_LOTE])
      .toArray();

    expect(animalsOptimized.length).toBe(animalsBaseline.length);
    expect(animalsOptimized.every((animal) => animal.fazenda_id === FARM_A)).toBe(true);
  });
});
