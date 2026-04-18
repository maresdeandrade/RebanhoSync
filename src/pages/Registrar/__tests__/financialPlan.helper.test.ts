import { describe, expect, it } from "vitest";
import type { Animal } from "@/lib/offline/types";
import {
  buildRegistrarFinancialPurchaseAnimals,
  buildRegistrarSelectedAnimalRecords,
} from "@/pages/Registrar/helpers/financialPlan";

const nowIso = "2026-01-01T00:00:00.000Z";

const buildAnimal = (
  id: string,
  identificacao: string,
  loteId: string | null,
): Animal => ({
  id,
  fazenda_id: "farm-1",
  lote_id: loteId,
  origem: "nascimento",
  identificacao,
  sexo: "M",
  status: "ativo",
  categoria: "bezerro",
  data_nascimento: "2025-01-01",
  peso_kg: null,
  mae_id: null,
  pai_id: null,
  observacoes: null,
  criado_em_fazenda: true,
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

describe("buildRegistrarSelectedAnimalRecords", () => {
  it("gera registros apenas para ids presentes no mapa e aplica lote fallback", () => {
    const animalsMap = new Map<string, Animal>([
      ["a-1", buildAnimal("a-1", "BR-001", null)],
      ["a-2", buildAnimal("a-2", "BR-002", "lote-2")],
    ]);

    const records = buildRegistrarSelectedAnimalRecords({
      selectedAnimalIds: ["a-1", "missing", "a-2"],
      animalsMap,
      fallbackLoteId: "lote-fallback",
    });

    expect(records).toEqual([
      { id: "a-1", identificacao: "BR-001", loteId: "lote-fallback" },
      { id: "a-2", identificacao: "BR-002", loteId: "lote-2" },
    ]);
  });
});

describe("buildRegistrarFinancialPurchaseAnimals", () => {
  it("usa drafts de compra quando natureza for compra", () => {
    const purchaseAnimals = buildRegistrarFinancialPurchaseAnimals({
      natureza: "compra",
      compraNovosAnimais: [
        {
          localId: "tmp-1",
          identificacao: " BR-100 ",
          sexo: "F",
          dataNascimento: "2025-02-01",
          pesoKg: "250,5",
        },
      ],
      selectedAnimalRecords: [],
      modoPeso: "individual",
      parseUserWeight: (value) => Number.parseFloat(value.replace(",", ".")),
    });

    expect(purchaseAnimals).toEqual([
      {
        localId: "tmp-1",
        identificacao: "BR-100",
        sexo: "F",
        dataNascimento: "2025-02-01",
        pesoKg: 250.5,
      },
    ]);
  });

  it("reaproveita selecionados em venda e mapeia peso por indice", () => {
    const purchaseAnimals = buildRegistrarFinancialPurchaseAnimals({
      natureza: "venda",
      compraNovosAnimais: [
        {
          localId: "tmp-1",
          identificacao: "x",
          sexo: "M",
          dataNascimento: "",
          pesoKg: "300",
        },
      ],
      selectedAnimalRecords: [{ id: "a-1", identificacao: "BR-001", loteId: "lote-1" }],
      modoPeso: "individual",
      parseUserWeight: (value) => Number.parseFloat(value),
    });

    expect(purchaseAnimals).toEqual([
      {
        localId: "a-1",
        identificacao: "BR-001",
        sexo: "M",
        dataNascimento: null,
        pesoKg: 300,
      },
    ]);
  });
});
