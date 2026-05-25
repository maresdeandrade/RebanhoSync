import { describe, expect, it } from "vitest";

import {
  buildClinicalProtocolEventPayload,
  buildClinicalProtocolSupport,
  buildClinicalProtocolTimelineSummary,
  CLINICAL_PROTOCOL_LIBRARY_GOVERNANCE,
  readClinicalProtocolEventPayload,
  validateClinicalProtocolLibraryGovernance,
} from "@/lib/sanitario/compliance/clinicalProtocols";
import type { Evento, SanitarioCaso } from "@/lib/offline/types";
import { STANDARD_PROTOCOLS } from "@/lib/sanitario/catalog/baseProtocols";

const baseCase: SanitarioCaso = {
  id: "caso-1",
  fazenda_id: "fazenda-1",
  animal_id: "animal-1",
  tipo: "clinico",
  status: "aberto",
  opened_at: "2026-01-10T10:00:00.000Z",
  closed_at: null,
  disease_code: null,
  disease_name: null,
  notification_type: null,
  requires_immediate_notification: false,
  movement_blocked: false,
  source_alert_evento_id: null,
  closure_reason: null,
  observacoes: null,
  payload: {},
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: "2026-01-10T10:00:00.000Z",
  server_received_at: "2026-01-10T10:00:00.000Z",
  created_at: "2026-01-10T10:00:00.000Z",
  updated_at: "2026-01-10T10:00:00.000Z",
  deleted_at: null,
};

