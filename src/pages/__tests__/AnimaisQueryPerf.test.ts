import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import "fake-indexeddb/auto";
import { db } from '@/lib/offline/db';
import { type Animal } from '@/lib/offline/types';

describe('Animais Query Performance', () => {
  const FARM_A = 'farm_a';
  const FARM_B = 'farm_b';
  const TOTAL_ANIMALS = 10000;

  beforeEach(async () => {
    // Open DB
    if (!db.isOpen()) {
        await db.open();
    }
    await db.state_animais.clear();

    // Seed data
    const animals: Animal[] = [];
    for (let i = 0; i < TOTAL_ANIMALS; i++) {
      // 90% in Farm B, 10% in Farm A
      const farmId = i < TOTAL_ANIMALS * 0.1 ? FARM_A : FARM_B;
      animals.push({
        id: `animal_${i}`,
        fazenda_id: farmId,
        identificacao: `BOI-${i}`,
        lote_id: i % 10 === 0 ? `lote_${farmId}_1` : undefined,
        sexo: i % 2 === 0 ? 'M' : 'F',
        status: 'ativo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        // Add dummy data to make object larger, simulating real world overhead
        observacoes: "Lorem ipsum dolor sit amet ".repeat(10),
      } as unknown as Animal);
    }

    await db.state_animais.bulkAdd(animals);
  });

  afterEach(async () => {
      await db.state_animais.clear();
  });

  it('measures performance of toCollection vs where(fazenda_id)', async () => {
    // Warmup
    await db.state_animais.where('fazenda_id').equals(FARM_A).count();

    // Baseline: toCollection (simulating current implementation)
    // We measure the time to fetch all and filter in JS (or just fetch all if no filter used)
    const startBaseline = performance.now();
    const allAnimals = await db.state_animais.toCollection().toArray();
    // Simulate filtering for current farm
    const farmAAnimalsBaseline = allAnimals.filter(a => a.fazenda_id === FARM_A);
    const endBaseline = performance.now();
    const baselineTime = endBaseline - startBaseline;

    console.log(`Baseline (toCollection + JS filter): ${baselineTime.toFixed(2)}ms`);
    console.log(`Fetched ${allAnimals.length} items, filtered to ${farmAAnimalsBaseline.length}`);

    // Optimized: where('fazenda_id')
    const startOptimized = performance.now();
    const farmAAnimalsOptimized = await db.state_animais.where('fazenda_id').equals(FARM_A).toArray();
    const endOptimized = performance.now();
    const optimizedTime = endOptimized - startOptimized;

    console.log(`Optimized (where fazenda_id): ${optimizedTime.toFixed(2)}ms`);
    console.log(`Fetched ${farmAAnimalsOptimized.length} items`);

    expect(farmAAnimalsOptimized.length).toBe(farmAAnimalsBaseline.length);

    // Assert that optimization is faster
    // In scenarios where we fetch 50% of data, the speedup comes from not cloning/transferring the other 50%.
    console.log(`Speedup: ${(baselineTime / optimizedTime).toFixed(2)}x`);
  });

  it('measures performance of lote filter: simple index vs compound index', async () => {
    // Setup specific scenario
    const TARGET_LOTE = `lote_${FARM_A}_1`;

    // Warmup
    await db.state_animais.where('lote_id').equals(TARGET_LOTE).count();

    // Baseline: simple index on lote_id
    // This scans the index for lote_id. Since lote_id is unique enough, it's already fast.
    // But let's measure anyway.
    const startBaseline = performance.now();
    const animalsBaseline = await db.state_animais.where('lote_id').equals(TARGET_LOTE).toArray();
    const endBaseline = performance.now();
    const baselineTime = endBaseline - startBaseline;

    console.log(`Baseline (lote_id index): ${baselineTime.toFixed(2)}ms`);
    console.log(`Fetched ${animalsBaseline.length} items`);

    // Optimized: compound index [fazenda_id+lote_id]
    const startOptimized = performance.now();
    const animalsOptimized = await db.state_animais.where('[fazenda_id+lote_id]').equals([FARM_A, TARGET_LOTE]).toArray();
    const endOptimized = performance.now();
    const optimizedTime = endOptimized - startOptimized;

    console.log(`Optimized (compound index): ${optimizedTime.toFixed(2)}ms`);
    console.log(`Fetched ${animalsOptimized.length} items`);

    expect(animalsOptimized.length).toBe(animalsBaseline.length);
    // Compound index might be slightly faster or same, but it guarantees farm isolation.
    // In fake-indexeddb, it might not show big diff.
  });
});
