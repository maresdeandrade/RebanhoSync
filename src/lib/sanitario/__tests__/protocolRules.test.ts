import { describe, expect, it } from "vitest";

import {
  evaluateSanitaryProtocolEligibility,
  formatSanitaryProtocolRestrictions,
  getAnimalAgeInDays,
  getSanitaryAgendaPriority,
} from "@/lib/sanitario/protocolRules";
import type {
  AgendaItem,
  Animal,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";

const BASE_ITEM: ProtocoloSanitarioItem = {
  id: "item-1",
  fazenda_id: "farm-1",
  protocolo_id: "proto-1",
  protocol_item_id: "piv-1",
  version: 1,
  tipo: "vacinacao",
  produto: "Vacina Teste",
  intervalo_dias: 30,
  dose_num: 1,
  gera_agenda: true,
  dedup_template: null,
  payload: {
    sexo_alvo: "F",
    idade_min_dias: 90,
    idade_max_dias: 240,
    obrigatorio: true,
  },
  client_id: "browser:1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: "2026-04-09T00:00:00.000Z",
  server_received_at: "2026-04-09T00:00:00.000Z",
  created_at: "2026-04-09T00:00:00.000Z",
  updated_at: "2026-04-09T00:00:00.000Z",
  deleted_at: null,
};

const FEMALE_CALF: Animal = {
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
  origem: null,
  raca: null,
  papel_macho: null,
  habilitado_monta: false,
  observacoes: null,
  payload: {},
  client_id: "browser:1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: "2026-04-09T00:00:00.000Z",
  server_received_at: "2026-04-09T00:00:00.000Z",
  created_at: "2026-04-09T00:00:00.000Z",
  updated_at: "2026-04-09T00:00:00.000Z",
  deleted_at: null,
};

const MALE_ANIMAL: Animal = {
  ...FEMALE_CALF,
  id: "animal-2",
  identificacao: "M-201",
  sexo: "M",
};

const BASE_PROTOCOL: ProtocoloSanitario = {
  id: "proto-1",
  fazenda_id: "farm-1",
  nome: "Protocolo Teste",
  descricao: null,
  ativo: true,
  payload: {
    obrigatorio: true,
  },
  client_id: "browser:1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: "2026-04-09T00:00:00.000Z",
  server_received_at: "2026-04-09T00:00:00.000Z",
  created_at: "2026-04-09T00:00:00.000Z",
  updated_at: "2026-04-09T00:00:00.000Z",
  deleted_at: null,
};

const BASE_AGENDA: AgendaItem = {
  id: "agenda-1",
  fazenda_id: "farm-1",
  dominio: "sanitario",
  tipo: "vacinacao",
  status: "agendado",
  data_prevista: "2026-04-09",
  animal_id: "animal-1",
  lote_id: "lote-1",
  dedup_key: null,
  source_kind: "automatico",
  source_ref: { protocolo_id: "proto-1" },
  source_client_op_id: null,
  source_tx_id: null,
  source_evento_id: null,
  protocol_item_version_id: "item-1",
  interval_days_applied: 30,
  payload: {},
  client_id: "browser:1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: "2026-04-09T00:00:00.000Z",
  server_received_at: "2026-04-09T00:00:00.000Z",
  created_at: "2026-04-09T00:00:00.000Z",
  updated_at: "2026-04-09T00:00:00.000Z",
  deleted_at: null,
};

describe("sanitary protocol rules", () => {
  it("computes animal age in days", () => {
    expect(getAnimalAgeInDays("2026-04-01", new Date("2026-04-09T12:00:00.000Z"))).toBe(
      8,
    );
  });

  it("flags ineligible animals by sex and age", () => {
    const summary = evaluateSanitaryProtocolEligibility(
      BASE_ITEM,
      [FEMALE_CALF, MALE_ANIMAL],
      BASE_PROTOCOL,
      new Date("2026-04-09T12:00:00.000Z"),
    );

    expect(summary.compatibleWithAll).toBe(false);
    expect(summary.eligibleCount).toBe(1);
    expect(summary.ineligibleCount).toBe(1);
    expect(summary.reasons[0]).toContain("M-201");
    expect(formatSanitaryProtocolRestrictions(summary.restrictions)).toContain(
      "Somente femeas",
    );
  });

  it("computes agenda priority for overdue mandatory items", () => {
    const priority = getSanitaryAgendaPriority({
      item: {
        ...BASE_AGENDA,
        data_prevista: "2026-04-01",
      },
      protocol: BASE_PROTOCOL,
      protocolItem: BASE_ITEM,
      today: new Date("2026-04-09T12:00:00.000Z"),
    });

    expect(priority.tone).toBe("danger");
    expect(priority.label).toContain("Critico");
  });

  it("computes agenda priority for upcoming routine items", () => {
    const priority = getSanitaryAgendaPriority({
      item: {
        ...BASE_AGENDA,
        data_prevista: "2026-04-11",
      },
      protocol: {
        ...BASE_PROTOCOL,
        payload: {},
      },
      protocolItem: {
        ...BASE_ITEM,
        payload: {},
      },
      today: new Date("2026-04-09T12:00:00.000Z"),
    });

    expect(priority.tone).toBe("info");
    expect(priority.label).toContain("Proximo");
  });
});
