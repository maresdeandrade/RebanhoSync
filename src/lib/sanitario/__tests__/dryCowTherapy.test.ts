import { describe, expect, it } from "vitest";

import type { Animal } from "@/lib/offline/types";
import {
  buildDryCowTherapyAnimalPayload,
  buildDryCowTherapyAgendaCandidatePreview,
  buildDryCowTherapyClinicalSupportItemPayload,
  buildDryCowTherapyDedupKey,
  buildDryCowTherapyEventPayload,
  buildDryCowTherapyOperationalAgendaItemPayload,
  DRY_COW_THERAPY_MATERIALIZATION_CONTRACT,
  evaluateDryCowTherapyReadiness,
  isDryCowTherapyClinicalRef,
  isDryCowTherapyProtocolItem,
  validateDryCowTherapyMaterializationContract,
} from "@/lib/sanitario/compliance/dryCowTherapy";

const baseAnimal = {
  sexo: "F",
  status: "ativo",
  payload: {
    taxonomy_facts: {
      em_lactacao: true,
      secagem_realizada: false,
      data_prevista_parto: "2026-07-10",
    },
  },
} satisfies Pick<Animal, "sexo" | "status" | "payload">;

describe("dry cow therapy readiness", () => {
  it("marks a lactating pregnant female in the dry-off window as future agenda candidate only", () => {
    const result = evaluateDryCowTherapyReadiness({
      animal: baseAnimal,
      referenceDate: "2026-05-10",
    });

    expect(result).toMatchObject({
      protocolId: "med-mastite-seca",
      itemId: "secagem-intramamario",
      decision: "candidate_for_future_agenda_contract",
      agendaMaterializationAllowed: false,
      isCandidate: true,
      blockReasons: [],
      daysUntilExpectedCalving: 61,
      expectedCalvingDate: "2026-07-10",
      anchorDate: "2026-07-10",
    });
  });

  it("keeps dry cow therapy as clinical support when expected calving date is missing", () => {
    const result = evaluateDryCowTherapyReadiness({
      animal: {
        ...baseAnimal,
        payload: {
          taxonomy_facts: {
            em_lactacao: true,
            secagem_realizada: false,
          },
        },
      },
      referenceDate: "2026-05-10",
    });

    expect(result).toMatchObject({
      decision: "keep_as_clinical_protocol",
      agendaMaterializationAllowed: false,
      isCandidate: false,
      blockReasons: ["missing_expected_calving_date"],
    });
  });

  it("blocks males, inactive animals, non-lactating animals and already dried animals", () => {
    const result = evaluateDryCowTherapyReadiness({
      animal: {
        sexo: "M",
        status: "vendido",
        payload: {
          taxonomy_facts: {
            em_lactacao: false,
            secagem_realizada: true,
            data_prevista_parto: "2026-07-10",
          },
        },
      },
      referenceDate: "2026-05-10",
    });

    expect(result.agendaMaterializationAllowed).toBe(false);
    expect(result.blockReasons).toEqual([
      "animal_not_active",
      "animal_not_female",
      "not_in_lactation",
      "already_dried_off",
    ]);
  });

  it("blocks candidates outside the dry-off window", () => {
    const tooEarly = evaluateDryCowTherapyReadiness({
      animal: baseAnimal,
      referenceDate: "2026-04-01",
    });
    const tooLate = evaluateDryCowTherapyReadiness({
      animal: baseAnimal,
      referenceDate: "2026-06-20",
    });

    expect(tooEarly.blockReasons).toContain("outside_dry_off_window");
    expect(tooEarly.isCandidate).toBe(false);
    expect(tooLate.blockReasons).toContain("outside_dry_off_window");
    expect(tooLate.isCandidate).toBe(false);
  });

  it("accepts legacy flat payload facts while keeping agenda materialization blocked", () => {
    const result = evaluateDryCowTherapyReadiness({
      animal: {
        sexo: "F",
        status: "ativo",
        payload: {
          em_lactacao: true,
          secagem_realizada: false,
          data_prevista_parto: "2026-07-10",
        },
      },
      referenceDate: "2026-05-10",
    });

    expect(result).toMatchObject({
      isCandidate: true,
      agendaMaterializationAllowed: false,
      blockReasons: [],
    });
  });

  it("builds a canonical dry-off dedup key by animal and expected calving cycle", () => {
    expect(
      buildDryCowTherapyDedupKey({
        animalId: "animal-1",
        expectedCalvingDate: "2026-07-10",
      }),
    ).toBe(
      "sanitario:animal:animal-1:terapia_vaca_seca:secagem-intramamario:v1:window:2026-07-10",
    );

    expect(
      buildDryCowTherapyDedupKey({
        animalId: "animal-1",
        expectedCalvingDate: "2026-07-10",
      }),
    ).toBe(
      buildDryCowTherapyDedupKey({
        animalId: "animal-1",
        expectedCalvingDate: "2026-07-10",
      }),
    );

    expect(
      buildDryCowTherapyDedupKey({
        animalId: "animal-1",
        expectedCalvingDate: "2026-08-10",
      }),
    ).not.toBe(
      buildDryCowTherapyDedupKey({
        animalId: "animal-1",
        expectedCalvingDate: "2026-07-10",
      }),
    );
  });

  it("returns null dedup when animal or expected calving date is missing", () => {
    expect(
      buildDryCowTherapyDedupKey({
        animalId: "",
        expectedCalvingDate: "2026-07-10",
      }),
    ).toBeNull();
    expect(
      buildDryCowTherapyDedupKey({
        animalId: "animal-1",
        expectedCalvingDate: null,
      }),
    ).toBeNull();
  });

  it("builds a versioned event payload without allowing agenda materialization", () => {
    const readiness = evaluateDryCowTherapyReadiness({
      animal: baseAnimal,
      referenceDate: "2026-05-10",
    });

    expect(
      buildDryCowTherapyEventPayload({
        animalId: "animal-1",
        performedAt: "2026-05-10T12:00:00.000Z",
        readiness,
      }),
    ).toEqual({
      dry_cow_therapy: {
        schema_version: 1,
        protocol_id: "med-mastite-seca",
        item_id: "secagem-intramamario",
        performed_at: "2026-05-10T12:00:00.000Z",
        expected_calving_date: "2026-07-10",
        days_until_expected_calving: 61,
        readiness_decision: "candidate_for_future_agenda_contract",
        agenda_materialization_allowed: false,
        dry_off_dedup_key:
          "sanitario:animal:animal-1:terapia_vaca_seca:secagem-intramamario:v1:window:2026-07-10",
        source: "manual_dry_off_event",
      },
    });
  });

  it("recognizes the dry cow therapy clinical protocol reference", () => {
    expect(
      isDryCowTherapyClinicalRef({
        protocolId: "med-mastite-seca",
        itemId: "secagem-intramamario",
      }),
    ).toBe(true);
    expect(
      isDryCowTherapyClinicalRef({
        protocolId: "med-mastite-seca",
        itemId: null,
      }),
    ).toBe(true);
    expect(
      isDryCowTherapyClinicalRef({
        protocolId: "med-tpb",
        itemId: "tpb-diminazeno",
      }),
    ).toBe(false);
  });

  it("builds the animal taxonomy payload for a manual dry-off event", () => {
    expect(
      buildDryCowTherapyAnimalPayload({
        animal: baseAnimal,
        performedAt: "2026-05-10T12:00:00.000Z",
      }),
    ).toMatchObject({
      taxonomy_facts: {
        schema_version: 1,
        em_lactacao: false,
        secagem_realizada: true,
        data_secagem: "2026-05-10",
        data_prevista_parto: "2026-07-10",
      },
    });
  });

  it("defines a SQL materialization contract while keeping runtime agenda blocked", () => {
    expect(validateDryCowTherapyMaterializationContract()).toEqual([]);
    expect(DRY_COW_THERAPY_MATERIALIZATION_CONTRACT).toMatchObject({
      capabilityId: "sanitario.agenda.vaca_seca",
      contractVersion: 1,
      status: "sql_contract_implemented_activation_required",
      sqlOwner: "sanitario_recompute_agenda_core",
      sqlImplementationMigration:
        "20260524000000_dry_cow_therapy_agenda_recompute.sql",
      protocolId: "med-mastite-seca",
      itemId: "secagem-intramamario",
      familyCode: "terapia_vaca_seca",
      itemCode: "secagem-intramamario",
      materializationAllowedInCurrentRuntime: true,
      materializationRequiresOperationalActivation: true,
      schedule: {
        anchorFact: "taxonomy_facts.data_prevista_parto",
        dueDateRule: "max(as_of, data_prevista_parto - 60 days)",
        candidateWindowDaysBeforeCalving: {
          start: 75,
          end: 45,
        },
        dedupPeriodMode: "window",
        dedupPeriodKey: "data_prevista_parto",
      },
    });
    expect(
      DRY_COW_THERAPY_MATERIALIZATION_CONTRACT.antiZombieRules,
    ).toEqual(
      expect.arrayContaining([
        "do not create agenda when secagem_realizada is true",
        "do not recreate agenda when matching dry_cow_therapy event already exists",
      ]),
    );
  });

  it("builds a future SQL agenda candidate preview without enabling materialization", () => {
    const readiness = evaluateDryCowTherapyReadiness({
      animal: baseAnimal,
      referenceDate: "2026-05-10",
    });

    expect(
      buildDryCowTherapyAgendaCandidatePreview({
        animalId: "animal-1",
        asOf: "2026-05-10",
        readiness,
      }),
    ).toEqual({
      contract_version: 1,
      protocol_id: "med-mastite-seca",
      item_id: "secagem-intramamario",
      family_code: "terapia_vaca_seca",
      item_code: "secagem-intramamario",
      animal_id: "animal-1",
      due_date: "2026-05-11",
      expected_calving_date: "2026-07-10",
      dry_off_target_date: "2026-05-11",
      dry_off_dedup_key:
        "sanitario:animal:animal-1:terapia_vaca_seca:secagem-intramamario:v1:window:2026-07-10",
      agenda_materialization_allowed: false,
      payload: {
        family_code: "terapia_vaca_seca",
        item_code: "secagem-intramamario",
        protocol_id: "med-mastite-seca",
        materialization_contract_version: 1,
        anchor_fact: "taxonomy_facts.data_prevista_parto",
        expected_calving_date: "2026-07-10",
        dry_off_target_date: "2026-05-11",
        dry_off_dedup_key:
          "sanitario:animal:animal-1:terapia_vaca_seca:secagem-intramamario:v1:window:2026-07-10",
        agenda_materialization_allowed: false,
        source: "dry_cow_therapy_sql_contract_preview",
      },
    });
  });

  it("clamps the future SQL candidate due date to asOf inside the active window", () => {
    const readiness = evaluateDryCowTherapyReadiness({
      animal: baseAnimal,
      referenceDate: "2026-05-20",
    });

    expect(
      buildDryCowTherapyAgendaCandidatePreview({
        animalId: "animal-1",
        asOf: "2026-05-20T12:00:00.000Z",
        readiness,
      })?.due_date,
    ).toBe("2026-05-20");
  });

  it("does not build a future SQL agenda candidate when readiness is blocked", () => {
    const readiness = evaluateDryCowTherapyReadiness({
      animal: {
        ...baseAnimal,
        payload: {
          taxonomy_facts: {
            em_lactacao: false,
            secagem_realizada: false,
            data_prevista_parto: "2026-07-10",
          },
        },
      },
      referenceDate: "2026-05-10",
    });

    expect(
      buildDryCowTherapyAgendaCandidatePreview({
        animalId: "animal-1",
        asOf: "2026-05-10",
        readiness,
      }),
    ).toBeNull();
  });

  it("builds the farm-scoped activation payload required by SQL recompute", () => {
    const activated = buildDryCowTherapyOperationalAgendaItemPayload({
      standard_id: "med-mastite-seca",
      family_code: "terapia_vaca_seca",
      item_code: "secagem-intramamario",
      calendario_base: {
        mode: "clinical_protocol",
        anchor: "dry_off",
      },
    });

    expect(activated).toMatchObject({
      family_code: "terapia_vaca_seca",
      item_code: "secagem-intramamario",
      protocol_id: "med-mastite-seca",
      materialization_contract_version: 1,
      agenda_activation: {
        mode: "dry_off_reproductive_window",
        source: "farm_protocol_explicit_activation",
        contract_version: 1,
      },
      dry_cow_therapy: {
        activation_status: "operational_agenda_enabled",
        materialization_contract_version: 1,
      },
    });

    expect(
      isDryCowTherapyProtocolItem({
        payload: activated,
      }),
    ).toBe(true);
  });

  it("removes agenda activation when returning Vaca Seca to clinical support", () => {
    const clinical = buildDryCowTherapyClinicalSupportItemPayload({
      family_code: "terapia_vaca_seca",
      item_code: "secagem-intramamario",
      agenda_activation: {
        mode: "dry_off_reproductive_window",
      },
    });

    expect(clinical).not.toHaveProperty("agenda_activation");
    expect(clinical).toMatchObject({
      family_code: "terapia_vaca_seca",
      item_code: "secagem-intramamario",
      protocol_id: "med-mastite-seca",
      dry_cow_therapy: {
        activation_status: "clinical_support_only",
        materialization_contract_version: 1,
      },
    });
  });
});
