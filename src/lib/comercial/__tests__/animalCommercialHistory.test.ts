/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/offline/db";
import { buildCommercialOperationGesture } from "../commercialOperationCommand";
import {
  loadAnimalCommercialHistory,
  projectAnimalCommercialValues,
  loadAnimalAcquisitionHistory,
  projectPurchaseAcquisition,
} from "../animalCommercialHistory";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { selectLatestObservedWeight } from "@/lib/insights/latestObservedWeight";
import type { CommercialOperationCommandInput } from "../commercialOperationCommand";
import { createGesture } from "@/lib/offline/ops";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";

afterEach(async () => {
  await Promise.all([
    db.state_animais.clear(),
    db.event_eventos.clear(),
    db.event_eventos_comercial.clear(),
    db.event_eventos_pesagem.clear(),
    db.queue_ops.clear(),
    db.queue_gestures.clear(),
  ]);
});

const farm = "10000000-0000-4000-8000-000000000001";
const acquisitionDate = "2026-08-13T12:00:00.000Z";
const ids = [
  "30000000-0000-4000-8000-000000000001",
  "30000000-0000-4000-8000-000000000002",
  "30000000-0000-4000-8000-000000000003",
];

function purchaseInput(
  weights: Array<number | null>,
): CommercialOperationCommandInput {
  return {
    fazendaId: farm,
    operationType: "compra",
    scope: weights.length === 1 ? "animal" : "lote",
    occurredAt: acquisitionDate,
    declaredQuantity: weights.length,
    loteId:
      weights.length === 1 ? null : "20000000-0000-4000-8000-000000000001",
    selectedAnimalIds: [],
    animals: [],
    lifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    valorBruto: 0,
    operationId: "40000000-0000-4000-8000-000000000001",
    newAnimals: weights.map((weight, i) => ({
      id: ids[i],
      localId: ids[i],
      identificacao: `AQUISICAO-${i}`,
      sexo: "F",
      especie: "bovino",
      dataEntrada: "2026-08-13",
      dataNascimento: "2025-01-01",
      commercialWeight: weight,
      valorIndividual: 0,
    })),
  };
}

