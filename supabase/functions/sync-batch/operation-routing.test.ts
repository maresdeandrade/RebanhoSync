import { describe, expect, it } from "vitest";
import { isGenericSanitaryInventoryMovement, isLegacyOperation } from "./operation-routing";

type RoutedOperation = Parameters<typeof isLegacyOperation>[0];
const inventory = { table: "insumo_movimentacoes", action: "INSERT", record: { tipo: "consumo_sanitario" } };

describe("batch operation routing", () => {
  it.each(["movement_v1", "obito_agenda_v1", "sanitario_v2", "commercial_purchase_v1", "commercial_operation_v2"])(
    "keeps recognized %s out of generic paths even with inventory-shaped fields", (domain) => {
      const op = { ...inventory, domain } as RoutedOperation;
      expect(isLegacyOperation(op)).toBe(false);
      expect(isGenericSanitaryInventoryMovement(op)).toBe(false);
    },
  );

  it.each([
    [inventory, true],
    [{ ...inventory, action: "UPDATE" }, false],
    [{ ...inventory, record: { tipo: "entrada" } }, false],
    [{ table: "animais", action: "UPDATE", record: {} }, false],
  ])("preserves ordinary mutation and stock routing for %j", (value, stock) => {
    expect(isLegacyOperation(value as RoutedOperation)).toBe(true);
    expect(isGenericSanitaryInventoryMovement(value as RoutedOperation)).toBe(stock);
  });
});
