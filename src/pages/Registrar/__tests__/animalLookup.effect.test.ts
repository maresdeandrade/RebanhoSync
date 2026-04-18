import { describe, expect, it } from "vitest";
import type { Animal } from "@/lib/offline/types";
import { loadRegistrarAnimalsMap } from "@/pages/Registrar/effects/animalLookup";

const nowIso = "2026-01-01T00:00:00.000Z";

const buildAnimal = (id: string): Animal => ({
  id,
  fazenda_id: "farm-1",
  lote_id: "lote-1",
  origem: "nascimento",
  identificacao: `BR-${id}`,
  sexo: "F",
  status: "ativo",
  categoria: "vaca",
  data_nascimento: "2020-01-01",
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

describe("loadRegistrarAnimalsMap", () => {
  it("retorna mapa vazio quando nao ha ids", async () => {
    const map = await loadRegistrarAnimalsMap({ animalIds: [] });
    expect(map.size).toBe(0);
  });

  it("monta mapa ignorando entradas undefined", async () => {
    const map = await loadRegistrarAnimalsMap({
      animalIds: ["a-1", "a-2"],
      bulkGetAnimals: async () => [buildAnimal("a-1"), undefined],
    });

    expect(map.size).toBe(1);
    expect(map.get("a-1")?.identificacao).toBe("BR-a-1");
  });
});
