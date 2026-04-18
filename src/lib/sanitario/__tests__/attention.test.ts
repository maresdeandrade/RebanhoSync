import { describe, expect, it } from "vitest";

import type {
  AgendaItem,
  Animal,
  Lote,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";
import { summarizeSanitaryAgendaAttention } from "@/lib/sanitario/attention";

const baseAgendaItem: AgendaItem = {
  id: "agenda-base",
  fazenda_id: "farm-1",
  dominio: "sanitario",
  tipo: "vacinacao",
  status: "agendado",
  data_prevista: "2026-04-09",
  animal_id: null,
  lote_id: null,
  dedup_key: null,
  source_kind: "automatico",
  source_ref: null,
  source_client_op_id: null,
  source_tx_id: null,
  source_evento_id: null,
  protocol_item_version_id: null,
  interval_days_applied: null,
  payload: {},
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: "2026-04-09T08:00:00.000Z",
  server_received_at: "2026-04-09T08:00:00.000Z",
  created_at: "2026-04-09T08:00:00.000Z",
  updated_at: "2026-04-09T08:00:00.000Z",
  deleted_at: null,
};

const animals: Animal[] = [
  {
    id: "animal-1",
    fazenda_id: "farm-1",
    identificacao: "BR-001",
    sexo: "F",
    status: "ativo",
    lote_id: null,
    data_nascimento: null,
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    origem: null,
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-09T08:00:00.000Z",
    server_received_at: "2026-04-09T08:00:00.000Z",
    created_at: "2026-04-09T08:00:00.000Z",
    updated_at: "2026-04-09T08:00:00.000Z",
    deleted_at: null,
  },
];

const lotes: Lote[] = [
  {
    id: "lote-1",
    fazenda_id: "farm-1",
    nome: "Matrizes",
    status: "ativo",
    pasto_id: null,
    touro_id: null,
    observacoes: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-09T08:00:00.000Z",
    server_received_at: "2026-04-09T08:00:00.000Z",
    created_at: "2026-04-09T08:00:00.000Z",
    updated_at: "2026-04-09T08:00:00.000Z",
    deleted_at: null,
  },
];

const protocols: ProtocoloSanitario[] = [
  {
    id: "protocol-1",
    fazenda_id: "farm-1",
    nome: "Calendario oficial",
    descricao: null,
    ativo: true,
    payload: {
      obrigatorio_por_risco: true,
    },
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-09T08:00:00.000Z",
    server_received_at: "2026-04-09T08:00:00.000Z",
    created_at: "2026-04-09T08:00:00.000Z",
    updated_at: "2026-04-09T08:00:00.000Z",
    deleted_at: null,
  },
];

const protocolItems: ProtocoloSanitarioItem[] = [
  {
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
    dedup_template: null,
    payload: {
      obrigatorio: true,
      requires_vet: true,
    },
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-09T08:00:00.000Z",
    server_received_at: "2026-04-09T08:00:00.000Z",
    created_at: "2026-04-09T08:00:00.000Z",
    updated_at: "2026-04-09T08:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "item-2",
    fazenda_id: "farm-1",
    protocolo_id: "protocol-1",
    protocol_item_id: "rule-2",
    version: 1,
    tipo: "vermifugacao",
    produto: "Endectocida",
    intervalo_dias: 90,
    dose_num: 1,
    gera_agenda: true,
    dedup_template: null,
    payload: {},
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: null,
    client_recorded_at: "2026-04-09T08:00:00.000Z",
    server_received_at: "2026-04-09T08:00:00.000Z",
    created_at: "2026-04-09T08:00:00.000Z",
    updated_at: "2026-04-09T08:00:00.000Z",
    deleted_at: null,
  },
];

describe("summarizeSanitaryAgendaAttention", () => {
  it("prioritizes critical sanitary items and aggregates mandatory flags", () => {
    const summary = summarizeSanitaryAgendaAttention({
      agenda: [
        {
          ...baseAgendaItem,
          id: "agenda-1",
          data_prevista: "2026-04-05",
          animal_id: "animal-1",
          source_ref: {
            protocolo_id: "protocol-1",
            produto: "Vacina Aftosa",
          },
          protocol_item_version_id: "item-1",
        },
        {
          ...baseAgendaItem,
          id: "agenda-2",
          data_prevista: "2026-04-09",
          lote_id: "lote-1",
          tipo: "vermifugacao",
          source_ref: {
            protocolo_id: "protocol-1",
          },
          protocol_item_version_id: "item-2",
        },
        {
          ...baseAgendaItem,
          id: "agenda-3",
          data_prevista: "2026-04-12",
          tipo: "medicamento",
          payload: {
            produto: "Antibiotico",
            calendario_base: {
              version: 1,
              mode: "clinical_protocol",
              anchor: "clinical_need",
              label: "Uso clinico sob avaliacao",
            },
          },
        },
        {
          ...baseAgendaItem,
          id: "agenda-4",
          dominio: "pesagem",
          tipo: "pesagem",
        },
      ],
      animals,
      lotes,
      protocols,
      protocolItems,
      limit: 2,
      today: new Date("2026-04-09T12:00:00.000Z"),
    });

    expect(summary).toMatchObject({
      totalOpen: 3,
      criticalCount: 2,
      warningCount: 0,
      overdueCount: 1,
      dueTodayCount: 1,
      mandatoryCount: 2,
      requiresVetCount: 1,
      scheduleModes: [
        {
          key: "rotina_recorrente",
          label: "Rotina recorrente",
          count: 2,
        },
        {
          key: "clinical_protocol",
          label: "Uso imediato",
          count: 1,
        },
      ],
      scheduleAnchors: [],
    });
    expect(summary.topItems).toHaveLength(2);
    expect(summary.topItems[0]).toMatchObject({
      id: "agenda-1",
      priorityLabel: "Critico 4d",
      priorityTone: "danger",
      contexto: "BR-001",
      produto: "Vacina Aftosa",
      scheduleModeLabel: "Rotina recorrente",
      scheduleAnchor: null,
    });
    expect(summary.topItems[1]).toMatchObject({
      id: "agenda-2",
      priorityLabel: "Obrigatorio hoje",
      priorityTone: "danger",
      contexto: "Matrizes",
      titulo: "Calendario oficial: Endectocida",
      scheduleModeLabel: "Rotina recorrente",
      scheduleAnchor: null,
    });
  });

  it("returns an empty summary when no sanitary item is open", () => {
    const summary = summarizeSanitaryAgendaAttention({
      agenda: [
        {
          ...baseAgendaItem,
          id: "agenda-10",
          dominio: "pesagem",
          tipo: "pesagem",
        },
      ],
      today: new Date("2026-04-09T12:00:00.000Z"),
    });

    expect(summary).toEqual({
      totalOpen: 0,
      criticalCount: 0,
      warningCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      mandatoryCount: 0,
      requiresVetCount: 0,
      scheduleModes: [],
      scheduleAnchors: [],
      topItems: [],
    });
  });
});
