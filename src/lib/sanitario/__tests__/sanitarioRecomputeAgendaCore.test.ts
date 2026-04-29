import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const baselineSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/00000000000000_rebuild_base_schema_sanitario.sql"),
  "utf8",
);

function extractRecomputeCore() {
  const match = baselineSql.match(
    /create or replace function public\.sanitario_recompute_agenda_core[\s\S]*?\nend;\n\$\$;/,
  );
  expect(match, "sanitario_recompute_agenda_core not found").not.toBeNull();
  return match?.[0] ?? "";
}

function extractCompleteAgendaWithEvent() {
  const match = baselineSql.match(
    /create or replace function public\.sanitario_complete_agenda_with_event[\s\S]*?\nend;\n\$\$;/,
  );
  expect(match, "sanitario_complete_agenda_with_event not found").not.toBeNull();
  return match?.[0] ?? "";
}

type AnimalStatus = "ativo" | "vendido" | "morto";
type AnimalSpecies = "bovino" | "bubalino" | "equino" | null;

interface AnimalFixture {
  id: string;
  especie: AnimalSpecies;
  sexo: "F" | "M";
  status: AnimalStatus;
  dataNascimento: string | null;
  deleted: boolean;
}

interface BrucellosisCandidateInput {
  animal: AnimalFixture;
  asOf: string;
  protocolActive?: boolean;
  protocolDeleted?: boolean;
  itemDeleted?: boolean;
  geraAgenda?: boolean;
  existingDedups?: Set<string>;
  completedAgendas?: CompletedAgendaFixture[];
  completedSanitaryEvents?: CompletedSanitaryEventFixture[];
}

type RabiesRisk = "baixo" | "medio" | "alto";
type TechnicalFamily =
  | "clostridioses"
  | "leptospirose_ibr_bvd"
  | "controle_parasitario"
  | "controle_carrapato";

interface RabiesCandidateInput {
  animal: AnimalFixture;
  asOf: string;
  hasOperationalItem?: boolean;
  protocolActive?: boolean;
  protocolDeleted?: boolean;
  itemDeleted?: boolean;
  geraAgenda?: boolean;
  hasConfig?: boolean;
  farmRisk?: RabiesRisk;
  explicitActivation?: boolean;
  riskValues?: RabiesRisk[] | null;
  existingDedups?: Set<string>;
}

interface TechnicalCandidateInput {
  animal: AnimalFixture;
  asOf: string;
  familyCode: TechnicalFamily;
  itemCode?: string;
  protocolActive?: boolean;
  protocolDeleted?: boolean;
  itemDeleted?: boolean;
  geraAgenda?: boolean;
  explicitActivation?: boolean;
  hasConfig?: boolean;
  pressure?: RabiesRisk;
  riskValues?: RabiesRisk[] | null;
  speciesTargets?: string | string[] | null;
  existingDedups?: Set<string>;
}

interface CompletedAgendaFixture {
  dedupKey: string;
  deleted?: boolean;
  sourceEventoId?: string | null;
  eventDeleted?: boolean;
  sanitaryEventDeleted?: boolean;
}

interface CompletedSanitaryEventFixture {
  sanitaryCompletionKey: string | null;
  eventDeleted?: boolean;
  sanitaryEventDeleted?: boolean;
}

function dateUtc(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value: string, days: number) {
  const date = dateUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  const diffMs = dateUtc(end).getTime() - dateUtc(start).getTime();
  return Math.floor(diffMs / 86_400_000);
}

function brucellosisWindowDedup(animalId: string, birthDate: string) {
  return [
    "sanitario",
    "animal",
    animalId,
    "brucelose",
    "brucelose-b19-dose-unica",
    "v1",
    "window",
    addDays(birthDate, 90),
  ].join(":");
}

function rabiesRiskDedup(animalId: string, asOf: string) {
  return [
    "sanitario",
    "animal",
    animalId,
    "raiva_herbivoros",
    "raiva-vigilancia-risco",
    "v1",
    "unstructured",
    asOf,
  ].join(":");
}

