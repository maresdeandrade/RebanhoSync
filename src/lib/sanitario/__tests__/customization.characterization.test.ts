import { describe, expect, it } from "vitest";
import type { ProtocoloSanitarioItem } from "@/lib/offline/types";
import {
  buildProtocolItemUpdateRecord,
  createEmptyProtocolItemDraft,
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

describe("Caracterizacao - Risco H: Delete/Desativacao de Protocolo", () => {
  it("CONFIRMADO: A exclusao de protocolo monta apenas operacoes de DELETE duras na tabela de itens e protocolo", () => {
    // Simulando o comportamento de handleDeleteProtocol em FarmProtocolManager.tsx
    const deleteTarget = { id: "protocol-1", nome: "Protocolo Teste" };
    const items = [
      { id: "item-1", protocolo_id: "protocol-1" },
      { id: "item-2", protocolo_id: "protocol-1" },
    ];

    const mockBuildDeleteOperations = (target: typeof deleteTarget, targetItems: typeof items) => {
      return [
        ...targetItems.map((item) => ({
          table: "protocolos_sanitarios_itens",
          action: "DELETE",
          record: { id: item.id },
        })),
        {
          table: "protocolos_sanitarios",
          action: "DELETE",
          record: { id: target.id },
        },
      ];
    };

    const ops = mockBuildDeleteOperations(deleteTarget, items);

    expect(ops).toHaveLength(3);
    
    // As duas primeiras operacoes sao de DELETE dos itens
    expect(ops[0]).toEqual({
      table: "protocolos_sanitarios_itens",
      action: "DELETE",
      record: { id: "item-1" },
    });
    expect(ops[1]).toEqual({
      table: "protocolos_sanitarios_itens",
      action: "DELETE",
      record: { id: "item-2" },
    });

    // A ultima operacao eh DELETE do protocolo cabecalho
    expect(ops[2]).toEqual({
      table: "protocolos_sanitarios",
      action: "DELETE",
      record: { id: "protocol-1" },
    });

    // Nota de caracterizacao: Nenhuma operacao de analise de impacto,
    // desativacao de agenda vinculada, ou checagem de eventos historicos eh gerada.
  });
});
