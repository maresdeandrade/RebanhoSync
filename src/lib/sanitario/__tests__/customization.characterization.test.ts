import { describe, expect, it } from "vitest";
import type { ProtocoloSanitarioItem } from "@/lib/offline/types";
import {
  buildProtocolItemUpdateRecord,
  buildProtocolUpdateRecord,
  createEmptyProtocolItemDraft,
  checkSanitaryProtocolDeletionSafety,
} from "@/lib/sanitario/customization/customization";

const buildItem = (
  id: string,
  payload: Record<string, unknown>,
  overrides?: Partial<ProtocoloSanitarioItem>,
): ProtocoloSanitarioItem => ({
  id,
  protocolo_id: "protocol-1",
  protocol_item_id: "proto-item-uuid-123",
  version: 1,
  tipo: "vacinacao",
  produto: "Vacina A",
  intervalo_dias: 30,
  dose_num: 1,
  gera_agenda: true,
  dedup_template: null,
  payload,
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: "2026-04-12T12:00:00.000Z",
  server_received_at: "2026-04-12T12:00:00.000Z",
  created_at: "2026-04-12T12:00:00.000Z",
  updated_at: "2026-04-12T12:00:00.000Z",
  deleted_at: null,
  ...overrides,
});

describe("Caracterizacao - Risco D: Edicao de Item de Protocolo sem Versionamento", () => {
  it("CONFIRMADO: buildProtocolItemUpdateRecord mantem a mesma versao e o mesmo ID (sobrescreve sem incrementar versao)", () => {
    const originalItem = buildItem("item-1", {
      family_code: "brucelose",
      regimen_version: 1,
    }, {
      version: 1,
      protocol_item_id: "proto-item-uuid-123",
    });

    const draft = createEmptyProtocolItemDraft({
      tipo: "vermifugacao", // Mudanca de tipo
      produto: "Vermifugo Super", // Mudanca de produto
      intervaloDias: "60", // Mudanca de intervalo
      doseNum: "2", // Mudanca de dose
      geraAgenda: false, // Mudanca de flag
    });

    const updateRecord = buildProtocolItemUpdateRecord(originalItem, draft, {}, {
      protocolPayload: { family_code: "brucelose", regimen_version: 1 },
    });

    // O registro retornado para atualizacao nao possui protocol_item_id nem version,
    // o que significa que o update do Dexie mantem a mesma versao (1) e id original do registro.
    expect((updateRecord as Record<string, unknown>).protocol_item_id).toBeUndefined();
    expect((updateRecord as Record<string, unknown>).version).toBeUndefined();
    
    // Os outros campos foram alterados com sucesso, mas no mesmo registro semântico.
    expect(updateRecord.produto).toBe("Vermifugo Super");
    expect(updateRecord.tipo).toBe("vermifugacao");
    expect(updateRecord.intervalo_dias).toBe(60);
    expect(updateRecord.dose_num).toBe(2);
    expect(updateRecord.gera_agenda).toBe(false);
  });
});

describe("Regressao - Risco D: Edicao de Item de Protocolo em Oficial", () => {
  it("REGRESSÃO FASE 1A: buildProtocolItemUpdateRecord e buildProtocolUpdateRecord lancam erro se o protocolo for oficial", () => {
    const officialProtocol = {
      id: "official-1",
      payload: { origem: "catalogo_oficial" },
    };
    
    const originalItem = buildItem("item-1", {
      family_code: "brucelose",
    }, {
      protocolo_id: "official-1",
    });

    const draft = createEmptyProtocolItemDraft({
      produto: "Vermifugo Super",
      geraAgenda: false,
    });

    // Tentativa de atualizar etapa sob protocolo oficial dispara erro
    expect(() =>
      buildProtocolItemUpdateRecord(originalItem, draft, {}, {
        protocolPayload: { origem: "catalogo_oficial" },
      })
    ).toThrow("Protocolo oficial não pode ser editado diretamente.");

    // Tentativa de atualizar cabecalho de protocolo oficial dispara erro
    const protocolDraft = {
      nome: "Brucelose Oficial",
      descricao: "",
      ativo: true,
      familyCode: "brucelose",
      regimenVersion: "1",
      sexoAlvo: "" as "todos",
      idadeMinDias: "",
      idadeMaxDias: "",
      obrigatorio: true,
      obrigatorioPorRisco: false,
      requiresVet: false,
      requiresComplianceDocument: false,
      validoDe: "",
      validoAte: "",
    };

    expect(() =>
      buildProtocolUpdateRecord(officialProtocol, protocolDraft)
    ).toThrow("Protocolo oficial não pode ser editado diretamente.");
  });
});

describe("Regressao - Risco H: Delete/Desativacao de Protocolo e Preflight de Seguranca", () => {
  it("REGRESSÃO FASE 1A: checkSanitaryProtocolDeletionSafety BLOQUEIA delecao se houver tarefas de agenda ativas/concluidas", () => {
    const protocolId = "protocol-1";
    const protocolItems = [{ id: "item-1", protocolo_id: "protocol-1" }];
    
    // Tarefa ativa (aberta) na agenda associada ao item
    const agendaItems = [
      { deleted_at: null, protocol_item_version_id: "item-1" },
    ];
    const events: Array<{ deleted_at: string | null; payload?: Record<string, unknown> }> = [];

    const safety = checkSanitaryProtocolDeletionSafety({
      protocolId,
      protocolItems,
      agendaItems,
      events,
    });

    expect(safety.safe).toBe(false);
    expect(safety.reason).toContain("Não é possível excluir o protocolo pois existem tarefas ativas ou concluídas");
  });

  it("REGRESSÃO FASE 1A: checkSanitaryProtocolDeletionSafety BLOQUEIA delecao se houver eventos historicos vinculados no payload", () => {
    const protocolId = "protocol-1";
    const protocolItems = [{ id: "item-1", protocolo_id: "protocol-1" }];
    const agendaItems: Array<{ deleted_at: string | null; protocol_item_version_id: string | null }> = [];
    
    // Evento historico apontando para o protocolo no payload
    const events = [
      { deleted_at: null, payload: { protocolo_id: "protocol-1" } },
    ];

    const safety = checkSanitaryProtocolDeletionSafety({
      protocolId,
      protocolItems,
      agendaItems,
      events,
    });

    expect(safety.safe).toBe(false);
    expect(safety.reason).toContain("Não é possível excluir o protocolo pois existem eventos históricos de manejo");
  });

  it("REGRESSÃO FASE 1A: checkSanitaryProtocolDeletionSafety PERMITE delecao se nao houver vinculos relevantes", () => {
    const protocolId = "protocol-1";
    const protocolItems = [{ id: "item-1", protocolo_id: "protocol-1" }];
    const agendaItems = [
      { deleted_at: "2026-05-30T20:00:00.000Z", protocol_item_version_id: "item-1" }, // Deletado
    ];
    const events = [
      { deleted_at: "2026-05-30T20:00:00.000Z", payload: { protocolo_id: "protocol-1" } }, // Deletado
    ];

    const safety = checkSanitaryProtocolDeletionSafety({
      protocolId,
      protocolItems,
      agendaItems,
      events,
    });

    expect(safety.safe).toBe(true);
    expect(safety.reason).toBeNull();
  });
});
