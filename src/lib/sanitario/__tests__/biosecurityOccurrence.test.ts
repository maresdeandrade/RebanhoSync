import { describe, expect, it } from "vitest";

import {
  buildBiosecurityOccurrenceSignals,
  summarizeBiosecurityOccurrences,
} from "@/lib/sanitario/compliance/biosecurityReadModel";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import {
  buildBiosecurityOccurrenceEventInput,
  getAvailableBiosecurityLinkScopes,
  validateBiosecurityOccurrenceDraft,
  type BiosecurityOccurrenceDraft,
} from "@/lib/sanitario/compliance/biosecurityOccurrence";

const baseOccurrence: BiosecurityOccurrenceDraft = {
  tipo_ocorrencia: "visitante_sem_orientacao",
  tipos_ocorrencia: ["visitante_sem_orientacao"],
  categoria_ocorrencia: "biosseguranca",
  escopo_tipo: "fazenda",
  gravidade: "leve",
  descricao: "Visitante entrou sem troca de botas.",
  acao_imediata: "Area isolada e orientacao registrada.",
  gera_pendencia: false,
  status: "aberta",
};

describe("biosecurity occurrence contract", () => {
  it("calculates contextual link scopes by occurrence kind and available data", () => {
    expect(
      getAvailableBiosecurityLinkScopes({
        selectedOccurrenceTypes: ["animal_suspeito_sem_isolamento"],
        contextAvailability: {
          hasAnimal: true,
          hasMultipleAnimals: true,
          hasLote: true,
          hasLocal: true,
          hasManejo: true,
        },
      }).map((option) => option.scope),
    ).toEqual(["animal", "animais", "lote"]);

    expect(
      getAvailableBiosecurityLinkScopes({
        selectedOccurrenceTypes: ["falha_limpeza_desinfeccao"],
        contextAvailability: {
          hasAnimal: true,
          hasMultipleAnimals: true,
          hasLote: true,
          hasLocal: true,
          hasManejo: false,
        },
      }).map((option) => option.scope),
    ).toEqual(["animal", "animais", "lote", "local", "fazenda"]);
  });

  it("unions multiple occurrence kind scopes and keeps additional links for notifiable suspicion", () => {
    expect(
      getAvailableBiosecurityLinkScopes({
        selectedOccurrenceTypes: ["falha_epi", "animal_suspeito_sem_isolamento"],
        contextAvailability: {
          hasAnimal: true,
          hasMultipleAnimals: true,
          hasLote: true,
          hasLocal: true,
          hasManejo: true,
        },
      }).map((option) => option.scope),
    ).toEqual(["animal", "animais", "lote", "local", "evento", "fazenda"]);

    expect(
      getAvailableBiosecurityLinkScopes({
        selectedOccurrenceTypes: ["falha_epi", "animal_suspeito_sem_isolamento"],
        category: "suspeita_doenca_notificavel",
        contextAvailability: {
          hasAnimal: true,
          hasMultipleAnimals: true,
          hasLote: true,
          hasLocal: true,
          hasManejo: true,
        },
      }).map((option) => option.scope),
    ).toEqual(["animal", "animais", "lote", "local", "evento", "fazenda"]);
  });

  it("suppresses unavailable link scopes", () => {
    expect(
      getAvailableBiosecurityLinkScopes({
        selectedOccurrenceTypes: ["transporte_com_risco_sanitario"],
        contextAvailability: {
          hasAnimal: true,
          hasMultipleAnimals: false,
          hasLote: true,
          hasLocal: false,
          hasManejo: false,
        },
      }).map((option) => option.scope),
    ).toEqual(["animal", "lote"]);
  });

  it("maps routine biosecurity occurrence to a compliance event without agenda", () => {
    const eventInput = buildBiosecurityOccurrenceEventInput({
      fazendaId: "farm-1",
      occurredAt: "2026-05-30T12:00:00.000Z",
      occurrence: baseOccurrence,
    });

    expect(eventInput).toMatchObject({
      dominio: "conformidade",
      complianceKind: "checklist",
      animalId: null,
      loteId: null,
      sourceTaskId: null,
      payload: {
        biosseguranca_ocorrencia: {
          tipo_ocorrencia: "visitante_sem_orientacao",
          tipos_ocorrencia: ["visitante_sem_orientacao"],
          categoria_ocorrencia: "biosseguranca",
          escopo_tipo: "fazenda",
          gera_pendencia: false,
          prazo_correcao: null,
          status: "aberta",
        },
      },
    });
  });

  it("requires animal or lote for notifiable suspicion", () => {
    expect(
      validateBiosecurityOccurrenceDraft({
        ...baseOccurrence,
        categoria_ocorrencia: "suspeita_doenca_notificavel",
      }),
    ).toBe("Suspeita notificável exige vínculo com animal ou lote.");
  });

  it("does not accept only farm scope for notifiable suspicion", () => {
    expect(
      validateBiosecurityOccurrenceDraft({
        ...baseOccurrence,
        categoria_ocorrencia: "suspeita_doenca_notificavel",
        escopo_tipo: "fazenda",
        escopos_tipo: ["fazenda"],
      }),
    ).toBe("Suspeita notificável exige vínculo com animal ou lote.");
  });

  it("opens existing notifiable alert/case path when suspicion is linked to an animal", () => {
    const eventInput = buildBiosecurityOccurrenceEventInput({
      fazendaId: "farm-1",
      occurredAt: "2026-05-30T12:00:00.000Z",
      occurrence: {
        ...baseOccurrence,
        categoria_ocorrencia: "suspeita_doenca_notificavel",
        escopo_tipo: "animal",
        animal_id: "animal-1",
        gravidade: "alta",
      },
    });

    expect(eventInput).toMatchObject({
      dominio: "alerta_sanitario",
      animalId: "animal-1",
      alertKind: "suspeita_aberta",
      sanitarioCaso: {
        action: "open",
        tipo: "notificavel",
        movementBlocked: true,
      },
      animalPayload: {
        sanidade_alerta: {
          status: "suspeita_aberta",
          movement_blocked: true,
        },
      },
    });
  });

  it("keeps lote-linked notifiable suspicion as event occurrence without loose farm task", () => {
    const eventInput = buildBiosecurityOccurrenceEventInput({
      fazendaId: "farm-1",
      occurredAt: "2026-05-30T12:00:00.000Z",
      occurrence: {
        ...baseOccurrence,
        categoria_ocorrencia: "suspeita_doenca_notificavel",
        escopo_tipo: "lote",
        lote_id: "lote-1",
        gera_pendencia: false,
      },
    });

    expect(eventInput).toMatchObject({
      dominio: "alerta_sanitario",
      animalId: null,
      loteId: "lote-1",
      sourceTaskId: null,
      sanitarioCaso: undefined,
    });
  });

  it("persists multiple occurrence kinds and primary animal for multiple targets", () => {
    const eventInput = buildBiosecurityOccurrenceEventInput({
      fazendaId: "farm-1",
      occurredAt: "2026-05-30T12:00:00.000Z",
      occurrence: {
        ...baseOccurrence,
        tipo_ocorrencia: "falha_epi",
        tipos_ocorrencia: ["falha_epi", "descarte_inadequado"],
        escopo_tipo: "animais",
        animal_id: "animal-1",
        animal_ids: ["animal-1", "animal-2"],
      },
    });

    expect(eventInput).toMatchObject({
      animalId: "animal-1",
      payload: {
        biosseguranca_ocorrencia: {
          tipo_ocorrencia: "falha_epi",
          tipos_ocorrencia: ["falha_epi", "descarte_inadequado"],
          animal_id: "animal-1",
          animal_ids: ["animal-1", "animal-2"],
        },
      },
    });
  });

  it("requires relato when outro is selected", () => {
    expect(
      validateBiosecurityOccurrenceDraft({
        ...baseOccurrence,
        tipo_ocorrencia: "outro",
        tipos_ocorrencia: ["outro"],
        descricao: "",
        outro_relato: "",
      }),
    ).toBe("Relate o que aconteceu quando selecionar outro.");
  });

  it("does not create agenda when gera_pendencia is false", () => {
    const eventInput = buildBiosecurityOccurrenceEventInput({
      fazendaId: "farm-1",
      occurredAt: "2026-05-30T12:00:00.000Z",
      occurrence: baseOccurrence,
    });

    const gesture = buildEventGesture(eventInput);

    expect(gesture.ops.map((op) => op.table)).toEqual(["eventos"]);
  });

  it("creates specific agenda linked to the occurrence when gera_pendencia is true", () => {
    const eventInput = buildBiosecurityOccurrenceEventInput({
      fazendaId: "farm-1",
      occurredAt: "2026-05-30T12:00:00.000Z",
      occurrence: {
        ...baseOccurrence,
        escopo_tipo: "animal",
        escopos_tipo: ["animal", "lote"],
        animal_id: "animal-1",
        animal_ids: ["animal-1", "animal-2"],
        lote_id: "lote-1",
        local_id: "local-1",
        evento_id: "manejo-1",
        gera_pendencia: true,
        prazo_correcao: "2026-06-02",
      },
    });

    const gesture = buildEventGesture(eventInput);
    const eventOp = gesture.ops.find((op) => op.table === "eventos");
    const agendaOp = gesture.ops.find((op) => op.table === "agenda_itens");

    expect(agendaOp).toBeDefined();
    expect(agendaOp?.record).toMatchObject({
      dominio: "conformidade",
      tipo: "biosseguranca_acao_corretiva",
      status: "agendado",
      data_prevista: "2026-06-02",
      animal_id: "animal-1",
      lote_id: "lote-1",
      source_evento_id: eventOp?.record.id,
      payload: {
        occurrence_evento_id: eventOp?.record.id,
        animal_ids: ["animal-1", "animal-2"],
        local_id: "local-1",
        evento_id: "manejo-1",
        escopos_tipo: ["animal", "lote"],
      },
    });
  });

  it("creates notification agenda only for real notifiable occurrence with pending action", () => {
    const eventInput = buildBiosecurityOccurrenceEventInput({
      fazendaId: "farm-1",
      occurredAt: "2026-05-30T12:00:00.000Z",
      occurrence: {
        ...baseOccurrence,
        categoria_ocorrencia: "suspeita_doenca_notificavel",
        escopo_tipo: "lote",
        lote_id: "lote-1",
        gravidade: "alta",
        gera_pendencia: true,
        prazo_correcao: "2026-05-31",
      },
    });

    const gesture = buildEventGesture(eventInput);
    const agendaOp = gesture.ops.find((op) => op.table === "agenda_itens");

    expect(agendaOp?.record).toMatchObject({
      dominio: "alerta_sanitario",
      tipo: "sanitario_notificacao_pendente",
      lote_id: "lote-1",
      payload: {
        requires_notification: true,
      },
    });
  });

  it("derives signals from real occurrence events and linked agenda only", () => {
    const eventInput = buildBiosecurityOccurrenceEventInput({
      fazendaId: "farm-1",
      occurredAt: "2026-05-30T12:00:00.000Z",
      occurrence: {
        ...baseOccurrence,
        categoria_ocorrencia: "suspeita_doenca_notificavel",
        escopo_tipo: "animal",
        animal_id: "animal-1",
        gravidade: "alta",
        gera_pendencia: true,
        prazo_correcao: "2026-05-31",
      },
    });
    const gesture = buildEventGesture(eventInput);
    const eventRecord = gesture.ops.find((op) => op.table === "eventos")?.record;
    const agendaRecord = gesture.ops.find((op) => op.table === "agenda_itens")?.record;

    const signals = buildBiosecurityOccurrenceSignals({
      eventos: [eventRecord],
      agenda: [agendaRecord],
    });

    expect(signals.map((signal) => signal.code)).toEqual([
      "biosseguranca:ocorrencia_aberta",
      "biosseguranca:ocorrencia_com_pendencia",
      "biosseguranca:alta_gravidade",
      "sanitario:suspeita_notificavel",
      "sanitario:notificacao_pendente",
    ]);
    expect(signals.every((signal) => signal.source === "eventos.payload.biosseguranca_ocorrencia")).toBe(true);
  });

  it("summarizes occurrences by type, severity and scope for reports", () => {
    const eventInput = buildBiosecurityOccurrenceEventInput({
      fazendaId: "farm-1",
      occurredAt: "2026-05-30T12:00:00.000Z",
      occurrence: {
        ...baseOccurrence,
        tipos_ocorrencia: ["falha_epi", "descarte_inadequado"],
        tipo_ocorrencia: "falha_epi",
        escopo_tipo: "animal",
        escopos_tipo: ["animal", "lote"],
        animal_id: "animal-1",
        lote_id: "lote-1",
        gravidade: "moderada",
      },
    });
    const gesture = buildEventGesture(eventInput);
    const eventRecord = gesture.ops.find((op) => op.table === "eventos")?.record;

    const summary = summarizeBiosecurityOccurrences({
      eventos: [eventRecord],
      agenda: [],
      from: "2026-05-01",
      to: "2026-05-31",
    });

    expect(summary).toMatchObject({
      total: 1,
      openCount: 1,
      pendingCount: 0,
      byTipoOcorrencia: [
        { key: "descarte_inadequado", count: 1 },
        { key: "falha_epi", count: 1 },
      ],
      byGravidade: [{ key: "moderada", count: 1 }],
      byEscopo: [
        { key: "animal", count: 1 },
        { key: "lote", count: 1 },
      ],
    });
  });

  it("considera resolucao append-only vinculada sem editar a ocorrencia original", () => {
    const eventInput = buildBiosecurityOccurrenceEventInput({
      fazendaId: "farm-1",
      occurredAt: "2026-05-30T12:00:00.000Z",
      occurrence: {
        ...baseOccurrence,
        status: "aberta",
      },
    });
    const gesture = buildEventGesture(eventInput);
    const eventRecord = gesture.ops.find((op) => op.table === "eventos")?.record;
    const resolutionRecord = {
      id: "resolution-1",
      dominio: "conformidade",
      occurred_at: "2026-06-01T12:00:00.000Z",
      animal_id: "animal-1",
      lote_id: null,
      source_task_id: null,
      corrige_evento_id: eventRecord.id,
      payload: {
        sanitary_correction: {
          schema_version: 1,
          evento_origem_id: eventRecord.id,
          corrige_evento_id: eventRecord.id,
          tipo_correcao: "resolucao_ocorrencia_biosseguranca",
          motivo: "Resolvida.",
          payload_correcao: {
            status: "resolvida",
            resolvida_em: "2026-06-01T12:00:00.000Z",
          },
          created_by: "user-1",
          created_at: "2026-06-01T12:00:00.000Z",
        },
      },
    };

    const summary = summarizeBiosecurityOccurrences({
      eventos: [eventRecord, resolutionRecord],
      agenda: [],
    });

    expect(summary.byStatus).toEqual([{ key: "resolvida", count: 1 }]);
    expect(summary.openCount).toBe(0);
  });
});
