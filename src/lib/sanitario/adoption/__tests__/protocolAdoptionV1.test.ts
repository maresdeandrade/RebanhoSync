import { describe, expect, it } from "vitest";
import type { FazendaSanidadeConfig } from "@/lib/offline/types";
import type { SanitaryTriageEvaluationV2 } from "../../triage/sanitaryTriageV2";
import {
  SANITARY_PROTOCOL_PACKAGES, defaultProtocolFamiliesV1, readProtocolAdoptionV1,
  isProtocolMonitoringEnabledV1, countProtocolStageAnimalsV1,
} from "../protocolAdoptionV1";

const config = (overrides = {}) => ({ fazenda_id: "farm-a", deleted_at: null,
  payload: { sanitary_protocol_adoption_v1: { schemaVersion: 1, revision: 1, families: defaultProtocolFamiliesV1() } },
  ...overrides,
}) as FazendaSanidadeConfig;
const row = (animalId: string, overrides = {}) => ({ animalId, status: "in_action_window",
  disposition: "opportunity_in_window", documentaryPending: false, blockers: [], alreadyPlanned: false,
  ...overrides,
}) as SanitaryTriageEvaluationV2;

describe("monitoramento sanitário por fazenda", () => {
  it("organiza dez famílias uma única vez em quatro pacotes sem criar famílias", () => {
    const codes = SANITARY_PROTOCOL_PACKAGES.flatMap(pack => pack.families.map(family => family.code));
    expect(SANITARY_PROTOCOL_PACKAGES).toHaveLength(4);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes).toContain("controle_parasitario_recria_5_7_9");
  });
  it("ausência e versão inválida mantêm leitura legada, sem OFF fabricado", () => {
    expect(readProtocolAdoptionV1(undefined, "farm-a")).toBeNull();
    expect(readProtocolAdoptionV1(config({ payload: { sanitary_protocol_adoption_v1: { schemaVersion: 2 } } }), "farm-a")).toBeNull();
    expect(isProtocolMonitoringEnabledV1(undefined, "farm-a", "clostridioses")).toBe(true);
  });
  it("primeira gravação possui nove famílias e pré-confinamento OFF", () => {
    const families = defaultProtocolFamiliesV1();
    expect(Object.keys(families)).toHaveLength(9);
    expect(families.vermifugacao_pre_confinamento_pasto_vedado.monitoringEnabled).toBe(false);
    expect(families.clostridioses.monitoringEnabled).toBe(true);
    expect(families).not.toHaveProperty("febre_aftosa");
  });
  it("só aceita namespace completo e revisão sincronizada da própria fazenda", () => {
    expect(readProtocolAdoptionV1(config(), "farm-a")?.revision).toBe(1);
    expect(readProtocolAdoptionV1(config(), "farm-b")).toBeNull();
    expect(readProtocolAdoptionV1(config({ deleted_at: "2026-11-15" }), "farm-a")).toBeNull();
    for (const value of [{ schemaVersion: 1, revision: 0, families: defaultProtocolFamiliesV1() },
      { schemaVersion: 1, revision: 1, families: {} },
      { schemaVersion: 1, revision: 1, families: { ...defaultProtocolFamiliesV1(), clostridioses: { monitoringEnabled: "false" } } }]) {
      expect(readProtocolAdoptionV1(config({ payload: { sanitary_protocol_adoption_v1: value } }), "farm-a")).toBeNull();
    }
  });
  it("OFF explícito só vale no tenant correspondente e não habilita aftosa", () => {
    const saved = config();
    (saved.payload.sanitary_protocol_adoption_v1 as { families: ReturnType<typeof defaultProtocolFamiliesV1> }).families.clostridioses.monitoringEnabled = false;
    expect(isProtocolMonitoringEnabledV1(saved, "farm-a", "clostridioses")).toBe(false);
    expect(isProtocolMonitoringEnabledV1(saved, "farm-b", "clostridioses")).toBe(true);
    expect(isProtocolMonitoringEnabledV1(saved, "farm-a", "febre_aftosa")).toBe(false);
  });
  it("conta animais únicos e separa pendências, atraso e janela futura", () => {
    const result = countProtocolStageAnimalsV1([
      row("a"), row("a"), row("b", { status: "overdue" }),
      row("c", { status: "insufficient_data", disposition: "insufficient_data" }),
      row("d", { disposition: "future_opportunity", status: "not_yet_eligible" }),
      row("e", { disposition: "factual_completed", status: "completed" }),
      row("f", { disposition: "scheduled", alreadyPlanned: true }),
      row("g", { disposition: "restricted", status: "not_applicable" }),
      row("h", { disposition: "outside_period" }),
    ]);
    expect(result).toEqual({ eligible: 1, overdue: 1, insufficient: 1, future: 1, completed: 1, scheduled: 1, restricted: 1 });
  });
  it("não conta documentação insuficiente como elegibilidade nem duplica situações incompatíveis", () => {
    expect(countProtocolStageAnimalsV1([row("a"), row("a", { documentaryPending: true })]))
      .toMatchObject({ eligible: 0, insufficient: 1 });
  });
});
