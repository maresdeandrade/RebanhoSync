import { describe, expect, it } from "vitest";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import type { Animal } from "@/lib/offline/types";
import {
  COMMERCIAL_OPERATION_MAX_ANIMALS,
  buildCommercialOperationGesture,
  validateCommercialOperationCommand,
  validateCommercialPricingSnapshotLine,
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
  it("rejects a divergent direct-arroba snapshot before writing", () => {
    expect(
      validateCommercialPricingSnapshotLine("arroba", {
        pricing_mode: "per_arroba",
        commercial_weight: 18,
        commercial_weight_unit: "arroba",
        weight_source: "direct",
        weight_considered_kg: null,
        arrobas: 17.5,
        arroba_basis: null,
        carcass_yield_percent: null,
      }),
    ).toMatch(/igual às arrobas faturadas/i);
  });

  it("persists an auditable per-arroba snapshot inside the commercial detail", () => {
    const input = baseInput();
    input.valorBruto = 5_400;
    input.pricing = {
      pricingMode: "per_arroba",
      weightUnit: "arroba",
      pricePerArroba: 300,
      lines: {
        "row-1": { commercialWeight: { unit: "arroba", amount: 18 } },
      },
    };

    const built = buildCommercialOperationGesture(input);
    expect(buildCommercialOperationGesture(input)).toEqual(built);
    const detail = built.ops.find(
      (op) => op.table === "eventos_comercial",
    )!.record;
    expect(detail.snapshot.pricing).toEqual({
      contract_version: 2,
      pricing_mode: "per_arroba",
      weight_unit: "arroba",
      commercial_weight_total: 18,
      price_per_arroba: 300,
      arroba_basis: null,
      carcass_yield_percent: null,
      total_arrobas: 18,
      effective_price_per_arroba_gross: 300,
      effective_price_per_arroba_net: 300,
      lines: [
        {
          animal_id: "30000000-0000-4000-8000-000000000001",
          pricing_mode: "per_arroba",
          price_per_head: null,
          allocated_gross_value: null,
          price_per_arroba: 300,
          arroba_basis: null,
          carcass_yield_percent: null,
          commercial_weight: 18,
          commercial_weight_unit: "arroba",
          weight_source: "direct",
          weight_considered_kg: null,
          arrobas: 18,
          individual_gross_value: 5400,
        },
      ],
    });
    expect(detail.snapshot.valor_por_animal).toEqual({
      "30000000-0000-4000-8000-000000000001": 5400,
    });
    expect(detail.snapshot.animals[0].peso_kg).toBeNull();
    expect(
      built.ops.find((op) => op.table === "animais")!.record,
    ).not.toHaveProperty("peso_atual_kg");
  });

  it("persists total-value allocation and effective arroba prices", () => {
    const input = baseInput();
    input.valorBruto = 6_000;
    input.frete = 100;
    input.descontos = 50;
    input.bonificacoes = 150;
    input.pricing = {
      pricingMode: "total_value",
      weightUnit: "arroba",
      lines: {
        "row-1": {
          pricePerHead: 6_000,
          commercialWeight: { unit: "arroba", amount: 20 },
        },
      },
    };

    const detail = buildCommercialOperationGesture(input).ops.find(
      (op) => op.table === "eventos_comercial",
    )!.record;
    expect(detail.snapshot).toMatchObject({ bonificacoes: 150 });
    expect(detail.snapshot.pricing).toMatchObject({
      contract_version: 2,
      pricing_mode: "total_value",
      total_arrobas: 20,
      effective_price_per_arroba_gross: 300,
      effective_price_per_arroba_net: 295,
      price_per_arroba: null,
      lines: [
        {
          allocated_gross_value: 6000,
          individual_gross_value: 6000,
          arrobas: 20,
        },
      ],
    });
  });

  it("records arrobas calculated from kg without promoting commercial weight to animal state", () => {
    const input = baseInput();
    input.valorBruto = 6_000;
    input.pricing = {
      pricingMode: "per_arroba",
      weightUnit: "kg",
      pricePerArroba: 300,
      arrobaBasis: "carcass_weight",
      lines: {
        "row-1": { commercialWeight: { unit: "kg", amount: 300 } },
      },
    };

    const built = buildCommercialOperationGesture(input);
    const detail = built.ops.find(
      (op) => op.table === "eventos_comercial",
    )!.record;
    expect(detail.snapshot.pricing.lines[0]).toMatchObject({
      commercial_weight: 300,
      commercial_weight_unit: "kg",
      weight_source: "calculated",
      weight_considered_kg: 300,
      arrobas: 20,
      individual_gross_value: 6000,
    });
    expect(detail.snapshot.animals[0].peso_kg).toBeNull();
  });

  it("keeps the same unit snapshot and command content on identical replay", () => {
    const input = baseInput();
    input.pricing = {
      pricingMode: "per_head",
      weightUnit: "arroba",
      lines: {
        "row-1": {
          pricePerHead: 2500,
          commercialWeight: { unit: "arroba", amount: 30 },
        },
      },
    };
    const first = buildCommercialOperationGesture(input);
    const replay = buildCommercialOperationGesture(input);
    expect(replay).toEqual(first);
    const detail = first.ops.find(
      (op) => op.table === "eventos_comercial",
    )!.record;
    expect(detail.snapshot.pricing).toMatchObject({
      weight_unit: "arroba",
      commercial_weight_total: 30,
      arroba_basis: null,
      carcass_yield_percent: null,
    });
  });

  it("changes factual content instead of reinterpreting weight when the unit changes", () => {
    const kg = baseInput();
    kg.valorBruto = 6000;
    kg.pricing = {
      pricingMode: "per_arroba",
      weightUnit: "kg",
      pricePerArroba: 300,
      arrobaBasis: "carcass_weight",
      lines: {
        "row-1": { commercialWeight: { unit: "kg", amount: 300 } },
      },
    };
    const arroba = baseInput();
    arroba.valorBruto = 6000;
    arroba.pricing = {
      pricingMode: "per_arroba",
      weightUnit: "arroba",
      pricePerArroba: 300,
      lines: {
        "row-1": { commercialWeight: { unit: "arroba", amount: 20 } },
      },
    };

    const kgDetail = buildCommercialOperationGesture(kg).ops.find(
      (op) => op.table === "eventos_comercial",
    )!.record;
    const arrobaDetail = buildCommercialOperationGesture(arroba).ops.find(
      (op) => op.table === "eventos_comercial",
    )!.record;
    expect(kgDetail.snapshot.pricing).not.toEqual(
      arrobaDetail.snapshot.pricing,
    );
    expect(kgDetail.snapshot.pricing.weight_unit).toBe("kg");
    expect(arrobaDetail.snapshot.pricing.weight_unit).toBe("arroba");
  });

  it("rejects a pricing snapshot whose line sum differs from gross value", () => {
    const input = baseInput();
    input.pricing = {
      pricingMode: "per_head",
      weightUnit: "kg",
      lines: {
        "row-1": {
          pricePerHead: 2_000,
          commercialWeight: { unit: "kg", amount: null },
        },
      },
    };
    expect(validateCommercialOperationCommand(input)).toMatch(/valor bruto/i);
  });

  it("rejects a carcass-weight snapshot with residual yield data", () => {
    const input = baseInput();
    input.valorBruto = 6_000;
    input.pricing = {
      pricingMode: "per_arroba",
      weightUnit: "kg",
      pricePerArroba: 300,
      arrobaBasis: "carcass_weight",
      carcassYieldPercent: 54,
      lines: {
        "row-1": { commercialWeight: { unit: "kg", amount: 300 } },
      },
    };
    expect(validateCommercialOperationCommand(input)).toMatch(
      /rendimento residual/i,
    );
  });

  it("rejects individual purchase with more than one animal", () => {
    const input = baseInput();
    input.declaredQuantity = 2;
    input.newAnimals = [
      input.newAnimals[0]!,
      {
        ...input.newAnimals[0]!,
        localId: "row-2",
        id: "30000000-0000-4000-8000-000000000002",
        identificacao: "BR-002",
      },
    ];

    expect(validateCommercialOperationCommand(input)).toBe(
      "Compra individual exige exatamente um novo animal.",
    );
  });

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
      record: {
        status: "ativo",
        origem: "compra",
        data_nascimento: "2025-01-01",
      },
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
      pricing: {
        pricingMode: "per_head",
        weightUnit: "kg",
        lines: Object.fromEntries(
          animals.map((item) => [
            item.id,
            {
              pricePerHead: 1250,
              commercialWeight: { unit: "kg", amount: 400 },
            },
          ]),
        ),
      },
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
    const detail = built.ops.find(
      (op) => op.table === "eventos_comercial",
    )!.record;
    expect(detail.snapshot.pricing.lines).toHaveLength(2);
    expect(detail.snapshot.valor_por_animal).toEqual({
      "30000000-0000-4000-8000-000000000001": 1250,
      "30000000-0000-4000-8000-000000000002": 1250,
    });
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
