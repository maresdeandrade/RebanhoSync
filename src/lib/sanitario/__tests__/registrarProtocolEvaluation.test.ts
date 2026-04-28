import { describe, expect, it } from "vitest";
import type {
  Animal,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";
import {
  evaluateRegistrarProtocolItems,
  findRegistrarProtocolItemEvaluation,
} from "@/lib/sanitario/models/registrarProtocolEvaluation";

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

describe("registrarProtocolEvaluation", () => {
  it("avalia protocolo valido e preserva protocolo associado", () => {
    const protocolo = buildProtocol("p-ok");
    const item = buildItem("i-ok", protocolo.id, 1);

    const evaluations = evaluateRegistrarProtocolItems({
      items: [item],
      protocolsById: new Map([[protocolo.id, protocolo]]),
      selectedAnimals: [
        {
          identificacao: "AN-01",
          sexo: "F",
          data_nascimento: "2024-01-01",
        },
      ],
    });

    expect(evaluations).toHaveLength(1);
    expect(evaluations[0]?.protocolo?.id).toBe("p-ok");
    expect(evaluations[0]?.eligibility.compatibleWithAll).toBe(true);
  });

  it("mantem comportamento para protocolo incompativel", () => {
    const protocolo = buildProtocol("p-femeas");
    const item = buildItem("i-femeas", protocolo.id, 1, {
      sexo_alvo: "F",
    });

    const selectedAnimals: Array<
      Pick<Animal, "identificacao" | "sexo" | "data_nascimento">
    > = [
      {
        identificacao: "AN-02",
        sexo: "M",
        data_nascimento: "2024-01-01",
      },
    ];
    const evaluations = evaluateRegistrarProtocolItems({
      items: [item],
      protocolsById: new Map([[protocolo.id, protocolo]]),
      selectedAnimals,
    });

    expect(evaluations[0]?.eligibility.compatibleWithAll).toBe(false);
    expect(evaluations[0]?.eligibility.reasons[0]).toContain(
      "exclusivo para femeas",
    );
  });

  it("entrada incompleta retorna protocolo nulo e busca selecionado com fallback seguro", () => {
    const item = buildItem("i-missing", "missing-protocol", 1);
    const evaluations = evaluateRegistrarProtocolItems({
      items: [item],
      protocolsById: new Map(),
      selectedAnimals: [],
    });

    expect(evaluations[0]?.protocolo).toBeNull();
    expect(
      findRegistrarProtocolItemEvaluation({
        protocolItemId: "missing-selection",
        evaluations,
      }),
    ).toBeNull();
    expect(
      findRegistrarProtocolItemEvaluation({
        protocolItemId: "i-missing",
        evaluations,
      })?.item.id,
    ).toBe("i-missing");
  });
});
