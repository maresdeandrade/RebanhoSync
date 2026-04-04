import type { Animal } from "@/lib/offline/types";

export interface AnimalFamilyRow {
  animal: Animal;
  depth: number;
}

function compareAnimals(left: Animal, right: Animal) {
  return left.identificacao.localeCompare(right.identificacao);
}

export function buildAnimalFamilyRows(
  visibleAnimals: Animal[],
  allAnimals: Animal[],
): AnimalFamilyRow[] {
  const allById = new Map(allAnimals.map((animal) => [animal.id, animal]));
  const childrenByMother = new Map<string, Animal[]>();

  for (const animal of allAnimals) {
    if (!animal.mae_id || animal.deleted_at) continue;
    const current = childrenByMother.get(animal.mae_id) ?? [];
    current.push(animal);
    childrenByMother.set(animal.mae_id, current);
  }

  for (const entries of childrenByMother.values()) {
    entries.sort(compareAnimals);
  }

  const includedIds = new Set(visibleAnimals.map((animal) => animal.id));
  let changed = true;

  while (changed) {
    changed = false;
    const snapshot = Array.from(includedIds);

    for (const animalId of snapshot) {
      const animal = allById.get(animalId);
      if (!animal) continue;

      if (animal.mae_id && allById.has(animal.mae_id) && !includedIds.has(animal.mae_id)) {
        includedIds.add(animal.mae_id);
        changed = true;
      }

      for (const calf of childrenByMother.get(animal.id) ?? []) {
        if (!includedIds.has(calf.id)) {
          includedIds.add(calf.id);
          changed = true;
        }
      }
    }
  }

  const includedAnimals = Array.from(includedIds)
    .map((animalId) => allById.get(animalId))
    .filter((animal): animal is Animal => Boolean(animal))
    .sort(compareAnimals);

  const includedSet = new Set(includedAnimals.map((animal) => animal.id));
  const roots = includedAnimals.filter(
    (animal) => !animal.mae_id || !includedSet.has(animal.mae_id),
  );

  const rows: AnimalFamilyRow[] = [];
  const visited = new Set<string>();

  const walk = (animal: Animal, depth: number) => {
    if (visited.has(animal.id)) return;
    visited.add(animal.id);
    rows.push({ animal, depth });

    for (const calf of childrenByMother.get(animal.id) ?? []) {
      if (!includedSet.has(calf.id)) continue;
      walk(calf, depth + 1);
    }
  };

  for (const root of roots.sort(compareAnimals)) {
    walk(root, 0);
  }

  for (const animal of includedAnimals) {
    if (!visited.has(animal.id)) {
      walk(animal, 0);
    }
  }

  return rows;
}
