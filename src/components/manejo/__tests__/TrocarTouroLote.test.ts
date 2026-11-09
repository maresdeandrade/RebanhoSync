import { describe, expect, it } from "vitest";
import type { Animal } from "@/lib/offline/types";
import { isAnimalEligibleForLotBull } from "@/lib/animals/maleProfile";

function animal(overrides: Partial<Animal> = {}): Animal {
  const now = "2026-04-04T12:00:00.000Z";
  return {
    id: "bull-1",
    fazenda_id: "farm-1",
    identificacao: "T-001",
    sexo: "M",
    status: "ativo",
    lote_id: "lot-1",
    data_nascimento: "2020-01-01",
    data_entrada: null,
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    origem: null,
    raca: null,
    papel_macho: "reprodutor",
    habilitado_monta: true,
    observacoes: null,
    payload: {
      lifecycle: { destino_produtivo: "reprodutor" },
      male_profile: { status_reprodutivo: "apto" },
    },
    client_id: "client-1",
    client_op_id: "op-1",
    client_tx_id: "tx-1",
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  };
}

describe("revalidação de touro do lote", () => {
  const lote = { id: "lot-1", fazenda_id: "farm-1" };

  it("aceita somente o touro ainda elegível no mesmo lote e fazenda", () => {
    expect(isAnimalEligibleForLotBull(animal(), lote)).toBe(true);
  });

  it.each([
    ["mudou de lote", { lote_id: "lot-2" }],
    ["mudou de fazenda", { fazenda_id: "farm-2" }],
    ["foi castrado", { payload: { taxonomy_facts: { castrado: true } } }],
    ["ficou inativo", { status: "retirado" }],
    ["foi removido", { deleted_at: "2026-04-04T13:00:00.000Z" }],
  ] as const)("rejeita animal quando %s", (_reason, overrides) => {
    expect(isAnimalEligibleForLotBull(animal(overrides), lote)).toBe(false);
  });
});