describe("peso factual de aquisição", () => {
  it.each([false, true])("mantém peso ausente intercalado com pricing=%s", async (withPricing) => {
    const input = purchaseInput([320, null, 355]);
    if (withPricing) input.pricing = {
      pricingMode: "per_head", weightUnit: "kg",
      lines: Object.fromEntries(input.newAnimals.map((animal) => [animal.localId, {
        pricePerHead: 0, commercialWeight: { unit: "kg", amount: animal.commercialWeight },
      }])),
    };
    await createGesture(farm, buildCommercialOperationGesture(input).ops);
    const facts = await Promise.all(ids.map((id) => loadAnimalAcquisitionHistory(farm, id)));
    expect(facts.map((rows) => rows[0]?.weight)).toEqual([320, null, 355]);
    expect(facts.map((rows) => rows[0]?.animalId)).toEqual(ids);
  });

  it.each([[320], [320, 355], [0]])(
    "preserva aquisição %j no snapshot sem pricing após reabrir",
    async (...weights: number[]) => {
      const built = buildCommercialOperationGesture(purchaseInput(weights));
      await createGesture(farm, built.ops);
      db.close();
      await db.open();
      for (const [i, weight] of weights.entries()) {
        const facts = await loadAnimalAcquisitionHistory(farm, ids[i]);
        expect(facts).toHaveLength(1);
        expect(facts[0]).toMatchObject({
          origin: "compra",
          animalId: ids[i],
          weight,
          weightUnit: "kg",
          value: 0,
          eventId: built.eventId,
        });
      }
    },
  );

  it("mantém aquisição 320, pesagem 410 e venda 480 como fatos independentes", async () => {
    await createGesture(
      farm,
      buildCommercialOperationGesture(purchaseInput([320])).ops,
    );
    await createGesture(
      farm,
      buildEventGesture({
        dominio: "pesagem",
        fazendaId: farm,
        animalId: ids[0],
        occurredAt: "2026-09-01T12:00:00.000Z",
        pesoKg: 410,
      }).ops,
    );
    const animal = (await db.state_animais.get(ids[0]))!;
    const sale = buildCommercialOperationGesture({
      ...purchaseInput([320]),
      operationId: "40000000-0000-4000-8000-000000000002",
      operationType: "venda",
      occurredAt: "2026-09-15T12:00:00.000Z",
      selectedAnimalIds: [ids[0]],
      animals: [animal],
      newAnimals: [],
      pesoVivoTotal: 480,
      valorBruto: 5000,
      contraparteId: "50000000-0000-4000-8000-000000000001",
    });
    await createGesture(farm, sale.ops);
    const eventRows = await db.event_eventos.toArray();
    const weights = await db.event_eventos_pesagem.toArray();
    const latest = selectLatestObservedWeight({
      fazendaId: farm,
      animalId: ids[0],
      animal,
      events: eventRows,
      weightDetails: weights,
      referenceDate: "2026-09-20",
    });
    expect(latest).toMatchObject({
      status: "available",
      value: { weight: 410 },
    });
    const history = await loadAnimalAcquisitionHistory(farm, ids[0]);
    expect(history).toHaveLength(1);
    expect(history[0].weight).toBe(320);
    const sales = (await loadAnimalCommercialHistory(farm, ids[0])).filter(
      (row) => row.operation_type === "venda",
    );
    expect(projectAnimalCommercialValues(sales[0], ids[0]).weight).toBe(480);
  });

  it.each([null, {}, { animals: "legado", pricing: { lines: {} } }])(
    "legado sem peso permanece ausente: %j",
    async (snapshot) => {
      const built = buildCommercialOperationGesture(purchaseInput([null]));
      await createGesture(farm, built.ops);
      await db.event_eventos_comercial.update(built.eventId, { snapshot });
      const [fact] = await loadAnimalAcquisitionHistory(farm, ids[0]);
      expect(fact.weight).toBeNull();
    },
  );

  it("não usa peso médio, de outro animal ou venda como aquisição", async () => {
    const built = buildCommercialOperationGesture(purchaseInput([null, 355]));
    await createGesture(farm, built.ops);
    await db.event_eventos_comercial.update(built.eventId, {
      peso_vivo_total: 710,
      peso_medio_derivado: 355,
    });
    const [fact] = await loadAnimalAcquisitionHistory(farm, ids[0]);
    expect(fact.weight).toBeNull();
    const detail = (await db.event_eventos_comercial.get(built.eventId))!;
    expect(
      projectPurchaseAcquisition(
        { ...detail, operation_type: "venda" },
        ids[0],
      ),
    ).toBeNull();
  });

  it("preserva arrobas e base de carcaça declaradas sem converter para peso vivo", async () => {
    const built = buildCommercialOperationGesture(purchaseInput([null]));
    await createGesture(farm, built.ops);
    await db.event_eventos_comercial.update(built.eventId, {
      snapshot: {
        pricing: {
          weight_unit: "arroba",
          arroba_basis: "carcass_weight",
          lines: [
            {
              animal_id: ids[0],
              commercial_weight: 18,
              commercial_weight_unit: "arroba",
              individual_gross_value: 0,
            },
          ],
        },
      },
    });
    const [fact] = await loadAnimalAcquisitionHistory(farm, ids[0]);
    expect(fact).toMatchObject({
      weight: 18,
      weightUnit: "@",
      weightBasis: "carcass_weight",
      value: 0,
    });
  });

  it("ignora simulação, inclusive quando há peso individual no snapshot", async () => {
    const built = buildCommercialOperationGesture(purchaseInput([320]));
    await createGesture(farm, built.ops);
    await db.event_eventos.update(built.eventId, {
      payload: { is_simulation: true },
    });
    expect(await loadAnimalAcquisitionHistory(farm, ids[0])).toEqual([]);
    await db.event_eventos_comercial.update(built.eventId, {
      snapshot: { is_simulation: true },
    });
    expect(
      projectPurchaseAcquisition(
        (await db.event_eventos_comercial.get(built.eventId))!,
        ids[0],
      ),
    ).toBeNull();
  });

  it("a entrada em sociedade usa somente a pesagem marcada, mesmo após pesagem posterior", async () => {
    for (const [i, weight] of [320, 355].entries()) {
      await createGesture(
        farm,
        buildEventGesture({
          dominio: "pesagem",
          fazendaId: farm,
          animalId: ids[i],
          occurredAt: acquisitionDate,
          pesoKg: weight,
          payload: {
            tipo_acao: "entrada_sociedade",
            sociedade_id: "sociedade-1",
          },
        }).ops,
      );
    }
    await createGesture(
      farm,
      buildEventGesture({
        dominio: "pesagem",
        fazendaId: farm,
        animalId: ids[0],
        occurredAt: "2026-09-01",
        pesoKg: 410,
      }).ops,
    );
    db.close();
    await db.open();
    for (const [i, weight] of [320, 355].entries()) {
      const [fact] = await loadAnimalAcquisitionHistory(farm, ids[i]);
      expect(fact).toMatchObject({
        origin: "sociedade",
        weight,
        animalId: ids[i],
        value: null,
        societyId: "sociedade-1",
      });
    }
    expect(await loadAnimalAcquisitionHistory("outra-fazenda", ids[0])).toEqual(
      [],
    );
  });
});

