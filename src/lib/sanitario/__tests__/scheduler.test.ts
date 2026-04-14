/**
 * Testes para Scheduler Sanitário (Fase 2)
 *
 * Cobertura obrigatória conforme plano:
 * - Janela etária (antes, dentro, após faixa)
 * - Rotina recorrente (sem histórico, com histórico)
 * - Campanha (fora mês, no mês, já materializada)
 * - Procedimento imediato (evento inad, evento ativo)
 * - Dependência (não satisfeita, satisfeita)
 * - Elegibilidade (sexo, idade, espécie, categoria)
 * - Dedup (mesma chave mesma opportunity, chave diferente períodos diferentes)
 * - Applicability (jurisdição, risco, evento)
 */

import { describe, it, expect } from "vitest";
import { computeNextSanitaryOccurrence } from "../scheduler";
import type {
  SanitaryProtocolItemDomain,
  SanitarySubjectContext,
  SanitaryExecutionRecord,
  SchedulerNowContext,
} from "../domain";

// ============================================================================
// FIXTURE HELPER: Minimal valid domain
// ============================================================================

function createMinimalDomain(): SanitaryProtocolItemDomain {
  return {
    identity: {
      protocolId: "prot-1",
      itemId: "item-1",
      familyCode: "test-family",
      itemCode: "test-item",
      regimenVersion: 1,
      layer: "official",
      scopeType: "animal",
    },
    schedule: {
      mode: "nao_estruturado",
      anchor: "sem_ancora",
      intervalDays: null,
      campaignMonths: null,
      ageStartDays: null,
      ageEndDays: null,
      dependsOnItemCode: null,
      generatesAgenda: true,
      operationalLabel: null,
      notes: null,
      instructions: null,
    },
    eligibility: {
      sexTarget: "sem_restricao",
      ageMinDays: null,
      ageMaxDays: null,
      species: null,
      categoryCodes: null,
    },
    applicability: { type: "sempre" },
    compliance: {
      level: "recomendado",
      mandatory: false,
      requiresVeterinarian: false,
      requiresDocument: false,
      requiredDocumentTypes: null,
      blocksExecutionWithoutVeterinarian: false,
      blocksCompletionWithoutDocument: false,
    },
    executionPolicy: {
      allowsManualExecution: true,
      createsInstantTaskOnEvent: false,
      expiresWhenWindowEnds: false,
      supportsBatchExecution: false,
    },
  };
}

function createMinimalSubject(): SanitarySubjectContext {
  return {
    scopeType: "animal",
    scopeId: "animal-1",
    animal: {
      id: "animal-1",
      birthDate: "2026-01-01",
      sex: "femea",
      species: "bovino",
      categoryCode: "bezerro",
      payload: { taxonomy_facts: {} },
    },
    lote: null,
    fazenda: { id: "faz-1", uf: "GO", municipio: "Goiânia", now: "2026-07-15" },
    activeRisks: [],
    activeEvents: [],
  };
}

function createMinimalNowContext(): SchedulerNowContext {
  return { currentDate: "2026-07-15" };
}

// ============================================================================
// TESTES: JANELA ETARIA
// ============================================================================

describe("Scheduler: Janela Etária", () => {
  it("should return ready when animal is within age window", () => {
    const domain = createMinimalDomain();
    domain.schedule = {
      ...domain.schedule,
      mode: "janela_etaria",
      anchor: "nascimento",
      ageStartDays: 30,
      ageEndDays: 180,
    };

    const subject = createMinimalSubject();
    subject.animal!.birthDate = "2026-06-15"; // 30 dias atrás

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: createMinimalNowContext(),
    });

    expect(result.reasonCode).toBe("ready");
    expect(result.materialize).toBe(true);
    expect(result.dueDate).not.toBeNull();
  });

  it("should return before_window when animal is too young", () => {
    const domain = createMinimalDomain();
    domain.schedule = {
      ...domain.schedule,
      mode: "janela_etaria",
      anchor: "nascimento",
      ageStartDays: 60,
      ageEndDays: 180,
    };

    const subject = createMinimalSubject();
    subject.animal!.birthDate = "2026-07-10"; // 5 dias atrás (< 60)

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: createMinimalNowContext(),
    });

    expect(result.reasonCode).toBe("before_window");
    expect(result.materialize).toBe(false);
  });

  it("should return window_expired when animal exceeds max age", () => {
    const domain = createMinimalDomain();
    domain.schedule = {
      ...domain.schedule,
      mode: "janela_etaria",
      anchor: "nascimento",
      ageStartDays: 30,
      ageEndDays: 100,
    };

    const subject = createMinimalSubject();
    subject.animal!.birthDate = "2026-01-01"; // 196 dias atrás (> 100)

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: createMinimalNowContext(),
    });

    expect(result.reasonCode).toBe("window_expired");
    expect(result.materialize).toBe(false);
  });
});