function technicalDedup(animalId: string, familyCode: string, itemCode: string, asOf: string) {
  return [
    "sanitario",
    "animal",
    animalId,
    familyCode,
    itemCode,
    "v1",
    "unstructured",
    asOf,
  ].join(":");
}

function tokenizeSpeciesTargets(targets: string | string[] | null | undefined) {
  if (targets === null || targets === undefined) return null;
  const values = Array.isArray(targets) ? targets : [targets];
  return values.flatMap((value) =>
    value
      .toLowerCase()
      .split(/[^a-z_]+/)
      .map((token) => token.trim())
      .filter(Boolean),
  );
}

function speciesTargetMatches(
  animalSpecies: AnimalSpecies,
  targets: string | string[] | null | undefined,
) {
  if (animalSpecies === null) return true;
  const tokens = tokenizeSpeciesTargets(targets);
  if (!tokens || tokens.length === 0) return false;

  return tokens.some((token) => {
    if (["herbivoro", "herbivoros", "ruminante", "ruminantes"].includes(token)) {
      return animalSpecies === "bovino" || animalSpecies === "bubalino";
    }
    if (["bovino", "bovinos", "bovina", "bovinas"].includes(token)) {
      return animalSpecies === "bovino";
    }
    if (["bubalino", "bubalinos", "bufalino", "bufalinos"].includes(token)) {
      return animalSpecies === "bubalino";
    }
    return false;
  });
}

function speciesEligibleForFamily(
  animalSpecies: AnimalSpecies,
  familyCode: "brucelose" | "raiva_herbivoros" | TechnicalFamily,
  speciesTargets?: string | string[] | null,
) {
  if (animalSpecies === null) return true;

  if (familyCode === "brucelose" || familyCode === "raiva_herbivoros") {
    return animalSpecies === "bovino" || animalSpecies === "bubalino";
  }

  const hasExplicitTarget = speciesTargets !== null && speciesTargets !== undefined;
  if (!hasExplicitTarget) {
    return animalSpecies === "bovino" || animalSpecies === "bubalino";
  }

  return speciesTargetMatches(animalSpecies, speciesTargets);
}

function evaluateBrucellosisCandidate(input: BrucellosisCandidateInput) {
  const protocolActive = input.protocolActive ?? true;
  const protocolDeleted = input.protocolDeleted ?? false;
  const itemDeleted = input.itemDeleted ?? false;
  const geraAgenda = input.geraAgenda ?? true;
  const { animal } = input;

  if (!protocolActive || protocolDeleted || itemDeleted || !geraAgenda) return null;
  if (animal.deleted || animal.status !== "ativo") return null;
  if (!speciesEligibleForFamily(animal.especie, "brucelose")) return null;
  if (animal.sexo !== "F") return null;
  if (!animal.dataNascimento) return null;

  const ageDays = daysBetween(animal.dataNascimento, input.asOf);
  if (ageDays < 90 || ageDays > 240) return null;

  const dedupKey = brucellosisWindowDedup(animal.id, animal.dataNascimento);
  if (input.existingDedups?.has(dedupKey)) return null;
  if (
    input.completedAgendas?.some(
      (agenda) =>
        agenda.dedupKey === dedupKey &&
        agenda.deleted !== true &&
        Boolean(agenda.sourceEventoId) &&
        agenda.eventDeleted !== true &&
        agenda.sanitaryEventDeleted !== true,
    )
  ) {
    return null;
  }
  if (
    input.completedSanitaryEvents?.some(
      (event) =>
        event.sanitaryCompletionKey === dedupKey &&
        event.eventDeleted !== true &&
        event.sanitaryEventDeleted !== true,
    )
  ) {
    return null;
  }

  return {
    dataPrevista: input.asOf,
    dedupKey,
  };
}