describe("histórico comercial individual persistido", () => {
  it("relê compra por lote e mantém peso e valor de cada animal sem fabricar pesagem", async () => {
    const farm = "10000000-0000-4000-8000-000000000001";
    const ids = [
      "30000000-0000-4000-8000-000000000001",
      "30000000-0000-4000-8000-000000000002",
    ];
    const command = buildCommercialOperationGesture({
      fazendaId: farm,
      operationType: "compra",
      scope: "lote",
      occurredAt: "2026-08-13T12:00:00.000Z",
      declaredQuantity: 2,
      loteId: "20000000-0000-4000-8000-000000000001",
      selectedAnimalIds: [],
      animals: [],
      valorBruto: 7000,
      lifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
      operationId: "40000000-0000-4000-8000-000000000001",
      newAnimals: ids.map((id, i) => ({
        id,
        localId: id,
        identificacao: `COMPRA-${i}`,
        sexo: "F",
        especie: "bovino",
        dataNascimento: "2025-01-01",
        dataEntrada: "2026-08-13",
      })),
      pricing: {
        pricingMode: "per_head",
        weightUnit: "kg",
        lines: {
          [ids[0]]: {
            pricePerHead: 3000,
            commercialWeight: { unit: "kg", amount: 250 },
          },
          [ids[1]]: {
            pricePerHead: 4000,
            commercialWeight: { unit: "kg", amount: 350 },
          },
        },
      },
    });
    await createGesture(farm, command.ops);
    db.close();
    await db.open();
    for (const [i, id] of ids.entries()) {
      const rows = await loadAnimalCommercialHistory(farm, id);
      expect(rows).toHaveLength(1);
      expect(projectAnimalCommercialValues(rows[0], id)).toEqual({
        weight: i ? 350 : 250,
        weightUnit: "kg",
        value: i ? 4000 : 3000,
      });
    }
    expect(await loadAnimalCommercialHistory("outra-fazenda", ids[0])).toEqual(
      [],
    );
    expect(await loadAnimalCommercialHistory(farm, "outro-animal")).toEqual([]);
    const initialRows = await loadAnimalCommercialHistory(farm, ids[0]);
    expect(
      projectAnimalCommercialValues(
        { ...initialRows[0], snapshot: {} },
        ids[0],
      ),
    ).toEqual({ weight: null, weightUnit: "kg", value: null });
    expect(
      projectAnimalCommercialValues(
        {
          ...initialRows[0],
          snapshot: {
            pricing: {
              lines: [
                {
                  animal_id: ids[0],
                  commercial_weight: 18,
                  commercial_weight_unit: "arroba",
                  individual_gross_value: 0,
                },
              ],
            },
          },
        },
        ids[0],
      ),
    ).toEqual({ weight: 18, weightUnit: "@", value: 0 });
    expect(
      await db.event_eventos
        .filter((event) => event.dominio === "pesagem")
        .count(),
    ).toBe(0);
    expect(await db.event_eventos.count()).toBe(1);
    const rows = await loadAnimalCommercialHistory(farm, ids[0]);
    await db.event_eventos.update(rows[0].evento_id, { animal_id: ids[0] });
    await db.event_eventos_comercial.update(rows[0].evento_id, {
      animal_ids: null,
    });
    expect(await loadAnimalCommercialHistory(farm, ids[0])).toHaveLength(1);
    await db.event_eventos.update(rows[0].evento_id, {
      deleted_at: "2026-08-14",
    });
    expect(await loadAnimalCommercialHistory(farm, ids[0])).toEqual([]);
  });
});
