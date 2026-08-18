import { describe, expect, it } from "vitest";
import { buildCommercialPurchaseEnvelope } from "../animalPurchaseSync";
import type { Operation } from "@/lib/offline/types";

const farm = "10000000-0000-4000-8000-000000000001";
const tx = "20000000-0000-4000-8000-000000000001";
const animalId = "30000000-0000-4000-8000-000000000001";
const eventId = "40000000-0000-4000-8000-000000000001";

function legacyOps(): Operation[] {
  const records = [
    [
      "animais",
      { id: animalId, fazenda_id: farm, origem: "compra", status: "ativo" },
    ],
    [
      "eventos",
      {
        id: eventId,
        fazenda_id: farm,
        dominio: "comercial",
        animal_id: animalId,
        occurred_at: "2026-08-08T12:00:00.000Z",
      },
    ],
    [
      "eventos_comercial",
      {
        evento_id: eventId,
        fazenda_id: farm,
        operation_type: "compra",
        scope: "animal",
        occurred_at: "2026-08-08T12:00:00.000Z",
        animal_ids: [animalId],
        finance_transaction_id: null,
      },
    ],
  ] as const;
  return records.map(([table, record], index) => ({
    client_op_id: `${index + 1}0000000-0000-4000-8000-000000000001`,
    client_tx_id: tx,
    op_order: index,
    table,
    action: "INSERT",
    record,
    created_at: "2026-08-08T12:00:00.000Z",
  }));
}

describe("commercial purchase queue compatibility", () => {
  it("migrates a complete coherent legacy trio to one compound command", () => {
    const envelope = buildCommercialPurchaseEnvelope(legacyOps(), farm);
    expect(envelope).toMatchObject({
      domain: "commercial_purchase_v1",
      command: "apply_individual_purchase",
      client_op_id: legacyOps()[0].client_op_id,
      animal: { id: animalId },
      event: { id: eventId, animal_id: animalId },
      detail: { evento_id: eventId, animal_ids: [animalId] },
    });
  });

  it("fails closed for an incomplete legacy purchase", () => {
    expect(() =>
      buildCommercialPurchaseEnvelope(legacyOps().slice(0, 2), farm),
    ).toThrow("COMMERCIAL_PURCHASE_LEGACY_INCOMPLETE");
  });

  it("fails closed for divergent identity or cross-farm content", () => {
    const inconsistent = legacyOps();
    inconsistent[2].record.animal_ids = ["another-animal"];
    expect(() => buildCommercialPurchaseEnvelope(inconsistent, farm)).toThrow(
      "COMMERCIAL_PURCHASE_LEGACY_CONTENT_INVALID",
    );

    const crossFarm = legacyOps();
    crossFarm[1].record.fazenda_id = "another-farm";
    expect(() => buildCommercialPurchaseEnvelope(crossFarm, farm)).toThrow(
      "COMMERCIAL_PURCHASE_LEGACY_CONTENT_INVALID",
    );
  });

  it("fails closed when the legacy trio loses lote or occurred_at consistency", () => {
    const divergentLote = legacyOps();
    divergentLote[0].record.lote_id = "lote-a";
    divergentLote[1].record.lote_id = "lote-a";
    divergentLote[2].record.lote_id = "lote-b";
    expect(() => buildCommercialPurchaseEnvelope(divergentLote, farm)).toThrow(
      "COMMERCIAL_PURCHASE_LEGACY_CONTENT_INVALID",
    );

    const divergentTime = legacyOps();
    divergentTime[1].record.occurred_at = "2026-08-08T12:00:00.000Z";
    divergentTime[2].record.occurred_at = "2026-08-08T13:00:00.000Z";
    expect(() => buildCommercialPurchaseEnvelope(divergentTime, farm)).toThrow(
      "COMMERCIAL_PURCHASE_LEGACY_CONTENT_INVALID",
    );
  });
});
