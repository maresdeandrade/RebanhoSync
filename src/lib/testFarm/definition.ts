import { deterministicUuidFromText } from "@/lib/reproduction/deterministicUuid";
import type { AnimalRegistrationDraft } from "@/lib/animals/registration";

export const TEST_FARM_SPEC = {
  logicalId: "DEMO-HOMOLOGACAO-001",
  name: "Fazenda Modelo RebanhoSync",
  productionType: "corte",
  predominantBreed: "nelore",
  productionSystem: "cria_recria_reproducao",
  referenceDate: "2026-10-23",
  expectedAnimals: 120,
} as const;

export const TEST_FARM_CATEGORY_COUNTS = {
  vaca_reprodutiva: 50,
  novilha: 20,
  bezerra: 18,
  bezerro: 18,
  macho_recria: 8,
  touro: 4,
  vaca_fora_reproducao: 2,
} as const;

export type TestFarmCategory = keyof typeof TEST_FARM_CATEGORY_COUNTS;

export interface TestFarmAnimalDefinition {
  id: string;
  identification: string;
  category: TestFarmCategory;
  lotKey: "matrizes" | "novilhas" | "crias" | "recria" | "touros";
  draft: AnimalRegistrationDraft;
}

export interface TestFarmReproductionEpisode {
  id: string;
  motherId: string;
  sireId: string;
  service: { id: string; date: string };
  diagnosis?: {
    id: string;
    date: string;
    result: "positivo" | "negativo";
    expectedBirthDate?: string;
  };
  outcome?:
    | { type: "parto"; id: string; date: string; calfId: string }
    | { type: "aborto"; id: string; date: string };
}

export interface TestFarmDefinition {
  id: string;
  animals: TestFarmAnimalDefinition[];
  reproductionEpisodes: TestFarmReproductionEpisode[];
}

