import { describe, expect, it } from "vitest";

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
});