// ============================================================================
// TESTES: ROTINA RECORRENTE
// ============================================================================

describe("Scheduler: Rotina Recorrente", () => {
  it("should compute interval from anchor date when no history", () => {
    const domain = createMinimalDomain();
    domain.schedule = {
      ...domain.schedule,
      mode: "rotina_recorrente",
      anchor: "nascimento",
      intervalDays: 60,
    };

    const subject = createMinimalSubject();
    subject.animal!.birthDate = "2026-05-01"; // 75 dias atrás

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: createMinimalNowContext(),
    });

    // 75 dias > 60 intervalo = ready
    expect(result.reasonCode).toBe("ready");
    expect(result.materialize).toBe(true);
    expect(result.dueDate).toBeDefined();
  });

  it("should compute interval from last completion in history", () => {
    const domain = createMinimalDomain();
    domain.schedule = {
      ...domain.schedule,
      mode: "rotina_recorrente",
      anchor: "nascimento",
      intervalDays: 30,
    };

    const subject = createMinimalSubject();

    const history: SanitaryExecutionRecord[] = [
      {
        occurrenceId: "occ-1",
        familyCode: "test-family",
        itemCode: "test-item",
        regimenVersion: 1,
        scopeType: "animal",
        scopeId: "animal-1",
        completedAt: "2026-07-01",
        executionDate: "2026-07-01",
        sourceEventId: null,
        dedupKey: "sanitario:animal:animal-1:test-family:test-item:v1:interval:2026-07-01",
        status: "completed",
      },
    ];

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history,
      now: createMinimalNowContext(),
    });

    // 14 dias desde last (2026-07-01 até 2026-07-15) < 30 = not_due_yet
    expect(result.reasonCode).toBe("not_due_yet");
    expect(result.materialize).toBe(false);
    expect(result.dueDate).toBeDefined(); // nextDue = 2026-07-31
  });
});

// ============================================================================
// TESTES: CAMPANHA
// ============================================================================

describe("Scheduler: Campanha", () => {
  it("should return ready when current month is in campaign months", () => {
    const domain = createMinimalDomain();
    domain.schedule = {
      ...domain.schedule,
      mode: "campanha",
      anchor: "nascimento", // mudado de desmama para nascimento
      campaignMonths: [5, 6, 7], // maio, junho, julho
    };

    const subject = createMinimalSubject();

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: { currentDate: "2026-07-15" }, // julho
    });

    expect(result.reasonCode).toBe("ready");
    expect(result.materialize).toBe(true);
  });

  it("should return not_due_yet when current month is not in campaign", () => {
    const domain = createMinimalDomain();
    domain.schedule = {
      ...domain.schedule,
      mode: "campanha",
      anchor: "nascimento", // mudado de desmama para nascimento
      campaignMonths: [5, 6, 7], // maio, junho, julho
    };

    const subject = createMinimalSubject();

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: { currentDate: "2026-08-15" }, // agosto
    });

    expect(result.reasonCode).toBe("not_due_yet");
    expect(result.materialize).toBe(false);
  });

  it("should return already_materialized if campaign already exists in history", () => {
    const domain = createMinimalDomain();
    domain.schedule = {
      ...domain.schedule,
      mode: "campanha",
      anchor: "nascimento", // mudado de desmama para nascimento
      campaignMonths: [7],
    };

    const subject = createMinimalSubject();

    const history: SanitaryExecutionRecord[] = [
      {
        occurrenceId: "occ-camp-1",
        familyCode: "test-family",
        itemCode: "test-item",
        regimenVersion: 1,
        scopeType: "animal",
        scopeId: "animal-1",
        completedAt: null,
        executionDate: "2026-07-10",
        sourceEventId: null,
        dedupKey: "sanitario:animal:animal-1:test-family:test-item:v1:campaign:2026-07",
        status: "pending",
      },
    ];

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history,
      now: { currentDate: "2026-07-20" }, // ainda julho
    });

    expect(result.reasonCode).toBe("already_materialized");
    expect(result.materialize).toBe(false);
  });
});

