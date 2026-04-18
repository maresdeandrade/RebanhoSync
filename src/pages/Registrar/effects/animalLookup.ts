import { db } from "@/lib/offline/db";
import type { Animal } from "@/lib/offline/types";

type BulkGetAnimalsFn = (ids: string[]) => Promise<Array<Animal | undefined>>;

export async function loadRegistrarAnimalsMap(input: {
  animalIds: string[];
  bulkGetAnimals?: BulkGetAnimalsFn;
}): Promise<Map<string, Animal>> {
  const animalsMap = new Map<string, Animal>();
  if (input.animalIds.length === 0) {
    return animalsMap;
  }

  const bulkGet = input.bulkGetAnimals ?? ((ids) => db.state_animais.bulkGet(ids));
  const animals = await bulkGet(input.animalIds);
  animals.forEach((animal) => {
    if (animal) {
      animalsMap.set(animal.id, animal);
    }
  });

  return animalsMap;
}