function evaluateRabiesCandidate(input: RabiesCandidateInput) {
  const hasOperationalItem = input.hasOperationalItem ?? true;
  const protocolActive = input.protocolActive ?? true;
  const protocolDeleted = input.protocolDeleted ?? false;
  const itemDeleted = input.itemDeleted ?? false;
  const geraAgenda = input.geraAgenda ?? true;
  const hasConfig = input.hasConfig ?? true;
  const farmRisk = input.farmRisk ?? "alto";
  const explicitActivation = input.explicitActivation ?? true;
  const riskValues = input.riskValues === undefined ? ["medio", "alto"] : input.riskValues;
  const { animal } = input;

  if (!hasOperationalItem) return null;
  if (!protocolActive || protocolDeleted || itemDeleted || !geraAgenda) return null;
  if (animal.deleted || animal.status !== "ativo") return null;
  if (!speciesEligibleForFamily(animal.especie, "raiva_herbivoros")) return null;
  if (!hasConfig) return null;
  if (!explicitActivation) return null;
  if (!riskValues?.includes(farmRisk)) return null;

  const dedupKey = rabiesRiskDedup(animal.id, input.asOf);
  if (input.existingDedups?.has(dedupKey)) return null;

  return {
    dataPrevista: input.asOf,
    dedupKey,
  };
}

function evaluateTechnicalCandidate(input: TechnicalCandidateInput) {
  const protocolActive = input.protocolActive ?? true;
  const protocolDeleted = input.protocolDeleted ?? false;
  const itemDeleted = input.itemDeleted ?? false;
  const geraAgenda = input.geraAgenda ?? true;
  const explicitActivation = input.explicitActivation ?? true;
  const hasConfig = input.hasConfig ?? true;
  const pressure = input.pressure ?? "alto";
  const riskValues = input.riskValues === undefined ? ["medio", "alto"] : input.riskValues;
  const { animal } = input;

  if (!protocolActive || protocolDeleted || itemDeleted || !geraAgenda) return null;
  if (animal.deleted || animal.status !== "ativo") return null;
  if (!speciesEligibleForFamily(animal.especie, input.familyCode, input.speciesTargets)) return null;
  if (!explicitActivation) return null;
  if (
    (input.familyCode === "controle_parasitario" ||
      input.familyCode === "controle_carrapato") &&
    (!hasConfig || !riskValues?.includes(pressure))
  ) {
    return null;
  }

  const itemCode =
    input.itemCode ??
    (input.familyCode === "controle_parasitario"
      ? "vermifugacao-estrategica"
      : input.familyCode === "controle_carrapato"
        ? "controle-carrapato"
        : `${input.familyCode}-operacional`);
  const dedupKey = technicalDedup(animal.id, input.familyCode, itemCode, input.asOf);
  if (input.existingDedups?.has(dedupKey)) return null;

  return {
    dataPrevista: input.asOf,
    dedupKey,
  };
}

function activeFemale(overrides: Partial<AnimalFixture> = {}): AnimalFixture {
  return {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    especie: "bovino",
    sexo: "F",
    status: "ativo",
    dataNascimento: "2026-04-01",
    deleted: false,
    ...overrides,
  };
}