// ============================================================================
// TESTES: PROCEDIMENTO IMEDIATO
// ============================================================================

describe("Scheduler: Procedimento Imediato", () => {
  it("should return ready when event is active", () => {
    const domain = createMinimalDomain();
    domain.schedule = {
      ...domain.schedule,
      mode: "procedimento_imediato",
      anchor: "sem_ancora",
    };

    const subject = createMinimalSubject();
    subject.activeEvents = [
      {
        eventId: "evt-77",
        eventCode: "notificacao_svo",
        openedAt: "2026-07-14",
        closedAt: null,
      },
    ];

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: createMinimalNowContext(),
    });

    expect(result.reasonCode).toBe("ready");
    expect(result.materialize).toBe(true);
  });

  it("should return not_applicable when no event is active", () => {
    const domain = createMinimalDomain();
    domain.schedule = {
      ...domain.schedule,
      mode: "procedimento_imediato",
      anchor: "sem_ancora",
    };

    const subject = createMinimalSubject();
    subject.activeEvents = [];

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: createMinimalNowContext(),
    });

    expect(result.reasonCode).toBe("not_applicable");
    expect(result.materialize).toBe(false);
  });
});

// ============================================================================
// TESTES: DEPENDÊNCIA
// ============================================================================

describe("Scheduler: Dependência", () => {
  it("should block when dependency is not satisfied", () => {
    const domain = createMinimalDomain();
    domain.schedule = {
      ...domain.schedule,
      mode: "campanha",
      campaignMonths: [7],
      dependsOnItemCode: "dose-1",
    };

    const subject = createMinimalSubject();
    const history: SanitaryExecutionRecord[] = []; // sem dose-1

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history,
      now: { currentDate: "2026-07-15" },
    });

    expect(result.reasonCode).toBe("dependency_not_satisfied");
    expect(result.materialize).toBe(false);
  });

  it("should allow when dependency is satisfied", () => {
    const domain = createMinimalDomain();
    domain.schedule = {
      ...domain.schedule,
      mode: "campanha",
      anchor: "nascimento",
      campaignMonths: [7],
      dependsOnItemCode: "dose-1",
    };

    const subject = createMinimalSubject();
    const history: SanitaryExecutionRecord[] = [
      {
        occurrenceId: "occ-dep",
        familyCode: "raiva",
        itemCode: "dose-1",
        regimenVersion: 1,
        scopeType: "animal",
        scopeId: "animal-1",
        completedAt: "2026-06-01",
        executionDate: "2026-06-01",
        sourceEventId: null,
        dedupKey: "sanitario:animal:animal-1:raiva:dose-1:v1:campaign:2026-06",
        status: "completed",
      },
    ];

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history,
      now: { currentDate: "2026-07-15" },
    });

    expect(result.reasonCode).toBe("ready");
    expect(result.materialize).toBe(true);
  });
});

// ============================================================================
// TESTES: ELEGIBILIDADE
// ============================================================================

describe("Scheduler: Elegibilidade", () => {
  it("should block when animal sex does not match requirement", () => {
    const domain = createMinimalDomain();
    domain.eligibility.sexTarget = "macho"; // apenas machos

    const subject = createMinimalSubject();
    subject.animal!.sex = "femea"; // mas é fêmea

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: createMinimalNowContext(),
    });

    expect(result.reasonCode).toBe("not_eligible");
    expect(result.materialize).toBe(false);
  });

  it("should block when animal species does not match", () => {
    const domain = createMinimalDomain();
    domain.eligibility.species = ["bubalino"]; // apenas bubalinos

    const subject = createMinimalSubject();
    subject.animal!.species = "bovino"; // mas é bovino

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: createMinimalNowContext(),
    });

    expect(result.reasonCode).toBe("not_eligible");
    expect(result.materialize).toBe(false);
  });

  it("should block when animal category does not match", () => {
    const domain = createMinimalDomain();
    domain.eligibility.categoryCodes = ["novilha", "vaca"]; // apenas novilhu/vaca

    const subject = createMinimalSubject();
    subject.animal!.categoryCode = "bezerro"; // mas é bezerro

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: createMinimalNowContext(),
    });

    expect(result.reasonCode).toBe("not_eligible");
    expect(result.materialize).toBe(false);
  });
});

// ============================================================================
// TESTES: APPLICABILITY
// ============================================================================

