import { buildAnimalRegistrationRecord } from "@/lib/animals/registration";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { buildLoteRegistrationRecord } from "@/lib/structures/registration";
import { buildCalfJourneyAgendaOps } from "@/lib/reproduction/calfJourney";
import { registerReproductionGesture } from "@/lib/reproduction/register";
import { db } from "@/lib/offline/db";
import { requireTenantSensitiveAccess } from "@/lib/offline/localReadBoundary";
import { createGesture } from "@/lib/offline/ops";
import type { AgendaItem } from "@/lib/offline/types";
import { supabase } from "@/lib/supabase";
import { getActiveFarmId } from "@/lib/storage";
import { matchesPersistedSeedCalf, matchesPersistedSeedReproduction, waitForTestFarmGesture } from "./progress";
import {
  createTestFarmDefinition,
  testFarmStableId,
  TEST_FARM_CATEGORY_COUNTS,
  TEST_FARM_SPEC,
  validateTestFarmDefinition,
  type TestFarmAnimalDefinition,
  type TestFarmDefinition,
} from "./definition";

const LOTE_NAMES = {
  matrizes: "DEMO Matrizes",
  novilhas: "DEMO Novilhas",
  crias: "DEMO Crias",
  recria: "DEMO Recria",
  touros: "DEMO Touros",
} as const;
const REFERENCE_INSTANT = `${TEST_FARM_SPEC.referenceDate}T12:00:00.000Z`;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function stableId(key: string) {
  return testFarmStableId(`${TEST_FARM_SPEC.logicalId}:${key}`);
}

function assertFarmContext(farmId: string) {
  assertLocalEnvironment();
  if (getActiveFarmId() !== farmId) throw new Error("TEST_FARM_ACTIVE_FARM_CHANGED");
}

function expectedReproductionFacts(data: Parameters<typeof registerReproductionGesture>[0]["data"]) {
  return { tipo: data.tipo, macho_id: data.machoId ?? null, payload: {
    tecnica_livre: data.tecnicaLivre, reprodutor_tag: data.reprodutorTag,
    lote_semen: data.loteSemen, dose_semen_ref: data.doseSemenRef,
    resultado: data.resultadoDiagnostico, data_prevista_parto: data.dataPrevistaParto,
    episode_evento_id: data.episodeEventoId, data_parto_real: data.dataParto,
    numero_crias: data.numeroCrias,
  } };
}

async function confirmGesture(farmId: string, txId: string) {
  assertFarmContext(farmId);
  const { processGesture, drainReconciliationObligations } = await import("@/lib/offline/syncWorker");
  const gesture = await db.queue_gestures.get(txId);
  if (!gesture || gesture.fazenda_id !== farmId) throw new Error("TEST_FARM_TX_FARM_MISMATCH");
  assertFarmContext(farmId);
  if (gesture.status === "PENDING") await processGesture(gesture);
  assertFarmContext(farmId);
  await drainReconciliationObligations(farmId);
  await waitForTestFarmGesture(farmId, txId);
  assertFarmContext(farmId);
}

function assertLocalEnvironment() {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    throw new Error("TEST_FARM_LOCAL_DEVELOPMENT_ONLY");
  }
  let backendHost: string;
  try { backendHost = new URL(import.meta.env.VITE_SUPABASE_URL).hostname; }
  catch { throw new Error("TEST_FARM_LOCAL_BACKEND_REQUIRED"); }
  if (!LOCAL_HOSTS.has(backendHost) || !LOCAL_HOSTS.has(window.location.hostname)) {
    throw new Error("TEST_FARM_LOCAL_BACKEND_REQUIRED");
  }
}

async function getAuthorizedUser() {
  assertLocalEnvironment();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("TEST_FARM_AUTH_REQUIRED");
  return data.user;
}