describe("clinical protocol support", () => {
  it("documents the clinical library governance boundaries", () => {
    expect(CLINICAL_PROTOCOL_LIBRARY_GOVERNANCE).toMatchObject({
      capabilityId: "sanitario.historico",
      scope: "clinical_support_read_model",
      prohibitedEffects: expect.arrayContaining([
        "Nao materializa agenda.",
        "Nao cria evento sem acao explicita do usuario.",
        "Nao prescreve tratamento automaticamente.",
        "Nao baixa estoque ou movimenta insumo.",
      ]),
      requiredItemRules: expect.arrayContaining([
        "Todo item clinico deve manter gera_agenda=false.",
        "Todo item clinico deve usar calendario_base.mode=clinical_protocol.",
      ]),
    });
  });

  it("keeps every supported clinical protocol read-only and animal-scoped", () => {
    expect(validateClinicalProtocolLibraryGovernance()).toEqual([]);
  });

  it("reports governance violations when a clinical protocol starts generating agenda", () => {
    const protocol = STANDARD_PROTOCOLS.find((entry) => entry.id === "med-tpb");
    expect(protocol).toBeDefined();

    const violations = validateClinicalProtocolLibraryGovernance([
      {
        ...protocol!,
        itens: [
          {
            ...protocol!.itens[0],
            gera_agenda: true,
          },
        ],
      },
    ]);

    expect(violations).toContain("med-tpb/tpb-diminazeno: nao pode gerar agenda");
  });

  it("suggests TPB support from linked clinical event context", () => {
    const support = buildClinicalProtocolSupport({
      caseRecord: baseCase,
      events: [
        {
          observacoes: "Suspeita de tristeza parasitaria bovina",
          payload: { sinais: ["febre", "carrapato"] },
        } satisfies Pick<Evento, "observacoes" | "payload">,
      ],
    });

    expect(support).toMatchObject({
      protocolId: "med-tpb",
      title: "Terapia de Tristeza Parasitaria Bovina (TPB)",
      matchSource: "context",
      sourceLabel: "Contexto",
      safetyNotes: expect.arrayContaining([
        "Apoio clinico informativo; nao gera agenda, evento ou baixa de estoque.",
      ]),
    });
    expect(support?.guidanceItems.map((item) => item.label)).toContain(
      "Diminazeno (Ganaseg/Outros)",
    );
  });

  it("prefers explicit protocol selected in the clinical case payload", () => {
    const support = buildClinicalProtocolSupport({
      caseRecord: {
        ...baseCase,
        payload: {
          clinical_protocol_id: "med-mastite-seca",
        },
        observacoes: "Animal tratado anteriormente por TPB",
      },
    });

    expect(support).toMatchObject({
      protocolId: "med-mastite-seca",
      title: "Terapia de Vaca Seca (Mastite)",
      matchSource: "explicit",
      sourceLabel: "Selecionado",
    });
    expect(support?.guidanceItems.map((item) => item.label)).toContain(
      "Antibiotico Intramamario (Vaca Seca)",
    );
  });

  it("accepts structured condition codes as explicit protocol override", () => {
    const support = buildClinicalProtocolSupport({
      caseRecord: {
        ...baseCase,
        disease_code: "secagem_lactacao",
      },
    });

    expect(support).toMatchObject({
      protocolId: "med-mastite-seca",
      matchSource: "explicit",
    });
  });

  it("suggests neonatal diarrhea support from clinical context", () => {
    const support = buildClinicalProtocolSupport({
      caseRecord: {
        ...baseCase,
        observacoes: "Bezerro com diarreia neonatal e sinais de desidratacao.",
      },
    });

    expect(support).toMatchObject({
      protocolId: "med-diarreia-neonatal",
      title: "Suporte Clinico para Diarreia Neonatal",
      matchSource: "context",
    });
    expect(support?.guidanceItems.map((item) => item.label)).toContain(
      "Soro Oral / Reidratacao Eletrolitica",
    );
  });

  it("suggests respiratory support from clinical context", () => {
    const support = buildClinicalProtocolSupport({
      caseRecord: {
        ...baseCase,
        disease_name: "Suspeita respiratoria",
        observacoes: "Animal com tosse, secrecao nasal e possivel pneumonia.",
      },
    });

    expect(support).toMatchObject({
      protocolId: "med-respiratorio-pneumonia",
      title: "Suporte Clinico Respiratorio / Pneumonia",
      matchSource: "context",
    });
    expect(support?.guidanceItems.map((item) => item.label)).toContain(
      "Antibiotico Respiratorio conforme avaliacao",
    );
  });

  it("suggests wound and miiase support from clinical context", () => {
    const support = buildClinicalProtocolSupport({
      caseRecord: {
        ...baseCase,
        disease_code: "ferida_miiase",
      },
    });

    expect(support).toMatchObject({
      protocolId: "med-ferida-miiase",
      title: "Manejo Clinico de Feridas / Miiase",
      matchSource: "explicit",
    });
    expect(support?.guidanceItems.map((item) => item.label)).toContain(
      "Limpeza / Antisseptico / Curativo local",
    );
  });

  it("accepts explicit protocol selected in linked event payload", () => {
    const support = buildClinicalProtocolSupport({
      caseRecord: {
        ...baseCase,
        observacoes: "Caso clinico em acompanhamento",
      },
      events: [
        {
          observacoes: null,
          payload: {
            protocolo_clinico_id: "med-mastite-seca",
          },
        } satisfies Pick<Evento, "observacoes" | "payload">,
      ],
    });

    expect(support).toMatchObject({
      protocolId: "med-mastite-seca",
      matchSource: "explicit",
      sourceLabel: "Selecionado",
    });
  });

  it("builds and reads the public clinical protocol event payload", () => {
    const payload = buildClinicalProtocolEventPayload({
      protocolId: "med-tpb",
      itemId: "tpb-diminazeno",
    });

    expect(payload).toEqual({
      clinical_protocol: {
        schema_version: 1,
        protocol_id: "med-tpb",
        item_id: "tpb-diminazeno",
        source: "registrar_query_prefill",
      },
    });
    expect(readClinicalProtocolEventPayload(payload)).toEqual({
      schema_version: 1,
      protocol_id: "med-tpb",
      item_id: "tpb-diminazeno",
      source: "registrar_query_prefill",
    });
  });

  it("uses canonical clinical protocol payload as explicit support source", () => {
    const support = buildClinicalProtocolSupport({
      caseRecord: baseCase,
      events: [
        {
          observacoes: "Texto sem hipotese clinica nomeada",
          payload: buildClinicalProtocolEventPayload({
            protocolId: "med-mastite-seca",
            itemId: "secagem-intramamario",
          }),
        } satisfies Pick<Evento, "observacoes" | "payload">,
      ],
    });

    expect(support).toMatchObject({
      protocolId: "med-mastite-seca",
      matchSource: "explicit",
    });
  });

  it("builds a read-only timeline summary from canonical clinical protocol payload", () => {
    expect(
      buildClinicalProtocolTimelineSummary(
        buildClinicalProtocolEventPayload({
          protocolId: "med-tpb",
          itemId: "tpb-diminazeno",
        }),
      ),
    ).toEqual({
      protocolId: "med-tpb",
      protocolTitle: "Terapia de Tristeza Parasitaria Bovina (TPB)",
      itemId: "tpb-diminazeno",
      itemLabel: "Diminazeno (Ganaseg/Outros)",
    });
  });

  it("reads neonatal diarrhea timeline summary from canonical clinical payload", () => {
    expect(
      buildClinicalProtocolTimelineSummary(
        buildClinicalProtocolEventPayload({
          protocolId: "med-diarreia-neonatal",
          itemId: "diarreia-neonatal-reidratacao",
        }),
      ),
    ).toEqual({
      protocolId: "med-diarreia-neonatal",
      protocolTitle: "Suporte Clinico para Diarreia Neonatal",
      itemId: "diarreia-neonatal-reidratacao",
      itemLabel: "Soro Oral / Reidratacao Eletrolitica",
    });
  });

  it("reads respiratory and wound timeline summaries from canonical clinical payload", () => {
    expect(
      buildClinicalProtocolTimelineSummary(
        buildClinicalProtocolEventPayload({
          protocolId: "med-respiratorio-pneumonia",
          itemId: "respiratorio-antibiotico",
        }),
      ),
    ).toMatchObject({
      protocolId: "med-respiratorio-pneumonia",
      protocolTitle: "Suporte Clinico Respiratorio / Pneumonia",
      itemLabel: "Antibiotico Respiratorio conforme avaliacao",
    });

    expect(
      buildClinicalProtocolTimelineSummary(
        buildClinicalProtocolEventPayload({
          protocolId: "med-ferida-miiase",
          itemId: "ferida-larvicida-repelente",
        }),
      ),
    ).toMatchObject({
      protocolId: "med-ferida-miiase",
      protocolTitle: "Manejo Clinico de Feridas / Miiase",
      itemLabel: "Larvicida / Repelente para miiase",
    });
  });

  it("keeps notification cases outside clinical protocol support", () => {
    expect(
      buildClinicalProtocolSupport({
        caseRecord: {
          ...baseCase,
          tipo: "notificavel",
          disease_name: "Tristeza parasitaria bovina",
        },
      }),
    ).toBeNull();
  });

  it("does not suggest support without a recognized clinical context", () => {
    expect(
      buildClinicalProtocolSupport({
        caseRecord: {
          ...baseCase,
          observacoes: "Animal em observacao sem hipotese clinica definida",
        },
      }),
    ).toBeNull();
  });
});
