import { describe, expect, it } from "vitest";
import {
  createTestFarmDefinition,
  TEST_FARM_CATEGORY_COUNTS,
  TEST_FARM_SPEC,
  validateTestFarmDefinition,
} from "../definition";

describe("test farm definition", () => {
  it("creates the fixed 120-head category distribution deterministically", () => {
    const first = createTestFarmDefinition();
    const second = createTestFarmDefinition();
    const categoryCounts = Object.fromEntries(
      Object.keys(TEST_FARM_CATEGORY_COUNTS).map((category) => [
        category,
        first.animals.filter((animal) => animal.category === category).length,
      ]),
    );

    expect(first).toEqual(second);
    expect(first.animals).toHaveLength(TEST_FARM_SPEC.expectedAnimals);
    expect(categoryCounts).toEqual(TEST_FARM_CATEGORY_COUNTS);
    expect(validateTestFarmDefinition(first)).toEqual([]);
  });

  it("contains multigenerational parentage, half-siblings, and incomplete pedigrees", () => {
    const definition = createTestFarmDefinition();
    const animalsById = new Map(definition.animals.map((animal) => [animal.id, animal]));
    const animalsWithDam = definition.animals.filter((animal) => animal.draft.maeId);
    const animalsWithoutCompletePedigree = definition.animals.filter(
      (animal) => !animal.draft.maeId || !animal.draft.paiId,
    );
    const offspringByMother = new Map<string, string[]>();
    const offspringBySire = new Map<string, string[]>();

    for (const animal of definition.animals) {
      if (animal.draft.maeId) {
        offspringByMother.set(animal.draft.maeId, [
          ...(offspringByMother.get(animal.draft.maeId) ?? []),
          animal.id,
        ]);
      }
      if (animal.draft.paiId) {
        offspringBySire.set(animal.draft.paiId, [
          ...(offspringBySire.get(animal.draft.paiId) ?? []),
          animal.id,
        ]);
      }
    }

    const hasThreeGenerations = animalsWithDam.some((animal) => {
      const mother = animalsById.get(animal.draft.maeId!);
      return Boolean(mother?.draft.maeId && animalsById.has(mother.draft.maeId));
    });

    expect(hasThreeGenerations).toBe(true);
    expect(animalsWithoutCompletePedigree.length).toBeGreaterThan(0);
    expect([...offspringByMother.values()].some((offspring) => offspring.length > 1)).toBe(true);
    expect([...offspringBySire.values()].some((offspring) => offspring.length > 1)).toBe(true);
    expect(definition.reproductionEpisodes.filter((episode) => episode.outcome?.type === "parto").length)
      .toBeGreaterThan(1);
  });

  it("rejects animals born after the reference date", () => {
    const definition = createTestFarmDefinition();
    definition.animals[0]!.draft.dataNascimento = "2026-10-24";

    expect(validateTestFarmDefinition(definition)).toContain(
      `birth date after reference date for ${definition.animals[0]!.identification}`,
    );
  });

  it("rejects reproduction facts after the reference date", () => {
    const definition = createTestFarmDefinition();
    const episode = definition.reproductionEpisodes[0]!;
    episode.service.date = "2026-10-24";

    expect(validateTestFarmDefinition(definition)).toContain(
      `reproduction fact after reference date for episode ${episode.id}`,
    );
  });

  it("keeps explicit service dates instead of deriving them from outcomes", () => {
    const definition = createTestFarmDefinition();
    const lossEpisodes = definition.reproductionEpisodes.filter(
      (episode) => episode.outcome?.type === "aborto",
    );

    expect(lossEpisodes.map((episode) => [
      episode.service.date,
      (episode.outcome as { date: string }).date,
    ]).sort(([left], [right]) => left.localeCompare(right))).toEqual([
      ["2026-05-15", "2026-07-15"],
      ["2026-05-16", "2026-07-16"],
    ]);
    expect(validateTestFarmDefinition(definition)).toEqual([]);
  });

  it("rejects consecutive calvings closer than the gestation length", () => {
    const definition = createTestFarmDefinition();
    const animalsById = new Map(definition.animals.map((animal) => [animal.id, animal]));
    const partoEpisodesByDam = new Map<string, typeof definition.reproductionEpisodes>();
    for (const episode of definition.reproductionEpisodes) {
      if (episode.outcome?.type !== "parto") continue;
      const damId = animalsById.get(episode.outcome.calfId)!.draft.maeId!;
      partoEpisodesByDam.set(damId, [
        ...(partoEpisodesByDam.get(damId) ?? []),
        episode,
      ]);
    }
    const damId = [...partoEpisodesByDam.entries()]
      .find(([, episodes]) => episodes.length >= 2)![0];
    const [first, second] = partoEpisodesByDam
      .get(damId)!
      .sort((left, right) => left.outcome!.date.localeCompare(right.outcome!.date));
    const conflictedBirthDate = new Date(
      `${first.outcome!.date}T12:00:00.000Z`,
    );
    conflictedBirthDate.setUTCDate(conflictedBirthDate.getUTCDate() + 100);
    const conflictedDate = conflictedBirthDate.toISOString().slice(0, 10);
    const conflictedCalf = animalsById.get(
      (second.outcome as { calfId: string }).calfId,
    )!;
    conflictedCalf.draft.dataNascimento = conflictedDate;
    second.outcome = { type: "parto", id: second.outcome!.id, date: conflictedDate, calfId: conflictedCalf.id };

    expect(validateTestFarmDefinition(definition)).toContain(
      `calving interval too short for mother ${damId} at episode ${second.id}`,
    );
  });

  it("rejects a new service during an open pregnancy", () => {
    const definition = createTestFarmDefinition();
    const openEpisode = definition.reproductionEpisodes.find(
      (episode) => episode.diagnosis?.result === "positivo" && !episode.outcome,
    )!;
    definition.reproductionEpisodes.push({
      id: "synthetic-episode-during-open-pregnancy",
      motherId: openEpisode.motherId,
      sireId: openEpisode.sireId,
      service: { id: "synthetic-service-during-open-pregnancy", date: "2026-09-01" },
      diagnosis: {
        id: "synthetic-diagnosis-during-open-pregnancy",
        date: "2026-10-01",
        result: "negativo",
      },
    });

    expect(validateTestFarmDefinition(definition)).toContain(
      `overlapping reproduction episodes for mother ${openEpisode.motherId} at episode synthetic-episode-during-open-pregnancy`,
    );
  });

  it("detects broken parent references, cycles, and invalid reproduction chronology", () => {
    const definition = createTestFarmDefinition();
    const child = definition.animals.find((animal) => animal.draft.maeId)!;
    child.draft.maeId = child.id;
    const episode = definition.reproductionEpisodes[0]!;
    episode.outcome = {
      type: "parto",
      id: episode.outcome?.id ?? "duplicate-event-id",
      date: "2020-01-01",
      calfId: child.id,
    };

    expect(validateTestFarmDefinition(definition)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("mother age chronology invalid"),
        expect.stringContaining("genealogy cycle"),
        expect.stringContaining("parturition parentage mismatch"),
        expect.stringContaining("parturition date mismatch"),
        expect.stringContaining("parturition gestation interval mismatch"),
      ]),
    );
  });
});