async function getFarmMembership(farmId: string, userId: string) {
  const { data, error } = await supabase
    .from("user_fazendas")
    .select("role")
    .eq("user_id", userId)
    .eq("fazenda_id", farmId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("TEST_FARM_MEMBERSHIP_LOOKUP_FAILED");
  return data;
}

async function findOwnedTestFarm(userId: string) {
  const { data, error } = await supabase
    .from("fazendas")
    .select("id, nome, codigo, tipo_producao, created_by")
    .eq("codigo", TEST_FARM_SPEC.logicalId)
    .is("deleted_at", null)
    .limit(2);
  if (error) throw new Error("TEST_FARM_LOOKUP_FAILED");
  if ((data ?? []).length > 1) throw new Error("TEST_FARM_DUPLICATE_LOGICAL_ID");
  if (!data?.length) return null;

  const farm = data[0];
  const membership = await getFarmMembership(farm.id, userId);
  if (!membership || membership.role !== "owner") {
    throw new Error("TEST_FARM_LOGICAL_ID_OWNED_BY_OTHER_USER");
  }
  if (farm.created_by !== userId || farm.nome !== TEST_FARM_SPEC.name || farm.tipo_producao !== "corte") {
    throw new Error("TEST_FARM_EXISTING_FARM_MISMATCH");
  }
  return farm;
}

export async function provisionTestFarm() {
  const user = await getAuthorizedUser();
  if (!navigator.locks) throw new Error("TEST_FARM_CREATION_LOCK_UNAVAILABLE");

  return navigator.locks.request(
    `rebanhosync:${TEST_FARM_SPEC.logicalId}:provision`,
    async () => {
      const existing = await findOwnedTestFarm(user.id);
      if (existing) return { farmId: existing.id, created: false };

      const { data: farmId, error } = await supabase.rpc("create_fazenda", {
        _nome: TEST_FARM_SPEC.name,
        _codigo: TEST_FARM_SPEC.logicalId,
        _municipio: null,
        _estado: null,
        _cep: null,
        _area_total_ha: null,
        _tipo_producao: TEST_FARM_SPEC.productionType,
        _sistema_manejo: null,
      });
      if (error || !farmId) throw new Error("TEST_FARM_CREATION_FAILED");

      const membership = await getFarmMembership(farmId, user.id);
      if (membership?.role !== "owner") {
        throw new Error("TEST_FARM_CANONICAL_MEMBERSHIP_NOT_CONFIRMED");
      }
      const createdFarm = await findOwnedTestFarm(user.id);
      if (!createdFarm || createdFarm.id !== farmId) {
        throw new Error("TEST_FARM_CREATION_IDENTITY_NOT_CONFIRMED");
      }
      return { farmId, created: true };
    },
  );
}

function lotId(lotKey: keyof typeof LOTE_NAMES) {
  return stableId(`lot:${lotKey}`);
}

function lotAtAge(animal: TestFarmAnimalDefinition, ageDays: number): keyof typeof LOTE_NAMES {
  const weanedCategory = animal.category === "novilha" || animal.category === "macho_recria";
  return weanedCategory && ageDays < 210 ? "crias" : animal.lotKey;
}

function birthOutcomeForAnimal(definition: TestFarmDefinition, animalId: string) {
  return definition.reproductionEpisodes.find(
    (episode) => episode.outcome?.type === "parto" && episode.outcome.calfId === animalId,
  );
}

export function buildTestFarmAnimalRegistration(
  animal: TestFarmAnimalDefinition,
  farmId: string,
  definition: TestFarmDefinition,
) {
  const birth = birthOutcomeForAnimal(definition, animal.id);
  const payload = {
    test_farm_seed: TEST_FARM_SPEC.logicalId,
    category: animal.category,
    ...(birth
      ? {
          generated_from: "evento_parto",
          birth_event_id: birth.outcome?.id,
          ordem_cria: 1,
        }
      : {}),
  };
  return buildAnimalRegistrationRecord({
    fazendaId: farmId,
    recordedAt: REFERENCE_INSTANT,
    origem: birth ? "nascimento" : null,
    lifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    draft: {
      ...animal.draft,
      preparedPayload: true,
      payload,
      loteId: lotId(animal.lotKey),
      papelMacho: animal.category === "touro" ? "reprodutor" : null,
      habilitadoMonta: animal.category === "touro",
    },
  });
}

async function insertIfAbsent(
  farmId: string,
  table: "animais" | "lotes",
  id: string,
  record: Record<string, unknown>,
  definition: TestFarmDefinition,
) {
  const store = db.table(table === "animais" ? "state_animais" : "state_lotes");
  const existing = await store.get(id) as Record<string, unknown> | undefined;
  if (existing) {
    if (existing.fazenda_id !== farmId || existing.id !== id) {
      throw new Error("TEST_FARM_LOCAL_IDENTITY_CONFLICT");
    }
    if (table === "animais") {
      const animal = existing as { identificacao?: string; payload?: Record<string, unknown> };
      if (animal.identificacao !== record.identificacao) {
        throw new Error("TEST_FARM_LOCAL_ANIMAL_CONFLICT");
      }
      const birth = birthOutcomeForAnimal(definition, id);
      const expectedBirthEventId = birth?.outcome?.id;
      if (expectedBirthEventId && animal.payload?.birth_event_id !== expectedBirthEventId) {
        throw new Error("TEST_FARM_LOCAL_BIRTH_IDENTITY_CONFLICT");
      }
      if (!expectedBirthEventId && animal.payload?.test_farm_seed !== TEST_FARM_SPEC.logicalId) {
        throw new Error("TEST_FARM_LOCAL_ANIMAL_CONFLICT");
      }
    } else if (existing.nome !== record.nome) {
      throw new Error("TEST_FARM_LOCAL_LOT_CONFLICT");
    }
    if (typeof existing.client_tx_id !== "string") throw new Error("TEST_FARM_RECORD_TX_MISSING");
    await confirmGesture(farmId, existing.client_tx_id);
    return false;
  }

  const txId = await createGesture(farmId, [{ table, action: "INSERT", record }], {
    validateContext: () => assertFarmContext(farmId),
    clientTxId: stableId(`tx:${table}:${id}`),
    clientOpIds: [stableId(`op:${table}:${id}`)],
  });
  await confirmGesture(farmId, txId);
  return true;
}

function isoDate(date: string) {
  return `${date}T12:00:00.000Z`;
}

function buildWeightAndMovementHistory(
  farmId: string,
  definition: TestFarmDefinition,
) {
  const ops = [];
  const eventIds: string[] = [];
  const referenceDate = new Date(`${TEST_FARM_SPEC.referenceDate}T12:00:00.000Z`);

  for (const animal of definition.animals) {
    const birthDate = new Date(`${animal.draft.dataNascimento}T12:00:00.000Z`);
    const ageDays = Math.floor((referenceDate.getTime() - birthDate.getTime()) / 86_400_000);
    const ages = ageDays >= 365 ? [ageDays - 180, ageDays] : ageDays >= 45 ? [ageDays - 30, ageDays] : [7, ageDays];
    const uniqueAges = [...new Set(ages)].filter((age) => age > 0 && age <= ageDays);

    for (const [index, age] of uniqueAges.entries()) {
      const occurredOn = new Date(birthDate.getTime() + age * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const eventId = stableId(`event:weight:${animal.id}:${occurredOn}`);
      const weightKg = Math.round(
        Math.min(
          animal.draft.sexo === "F" ? 520 : 650,
          35 + age * (age < 210 ? 0.55 : age < 730 ? 0.38 : 0.2),
        ) * 10,
      ) / 10;
      const built = buildEventGesture({
        dominio: "pesagem",
        fazendaId: farmId,
        eventId,
        occurredAt: isoDate(occurredOn),
        animalId: animal.id,
        loteId: lotId(lotAtAge(animal, age)),
        pesoKg: weightKg,
        observacoes: "Registro sintetico para homologacao local.",
        payload: {
          test_farm_seed: TEST_FARM_SPEC.logicalId,
          measurement_sequence: index + 1,
        },
      });
      eventIds.push(eventId);
      ops.push(...built.ops);
    }

    if (
      (animal.category === "novilha" || animal.category === "macho_recria") &&
      ageDays >= 210
    ) {
      const weaningDate = new Date(birthDate.getTime() + 210 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const movementEventId = stableId(`event:weaning-movement:${animal.id}`);
      const built = buildEventGesture({
        dominio: "movimentacao",
        fazendaId: farmId,
        eventId: movementEventId,
        occurredAt: isoDate(weaningDate),
        animalId: animal.id,
        loteId: lotId("crias"),
        fromLoteId: lotId("crias"),
        toLoteId: lotId(animal.lotKey),
        applyAnimalStateUpdate: false,
        observacoes: "Movimentacao historica sintetica na desmama.",
        payload: {
          test_farm_seed: TEST_FARM_SPEC.logicalId,
          milestone: "desmame",
        },
      });
      eventIds.push(movementEventId);
      ops.push(...built.ops);
    }
  }

  return { ops, eventIds };
}

async function registerConfirmedReproduction(input: Parameters<typeof registerReproductionGesture>[0]) {
  assertFarmContext(input.fazendaId);
  const existingEvent = input.eventId ? await db.event_eventos.get(input.eventId) : undefined;
  if (existingEvent) {
    const detail = await db.event_eventos_reproducao.get(input.eventId!);
    if (existingEvent.fazenda_id !== input.fazendaId || !existingEvent.client_tx_id ||
      existingEvent.animal_id !== input.animalId || Date.parse(existingEvent.occurred_at) !== Date.parse(input.occurredAt!) ||
      !detail || detail.fazenda_id !== input.fazendaId || detail.tipo !== input.data.tipo ||
      !matchesPersistedSeedReproduction(detail, expectedReproductionFacts(input.data)) ||
      (input.data.episodeEventoId && detail.payload?.episode_evento_id !== input.data.episodeEventoId)) {
      throw new Error("TEST_FARM_EVENT_IDENTITY_CONFLICT");
    }
    if (input.data.tipo === "parto") {
      if (detail.payload?.data_parto_real !== input.data.dataParto || detail.payload?.numero_crias !== input.data.numeroCrias) throw new Error("TEST_FARM_BIRTH_IDENTITY_CONFLICT");
      for (const expected of input.data.crias ?? []) {
        const calf = expected.localId ? await db.state_animais.get(expected.localId) : undefined;
        if (!calf || !matchesPersistedSeedCalf(calf, { id: expected.localId, fazenda_id: input.fazendaId,
          mae_id: input.animalId, pai_id: input.paiId ?? input.data.machoId ?? null,
          identificacao: expected.identificacao, sexo: expected.sexo, data_nascimento: input.data.dataParto,
          birth_event_id: input.eventId })) throw new Error("TEST_FARM_BIRTH_IDENTITY_CONFLICT");
      }
    }
    await confirmGesture(input.fazendaId, existingEvent.client_tx_id);
    return;
  }
  const { pullDataForFarm } = await import("@/lib/offline/pull");
  assertFarmContext(input.fazendaId);
  await pullDataForFarm(input.fazendaId, ["animais"], { mode: "merge" });
  assertFarmContext(input.fazendaId);
  const result = await registerReproductionGesture(input, { validateContext: () => assertFarmContext(input.fazendaId) });
  await confirmGesture(input.fazendaId, result.txId);
  return result;
}

async function registerReproductionHistory(
  farmId: string,
  definition: TestFarmDefinition,
) {
  const animalsById = new Map(definition.animals.map((animal) => [animal.id, animal]));
  const episodes = [...definition.reproductionEpisodes].sort((left, right) =>
    left.service.date.localeCompare(right.service.date),
  );

  for (const episode of episodes) {
    const mother = animalsById.get(episode.motherId);
    const calf = episode.outcome?.type === "parto"
      ? animalsById.get(episode.outcome.calfId)
      : undefined;
    if (!mother || (episode.outcome?.type === "parto" && !calf)) {
      throw new Error("TEST_FARM_REPRODUCTION_REFERENCE_MISSING");
    }
    const motherLot = lotId(mother.lotKey);
    await registerConfirmedReproduction({
      fazendaId: farmId,
      animalId: mother.id,
      animalIdentificacao: mother.identification,
      loteId: motherLot,
      occurredAt: isoDate(episode.service.date),
      eventId: episode.service.id,
      data: {
        tipo: "cobertura",
        machoId: episode.sireId,
        tecnicaLivre: "monta_natural",
        reprodutorTag: "cadastrado_no_rebanho",
        observacoes: `Registro sintetico ${TEST_FARM_SPEC.logicalId}`,
      },
    });

    if (episode.diagnosis) {
      await registerConfirmedReproduction({
        fazendaId: farmId,
        animalId: mother.id,
        animalIdentificacao: mother.identification,
        loteId: motherLot,
        occurredAt: isoDate(episode.diagnosis.date),
        eventId: episode.diagnosis.id,
        data: {
          tipo: "diagnostico",
          resultadoDiagnostico: episode.diagnosis.result,
          ...(episode.diagnosis.expectedBirthDate
            ? { dataPrevistaParto: episode.diagnosis.expectedBirthDate }
            : {}),
          episodeEventoId: episode.service.id,
          episodeLinkMethod: "manual",
          observacoes: `Registro sintetico ${TEST_FARM_SPEC.logicalId}`,
        },
      });
    }

    if (episode.outcome?.type === "parto") {
      const birth = episode.outcome;
      await registerConfirmedReproduction({
        fazendaId: farmId,
        animalId: mother.id,
        animalIdentificacao: mother.identification,
        loteId: lotId(calf!.lotKey),
        paiId: episode.sireId,
        maeEspecie: mother.draft.especie ?? null,
        maeRaca: mother.draft.raca ?? null,
        occurredAt: isoDate(birth.date),
        eventId: birth.id,
        data: {
          tipo: "parto",
          machoId: episode.sireId,
          dataParto: birth.date,
          numeroCrias: 1,
          crias: [{
            localId: calf!.id,
            identificacao: calf!.identification,
            sexo: calf!.draft.sexo,
          }],
          episodeEventoId: episode.service.id,
          episodeLinkMethod: "manual",
          observacoes: `Registro sintetico ${TEST_FARM_SPEC.logicalId}`,
        },
      });
    } else if (episode.outcome?.type === "aborto") {
      await registerConfirmedReproduction({
        fazendaId: farmId,
        animalId: mother.id,
        animalIdentificacao: mother.identification,
        loteId: motherLot,
        occurredAt: isoDate(episode.outcome.date),
        eventId: episode.outcome.id,
        data: {
          tipo: "aborto",
          episodeEventoId: episode.service.id,
          episodeLinkMethod: "manual",
          observacoes: `Perda gestacional sintetica ${TEST_FARM_SPEC.logicalId}`,
        },
      });
    }
  }
}

function buildCalfAgendas(
  farmId: string,
  definition: TestFarmDefinition,
  existingItems: AgendaItem[],
) {
  const animalsById = new Map(definition.animals.map((animal) => [animal.id, animal]));
  const existingByAnimal = new Map<string, typeof existingItems>();
  for (const item of existingItems) {
    if (!item.animal_id) continue;
    existingByAnimal.set(item.animal_id, [
      ...(existingByAnimal.get(item.animal_id) ?? []),
      item,
    ]);
  }
  const ops = [];
  for (const episode of definition.reproductionEpisodes) {
    if (episode.outcome?.type !== "parto") continue;
    const calf = animalsById.get(episode.outcome.calfId);
    const mother = animalsById.get(episode.motherId);
    if (!calf || !mother) continue;
    const built = buildCalfJourneyAgendaOps({
      fazendaId: farmId,
      calf: {
        id: calf.id,
        identificacao: calf.identification,
        lote_id: lotId(calf.lotKey),
        data_nascimento: calf.draft.dataNascimento,
        payload: { generated_from: "evento_parto", birth_event_id: episode.outcome.id },
      },
      mother: { id: mother.id, identificacao: mother.identification },
      existingAgendaItems: existingByAnimal.get(calf.id) ?? [],
      createAgendaId: (dedupKey) => stableId(`agenda:${dedupKey}`),
    });
    ops.push(...built.ops.filter((op) => op.record.dominio !== "sanitario"));
  }
  return ops;
}

export function dryRunTestFarm() {
  const definition = createTestFarmDefinition();
  const integrityIssues = validateTestFarmDefinition(definition);
  if (integrityIssues.length) throw new Error(integrityIssues.join("; "));
  const birthEvents = definition.reproductionEpisodes.filter((episode) => episode.outcome?.type === "parto");
  const weightAndMovementHistory = buildWeightAndMovementHistory(definition.id, definition);
  const calfAgendaOps = buildCalfAgendas(definition.id, definition, []);
  return {
    environment: "local-development-only",
    logicalId: TEST_FARM_SPEC.logicalId,
    farmName: TEST_FARM_SPEC.name,
    referenceDate: TEST_FARM_SPEC.referenceDate,
    animalCount: definition.animals.length,
    rootAnimalCount: definition.animals.length - birthEvents.length,
    categoryCounts: TEST_FARM_CATEGORY_COUNTS,
    genealogy: {
      birthEvents: birthEvents.length,
      pregnancies: definition.reproductionEpisodes.filter((episode) => episode.diagnosis?.result === "positivo" && !episode.outcome).length,
      negativeDiagnoses: definition.reproductionEpisodes.filter((episode) => episode.diagnosis?.result === "negativo").length,
      gestationalLosses: definition.reproductionEpisodes.filter((episode) => episode.outcome?.type === "aborto").length,
    },
    plannedAgendaItems: calfAgendaOps.length,
    plannedWeightEvents: weightAndMovementHistory.ops.filter((op) => op.record.dominio === "pesagem").length,
    plannedMovementEvents: weightAndMovementHistory.ops.filter((op) => op.table === "movement_v1").length,
    sanitaryExecutionCount: 0,
    sanitaryOmission: "Sem produto/protocolo local validado para dose, via e carÃªncia; nenhuma execuÃ§Ã£o serÃ¡ fabricada.",
    integrityIssues,
  };
}

export async function seedTestFarm(farmId: string, options: { stopAfter?: "canary" | "reproduction" | "history" } = {}) {
  const user = await getAuthorizedUser();
  if (!navigator.locks) throw new Error("TEST_FARM_SEED_LOCK_UNAVAILABLE");
  return navigator.locks.request(
    `rebanhosync:${TEST_FARM_SPEC.logicalId}:${farmId}:seed`,
    async () => {
      const membership = await getFarmMembership(farmId, user.id);
      if (membership?.role !== "owner") throw new Error("TEST_FARM_OWNER_MEMBERSHIP_REQUIRED");
      if (getActiveFarmId() !== farmId) throw new Error("TEST_FARM_SELECT_IN_NORMAL_FARM_SWITCHER_FIRST");
      const ownedTestFarm = await findOwnedTestFarm(user.id);
      if (ownedTestFarm?.id !== farmId) throw new Error("TEST_FARM_NOT_PROVISIONED_FOR_USER");
      await requireTenantSensitiveAccess();

  const definition = createTestFarmDefinition();
  const validationIssues = validateTestFarmDefinition(definition);
  if (validationIssues.length) throw new Error(validationIssues.join("; "));
  const seedAnimalIds = new Set(definition.animals.map((animal) => animal.id));
  const localAnimals = await db.state_animais.where("fazenda_id").equals(farmId).toArray();
  if (localAnimals.some((animal) => !seedAnimalIds.has(animal.id))) {
    throw new Error("TEST_FARM_NON_SEED_ANIMAL_DATA_PRESENT");
  }

  const birthAnimalIds = new Set(
    definition.reproductionEpisodes
      .filter((episode) => episode.outcome?.type === "parto")
      .map((episode) => episode.outcome!.type === "parto" ? episode.outcome.calfId : ""),
  );
  const existingBirthAnimalIds = new Set(
    localAnimals.filter((animal) => birthAnimalIds.has(animal.id)).map((animal) => animal.id),
  );
  const lotIds = new Set<string>();
  let lotsCreated = 0;
  for (const [key, name] of Object.entries(LOTE_NAMES) as [keyof typeof LOTE_NAMES, string][]) {
    const id = lotId(key);
    lotIds.add(id);
    const record = buildLoteRegistrationRecord({
      fazendaId: farmId,
      recordedAt: REFERENCE_INSTANT,
      draft: { id, nome: name, status: "ativo", payload: { test_farm_seed: TEST_FARM_SPEC.logicalId } },
    });
    if (await insertIfAbsent(farmId, "lotes", id, record, definition)) lotsCreated += 1;
  }

  let rootAnimalsCreated = 0;
  const rootAnimals = definition.animals
    .filter((animal) => !birthAnimalIds.has(animal.id))
    .sort((left, right) =>
      (left.draft.dataNascimento ?? "").localeCompare(right.draft.dataNascimento ?? ""),
    );
  for (const animal of rootAnimals) {
    const record = buildTestFarmAnimalRegistration(animal, farmId, definition);
    if (await insertIfAbsent(farmId, "animais", animal.id, record, definition)) rootAnimalsCreated += 1;
    if (options.stopAfter === "canary") return { farmId, stage: "canary", animalId: animal.id, rootAnimalsCreated, lotsCreated };
  }

  await registerReproductionHistory(farmId, definition);
  if (options.stopAfter === "reproduction") return { farmId, stage: "reproduction", rootAnimalsCreated, lotsCreated };

  const history = buildWeightAndMovementHistory(farmId, definition);
  const existingEventRows = await db.event_eventos.bulkGet(history.eventIds);
  for (const [index, event] of existingEventRows.entries()) {
    if (event && (
      event.fazenda_id !== farmId ||
      event.id !== history.eventIds[index] ||
      event.payload?.test_farm_seed !== TEST_FARM_SPEC.logicalId
    )) throw new Error("TEST_FARM_LOCAL_EVENT_IDENTITY_CONFLICT");
    if (event) {
      if (!event.client_tx_id) throw new Error("TEST_FARM_EVENT_TX_MISSING");
      await confirmGesture(farmId, event.client_tx_id);
    }
  }
  const missingEventIds = new Set(
    existingEventRows.flatMap((event, index) => event ? [] : [history.eventIds[index]]),
  );
  for (const eventId of missingEventIds) {
    const ops = history.ops.filter(op =>
      String(op.record.id ?? op.record.evento_id ?? op.record.event_id) === eventId,
    );
    const txId = await createGesture(farmId, ops, {
      validateContext: () => assertFarmContext(farmId),
    clientTxId: stableId(`tx:history:${eventId}`),
      clientOpIds: ops.map(op => stableId(`op:${op.table}:${String(op.record.id ?? op.record.evento_id ?? op.record.event_id)}`)),
    });
    await confirmGesture(farmId, txId);
  }
  if (options.stopAfter === "history") return { farmId, stage: "history", eventsCreated: missingEventIds.size };

  const existingAgendaItems = await db.state_agenda_itens.where("fazenda_id").equals(farmId).toArray();
  for (const item of existingAgendaItems.filter(item => item.dedup_key?.startsWith("calf_journey:"))) {
    if (!item.client_tx_id) throw new Error("TEST_FARM_AGENDA_TX_MISSING");
    await confirmGesture(farmId, item.client_tx_id);
  }
  const calfAgendaOps = buildCalfAgendas(farmId, definition, existingAgendaItems);
  for (const op of calfAgendaOps) {
    const txId = await createGesture(farmId, [op], {
      validateContext: () => assertFarmContext(farmId),
    clientTxId: stableId(`tx:agenda:${String(op.record.id)}`),
      clientOpIds: [stableId(`op:agenda:${String(op.record.id)}`)],
    });
    await confirmGesture(farmId, txId);
  }

  return {
    farmId,
    lotsCreated,
    rootAnimalsCreated,
    birthAnimalsCreated: birthAnimalIds.size - existingBirthAnimalIds.size,
    totalAnimals: definition.animals.length,
    calfAgendasCreated: calfAgendaOps.length,
    weightAndMovementEventsCreated: missingEventIds.size,
    reproductionEpisodes: definition.reproductionEpisodes.length,
    sanitaryExecutionCount: 0,
  };
    },
  );
}

export async function verifyTestFarm(farmId: string) {
  const user = await getAuthorizedUser();
  const membership = await getFarmMembership(farmId, user.id);
  if (membership?.role !== "owner") throw new Error("TEST_FARM_OWNER_MEMBERSHIP_REQUIRED");
  if (getActiveFarmId() !== farmId) throw new Error("TEST_FARM_SELECT_IN_NORMAL_FARM_SWITCHER_FIRST");
  await requireTenantSensitiveAccess();
  const { data: farm, error } = await supabase
    .from("fazendas")
    .select("id, nome, codigo, tipo_producao")
    .eq("id", farmId)
    .maybeSingle();
  if (error || !farm) throw new Error("TEST_FARM_NOT_ACCESSIBLE");
  if (farm.codigo !== TEST_FARM_SPEC.logicalId || farm.nome !== TEST_FARM_SPEC.name || farm.tipo_producao !== "corte") {
    throw new Error("TEST_FARM_REMOTE_IDENTITY_MISMATCH");
  }

  const definition = createTestFarmDefinition();
  const issues = validateTestFarmDefinition(definition);
  const persistedAnimals = await db.state_animais.bulkGet(definition.animals.map((animal) => animal.id));
  const presentAnimals = persistedAnimals.filter((animal) => animal?.fazenda_id === farmId);
  const seedAnimalIds = new Set(definition.animals.map((animal) => animal.id));
  const localAnimals = await db.state_animais.where("fazenda_id").equals(farmId).toArray();
  if (localAnimals.some((animal) => !seedAnimalIds.has(animal.id))) {
    issues.push("unexpected non-seed animal data present in test farm");
  }
  for (const [index, expected] of definition.animals.entries()) {
    const persisted = persistedAnimals[index];
    if (!persisted || persisted.fazenda_id !== farmId) {
      issues.push(`missing or cross-farm animal ${expected.identification}`);
      continue;
    }
    if (
      persisted.identificacao !== expected.identification ||
      persisted.sexo !== expected.draft.sexo ||
      persisted.data_nascimento !== expected.draft.dataNascimento ||
      persisted.mae_id !== expected.draft.maeId ||
      persisted.pai_id !== expected.draft.paiId ||
      persisted.raca !== "nelore"
    ) {
      issues.push(`persisted animal differs from seed definition ${expected.identification}`);
    }
  }

  const lotKeys = Object.keys(LOTE_NAMES) as (keyof typeof LOTE_NAMES)[];
  const persistedLots = await db.state_lotes.bulkGet(lotKeys.map(lotId));
  const presentLots = persistedLots.filter((lot) => lot?.fazenda_id === farmId);
  const reproductionEventIds = definition.reproductionEpisodes.flatMap((episode) => [
    episode.service.id,
    ...(episode.diagnosis ? [episode.diagnosis.id] : []),
    ...(episode.outcome ? [episode.outcome.id] : []),
  ]);
  const persistedReproductionEvents = await db.event_eventos.bulkGet(reproductionEventIds);
  const persistedReproductionDetails = await db.event_eventos_reproducao.bulkGet(reproductionEventIds);
  for (const episode of definition.reproductionEpisodes) {
    const expectedFacts = [
      { id: episode.service.id, data: { tipo: "cobertura" as const, machoId: episode.sireId, tecnicaLivre: "monta_natural", reprodutorTag: "cadastrado_no_rebanho" } },
      ...(episode.diagnosis ? [{ id: episode.diagnosis.id, data: { tipo: "diagnostico" as const, resultadoDiagnostico: episode.diagnosis.result, dataPrevistaParto: episode.diagnosis.expectedBirthDate, episodeEventoId: episode.service.id } }] : []),
    ];
    for (const expected of expectedFacts) {
      const detail = persistedReproductionDetails.find(row => row?.evento_id === expected.id);
      if (!detail || !matchesPersistedSeedReproduction(detail, expectedReproductionFacts(expected.data))) {
        issues.push(`reproduction factual content mismatch ${expected.id}`);
      }
    }
  }
  const reproductionCount = persistedReproductionEvents.filter((event) => event?.fazenda_id === farmId).length;
  const reproductionDetailCount = persistedReproductionDetails.filter((event) => event?.fazenda_id === farmId).length;
  if (reproductionCount !== reproductionEventIds.length || reproductionDetailCount !== reproductionEventIds.length) {
    issues.push("reproduction event/detail count mismatch");
  }

  const eventRows = await db.event_eventos.where("fazenda_id").equals(farmId).toArray();
  const weightEvents = eventRows.filter((event) =>
    event.dominio === "pesagem" && seedAnimalIds.has(event.animal_id ?? "") &&
    event.payload?.test_farm_seed === TEST_FARM_SPEC.logicalId,
  );
  const movementEvents = eventRows.filter((event) =>
    event.dominio === "movimentacao" && seedAnimalIds.has(event.animal_id ?? "") &&
    event.payload?.test_farm_seed === TEST_FARM_SPEC.logicalId,
  );
  const agendas = await db.state_agenda_itens.where("fazenda_id").equals(farmId).toArray();
  const seedAgendas = agendas.filter((agenda) =>
    agenda.animal_id && seedAnimalIds.has(agenda.animal_id) &&
    typeof agenda.dedup_key === "string" && agenda.dedup_key.startsWith("calf_journey:"),
  );
  const expectedWeightEvents = buildWeightAndMovementHistory(farmId, definition).ops
    .filter((op) => op.record.dominio === "pesagem").length;
  const expectedMovementEvents = buildWeightAndMovementHistory(farmId, definition).ops
    .filter((op) => op.table === "movement_v1").length;
  const expectedCalfAgendas = buildCalfAgendas(farmId, definition, []).length;
  if (weightEvents.length !== expectedWeightEvents) issues.push("weight event count mismatch");
  if (movementEvents.length !== expectedMovementEvents) issues.push("movement event count mismatch");
  if (seedAgendas.length !== expectedCalfAgendas) issues.push("calf journey agenda count mismatch");

  return {
    farmId,
    farmIdentityValid: true,
    expectedAnimals: definition.animals.length,
    verifiedAnimals: presentAnimals.length,
    expectedLots: lotKeys.length,
    verifiedLots: presentLots.length,
    expectedReproductionEvents: reproductionEventIds.length,
    verifiedReproductionEvents: reproductionCount,
    verifiedReproductionDetails: reproductionDetailCount,
    expectedWeightEvents,
    verifiedWeightEvents: weightEvents.length,
    expectedMovementEvents,
    verifiedMovementEvents: movementEvents.length,
    expectedCalfAgendas,
    verifiedCalfAgendas: seedAgendas.length,
    sanitaryExecutionCount: 0,
    integrityIssues: issues,
    valid: issues.length === 0 &&
      presentAnimals.length === definition.animals.length &&
      presentLots.length === lotKeys.length &&
      reproductionCount === reproductionEventIds.length &&
      reproductionDetailCount === reproductionEventIds.length &&
      weightEvents.length === expectedWeightEvents &&
      movementEvents.length === expectedMovementEvents &&
      seedAgendas.length === expectedCalfAgendas,
  };
}

export const testFarmConsoleApi = {
  dryRun: dryRunTestFarm,
  provision: provisionTestFarm,
  seed: seedTestFarm,
  verify: verifyTestFarm,
};
