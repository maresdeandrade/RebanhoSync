import { describe, expect, it } from "vitest";
import type { Animal } from "@/lib/offline/types";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { runRegistrarReproductionFinalizeEffect } from "@/pages/Registrar/effects/reproductionFinalize";

const nowIso = "2026-01-01T00:00:00.000Z";

const buildAnimal = (overrides: Partial<Animal> = {}): Animal => ({
  id: "animal-1",
  fazenda_id: "farm-1",
  lote_id: "lote-1",
  origem: "nascimento",
  identificacao: "BR-001",
  sexo: "F",
  status: "ativo",
  categoria: "bezerro",
  data_nascimento: "2023-01-01",
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
  ...overrides,
});

describe("runRegistrarReproductionFinalizeEffect", () => {
  it("retorna issue quando animal nao eh elegivel para reproducao", async () => {
    const result = await runRegistrarReproductionFinalizeEffect({
      fazendaId: "farm-1",
      animalId: "animal-1",
      animal: buildAnimal({ sexo: "M" }),
      occurredAt: nowIso,
      sourceTaskId: null,
      targetLoteId: "lote-1",
      reproducaoData: { tipo: "cobertura", machoId: "macho-1" },
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    });

    expect(result.issue).toBeTruthy();
    expect(result.ops).toEqual([]);
  });

  it("retorna redirect de pos-parto quando houver crias", async () => {
    const result = await runRegistrarReproductionFinalizeEffect({
      fazendaId: "farm-1",
      animalId: "animal-1",
      animal: buildAnimal({ sexo: "F", categoria: "vaca" }),
      occurredAt: nowIso,
      sourceTaskId: null,
      targetLoteId: "lote-1",
      reproducaoData: { tipo: "parto", dataParto: "2026-01-01", numeroCrias: 1 },
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
      prepareReproduction: async () => ({
        eventId: "evt-1",
        ops: [
          {
            table: "eventos",
            action: "INSERT",
            record: { id: "evt-1" },
          },
        ],
        calfIds: ["calf-1"],
      }),
    });

    expect(result.issue).toBeNull();
    expect(result.eventId).toBe("evt-1");
    expect(result.postPartoRedirect).toEqual({
      motherId: "animal-1",
      eventId: "evt-1",
      calfIds: ["calf-1"],
    });
  });
});
