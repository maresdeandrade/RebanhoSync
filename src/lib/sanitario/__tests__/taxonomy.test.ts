import {
  isAgendaMaterializable,
  isComplianceOnly,
  isExecutionOnly,
  resolveComplianceKind,
  resolveMaterializationMode,
  resolveProtocolKind,
  resolveSanitaryItemOperationalClass,
} from "@/lib/sanitario/models/taxonomy";

describe("sanitary passive taxonomy", () => {
  it("maps vaccination and brucelose legacy payloads to protocol kind vacinacao", () => {
    expect(resolveProtocolKind({ tipo: "vacinacao" })).toBe("vacinacao");
    expect(resolveProtocolKind({ categoria: "vacinas" })).toBe("vacinacao");
    expect(
      resolveProtocolKind({
        identity: {
          protocolId: "official-brucelose",
          itemId: "brucelose-b19",
          familyCode: "brucelose",
          itemCode: "brucelose-b19",
          regimenVersion: 1,
          layer: "official",
          scopeType: "animal",
        },
        schedule: { generatesAgenda: true },
        compliance: {},
      }),
    ).toBe("vacinacao");
  });

  it("maps raiva family to protocol kind vacinacao", () => {
    expect(
      resolveProtocolKind({
        identity: {
          protocolId: "official-raiva",
          itemId: "raiva-d1",
          familyCode: "raiva_herbivoros",
          itemCode: "raiva_d1",
          regimenVersion: 1,
          layer: "official",
          scopeType: "animal",
        },
        schedule: { generatesAgenda: true },
        compliance: {},
      }),
    ).toBe("vacinacao");
  });

  it("maps vermifugacao to protocol kind antiparasitario", () => {
    expect(resolveProtocolKind({ tipo: "vermifugacao" })).toBe("antiparasitario");
    expect(resolveProtocolKind({ categoria: "vermifugacao" })).toBe(
      "antiparasitario",
    );
    expect(resolveProtocolKind({ area: "parasitas" })).toBe("antiparasitario");
  });

  it("maps medicamento with withholding metadata without changing materialization", () => {
    const medication = {
      tipo: "medicamento",
      gera_agenda: false,
      carencia_regra_json: {
        leite_dias: 3,
        carne_dias: 21,
      },
    };

    expect(resolveProtocolKind(medication)).toBe("medicamento");
    expect(resolveComplianceKind(medication)).toBe("withholding_period");
    expect(resolveMaterializationMode(medication)).toBe("compliance_only");
    expect(resolveSanitaryItemOperationalClass(medication)).toBe(
      "compliance_check",
    );
  });

  it("maps GTA/checklist to documental compliance-only", () => {
    const checklist = {
      codigo: "gta-precheck",
      area: "documental",
      gera_agenda: false,
      payload: {
        execution_mode: "checklist",
        subarea: "atualizacao_rebanho",
      },
    };

    expect(resolveProtocolKind(checklist)).toBe("documental");
    expect(resolveComplianceKind(checklist)).toBe("document_required");
    expect(resolveMaterializationMode(checklist)).toBe("compliance_only");
    expect(isComplianceOnly(checklist)).toBe(true);
    expect(resolveSanitaryItemOperationalClass(checklist)).toBe("compliance_check");
  });

  it("maps feed ban to nutrition protocol kind and feed_ban compliance kind", () => {
    const feedBan = {
      area: "nutricao",
      codigo: "feed-ban",
      gera_agenda: false,
      payload: {
        subarea: "feed_ban",
        compliance_kind: "feed_ban",
      },
    };

    expect(resolveProtocolKind(feedBan)).toBe("nutricao");
    expect(resolveComplianceKind(feedBan)).toBe("feed_ban");
    expect(resolveMaterializationMode(feedBan)).toBe("compliance_only");
    expect(resolveSanitaryItemOperationalClass(feedBan)).toBe("compliance_check");
  });

  it("maps quarantine to biosseguranca protocol kind and quarantine compliance kind", () => {
    const quarantine = {
      area: "biosseguranca",
      codigo: "quarentena-entrada",
      gera_agenda: false,
      payload: {
        subarea: "quarentena",
        execution_mode: "checklist",
      },
    };

    expect(resolveProtocolKind(quarantine)).toBe("biosseguranca");
    expect(resolveComplianceKind(quarantine)).toBe("quarantine");
    expect(resolveMaterializationMode(quarantine)).toBe("compliance_only");
    expect(resolveSanitaryItemOperationalClass(quarantine)).toBe(
      "compliance_check",
    );
  });

  it("maps gera_agenda=true to agenda materialization", () => {
    const item = {
      tipo: "vacinacao",
      gera_agenda: true,
    };

    expect(resolveMaterializationMode(item)).toBe("agenda");
    expect(isAgendaMaterializable(item)).toBe(true);
    expect(resolveSanitaryItemOperationalClass(item)).toBe(
      "operational_protocol",
    );
  });

  it("keeps legacy payloads without explicit taxonomy readable", () => {
    const legacyPayload = {
      categoria: "vermifugacao",
      gera_agenda: true,
      payload: {
        label: "Campanha de maio",
      },
    };

    expect(resolveProtocolKind(legacyPayload)).toBe("antiparasitario");
    expect(resolveMaterializationMode(legacyPayload)).toBe("agenda");
    expect(resolveSanitaryItemOperationalClass(legacyPayload)).toBe(
      "operational_protocol",
    );
  });

  it("uses safe fallback for unknown payloads", () => {
    const unknown = {
      categoria: "rotina_local",
      payload: {
        label: "Rotina sem taxonomia conhecida",
      },
    };

    expect(resolveProtocolKind(unknown)).toBe("outro");
    expect(resolveComplianceKind(unknown)).toBe("none");
    expect(resolveMaterializationMode(unknown)).toBe("none");
    expect(isExecutionOnly(unknown)).toBe(false);
    expect(resolveSanitaryItemOperationalClass(unknown)).toBe("unknown");
  });

  it("keeps medication without agenda as execution-only when no compliance signal exists", () => {
    const medication = {
      tipo: "medicamento",
      gera_agenda: false,
    };

    expect(resolveProtocolKind(medication)).toBe("medicamento");
    expect(resolveComplianceKind(medication)).toBe("none");
    expect(resolveMaterializationMode(medication)).toBe("execution_only");
    expect(isExecutionOnly(medication)).toBe(true);
    expect(resolveSanitaryItemOperationalClass(medication)).toBe("execution_only");
  });

  it("classifies notifiable suspicion separately from agenda protocols", () => {
    const notifiableSuspicion = {
      area: "notificacao",
      codigo: "sindrome-vesicular-alerta",
      gera_agenda: false,
      payload: {
        family_code: "febre_aftosa_vigilancia",
        requires_official_notification: true,
      },
    };

    expect(resolveProtocolKind(notifiableSuspicion)).toBe("notificacao");
    expect(resolveMaterializationMode(notifiableSuspicion)).toBe("none");
    expect(resolveSanitaryItemOperationalClass(notifiableSuspicion)).toBe(
      "notifiable_suspicion",
    );
  });

  it("classifies clinical protocols with target policy as clinical support", () => {
    const clinicalProtocol = {
      tipo: "medicamento",
      gera_agenda: false,
      payload: {
        family_code: "tristeza_parasitaria_bovina",
        target_policy: {
          mode: "suspected_animal_required",
          target_scope: "animal",
          condition_code: "tristeza_parasitaria_bovina",
        },
        calendario_base: {
          mode: "clinical_protocol",
        },
      },
    };

    expect(resolveProtocolKind(clinicalProtocol)).toBe("clinico");
    expect(resolveMaterializationMode(clinicalProtocol)).toBe("none");
    expect(resolveSanitaryItemOperationalClass(clinicalProtocol)).toBe(
      "clinical_protocol",
    );
  });
});
