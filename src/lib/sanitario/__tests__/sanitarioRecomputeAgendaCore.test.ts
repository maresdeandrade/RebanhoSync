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

type AnimalStatus = "ativo" | "vendido" | "morto";

interface AnimalFixture {
  id: string;
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
}

interface CompletedAgendaFixture {
  dedupKey: string;
  deleted?: boolean;
  sourceEventoId?: string | null;
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

function evaluateBrucellosisCandidate(input: BrucellosisCandidateInput) {
  const protocolActive = input.protocolActive ?? true;
  const protocolDeleted = input.protocolDeleted ?? false;
  const itemDeleted = input.itemDeleted ?? false;
  const geraAgenda = input.geraAgenda ?? true;
  const { animal } = input;

  if (!protocolActive || protocolDeleted || itemDeleted || !geraAgenda) return null;
  if (animal.deleted || animal.status !== "ativo") return null;
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

  return {
    dataPrevista: input.asOf,
    dedupKey,
  };
}

function activeFemale(overrides: Partial<AnimalFixture> = {}): AnimalFixture {
  return {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
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
});