describe("P6.2.1 sanitario_recompute_agenda_core brucellosis contract", () => {
  it("keeps SQL gates for active protocol/item, agenda flag, active animal and active dedup", () => {
    const core = extractRecomputeCore();

    expect(core).toContain("and ps.ativo");
    expect(core).toContain("and ps.deleted_at is null");
    expect(core).toContain("and psi.gera_agenda");
    expect(core).toContain("and psi.deleted_at is null");
    expect(core).toContain("and a.deleted_at is null");
    expect(core).toContain("and a.status = 'ativo'");
    expect(core).toContain("on conflict (fazenda_id, dedup_key)");
    expect(core).toContain("where status = 'agendado' and deleted_at is null");
  });

  it("keeps SQL gates for completed sanitary occurrences before inserting", () => {
    const core = extractRecomputeCore();

    expect(core).toContain("planned as (");
    expect(core).toContain("as candidate_dedup_key");
    expect(core).toContain("from planned p");
    expect(core).toContain("ai.dedup_key = p.candidate_dedup_key");
    expect(core).toContain("ai.status = 'concluido'");
    expect(core).toContain("ai.source_evento_id is not null");
    expect(core).toContain("from public.eventos e");
    expect(core).toContain("join public.eventos_sanitario es");
    expect(core).toContain("e.id = ai.source_evento_id");
    expect(core).toContain("e.deleted_at is null");
    expect(core).toContain("es.deleted_at is null");
  });

  it("keeps SQL gates for historical sanitary completion payload before inserting", () => {
    const core = extractRecomputeCore();

    expect(core).toContain("es.payload #>> '{sanitary_completion,sanitary_completion_key}' = p.candidate_dedup_key");
    expect(core).toContain("and e.animal_id = p.animal_id");
    expect(core).toContain("and e.dominio = 'sanitario'");
  });

  it("enriches completed sanitary agenda events with a historical completion payload", () => {
    const complete = extractCompleteAgendaWithEvent();

    expect(complete).toContain("v_enriched_payload");
    expect(complete).toContain("coalesce(_sanitario_payload, '{}'::jsonb) ||");
    expect(complete).toContain("'sanitary_completion'");
    expect(complete).toContain("'schema_version', 1");
    expect(complete).toContain("'sanitary_completion_key', v_agenda.dedup_key");
    expect(complete).toContain("'agenda_dedup_key', v_agenda.dedup_key");
    expect(complete).toContain("'source_agenda_item_id', v_agenda.id");
    expect(complete).toContain("'protocol_item_version_id', v_agenda.protocol_item_version_id");
    expect(complete).toContain("v_window_start");
    expect(complete).toContain("v_enriched_payload,");
  });

  it("keeps SQL gates for age-window birth date, sex target and window dedup", () => {
    const core = extractRecomputeCore();

    expect(core).toContain("coalesce(raw.calendar_mode, '') in ('age_window', 'janela_etaria') as is_age_window");
    expect(core).toContain("psi.payload->>'idade_min_dias'");
    expect(core).toContain("psi.payload #>> '{gatilho_json,age_start_days}'");
    expect(core).toContain("psi.payload->>'idade_max_dias'");
    expect(core).toContain("psi.payload #>> '{gatilho_json,age_end_days}'");
    expect(core).toContain("data_nascimento is not null");
    expect(core).toContain("(_as_of - data_nascimento) >= age_min_days");
    expect(core).toContain("(_as_of - data_nascimento) <= age_max_days");
    expect(core).toContain("or sexo = 'F'::public.sexo_enum");
    expect(core).toContain("when is_age_window then _as_of");
    expect(core).toContain("(data_nascimento + age_min_days)::text");
    expect(core).toContain("public.sanitario_dedup_period_mode(calendar_mode)");
  });

  it("keeps SQL transitional species gates inside agenda recompute", () => {
    const core = extractRecomputeCore();

    expect(core).toContain("a.especie as animal_especie");
    expect(core).toContain("psi.payload->'species'");
    expect(core).toContain("psi.payload->'especies_alvo'");
    expect(core).toContain("psi.payload #> '{gatilho_json,species}'");
    expect(core).toContain("raw.species_targets_json is not null as has_explicit_species_target");
    expect(core).toContain("when a.especie is null then true");
    expect(core).toContain("animal_especie is null");
    expect(core).toContain("and animal_especie in ('bovino', 'bubalino')");
    expect(core).toContain("has_explicit_species_target and species_target_matches");
  });

  it("keeps SQL gates that prevent universal rabies agenda", () => {
    const core = extractRecomputeCore();

    expect(core).toContain("left join public.fazenda_sanidade_config fsc");
    expect(core).toContain("fsc.deleted_at is null");
    expect(core).toContain("psi.payload->>'family_code'");
    expect(core).toContain("psi.payload #>> '{regime_sanitario,family_code}'");
    expect(core).toContain("psi.payload #>> '{agenda_activation,explicit}'");
    expect(core).toContain("psi.payload #>> '{gatilho_json,requires_explicit_activation}'");
    expect(core).toContain("psi.payload #> '{agenda_activation,risk_values}'");
    expect(core).toContain("psi.payload #> '{gatilho_json,risk_values}'");
    expect(core).toContain("jsonb_array_elements_text(raw.risk_values_json)");
    expect(core).toContain("rv.value = fsc.zona_raiva_risco");
    expect(core).toContain("coalesce(family_code, '') <> 'raiva_herbivoros'");
    expect(core).toContain("zona_raiva_risco is not null");
    expect(core).toContain("has_explicit_agenda_activation");
    expect(core).toContain("rabies_risk_allowed");
  });

  it("keeps SQL gates that prevent implicit technical agenda", () => {
    const core = extractRecomputeCore();

    expect(core).toContain("fsc.pressao_helmintos");
    expect(core).toContain("fsc.pressao_carrapato");
    expect(core).toContain("'clostridioses'");
    expect(core).toContain("'leptospirose_ibr_bvd'");
    expect(core).toContain("'controle_parasitario'");
    expect(core).toContain("'controle_carrapato'");
    expect(core).toContain("or has_explicit_agenda_activation");
    expect(core).toContain("pressao_helmintos is not null");
    expect(core).toContain("and helminth_risk_allowed");
    expect(core).toContain("pressao_carrapato is not null");
    expect(core).toContain("and tick_risk_allowed");
  });

  it("does not turn the global official catalog into agenda source inside recompute", () => {
    const core = extractRecomputeCore();

    expect(core).not.toContain("catalogo_protocolos_oficiais");
    expect(core).not.toContain("catalogo_protocolos_oficiais_itens");
    expect(core).not.toContain("catalogo_doencas_notificaveis");
  });

  it("creates one brucellosis agenda for an active female with 100 days", () => {
    const result = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
    });

    expect(result).toEqual({
      dataPrevista: "2026-07-10",
      dedupKey:
        "sanitario:animal:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:brucelose:brucelose-b19-dose-unica:v1:window:2026-06-30",
    });
  });

  it.each([
    ["bovino", "bovino"],
    ["bubalino", "bubalino"],
    ["null species", null],
  ] as const)("creates brucellosis agenda for %s in the transitional species gate", (_label, especie) => {
    expect(
      evaluateBrucellosisCandidate({
        animal: activeFemale({ especie }),
        asOf: "2026-07-10",
      }),
    ).not.toBeNull();
  });

  it("blocks brucellosis agenda for future known incompatible species", () => {
    expect(
      evaluateBrucellosisCandidate({
        animal: activeFemale({ especie: "equino" }),
        asOf: "2026-07-10",
      }),
    ).toBeNull();
  });

  it("keeps recompute idempotent with an existing active dedup", () => {
    const first = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
    });
    expect(first).not.toBeNull();

    const second = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
      existingDedups: new Set([first?.dedupKey ?? ""]),
    });

    expect(second).toBeNull();
  });

  it("does not reopen brucellosis when the same dedup has a completed sanitary event", () => {
    const first = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
    });
    expect(first).not.toBeNull();

    const afterCompletion = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
      completedAgendas: [
        {
          dedupKey: first?.dedupKey ?? "",
          sourceEventoId: "evento-1",
        },
      ],
    });

    expect(afterCompletion).toBeNull();
  });

  it("does not treat administrative completion without a sanitary event as fulfilled", () => {
    const first = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
    });
    expect(first).not.toBeNull();

    const withoutEvent = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
      completedAgendas: [
        {
          dedupKey: first?.dedupKey ?? "",
          sourceEventoId: null,
        },
      ],
    });

    expect(withoutEvent?.dedupKey).toBe(first?.dedupKey);
  });

  it("does not treat a deleted linked event as fulfilled", () => {
    const first = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
    });
    expect(first).not.toBeNull();

    const withDeletedBaseEvent = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
      completedAgendas: [
        {
          dedupKey: first?.dedupKey ?? "",
          sourceEventoId: "evento-1",
          eventDeleted: true,
        },
      ],
    });
    const withDeletedSanitaryEvent = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
      completedAgendas: [
        {
          dedupKey: first?.dedupKey ?? "",
          sourceEventoId: "evento-1",
          sanitaryEventDeleted: true,
        },
      ],
    });

    expect(withDeletedBaseEvent?.dedupKey).toBe(first?.dedupKey);
    expect(withDeletedSanitaryEvent?.dedupKey).toBe(first?.dedupKey);
  });

  it("does not reopen when the agenda was soft-deleted but the historical sanitary completion remains", () => {
    const first = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
    });
    expect(first).not.toBeNull();

    const afterSoftDeletedAgenda = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
      completedAgendas: [
        {
          dedupKey: first?.dedupKey ?? "",
          sourceEventoId: "evento-1",
          deleted: true,
        },
      ],
      completedSanitaryEvents: [
        {
          sanitaryCompletionKey: first?.dedupKey ?? "",
        },
      ],
    });

    expect(afterSoftDeletedAgenda).toBeNull();
  });

  it("does not treat deleted historical events or manual events without completion keys as fulfilled", () => {
    const first = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
    });
    expect(first).not.toBeNull();

    const withDeletedBaseEvent = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
      completedSanitaryEvents: [
        {
          sanitaryCompletionKey: first?.dedupKey ?? "",
          eventDeleted: true,
        },
      ],
    });
    const withDeletedSanitaryEvent = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
      completedSanitaryEvents: [
        {
          sanitaryCompletionKey: first?.dedupKey ?? "",
          sanitaryEventDeleted: true,
        },
      ],
    });
    const withManualEventWithoutCompletion = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
      completedSanitaryEvents: [{ sanitaryCompletionKey: null }],
    });

    expect(withDeletedBaseEvent?.dedupKey).toBe(first?.dedupKey);
    expect(withDeletedSanitaryEvent?.dedupKey).toBe(first?.dedupKey);
    expect(withManualEventWithoutCompletion?.dedupKey).toBe(first?.dedupKey);
  });

  it("does not block another animal, another window or another version", () => {
    const first = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
    });
    expect(first).not.toBeNull();
    const completedAgendas = [
      {
        dedupKey: first?.dedupKey ?? "",
        sourceEventoId: "evento-1",
      },
    ];

    const otherAnimal = evaluateBrucellosisCandidate({
      animal: activeFemale({ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" }),
      asOf: "2026-07-10",
      completedAgendas,
    });
    const otherWindow = evaluateBrucellosisCandidate({
      animal: activeFemale({ dataNascimento: "2026-04-12" }),
      asOf: "2026-07-25",
      completedAgendas,
    });
    const otherVersionCompletion = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
      completedAgendas: [
        {
          dedupKey: (first?.dedupKey ?? "").replace(":v1:", ":v2:"),
          sourceEventoId: "evento-1",
        },
      ],
    });

    expect(otherAnimal).not.toBeNull();
    expect(otherAnimal?.dedupKey).not.toBe(first?.dedupKey);
    expect(otherWindow).not.toBeNull();
    expect(otherWindow?.dedupKey).not.toBe(first?.dedupKey);
    expect(otherVersionCompletion?.dedupKey).toBe(first?.dedupKey);
  });

  it("does not let historical completion for another animal, window or version block this candidate", () => {
    const first = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
    });
    expect(first).not.toBeNull();

    const otherAnimalKey = brucellosisWindowDedup(
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "2026-04-01",
    );
    const otherWindowKey = brucellosisWindowDedup(
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "2026-04-12",
    );
    const otherVersionKey = (first?.dedupKey ?? "").replace(":v1:", ":v2:");

    for (const sanitaryCompletionKey of [otherAnimalKey, otherWindowKey, otherVersionKey]) {
      expect(
        evaluateBrucellosisCandidate({
          animal: activeFemale(),
          asOf: "2026-07-10",
          completedSanitaryEvents: [{ sanitaryCompletionKey }],
        })?.dedupKey,
      ).toBe(first?.dedupKey);
    }
  });

  it.each([
    ["male with 100 days", activeFemale({ sexo: "M" }), "2026-07-10"],
    ["female with 89 days", activeFemale({ dataNascimento: "2026-04-12" }), "2026-07-10"],
    ["female with 241 days", activeFemale({ dataNascimento: "2025-11-11" }), "2026-07-10"],
    ["female without birth date", activeFemale({ dataNascimento: null }), "2026-07-10"],
    ["sold animal", activeFemale({ status: "vendido" }), "2026-07-10"],
    ["dead animal", activeFemale({ status: "morto" }), "2026-07-10"],
    ["deleted animal", activeFemale({ deleted: true }), "2026-07-10"],
  ])("does not create brucellosis agenda for %s", (_label, animal, asOf) => {
    expect(evaluateBrucellosisCandidate({ animal, asOf })).toBeNull();
  });

  it("does not create brucellosis agenda for inactive protocol or disabled item", () => {
    expect(
      evaluateBrucellosisCandidate({
        animal: activeFemale(),
        asOf: "2026-07-10",
        protocolActive: false,
      }),
    ).toBeNull();
    expect(
      evaluateBrucellosisCandidate({
        animal: activeFemale(),
        asOf: "2026-07-10",
        geraAgenda: false,
      }),
    ).toBeNull();
  });

  it("keeps the brucellosis window dedup stable when as_of changes inside the same window", () => {
    const first = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
    });
    const later = evaluateBrucellosisCandidate({
      animal: activeFemale(),
      asOf: "2026-07-25",
    });

    expect(first?.dataPrevista).toBe("2026-07-10");
    expect(later?.dataPrevista).toBe("2026-07-25");
    expect(later?.dedupKey).toBe(first?.dedupKey);
  });

  it.each([
    ["alto", "alto"],
    ["medio", "medio"],
  ] as const)("creates one rabies agenda for %s risk with active operational item and explicit activation", (_label, farmRisk) => {
    const result = evaluateRabiesCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
      farmRisk,
    });

    expect(result).toEqual({
      dataPrevista: "2026-07-10",
      dedupKey:
        "sanitario:animal:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa:raiva_herbivoros:raiva-vigilancia-risco:v1:unstructured:2026-07-10",
    });
  });

  it.each([
    ["bovino", "bovino"],
    ["bubalino", "bubalino"],
    ["null species", null],
  ] as const)("creates rabies agenda for %s with all existing gates", (_label, especie) => {
    expect(
      evaluateRabiesCandidate({
        animal: activeFemale({ especie }),
        asOf: "2026-07-10",
        farmRisk: "alto",
      }),
    ).not.toBeNull();
  });

  it("blocks rabies agenda for future known incompatible species", () => {
    expect(
      evaluateRabiesCandidate({
        animal: activeFemale({ especie: "equino" }),
        asOf: "2026-07-10",
        farmRisk: "alto",
      }),
    ).toBeNull();
  });

  it("keeps rabies recompute idempotent with an existing active dedup", () => {
    const first = evaluateRabiesCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
      farmRisk: "alto",
    });
    expect(first).not.toBeNull();

    const second = evaluateRabiesCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
      farmRisk: "alto",
      existingDedups: new Set([first?.dedupKey ?? ""]),
    });

    expect(second).toBeNull();
  });

  it.each([
    ["baixo risk", { farmRisk: "baixo" as const }],
    ["missing fazenda_sanidade_config", { hasConfig: false }],
    ["activated template without operational item", { hasOperationalItem: false }],
    ["missing explicit activation", { explicitActivation: false }],
    ["missing risk values", { riskValues: null }],
    ["inactive protocol", { protocolActive: false }],
    ["deleted protocol", { protocolDeleted: true }],
    ["deleted item", { itemDeleted: true }],
    ["disabled agenda flag", { geraAgenda: false }],
  ])("does not create rabies agenda for %s", (_label, overrides) => {
    expect(
      evaluateRabiesCandidate({
        animal: activeFemale(),
        asOf: "2026-07-10",
        ...overrides,
      }),
    ).toBeNull();
  });

  it.each([
    ["clostridioses", "clostridioses"],
    ["IBR/BVD/lepto", "leptospirose_ibr_bvd"],
  ] as const)("creates technical agenda for %s only after explicit farm activation", (_label, familyCode) => {
    const result = evaluateTechnicalCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
      familyCode,
    });

    expect(result?.dedupKey).toContain(`:${familyCode}:`);
  });

  it("blocks technical agenda when explicit species target is incompatible", () => {
    expect(
      evaluateTechnicalCandidate({
        animal: activeFemale({ especie: "bubalino" }),
        asOf: "2026-07-10",
        familyCode: "clostridioses",
        speciesTargets: "bovinos",
      }),
    ).toBeNull();
  });

  it("allows technical agenda for null species even with explicit species target", () => {
    expect(
      evaluateTechnicalCandidate({
        animal: activeFemale({ especie: null }),
        asOf: "2026-07-10",
        familyCode: "clostridioses",
        speciesTargets: ["bovino"],
      }),
    ).not.toBeNull();
  });

  it.each([
    ["bovino", "bovino"],
    ["bubalino", "bubalino"],
    ["null species", null],
  ] as const)("allows technical agenda without explicit species target for %s", (_label, especie) => {
    expect(
      evaluateTechnicalCandidate({
        animal: activeFemale({ especie }),
        asOf: "2026-07-10",
        familyCode: "clostridioses",
      }),
    ).not.toBeNull();
  });

  it("blocks technical agenda without explicit target for future known incompatible species", () => {
    expect(
      evaluateTechnicalCandidate({
        animal: activeFemale({ especie: "equino" }),
        asOf: "2026-07-10",
        familyCode: "clostridioses",
      }),
    ).toBeNull();
  });

  it("keeps technical recompute idempotent with an existing active dedup", () => {
    const first = evaluateTechnicalCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
      familyCode: "clostridioses",
    });
    expect(first).not.toBeNull();

    const second = evaluateTechnicalCandidate({
      animal: activeFemale(),
      asOf: "2026-07-10",
      familyCode: "clostridioses",
      existingDedups: new Set([first?.dedupKey ?? ""]),
    });

    expect(second).toBeNull();
  });

  it.each([
    ["global catalog technical item with gera_agenda=false", { geraAgenda: false }],
    ["technical item without explicit activation", { explicitActivation: false }],
    ["inactive technical protocol", { protocolActive: false }],
    ["deleted technical protocol", { protocolDeleted: true }],
    ["deleted technical item", { itemDeleted: true }],
  ])("does not create technical agenda for %s", (_label, overrides) => {
    expect(
      evaluateTechnicalCandidate({
        animal: activeFemale(),
        asOf: "2026-07-10",
        familyCode: "clostridioses",
        ...overrides,
      }),
    ).toBeNull();
  });

  it.each([
    ["controle_parasitario", "medio"],
    ["controle_parasitario", "alto"],
    ["controle_carrapato", "medio"],
    ["controle_carrapato", "alto"],
  ] as const)("creates %s technical agenda when pressure is %s", (familyCode, pressure) => {
    expect(
      evaluateTechnicalCandidate({
        animal: activeFemale(),
        asOf: "2026-07-10",
        familyCode,
        pressure,
      }),
    ).not.toBeNull();
  });

  it.each([
    ["controle_parasitario", { pressure: "baixo" as const }],
    ["controle_parasitario", { hasConfig: false }],
    ["controle_parasitario", { riskValues: null }],
    ["controle_carrapato", { pressure: "baixo" as const }],
    ["controle_carrapato", { hasConfig: false }],
    ["controle_carrapato", { riskValues: null }],
  ])("does not create %s agenda when risk/config is insufficient", (familyCode, overrides) => {
    expect(
      evaluateTechnicalCandidate({
        animal: activeFemale(),
        asOf: "2026-07-10",
        familyCode,
        ...overrides,
      }),
    ).toBeNull();
  });
});
