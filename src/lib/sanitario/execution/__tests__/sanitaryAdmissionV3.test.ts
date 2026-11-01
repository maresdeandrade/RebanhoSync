// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { executeSanitaryAgendaV2 } from "../sanitaryAgendaExecutionV2";
import { createSanitaryCorrectionV2 } from "../../reconciliation/sanitaryCorrectionV2";
import { prepareSanitaryAdmissionV3 } from "../sanitaryAdmissionV3";

const input = {
  intent: "agenda_execution" as const,
  fazendaId: crypto.randomUUID(),
  agendaId: crypto.randomUUID(),
  clientOpId: crypto.randomUUID(),
  clientTxId: crypto.randomUUID(),
  domainOpId: crypto.randomUUID(),
  payload: {},
};
describe("V3.1 admission", () => {
  afterAll(async () => {
    db.close();
  });
  it("generic_sanitary_writer_is_blocked_before_optimistic_persistence", async () => {
    const before = [
      await db.event_eventos.count(),
      await db.queue_ops.count(),
      await db.state_insumo_movimentacoes.count(),
    ];
    await expect(
      createGesture(input.fazendaId, [
        {
          table: "eventos",
          action: "INSERT",
          record: {
            id: crypto.randomUUID(),
            dominio: "sanitario",
            occurred_at: new Date().toISOString(),
          },
        },
      ]),
    ).rejects.toThrow("SANITARIO_SINGLE_ADMISSION_REQUIRED");
    expect([
      await db.event_eventos.count(),
      await db.queue_ops.count(),
      await db.state_insumo_movimentacoes.count(),
    ]).toEqual(before);
  });
  it("agenda_writer_is_blocked_before_event_consumption_or_queue", async () => {
    const before = [
      await db.event_eventos.count(),
      await db.queue_ops.count(),
      await db.state_insumo_movimentacoes.count(),
    ];
    await expect(
      executeSanitaryAgendaV2({
        fazendaId: input.fazendaId,
        agendaId: input.agendaId,
        clientOpId: input.clientOpId,
        executedAt: "2026-10-30",
        confirmation: { userConfirmedExecution: true },
      }),
    ).rejects.toThrow("SANITARIO_V3_EXECUTION_NOT_ENABLED");
    expect([
      await db.event_eventos.count(),
      await db.queue_ops.count(),
      await db.state_insumo_movimentacoes.count(),
    ]).toEqual(before);
  });
  it("new_plan_is_persisted_as_format3_after_snapshot_capture_and_profile_fields_survive", async () => {
    const farm = crypto.randomUUID();
    const before = {
      fazenda_id: farm,
      uf: "GO",
      payload: { profile: "original" },
    };
    await db.state_fazenda_sanidade_config.put(
      before as import("@/lib/offline/types").FazendaSanidadeConfig,
    );
    const plan = {
      schemaVersion: 2,
      revision: 1,
      enabled: false,
      rules: [],
      context: {},
    };
    const tx = await createGesture(farm, [
      {
        table: "fazenda_sanidade_config",
        action: "UPDATE",
        record: {
          fazenda_id: farm,
          payload: { profile: "original", sanitary_agenda_automation_v2: plan },
        },
      },
    ]);
    const op = await db.queue_ops.where("client_tx_id").equals(tx).first();
    expect(op).toMatchObject({
      table: "sanitario_v2",
      action: "INSERT",
      before_snapshot: before,
      record: {
        domain: "sanitario_v2",
        contract_version: 3,
        command: "set_automation_plan",
        payload: { plan, expected_plan: null },
      },
    });
    expect((await db.state_fazenda_sanidade_config.get(farm))?.uf).toBe("GO");
    const profileTx = await createGesture(farm, [
      {
        table: "fazenda_sanidade_config",
        action: "UPDATE",
        record: {
          fazenda_id: farm,
          payload: { profile: "edited", sanitary_agenda_automation_v2: plan },
        },
      },
    ]);
    expect(
      await db.queue_ops.where("client_tx_id").equals(profileTx).first(),
    ).toMatchObject({
      table: "fazenda_sanidade_config",
      record: {
        payload: { profile: "edited", sanitary_agenda_automation_v2: plan },
      },
    });
  });
  it("correction_without_agenda_in_input_resolves_the_persisted_source_chain", async () => {
    const root = crypto.randomUUID(),
      source = crypto.randomUUID();
    await db.event_eventos.bulkPut([
      {
        id: root,
        fazenda_id: input.fazendaId,
        dominio: "sanitario",
        source_sanitario_agenda_v2_id: input.agendaId,
        payload: {},
      },
      {
        id: source,
        fazenda_id: input.fazendaId,
        dominio: "sanitario",
        corrige_evento_id: root,
        payload: {},
      },
    ] as import("@/lib/offline/types").Evento[]);
    await db.event_eventos_sanitario.put({
      evento_id: source,
      fazenda_id: input.fazendaId,
    } as import("@/lib/offline/types").EventoSanitario);
    const before = [
      await db.event_eventos.toArray(),
      await db.queue_ops.toArray(),
      await db.state_insumo_movimentacoes.toArray(),
    ];
    await expect(
      createSanitaryCorrectionV2({
        fazendaId: input.fazendaId,
        correctedEventId: source,
        correctionEventId: crypto.randomUUID(),
        correctionType: "complemento_rastreabilidade",
        reason: "fixture",
        changes: { responsavel_nome: "fixture" },
        occurredAt: "2026-10-30T12:00:00Z",
      }),
    ).rejects.toThrow("SANITARIO_V3_EXECUTION_NOT_ENABLED");
    expect([
      await db.event_eventos.toArray(),
      await db.queue_ops.toArray(),
      await db.state_insumo_movimentacoes.toArray(),
    ]).toEqual(before);
    await expect(
      createGesture(input.fazendaId, [
        {
          table: "eventos",
          action: "INSERT",
          record: {
            id: crypto.randomUUID(),
            dominio: "conformidade",
            corrige_evento_id: source,
          },
        },
      ]),
    ).rejects.toThrow("SANITARIO_SINGLE_ADMISSION_REQUIRED");
  });
  it("blocked_execution_writes_nothing", () => {
    expect(prepareSanitaryAdmissionV3(input)).toEqual({
      disposition: "blocked",
      reason: "SANITARIO_V3_EXECUTION_NOT_ENABLED",
    });
  });
  it("external_intent_cannot_disguise_primary_execution", () => {
    expect(
      prepareSanitaryAdmissionV3({
        ...input,
        intent: "external_history",
        agendaId: undefined,
        payload: {
          event: { id: crypto.randomUUID(), natureza: "primary_execution" },
          detail: {},
          event_animals: [
            { id: crypto.randomUUID(), animal_id: crypto.randomUUID() },
          ],
        },
      }),
    ).toEqual({
      disposition: "blocked",
      reason: "SANITARIO_V3_EXECUTION_NOT_ENABLED",
    });
  });
  it("correction_resolves_agenda_through_source", () => {
    expect(
      prepareSanitaryAdmissionV3({ ...input, intent: "factual_correction" })
        .disposition,
    ).toBe("blocked");
  });
  it("external_history_is_not_attendance", () => {
    const animalId = crypto.randomUUID();
    const result = prepareSanitaryAdmissionV3({
      ...input,
      intent: "external_history",
      agendaId: undefined,
      payload: {
        event: {
          id: crypto.randomUUID(),
          animal_id: animalId,
          natureza: "standalone_fact",
          payload: {
            entry_history_source: "external_declared",
            evidence_class: "declared",
          },
        },
        detail: {},
        event_animals: [{ id: crypto.randomUUID(), animal_id: animalId }],
      },
    });
    expect(result.envelope?.contract_version).toBe(3);
    expect(result.envelope?.client_op_id).toBe(input.clientOpId);
    expect(result.envelope?.domain_op_id).toBe(input.domainOpId);
  });
});