describe("Scheduler: Applicability", () => {
  it("should block when jurisdiction does not match", () => {
    const domain = createMinimalDomain();
    domain.applicability = {
      type: "jurisdicao",
      jurisdiction: "SP", // São Paulo apenas
    };

    const subject = createMinimalSubject();
    subject.fazenda!.uf = "GO"; // mas fazenda é em Goiás

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: createMinimalNowContext(),
    });

    expect(result.reasonCode).toBe("jurisdiction_not_allowed");
    expect(result.materialize).toBe(false);
  });

  it("should block when required risk is not active", () => {
    const domain = createMinimalDomain();
    domain.applicability = {
      type: "risco",
      risk: "raiva",
    };

    const subject = createMinimalSubject();
    subject.activeRisks = []; // nenhum risco ativo

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: createMinimalNowContext(),
    });

    expect(result.reasonCode).toBe("risk_not_active");
    expect(result.materialize).toBe(false);
  });

  it("should allow when required risk is active", () => {
    const domain = createMinimalDomain();
    domain.applicability = {
      type: "risco",
      risk: "raiva",
    };

    const subject = createMinimalSubject();
    subject.activeRisks = [
      { riskCode: "raiva", activatedAt: "2026-07-01", closedAt: null },
    ];

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: createMinimalNowContext(),
    });

    // Será ready se mode permitir (nao_estruturado = não)
    expect(result.blockedBy).not.toBe("applicability");
  });
});

// ============================================================================
// TESTES: DEDUP (Chave Única)
// ============================================================================

describe("Scheduler: Dedup", () => {
  it("should generate same dedup key for same campaign month and animal", () => {
    const domain = createMinimalDomain();
    domain.schedule = {
      ...domain.schedule,
      mode: "campanha",
      campaignMonths: [7],
    };

    const subject = createMinimalSubject();

    const result1 = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: { currentDate: "2026-07-15" },
    });

    const result2 = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: { currentDate: "2026-07-20" }, // outro dia, mesmo mês
    });

    expect(result1.dedupKey).toBe(result2.dedupKey);
  });

  it("should generate different dedup key for different campaign months", () => {
    const domain = createMinimalDomain();
    domain.schedule = {
      ...domain.schedule,
      mode: "campanha",
      anchor: "nascimento",
      campaignMonths: [6, 7],
    };

    const subject = createMinimalSubject();

    const result1 = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: { currentDate: "2026-06-15" },
    });

    const result2 = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: { currentDate: "2026-07-15" }, // próximo mês
    });

    expect(result1.dedupKey).not.toBe(result2.dedupKey);
  });
});

// ============================================================================
// TESTES: INTEGRAÇÃO (Múltiplos Passos)
// ============================================================================

describe("Scheduler: Integração Múltiplos Passos", () => {
  it("should block when generatesAgenda=false regardless of other conditions", () => {
    const domain = createMinimalDomain();
    domain.schedule.generatesAgenda = false;
    domain.schedule.mode = "campanha";
    domain.schedule.campaignMonths = [7];

    const subject = createMinimalSubject();

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history: [],
      now: { currentDate: "2026-07-15" },
    });

    expect(result.reasonCode).toBe("agenda_disabled");
    expect(result.materialize).toBe(false);
  });

  it("should allow complex scenario: campanha com dependência e elegibilidade", () => {
    const domain = createMinimalDomain();
    domain.schedule = {
      ...domain.schedule,
      mode: "campanha",
      anchor: "nascimento",
      campaignMonths: [7],
      dependsOnItemCode: "dose-1",
    };
    domain.eligibility.sexTarget = "femea";

    const subject = createMinimalSubject();
    subject.animal!.sex = "femea"; // Elegível
    const history: SanitaryExecutionRecord[] = [
      {
        occurrenceId: "occ-dep",
        familyCode: "raiva",
        itemCode: "dose-1",
        regimenVersion: 1,
        scopeType: "animal",
        scopeId: "animal-1",
        completedAt: "2026-06-01",
        executionDate: "2026-06-01",
        sourceEventId: null,
        dedupKey: "sanitario:animal:animal-1:raiva:dose-1:v1:campaign:2026-06",
        status: "completed",
      },
    ];

    const result = computeNextSanitaryOccurrence({
      item: domain,
      subject,
      history,
      now: { currentDate: "2026-07-15" },
    });

    expect(result.reasonCode).toBe("ready");
    expect(result.materialize).toBe(true);
  });
});
