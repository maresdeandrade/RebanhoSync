import { describe, expect, it } from "vitest";
import type { AnimalSanitaryAlertState } from "@/lib/sanitario/compliance/alerts";
import { buildSanitaryCaseFlowSummary } from "@/lib/sanitario/compliance/caseFlow";

const baseAlert: AnimalSanitaryAlertState = {
  status: "suspeita_aberta",
  diseaseCode: "AFTOSA",
  diseaseName: "Febre aftosa",
  notificationType: "imediata",
  requiresImmediateNotification: true,
  movementBlocked: true,
  openedAt: "2026-05-20T12:00:00.000Z",
  closedAt: null,
  notes: "Sinais compativeis",
  routeLabel: "Acionar SVO",
  immediateActions: ["Isolar animal"],
  alertSignals: ["Salivacao"],
  closureReason: null,
  closureNotes: null,
};

describe("buildSanitaryCaseFlowSummary", () => {
  it("projects open sanitary alert as an open case", () => {
    const summary = buildSanitaryCaseFlowSummary({ alert: baseAlert });

    expect(summary).toMatchObject({
      status: "case_open",
      statusLabel: "Caso aberto",
      scopeLabel: "Notificacao imediata",
      primaryLabel: "Febre aftosa",
      secondaryLabel: "Acionar SVO",
      blocked: true,
      openedAt: "2026-05-20T12:00:00.000Z",
      closedAt: null,
    });
  });

  it("projects closed sanitary alert without keeping movement blocked", () => {
    const summary = buildSanitaryCaseFlowSummary({
      alert: {
        ...baseAlert,
        status: "encerrada",
        movementBlocked: true,
        closedAt: "2026-05-21T12:00:00.000Z",
        closureReason: "descartada",
      },
    });

    expect(summary).toMatchObject({
      status: "case_closed",
      statusLabel: "Caso encerrado",
      blocked: false,
      closedAt: "2026-05-21T12:00:00.000Z",
    });
  });

  it("projects clinical follow-up when there is no structured alert yet", () => {
    const summary = buildSanitaryCaseFlowSummary({
      alert: null,
      clinicalFollowupCount: 2,
    });

    expect(summary).toMatchObject({
      status: "clinical_followup",
      statusLabel: "Acompanhamento clinico",
      scopeLabel: "Caso sanitario futuro",
      primaryLabel: "2 manejos clinicos",
      blocked: false,
    });
  });

  it("returns null when there is no alert or clinical follow-up", () => {
    expect(buildSanitaryCaseFlowSummary({ alert: null })).toBeNull();
  });
});