export const testFarmStableId = deterministicUuidFromText;

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateKeyValue: string, days: number) {
  const date = new Date(`${dateKeyValue}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function makeAnimal({
  tag,
  category,
  sex,
  birthDate,
  motherId,
  sireId,
  lotKey,
}: {
  tag: string;
  category: TestFarmCategory;
  sex: "F" | "M";
  birthDate: string;
  motherId?: string | null;
  sireId?: string | null;
  lotKey: TestFarmAnimalDefinition["lotKey"];
}): TestFarmAnimalDefinition {
  const id = testFarmStableId(`${TEST_FARM_SPEC.logicalId}:animal:${tag}`);
  const identification = `DEMO-${tag}`;
  return {
    id,
    identification,
    category,
    lotKey,
    draft: {
      id,
      identificacao: identification,
      sexo: sex,
      especie: "bovino",
      raca: "nelore",
      dataNascimento: birthDate,
      dataEntrada: null,
      paiId: sireId ?? null,
      maeId: motherId ?? null,
      payload: { test_farm_seed: TEST_FARM_SPEC.logicalId, category },
    },
  };
}

function makeEpisode({
  motherId,
  sireId,
  date,
  serviceDate = addDays(date, -283),
  outcome,
  diagnosis,
}: {
  motherId: string;
  sireId: string;
  date: string;
  serviceDate?: string;
  outcome: { type: "parto"; calfId: string } | { type: "aborto" } | null;
  diagnosis?: { date: string; result: "positivo" | "negativo" };
}): TestFarmReproductionEpisode {
  const id = testFarmStableId(
    `${TEST_FARM_SPEC.logicalId}:episode:${motherId}:${date}`,
  );
  const serviceId = testFarmStableId(`${id}:service`);
  const episode: TestFarmReproductionEpisode = {
    id,
    motherId,
    sireId,
    service: { id: serviceId, date: serviceDate },
  };
  if (diagnosis) {
    episode.diagnosis = {
      id: testFarmStableId(`${id}:diagnosis`),
      date: diagnosis.date,
      result: diagnosis.result,
      ...(diagnosis.result === "positivo"
        ? { expectedBirthDate: addDays(episode.service.date, 283) }
        : {}),
    };
  }
  if (outcome?.type === "parto") {
    episode.outcome = {
      type: "parto",
      id: testFarmStableId(`${id}:parto`),
      date,
      calfId: outcome.calfId,
    };
  } else if (outcome?.type === "aborto") {
    episode.outcome = {
      type: "aborto",
      id: testFarmStableId(`${id}:aborto`),
      date,
    };
  }
  return episode;
}

interface DefinitionBuilder {
  animals: TestFarmAnimalDefinition[];
  reproductionEpisodes: TestFarmReproductionEpisode[];
  dams: Map<number, TestFarmAnimalDefinition>;
  sires: TestFarmAnimalDefinition[];
}

function addSires({ sires }: DefinitionBuilder) {
  for (let index = 1; index <= 4; index += 1) {
    sires.push(
      makeAnimal({
        tag: `TOU-${String(index).padStart(3, "0")}`,
        category: "touro",
        sex: "M",
        birthDate: `${2010 + index}-03-15`,
        lotKey: "touros",
      }),
    );
  }
}

function breedingCowBirthYear(index: number) {
  return index <= 10
    ? 2011 + Math.floor((index - 1) / 2)
    : index <= 20
      ? 2018 + Math.floor((index - 11) / 3)
      : index <= 30
        ? 2023
        : 2015 + (index % 6);
}

function breedingCowMother(index: number, dams: DefinitionBuilder["dams"]) {
  return index >= 11 && index <= 20
    ? dams.get(((index - 11) % 10) + 1)
    : index >= 21 && index <= 30
      ? dams.get(index - 10)
      : undefined;
}

function addBreedingCows({
  animals,
  reproductionEpisodes,
  dams,
  sires,
}: DefinitionBuilder) {
  for (let index = 1; index <= 50; index += 1) {
    const birthYear = breedingCowBirthYear(index);
    const mother = breedingCowMother(index, dams);
    const animal = makeAnimal({
      tag: `MAT-${String(index).padStart(3, "0")}`,
      category: "vaca_reprodutiva",
      sex: "F",
      birthDate: `${birthYear}-02-${String((index % 20) + 1).padStart(2, "0")}`,
      motherId: mother?.id,
      sireId: mother ? sires[(index - 11) % sires.length]?.id : null,
      lotKey: "matrizes",
    });
    animals.push(animal);
    if (index <= 30) dams.set(index, animal);
    if (mother) {
      reproductionEpisodes.push(
        makeEpisode({
          motherId: mother.id,
          sireId: animal.draft.paiId!,
          date: animal.draft.dataNascimento!,
          outcome: { type: "parto", calfId: animal.id },
        }),
      );
    }
  }
}

function addHeifers({
  animals,
  reproductionEpisodes,
  dams,
  sires,
}: DefinitionBuilder) {
  for (let index = 1; index <= 20; index += 1) {
    const mother = dams.get(((index - 1) % 10) + 1)!;
    const sire = sires[(index - 1) % sires.length]!;
    const birthDate =
      index <= 10
        ? `2024-02-${String((index % 20) + 1).padStart(2, "0")}`
        : `2024-12-${String((index % 20) + 1).padStart(2, "0")}`;
    const animal = makeAnimal({
      tag: `NOV-${String(index).padStart(3, "0")}`,
      category: "novilha",
      sex: "F",
      birthDate,
      motherId: mother.id,
      sireId: sire.id,
      lotKey: "novilhas",
    });
    animals.push(animal);
    reproductionEpisodes.push(
      makeEpisode({
        motherId: mother.id,
        sireId: sire.id,
        date: animal.draft.dataNascimento!,
        outcome: { type: "parto", calfId: animal.id },
      }),
    );
  }
}

function addRearingMales({
  animals,
  reproductionEpisodes,
  dams,
  sires,
}: DefinitionBuilder) {
  for (let index = 1; index <= 8; index += 1) {
    const mother = dams.get(index)!;
    const sire = sires[(index - 1) % sires.length]!;
    const animal = makeAnimal({
      tag: `REC-${String(index).padStart(3, "0")}`,
      category: "macho_recria",
      sex: "M",
      birthDate: `2025-11-${String(index + 7).padStart(2, "0")}`,
      motherId: mother.id,
      sireId: sire.id,
      lotKey: "recria",
    });
    animals.push(animal);
    reproductionEpisodes.push(
      makeEpisode({
        motherId: mother.id,
        sireId: sire.id,
        date: animal.draft.dataNascimento!,
        outcome: { type: "parto", calfId: animal.id },
      }),
    );
  }
}

function addRecentCalves({
  animals,
  reproductionEpisodes,
  sires,
}: DefinitionBuilder) {
  const recentCalfMothers = [
    ...animals.slice(0, 10),
    ...animals.slice(10, 20),
    ...animals.slice(30, 36),
    ...animals.slice(38, 48),
  ];
  // Birth dates fixed per dam so each dam's calving chain keeps >= 283-day
  // intervals and no calving overlaps an open pregnancy, negative diagnosis,
  // or gestational loss episode for the same dam.
  const calfBirthDates: Record<number, { female: string; male: string }> = {
    1: { female: "2026-09-04", male: "2026-09-05" },
    2: { female: "2026-09-06", male: "2026-09-07" },
    3: { female: "2026-09-08", male: "2026-09-09" },
    4: { female: "2026-09-10", male: "2026-09-11" },
    5: { female: "2026-09-17", male: "2026-09-18" },
    6: { female: "2026-01-20", male: "2026-01-20" },
    7: { female: "2026-01-02", male: "2026-01-02" },
    8: { female: "2026-01-05", male: "2026-01-05" },
    9: { female: "2026-02-08", male: "2026-02-08" },
    10: { female: "2026-02-11", male: "2026-02-11" },
    11: { female: "2026-01-14", male: "2026-01-14" },
    12: { female: "2026-02-17", male: "2026-02-17" },
    13: { female: "2026-03-20", male: "2026-03-20" },
    14: { female: "2026-03-24", male: "2026-03-25" },
    15: { female: "2026-05-05", male: "2026-05-05" },
    16: { female: "2026-05-08", male: "2026-05-08" },
    17: { female: "2026-05-11", male: "2026-05-11" },
    18: { female: "2026-04-14", male: "2026-04-14" },
  };
  for (let index = 1; index <= 18; index += 1) {
    for (const [sex, category, prefix] of [
      ["F", "bezerra", "BZ-F"],
      ["M", "bezerro", "BZ-M"],
    ] as const) {
      const mother =
        recentCalfMothers[(index - 1) * 2 + (sex === "M" ? 1 : 0)]!;
      const sire = sires[(index - 1) % sires.length]!;
      const birthDate =
        sex === "F"
          ? calfBirthDates[index]!.female
          : calfBirthDates[index]!.male;
      const animal = makeAnimal({
        tag: `${prefix}-${String(index).padStart(3, "0")}`,
        category,
        sex,
        birthDate,
        motherId: mother.id,
        sireId: sire.id,
        lotKey: "crias",
      });
      animals.push(animal);
      reproductionEpisodes.push(
        makeEpisode({
          motherId: mother.id,
          sireId: sire.id,
          date: animal.draft.dataNascimento!,
          outcome: { type: "parto", calfId: animal.id },
        }),
      );
    }
  }
}

function addNonReproductiveCows({ animals }: DefinitionBuilder) {
  const nonReproductiveCows = [1, 2].map((index) =>
    makeAnimal({
      tag: `FORA-${String(index).padStart(3, "0")}`,
      category: "vaca_fora_reproducao",
      sex: "F",
      birthDate: `${2013 + index}-06-12`,
      lotKey: "matrizes",
    }),
  );
  animals.push(...nonReproductiveCows);
}

function addOpenPregnancies({
  animals,
  reproductionEpisodes,
  sires,
}: DefinitionBuilder) {
  for (let index = 21; index <= 30; index += 1) {
    const mother = animals[index - 1]!;
    const serviceDate = addDays("2026-04-20", index - 21);
    const serviceId = testFarmStableId(
      `${TEST_FARM_SPEC.logicalId}:open-episode:${mother.id}:service`,
    );
    const expectedBirthDate = addDays(serviceDate, 283);
    const episodeId = testFarmStableId(
      `${TEST_FARM_SPEC.logicalId}:open-episode:${mother.id}`,
    );
    reproductionEpisodes.push({
      id: episodeId,
      motherId: mother.id,
      sireId: sires[(index - 21) % sires.length]!.id,
      service: { id: serviceId, date: serviceDate },
      diagnosis: {
        id: testFarmStableId(`${episodeId}:diagnosis`),
        date: addDays(serviceDate, 30),
        result: "positivo",
        expectedBirthDate,
      },
    });
  }
}

function addNegativeDiagnoses({
  animals,
  reproductionEpisodes,
  sires,
}: DefinitionBuilder) {
  for (let index = 31; index <= 36; index += 1) {
    const mother = animals[index - 1]!;
    const serviceDate = `2026-06-${String(index - 30).padStart(2, "0")}`;
    const episodeId = testFarmStableId(
      `${TEST_FARM_SPEC.logicalId}:negative-episode:${mother.id}`,
    );
    reproductionEpisodes.push({
      id: episodeId,
      motherId: mother.id,
      sireId: sires[(index - 31) % sires.length]!.id,
      service: {
        id: testFarmStableId(`${episodeId}:service`),
        date: serviceDate,
      },
      diagnosis: {
        id: testFarmStableId(`${episodeId}:diagnosis`),
        date: `2026-08-${String(index - 30).padStart(2, "0")}`,
        result: "negativo",
      },
    });
  }
}

function addPregnancyLosses({
  animals,
  reproductionEpisodes,
  sires,
}: DefinitionBuilder) {
  for (let index = 37; index <= 38; index += 1) {
    const mother = animals[index - 1]!;
    const serviceDate = `2026-05-1${index - 32}`;
    const outcomeDate = `2026-07-1${index - 32}`;
    const episode = makeEpisode({
      motherId: mother.id,
      sireId: sires[(index - 37) % sires.length]!.id,
      date: outcomeDate,
      serviceDate,
      outcome: { type: "aborto" },
      diagnosis: {
        date: `2026-06-1${index - 32}`,
        result: "positivo",
      },
    });
    reproductionEpisodes.push(episode);
  }
}

export function createTestFarmDefinition(): TestFarmDefinition {
  const builder: DefinitionBuilder = {
    animals: [],
    reproductionEpisodes: [],
    dams: new Map(),
    sires: [],
  };
  addSires(builder);
  addBreedingCows(builder);
  addHeifers(builder);
  addRearingMales(builder);
  addRecentCalves(builder);
  addNonReproductiveCows(builder);
  addOpenPregnancies(builder);
  addNegativeDiagnoses(builder);
  addPregnancyLosses(builder);
  const { animals, reproductionEpisodes, sires } = builder;
  animals.push(...sires);

  return {
    id: testFarmStableId(`${TEST_FARM_SPEC.logicalId}:farm`),
    animals,
    reproductionEpisodes,
  };
}

function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function daysBetween(start: string, end: string) {
  return Math.round(
    (new Date(`${end}T12:00:00.000Z`).getTime() -
      new Date(`${start}T12:00:00.000Z`).getTime()) /
      86_400_000,
  );
}

interface DefinitionValidation {
  definition: TestFarmDefinition;
  issues: string[];
  animalById: Map<string, TestFarmAnimalDefinition>;
  idSet: Set<string>;
  identificationSet: Set<string>;
  categoryCounts: Map<TestFarmCategory, number>;
}

function validateParentage(
  animal: TestFarmAnimalDefinition,
  animalById: Map<string, TestFarmAnimalDefinition>,
  issues: string[],
) {
  for (const [relationship, parentId, expectedSex] of [
    ["mother", animal.draft.maeId, "F"],
    ["sire", animal.draft.paiId, "M"],
  ] as const) {
    if (!parentId) continue;
    const parent = animalById.get(parentId);
    if (!parent) {
      issues.push(
        `missing ${relationship} ${parentId} for ${animal.identification}`,
      );
    } else {
      if (parent.draft.sexo !== expectedSex) {
        issues.push(
          `${relationship} sex mismatch for ${animal.identification}`,
        );
      }
      validateParentAge(animal, parent, relationship, issues);
    }
  }
}

function validateAnimals({
  definition,
  issues,
  animalById,
  idSet,
  identificationSet,
  categoryCounts,
}: DefinitionValidation) {
  for (const animal of definition.animals) {
    if (idSet.has(animal.id)) issues.push(`duplicate animal id ${animal.id}`);
    idSet.add(animal.id);
    if (identificationSet.has(animal.identification)) {
      issues.push(`duplicate animal identification ${animal.identification}`);
    }
    identificationSet.add(animal.identification);
    categoryCounts.set(
      animal.category,
      (categoryCounts.get(animal.category) ?? 0) + 1,
    );
    validateAnimalBirth(animal, issues);
    if (
      animal.draft.id !== animal.id ||
      animal.draft.identificacao !== animal.identification
    ) {
      issues.push(
        `registration identity mismatch for ${animal.identification}`,
      );
    }
    validateParentage(animal, animalById, issues);
  }
}

function validateCategoryCounts({
  issues,
  categoryCounts,
}: DefinitionValidation) {
  for (const [category, expectedCount] of Object.entries(
    TEST_FARM_CATEGORY_COUNTS,
  ) as [TestFarmCategory, number][]) {
    const actualCount = categoryCounts.get(category) ?? 0;
    if (actualCount !== expectedCount) {
      issues.push(
        `category ${category} expected ${expectedCount}; received ${actualCount}`,
      );
    }
  }
}

function validateGenealogy({
  definition,
  issues,
  animalById,
}: DefinitionValidation) {
  const visitState = new Map<string, "visiting" | "visited">();
  const visit = (animalId: string) => {
    if (visitState.get(animalId) === "visiting") {
      issues.push(`genealogy cycle at ${animalId}`);
      return;
    }
    if (visitState.get(animalId) === "visited") return;
    visitState.set(animalId, "visiting");
    const animal = animalById.get(animalId);
    if (animal) {
      if (animal.draft.maeId) visit(animal.draft.maeId);
      if (animal.draft.paiId) visit(animal.draft.paiId);
    }
    visitState.set(animalId, "visited");
  };
  for (const animal of definition.animals) visit(animal.id);
}

function validateEpisodeDiagnosis(
  episode: TestFarmReproductionEpisode,
  issues: string[],
) {
  if (episode.diagnosis) {
    if (
      !isDateKey(episode.diagnosis.date) ||
      episode.diagnosis.date <= episode.service.date
    ) {
      issues.push(`diagnosis chronology invalid for episode ${episode.id}`);
    }
    if (episode.diagnosis.result === "positivo") {
      const expectedBirthDate = addDays(episode.service.date, 283);
      if (episode.diagnosis.expectedBirthDate !== expectedBirthDate) {
        issues.push(
          `positive diagnosis due date mismatch for episode ${episode.id}`,
        );
      }
    } else if (episode.diagnosis.expectedBirthDate) {
      issues.push(`negative diagnosis has due date for episode ${episode.id}`);
    }
  }
}

function validateEpisodeOutcome(
  episode: TestFarmReproductionEpisode,
  animalById: Map<string, TestFarmAnimalDefinition>,
  issues: string[],
) {
  if (episode.outcome) {
    if (
      !isDateKey(episode.outcome.date) ||
      episode.outcome.date <= episode.service.date
    ) {
      issues.push(`outcome chronology invalid for episode ${episode.id}`);
    }
    if (episode.diagnosis?.result === "negativo") {
      issues.push(`negative diagnosis has outcome for episode ${episode.id}`);
    }
    validateParturition(
      { ...episode, outcome: episode.outcome },
      animalById,
      issues,
    );
    if (episode.diagnosis && episode.diagnosis.date >= episode.outcome.date) {
      issues.push(`diagnosis occurs after outcome for episode ${episode.id}`);
    }
  }
}

function validateEpisodes({
  definition,
  issues,
  animalById,
}: DefinitionValidation) {
  const episodeIds = new Set<string>();
  const eventIds = new Set<string>();
  for (const episode of definition.reproductionEpisodes) {
    if (episodeIds.has(episode.id))
      issues.push(`duplicate reproduction episode ${episode.id}`);
    episodeIds.add(episode.id);
    const mother = animalById.get(episode.motherId);
    const sire = animalById.get(episode.sireId);
    if (!mother || mother.draft.sexo !== "F")
      issues.push(`invalid episode mother ${episode.motherId}`);
    if (!sire || sire.draft.sexo !== "M")
      issues.push(`invalid episode sire ${episode.sireId}`);
    validateEpisodeEventIds(episode, eventIds, issues);
    validateEpisodeFactDates(episode, issues);
    validateEpisodeService(episode, mother, issues);
    validateEpisodeDiagnosis(episode, issues);
    validateEpisodeOutcome(episode, animalById, issues);
  }
}

function validateEpisodeChains({ definition, issues }: DefinitionValidation) {
  const episodesByMother = new Map<string, TestFarmReproductionEpisode[]>();
  for (const episode of definition.reproductionEpisodes) {
    episodesByMother.set(episode.motherId, [
      ...(episodesByMother.get(episode.motherId) ?? []),
      episode,
    ]);
  }
  for (const [motherId, episodes] of episodesByMother) {
    validateMotherEpisodeChain(motherId, episodes, issues);
  }
}

export function validateTestFarmDefinition(definition: TestFarmDefinition) {
  const issues: string[] = [];
  const animalById = new Map(
    definition.animals.map((animal) => [animal.id, animal]),
  );
  const idSet = new Set<string>();
  const identificationSet = new Set<string>();
  const categoryCounts = new Map<TestFarmCategory, number>();

  if (definition.animals.length !== TEST_FARM_SPEC.expectedAnimals) {
    issues.push(
      `expected ${TEST_FARM_SPEC.expectedAnimals} animals; received ${definition.animals.length}`,
    );
  }

  const context = {
    definition,
    issues,
    animalById,
    idSet,
    identificationSet,
    categoryCounts,
  };
  validateAnimals(context);
  validateCategoryCounts(context);
  validateGenealogy(context);
  validateEpisodes(context);
  validateEpisodeChains(context);

  return issues;
}

function validateAnimalBirth(
  animal: TestFarmAnimalDefinition,
  issues: string[],
) {
  if (!isDateKey(animal.draft.dataNascimento ?? "")) {
    issues.push(`invalid birth date for ${animal.identification}`);
  } else if (animal.draft.dataNascimento! > TEST_FARM_SPEC.referenceDate) {
    issues.push(`birth date after reference date for ${animal.identification}`);
  }
}

function validateParentAge(
  animal: TestFarmAnimalDefinition,
  parent: TestFarmAnimalDefinition,
  relationship: string,
  issues: string[],
) {
  const parentBirth = parent.draft.dataNascimento ?? "";
  const childBirth = animal.draft.dataNascimento ?? "";
  if (
    !isDateKey(parentBirth) ||
    !isDateKey(childBirth) ||
    daysBetween(parentBirth, childBirth) < 548
  ) {
    issues.push(
      `${relationship} age chronology invalid for ${animal.identification}`,
    );
  }
}

function validateEpisodeEventIds(
  episode: TestFarmReproductionEpisode,
  eventIds: Set<string>,
  issues: string[],
) {
  for (const eventId of [
    episode.service.id,
    episode.diagnosis?.id,
    episode.outcome?.id,
  ]) {
    if (!eventId) continue;
    if (eventIds.has(eventId))
      issues.push(`duplicate reproduction event ${eventId}`);
    eventIds.add(eventId);
  }
}

function validateEpisodeFactDates(
  episode: TestFarmReproductionEpisode,
  issues: string[],
) {
  for (const factDate of [
    episode.service.date,
    episode.diagnosis?.date,
    episode.outcome?.date,
  ]) {
    if (
      factDate &&
      isDateKey(factDate) &&
      factDate > TEST_FARM_SPEC.referenceDate
    ) {
      issues.push(
        `reproduction fact after reference date for episode ${episode.id}`,
      );
    }
  }
}

function validateParturition(
  episode: TestFarmReproductionEpisode & {
    outcome: NonNullable<TestFarmReproductionEpisode["outcome"]>;
  },
  animalById: Map<string, TestFarmAnimalDefinition>,
  issues: string[],
) {
  if (episode.outcome.type === "parto") {
    const calf = animalById.get(episode.outcome.calfId);
    if (
      !calf ||
      calf.draft.maeId !== episode.motherId ||
      calf.draft.paiId !== episode.sireId
    ) {
      issues.push(`parturition parentage mismatch for episode ${episode.id}`);
    }
    if (calf?.draft.dataNascimento !== episode.outcome.date) {
      issues.push(`parturition date mismatch for episode ${episode.id}`);
    }
    if (daysBetween(episode.service.date, episode.outcome.date) !== 283) {
      issues.push(
        `parturition gestation interval mismatch for episode ${episode.id}`,
      );
    }
  }
}

function validateMotherEpisodeChain(
  motherId: string,
  episodes: TestFarmReproductionEpisode[],
  issues: string[],
) {
  const ordered = [...episodes].sort((left, right) =>
    left.service.date.localeCompare(right.service.date),
  );
  let previousOutcomeDate: string | null = null;
  let previousPartoDate: string | null = null;
  let previousOpenPregnancy = false;
  for (const episode of ordered) {
    if (previousOpenPregnancy) {
      issues.push(
        `overlapping reproduction episodes for mother ${motherId} at episode ${episode.id}`,
      );
    } else if (
      previousOutcomeDate &&
      episode.service.date <= previousOutcomeDate
    ) {
      issues.push(
        `overlapping reproduction episodes for mother ${motherId} at episode ${episode.id}`,
      );
    }
    previousPartoDate = validateCalvingInterval(
      episode,
      motherId,
      previousPartoDate,
      issues,
    );
    previousOpenPregnancy =
      !episode.outcome && episode.diagnosis?.result === "positivo";
    if (episode.outcome) previousOutcomeDate = episode.outcome.date;
  }
}

function validateCalvingInterval(
  episode: TestFarmReproductionEpisode,
  motherId: string,
  previousPartoDate: string | null,
  issues: string[],
) {
  if (episode.outcome?.type === "parto") {
    if (
      previousPartoDate &&
      daysBetween(previousPartoDate, episode.outcome.date) < 283
    ) {
      issues.push(
        `calving interval too short for mother ${motherId} at episode ${episode.id}`,
      );
    }
    previousPartoDate = episode.outcome.date;
  }
  return previousPartoDate;
}

function validateEpisodeService(
  episode: TestFarmReproductionEpisode,
  mother: TestFarmAnimalDefinition | undefined,
  issues: string[],
) {
  if (
    !isDateKey(episode.service.date) ||
    !mother?.draft.dataNascimento ||
    episode.service.date <= mother.draft.dataNascimento
  ) {
    issues.push(`service date invalid for episode ${episode.id}`);
  }
}
