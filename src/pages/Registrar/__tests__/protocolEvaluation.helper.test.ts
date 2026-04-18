import { describe, expect, it } from "vitest";
import type {
  Animal,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";
import {
  evaluateRegistrarProtocolItems,
  findRegistrarProtocolItemEvaluation,
} from "@/pages/Registrar/helpers/protocolEvaluation";

const nowIso = "2026-01-01T00:00:00.000Z";

const buildProtocol = (id: string): ProtocoloSanitario => ({
  id,
  fazenda_id: "farm-1",
  nome: `Protocolo ${id}`,
  descricao: null,
  ativo: true,
  payload: {},
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: nowIso,
  server_received_at: nowIso,
  created_at: nowIso,
  updated_at: nowIso,
  deleted_at: null,
});

const buildItem = (
  id: string,
  protocoloId: string,
  doseNum: number,
  payload: Record<string, unknown> = {},
): ProtocoloSanitarioItem => ({
  id,
  fazenda_id: "farm-1",
  protocolo_id: protocoloId,
  protocol_item_id: `tpl-${id}`,
  version: 1,
  tipo: "vacinacao",
  produto: `Produto ${id}`,
  intervalo_dias: 30,
  dose_num: doseNum,
  gera_agenda: true,
  dedup_template: null,
  payload,
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: nowIso,
  server_received_at: nowIso,
  created_at: nowIso,
  updated_at: nowIso,
  deleted_at: null,
});

describe("evaluateRegistrarProtocolItems", () => {
  it("prioriza itens compativeis e ordena por dose", () => {
    const protocoloA = buildProtocol("p-a");
    const protocoloB = buildProtocol("p-b");
    const itemCompativel = buildItem("i-ok", protocoloA.id, 2, {});
    const itemIncompativel = buildItem("i-bad", protocoloB.id, 1, {
      sexo_alvo: "F",
    });

    const selectedAnimals: Array<
      Pick<Animal, "identificacao" | "sexo" | "data_nascimento">
    > = [
      { identificacao: "AN-01", sexo: "M", data_nascimento: "2024-01-01" },
    ];

    const evaluations = evaluateRegistrarProtocolItems({
      items: [itemIncompativel, itemCompativel],
      protocolsById: new Map([
        [protocoloA.id, protocoloA],
        [protocoloB.id, protocoloB],
      ]),
      selectedAnimals,
    });

    expect(evaluations.map((entry) => entry.item.id)).toEqual(["i-ok", "i-bad"]);
    expect(evaluations[0]?.eligibility.compatibleWithAll).toBe(true);
    expect(evaluations[1]?.eligibility.compatibleWithAll).toBe(false);
  });

  it("mantem protocolo nulo quando id nao existe no mapa", () => {
    const item = buildItem("i-1", "missing", 1);

    const evaluations = evaluateRegistrarProtocolItems({
      items: [item],
      protocolsById: new Map(),
      selectedAnimals: [],
    });

    expect(evaluations[0]?.protocolo).toBeNull();
  });
});

describe("findRegistrarProtocolItemEvaluation", () => {
  it("retorna null quando nenhum item esta selecionado", () => {
    const selected = findRegistrarProtocolItemEvaluation({
      protocolItemId: null,
      evaluations: [],
    });

    expect(selected).toBeNull();
  });

  it("retorna a avaliacao correspondente ao item selecionado", () => {
    const protocolo = buildProtocol("p-a");
    const item = buildItem("i-1", protocolo.id, 1);
    const evaluations = evaluateRegistrarProtocolItems({
      items: [item],
      protocolsById: new Map([[protocolo.id, protocolo]]),
      selectedAnimals: [],
    });

    const selected = findRegistrarProtocolItemEvaluation({
      protocolItemId: "i-1",
      evaluations,
    });

    expect(selected?.item.id).toBe("i-1");
  });
});
