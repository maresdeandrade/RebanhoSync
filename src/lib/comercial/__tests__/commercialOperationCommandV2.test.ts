import { describe, expect, it } from "vitest";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import type { Animal } from "@/lib/offline/types";
import {
  COMMERCIAL_OPERATION_MAX_ANIMALS,
  buildCommercialOperationGesture,
  validateCommercialOperationCommand,
  type CommercialOperationCommandInput,
} from "../commercialOperationCommand";

const farm = "10000000-0000-4000-8000-000000000001";
const lot = "20000000-0000-4000-8000-000000000001";
const occurredAt = "2026-08-13T12:00:00.000Z";

function animal(id: string, status: Animal["status"] = "ativo"): Animal {
  return {
    id,
    fazenda_id: farm,
    identificacao: `BR-${id.slice(-2)}`,
    sexo: "F",
    status,
    lote_id: lot,
    data_nascimento: "2025-01-01",
    data_entrada: "2025-01-01",
    data_saida: null,
    pai_id: null,
    mae_id: null,
    nome: null,
    rfid: null,
    especie: "bovino",
    origem: "nascimento",
    raca: null,
    papel_macho: null,
    habilitado_monta: false,
    observacoes: null,
    payload: {},
    client_id: "client",
    client_op_id: crypto.randomUUID(),
    client_tx_id: null,
    client_recorded_at: occurredAt,
    server_received_at: occurredAt,
    created_at: occurredAt,
    updated_at: occurredAt,
    deleted_at: null,
  };
}

function baseInput(): CommercialOperationCommandInput {
  return {
    fazendaId: farm,
    operationType: "compra",
    scope: "animal",
    occurredAt,
    declaredQuantity: 1,
    loteId: null,
    selectedAnimalIds: [],
    animals: [],
    newAnimals: [
      {
        localId: "row-1",
        id: "30000000-0000-4000-8000-000000000001",
        identificacao: "BR-001",
        sexo: "F",
        especie: "bovino",
        dataNascimento: "2025-01-01",
        dataEntrada: "2026-08-13",
      },
    ],
    lifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    operationId: "40000000-0000-4000-8000-000000000001",
    valorBruto: 2500,
  };
}

describe("commercial_operation_v2 domain command", () => {
  it("creates one active animal plus exactly one commercial event and detail", () => {
    const built = buildCommercialOperationGesture(baseInput());
    expect(built.animalIds).toEqual(["30000000-0000-4000-8000-000000000001"]);
    expect(built.ops.filter((op) => op.table === "animais")).toHaveLength(1);
    expect(built.ops.filter((op) => op.table === "eventos")).toHaveLength(1);
    expect(
      built.ops.filter((op) => op.table === "eventos_comercial"),
    ).toHaveLength(1);
    expect(built.ops[0]).toMatchObject({
      action: "INSERT",
      record: { status: "ativo", origem: "compra" },
    });
    expect(
      built.ops.some(
        (op) =>
          op.table === "finance_transactions" ||
          op.table === "eventos_financeiro",
      ),
    ).toBe(false);
  });

  it("creates N purchase animals but only one lot fact with complete frozen ids", () => {
    const input = baseInput();
    input.scope = "lote";
    input.loteId = lot;
    input.loteFarmId = farm;
    input.declaredQuantity = 2;
    input.newAnimals = [
      { ...input.newAnimals[0]!, localId: "row-a", identificacao: "A" },
      {
        ...input.newAnimals[0]!,
        localId: "row-b",
        id: "30000000-0000-4000-8000-000000000002",
        identificacao: "B",
      },
    ];
    const built = buildCommercialOperationGesture(input);
    expect(built.ops.filter((op) => op.table === "animais")).toHaveLength(2);
    expect(built.ops.filter((op) => op.table === "eventos")).toHaveLength(1);
    const detail = built.ops.find(
      (op) => op.table === "eventos_comercial",
    )!.record;
    expect(detail.quantidade_animais).toBe(2);
    expect(detail.animal_ids).toEqual(built.animalIds);
    expect(detail.lote_id).toBe(lot);
  });

  it("updates every frozen sale animal to sold and preserves one historical fact", () => {
    const animals = [
      animal("30000000-0000-4000-8000-000000000001"),
      animal("30000000-0000-4000-8000-000000000002"),
    ];
    const built = buildCommercialOperationGesture({
      ...baseInput(),
      operationType: "venda",
      scope: "lote",
      declaredQuantity: 2,
      loteId: lot,
      newAnimals: [],
      animals,
      selectedAnimalIds: animals.map((item) => item.id),
      currentLotAnimalIds: animals.map((item) => item.id),
      contraparteId: "50000000-0000-4000-8000-000000000001",
      contraparteNome: "Comprador",
    });
    expect(built.ops.filter((op) => op.table === "animais")).toHaveLength(2);
    expect(
      built.ops.filter((op) => op.table === "animais").map((op) => op.record),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "vendido", lote_id: null }),
        expect.objectContaining({ status: "vendido", lote_id: null }),
      ]),
    );
    expect(built.ops.filter((op) => op.table === "eventos")).toHaveLength(1);
    expect(
      built.ops.filter((op) => op.table === "eventos_comercial"),
    ).toHaveLength(1);
  });

  it.each([
    [
      "duplicate identification",
      (input: CommercialOperationCommandInput) => {
        input.existingIdentifications = ["br-001"];
      },
      "Já existe animal",
    ],
    [
      "cross-farm lot",
      (input: CommercialOperationCommandInput) => {
        input.loteId = lot;
        input.loteFarmId = "other-farm";
      },
      "outra fazenda",
    ],
    [
      "declared count mismatch",
      (input: CommercialOperationCommandInput) => {
        input.declaredQuantity = 2;
      },
      "quantidade declarada",
    ],
  ])("rejects %s before any write", (_name, mutate, message) => {
    const input = baseInput();
    mutate(input);
    expect(validateCommercialOperationCommand(input)).toContain(message);
  });

  it("fails closed when the lot composition changed or an animal is ineligible", () => {
    const active = animal("30000000-0000-4000-8000-000000000001");
    const input: CommercialOperationCommandInput = {
      ...baseInput(),
      operationType: "venda",
      scope: "lote",
      loteId: lot,
      newAnimals: [],
      animals: [active],
      selectedAnimalIds: [active.id],
      currentLotAnimalIds: [active.id, crypto.randomUUID()],
    };
    expect(validateCommercialOperationCommand(input)).toContain(
      "composição do lote mudou",
    );
    input.currentLotAnimalIds = [active.id];
    input.animals = [{ ...active, status: "vendido" }];
    expect(validateCommercialOperationCommand(input)).toContain(
      "não está ativo",
    );
  });

  it("enforces the established 500-animal transaction boundary before writing", () => {
    const input = baseInput();
    input.declaredQuantity = COMMERCIAL_OPERATION_MAX_ANIMALS + 1;
    expect(validateCommercialOperationCommand(input)).toContain(
      `${COMMERCIAL_OPERATION_MAX_ANIMALS} animais`,
    );
  });
});
