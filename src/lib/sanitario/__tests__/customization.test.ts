import { describe, expect, it } from "vitest";

import type {
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";
import {
  buildProtocolInsertRecord,
  buildProtocolItemInsertRecord,
  buildProtocolItemUpdateRecord,
  buildProtocolUpdateRecord,
  createEmptyProtocolDraft,
  createEmptyProtocolItemDraft,
  readProtocolDraft,
  readProtocolItemDraft,
  validateProtocolDraft,
  validateProtocolItemDraft,
} from "@/lib/sanitario/customization";

const baseProtocol: ProtocoloSanitario = {
  id: "protocol-1",
  fazenda_id: "farm-1",
  nome: "Calendario oficial",
  descricao: "Protocolo padrao",
  ativo: true,
  payload: {
    origem: "template_padrao",
    reference: "MAPA",
    sexo_alvo: "F",
    idade_min_dias: 90,
    idade_max_dias: 240,
    obrigatorio: true,
    requires_vet: true,
    valido_de: "2026-05-01",
  },
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: "2026-04-09T08:00:00.000Z",
  server_received_at: "2026-04-09T08:00:00.000Z",
  created_at: "2026-04-09T08:00:00.000Z",
  updated_at: "2026-04-09T08:00:00.000Z",
  deleted_at: null,
};

const baseItem: ProtocoloSanitarioItem = {
  id: "item-1",
  fazenda_id: "farm-1",
  protocolo_id: "protocol-1",
  protocol_item_id: "rule-1",
  version: 1,
  tipo: "vacinacao",
  produto: "Vacina Aftosa",
  intervalo_dias: 180,
  dose_num: 1,
  gera_agenda: true,
  dedup_template: "vacina:aftosa:{ano}",
  payload: {
    indicacao: "Aplicar em bezerras",
    produto_veterinario_id: "prod-1",
    produto_nome_catalogo: "Vacina Aftosa",
    sexo_alvo: "F",
    item_code: "dose-1",
  },
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: "2026-04-09T08:00:00.000Z",
  server_received_at: "2026-04-09T08:00:00.000Z",
  created_at: "2026-04-09T08:00:00.000Z",
  updated_at: "2026-04-09T08:00:00.000Z",
  deleted_at: null,
};

describe("sanitary customization drafts", () => {
  it("reads protocol and item drafts from payload", () => {
    expect(readProtocolDraft(baseProtocol)).toMatchObject({
      nome: "Calendario oficial",
      familyCode: "calendario_oficial",
      regimenVersion: "1",
      sexoAlvo: "F",
      idadeMinDias: "90",
      idadeMaxDias: "240",
      obrigatorio: true,
      requiresVet: true,
      validoDe: "2026-05-01",
    });

    expect(readProtocolItemDraft(baseItem)).toMatchObject({
      tipo: "vacinacao",
      produto: "Vacina Aftosa",
      intervaloDias: "180",
      indicacao: "Aplicar em bezerras",
      sexoAlvo: "F",
      itemCode: "dose-1",
    });
  });

  it("builds update records preserving unrelated payload metadata", () => {
    const protocolDraft = readProtocolDraft(baseProtocol);
    const protocolRecord = buildProtocolUpdateRecord(baseProtocol, {
      ...protocolDraft,
      nome: "Calendario customizado",
      idadeMinDias: "",
      idadeMaxDias: "",
      obrigatorioPorRisco: true,
      requiresComplianceDocument: true,
      validoAte: "2026-12-31",
    });

    expect(protocolRecord).toMatchObject({
      nome: "Calendario customizado",
      descricao: "Protocolo padrao",
      ativo: true,
    });
    expect(protocolRecord.payload).toMatchObject({
      family_code: "calendario_oficial",
      regimen_version: 1,
      canonical_key: "calendario_oficial",
      origem: "template_padrao",
      reference: "MAPA",
      obrigatorio: true,
      obrigatorio_por_risco: true,
      requires_vet: true,
      requires_compliance_document: true,
      valido_de: "2026-05-01",
      valido_ate: "2026-12-31",
    });
    expect(protocolRecord.payload.idade_min_dias).toBeUndefined();

    const itemDraft = readProtocolItemDraft(baseItem);
    const itemRecord = buildProtocolItemUpdateRecord(
      baseItem,
      {
        ...itemDraft,
        produto: "Reforco Aftosa",
        intervaloDias: "0",
        doseNum: "2",
        dependsOnItemCode: "dose-1",
      },
      {
        produto_veterinario_id: "prod-2",
      },
      {
        protocolPayload: protocolRecord.payload,
      },
    );

    expect(itemRecord).toMatchObject({
      produto: "Reforco Aftosa",
      intervalo_dias: 1,
      dose_num: 2,
      gera_agenda: true,
      dedup_template: "vacina:aftosa:{ano}",
    });
    expect(itemRecord.payload).toMatchObject({
      indicacao: "Aplicar em bezerras",
      produto_veterinario_id: "prod-2",
      family_code: "calendario_oficial",
      regimen_version: 1,
      sexo_alvo: "F",
      item_code: "dose-1",
      depends_on_item_code: "dose-1",
      regime_sanitario: {
        family_code: "calendario_oficial",
        milestone_code: "dose_1",
      },
    });
  });

  it("preserves structured calendar-base metadata when editing a farm protocol item", () => {
    const itemWithCalendar: ProtocoloSanitarioItem = {
      ...baseItem,
      payload: {
        ...baseItem.payload,
        calendario_base: {
          version: 1,
          mode: "age_window",
          anchor: "birth",
          label: "Dose unica entre 90 e 240 dias",
          age_start_days: 90,
          age_end_days: 240,
        },
      },
    };

    const itemRecord = buildProtocolItemUpdateRecord(
      itemWithCalendar,
      {
        ...readProtocolItemDraft(itemWithCalendar),
        produto: "Vacina Brucelose B19",
        observacoes: "Aplicacao obrigatoria com controle oficial.",
      },
      {
        produto_veterinario_id: "prod-9",
      },
      {
        protocolPayload: {
          family_code: "brucelose",
          regimen_version: 1,
        },
      },
    );

    expect(itemRecord.payload).toMatchObject({
      produto_veterinario_id: "prod-9",
      family_code: "brucelose",
      calendario_base: {
        version: 1,
        mode: "age_window",
        anchor: "birth",
        label: "Dose unica entre 90 e 240 dias",
        age_start_days: 90,
        age_end_days: 240,
      },
      observacoes: "Aplicacao obrigatoria com controle oficial.",
      regime_sanitario: {
        family_code: "brucelose",
        milestone_code: "dose_1",
      },
    });
  });

  it("creates empty drafts and insert records", () => {
    expect(createEmptyProtocolDraft()).toMatchObject({
      nome: "",
      ativo: true,
      familyCode: "",
      regimenVersion: "1",
      obrigatorio: false,
    });

    expect(createEmptyProtocolItemDraft()).toMatchObject({
      tipo: "vacinacao",
      intervaloDias: "1",
      doseNum: "1",
      geraAgenda: true,
    });

    expect(
      buildProtocolInsertRecord(
        "protocol-new",
        createEmptyProtocolDraft({
          nome: "Calendario regional",
          sexoAlvo: "todos",
          obrigatorioPorRisco: true,
        }),
      ),
    ).toMatchObject({
      id: "protocol-new",
      nome: "Calendario regional",
      ativo: true,
      payload: {
        origem: "customizado_fazenda",
        source_origin: "fazenda_customizada",
        family_code: "calendario_regional",
        regimen_version: 1,
        canonical_key: "calendario_regional",
        sexo_alvo: "todos",
        obrigatorio: false,
        obrigatorio_por_risco: true,
      },
    });

    expect(
      buildProtocolItemInsertRecord({
        itemId: "item-new",
        protocoloId: "protocol-new",
        protocolItemId: "rule-new",
        draft: createEmptyProtocolItemDraft({
          produto: "Vacina Regional",
          intervaloDias: "0",
          doseNum: "",
          calendarMode: "campaign",
          calendarAnchor: "calendar_month",
          calendarLabel: "Campanha regional",
          calendarMonths: "4, 10",
        }),
        extraPayload: {
          produto_veterinario_id: "prod-new",
        },
        protocolPayload: {
          family_code: "calendario_regional",
          regimen_version: 1,
        },
      }),
    ).toMatchObject({
      id: "item-new",
      protocolo_id: "protocol-new",
      protocol_item_id: "rule-new",
      version: 1,
      produto: "Vacina Regional",
      intervalo_dias: 1,
      dose_num: null,
      dedup_template: "sanitario:calendario_regional:{animal_id}:milestone:dose_1",
      payload: {
        produto_veterinario_id: "prod-new",
        family_code: "calendario_regional",
        regimen_version: 1,
        calendario_base: {
          mode: "campaign",
          anchor: "calendar_month",
          label: "Campanha regional",
          months: [4, 10],
          interval_days: 1,
        },
        regime_sanitario: {
          family_code: "calendario_regional",
          milestone_code: "dose_1",
        },
      },
    });
  });

  it("validates protocol and item drafts", () => {
    expect(
      validateProtocolDraft({
        ...readProtocolDraft(baseProtocol),
        nome: "",
      }),
    ).toBe("Nome do protocolo e obrigatorio.");

    expect(
      validateProtocolItemDraft({
        ...readProtocolItemDraft(baseItem),
        produto: "",
      }),
    ).toBe("Produto da etapa e obrigatorio.");

    expect(
      validateProtocolItemDraft({
        ...readProtocolItemDraft(baseItem),
        itemCode: "",
        dependsOnItemCode: "dose-1",
      }),
    ).toBe("Defina um codigo da etapa antes de configurar dependencia.");

    expect(
      validateProtocolItemDraft({
        ...readProtocolItemDraft(baseItem),
        calendarMode: "campaign",
        calendarAnchor: "",
      }),
    ).toBe("Calendario-base exige modo e ancora juntos.");
  });
});
