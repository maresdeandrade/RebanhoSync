import { describe, expect, it } from "vitest";

import type {
  AgendaItem,
  Animal,
  FazendaSanidadeConfig,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";
import {
  buildSanitaryAgendaDiagnostics,
  buildSanitaryOperationalStatuses,
} from "@/lib/sanitario/operations/agendaDiagnostics";

const now = "2026-05-26T00:00:00.000Z";

const config: FazendaSanidadeConfig = {
  fazenda_id: "farm-1",
  uf: "SP",
  aptidao: "all",
  sistema: "all",
  zona_raiva_risco: "baixo",
  pressao_carrapato: "baixo",
  pressao_helmintos: "baixo",
  modo_calendario: "minimo_legal",
  payload: {},
  client_id: "browser:1",
  client_op_id: "op-config",
  client_tx_id: null,
  client_recorded_at: now,
  server_received_at: now,
  created_at: now,
  updated_at: now,
  deleted_at: null,
};

const animal: Animal = {
  id: "animal-1",
  fazenda_id: "farm-1",
  identificacao: "F-101",
  sexo: "F",
  status: "ativo",
  lote_id: "lote-1",
  data_nascimento: "2025-11-15",
  data_entrada: null,
  data_saida: null,
  pai_id: null,
  mae_id: null,
  nome: null,
  rfid: null,
  especie: "bovino",
  origem: null,
  raca: null,
  papel_macho: null,
  habilitado_monta: false,
  observacoes: null,
  payload: {},
  client_id: "browser:1",
  client_op_id: "op-animal",
  client_tx_id: null,
  client_recorded_at: now,
  server_received_at: now,
  created_at: now,
  updated_at: now,
  deleted_at: null,
};

const protocol: ProtocoloSanitario = {
  id: "proto-1",
  fazenda_id: "farm-1",
  nome: "Raiva",
  descricao: null,
  ativo: true,
  payload: { source_origin: "official" },
  client_id: "browser:1",
  client_op_id: "op-proto",
  client_tx_id: null,
  client_recorded_at: now,
  server_received_at: now,
  created_at: now,
  updated_at: now,
  deleted_at: null,
};

const item: ProtocoloSanitarioItem = {
  id: "item-1",
  fazenda_id: "farm-1",
  protocolo_id: "proto-1",
  logical_item_key: "logical-item-1",
  item_code: "raiva_d1",
  version: 1,
  tipo: "vacinacao",
  produto: "Vacina antirrábica",
  intervalo_dias: 365,
  dose_num: 1,
  gera_agenda: true,
  dedup_template: null,
  payload: {
    family_code: "raiva_herbivoros",
    sexo_alvo: "M",
    idade_min_dias: 10,
    calendario_base: {
      mode: "campaign",
      months: [4],
    },
  },
  client_id: "browser:1",
  client_op_id: "op-item",
  client_tx_id: null,
  client_recorded_at: now,
  server_received_at: now,
  created_at: now,
  updated_at: now,
  deleted_at: null,
};

const completedAgenda: AgendaItem = {
  id: "agenda-1",
  fazenda_id: "farm-1",
  dominio: "sanitario",
  tipo: "vacinacao",
  status: "concluido",
  data_prevista: "2026-04-10",
  animal_id: "animal-1",
  lote_id: null,
  pasto_id: null,
  source_kind: "automatico",
  source_ref: null,
  dedup_key: "sanitario:farm:farm-1:raiva_herbivoros:item:v1:campaign:2026-04",
  protocol_item_version_id: "item-1",
  payload: {},
  completed_evento_id: "event-1",
  completed_at: "2026-04-10T00:00:00.000Z",
  cancel_reason: null,
  client_id: "browser:1",
  client_op_id: "op-agenda",
  client_tx_id: null,
  client_recorded_at: now,
  server_received_at: now,
  created_at: now,
  updated_at: now,
  deleted_at: null,
};

describe("sanitary agenda diagnostics", () => {
  it("explains likely agenda absence with reason codes", () => {
    const diagnostics = buildSanitaryAgendaDiagnostics({
      config,
      protocols: [protocol],
      protocolItems: [item],
      animals: [animal],
      agendaItems: [completedAgenda],
      today: new Date("2026-05-26T00:00:00.000Z"),
    });

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "animal_ineligible_sex",
        "risk_not_enabled",
        "outside_campaign_window",
        "already_completed",
      ]),
    );
  });

  it("summarizes operational protocol statuses", () => {
    const statuses = buildSanitaryOperationalStatuses({
      protocol,
      items: [item],
      diagnostics: [
        {
          code: "risk_not_enabled",
          title: "Risco",
          action: "Ajuste risco",
          count: 1,
          tone: "warning",
        },
      ],
    });

    expect(statuses.map((status) => status.code)).toEqual(
      expect.arrayContaining([
        "official_active",
        "operational_available",
        "materialized",
        "active",
        "generates_agenda",
        "blocked_by_configuration",
      ]),
    );
  });
});
