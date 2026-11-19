import { describe, expect, it } from "vitest";
import { buildSanitaryAgendaForecastV2, buildSanitaryPlanRealizedIndicatorsV2 } from "../sanitaryAgendaForecastV2";

const supply = (id: string, product: string) => ({ id, fazenda_id: "farm-1", nome: "Produto", tipo: "sanitario" as const, categoria: null, produto_veterinario_id: null, sanitario_produto_v2_id: product, unidade_base: "ml" as const, ativo: true, payload: {}, client_id: "c", client_op_id: "o", client_tx_id: null, client_recorded_at: "2026-01-01", server_received_at: "2026-01-01", created_at: "2026-01-01", updated_at: "2026-01-01", deleted_at: null });
const lot = (id: string, supplyId: string, balance: number) => ({ id, fazenda_id: "farm-1", insumo_id: supplyId, apresentacao_id: null, identificacao_lote: null, validade: null, fabricante: null, local_armazenamento: null, quantidade_inicial_base: balance, saldo_atual_base: balance, unidade_base: "ml" as const, status: "ativo" as const, payload: {}, client_id: "c", client_op_id: "o", client_tx_id: null, client_recorded_at: "2026-01-01", server_received_at: "2026-01-01", created_at: "2026-01-01", updated_at: "2026-01-01", deleted_at: null });

describe("sanitary agenda forecast v2", () => {
  it("calcula demanda e identifica estoque suficiente", () => {
    expect(buildSanitaryAgendaForecastV2({ fazendaId: "farm-1", asOf: "2026-01-01", item: { animalCount: 10, plannedProductId: "p1", suggestedDose: 2, suggestedDoseUnit: "ml", suggestedDoseBasis: "animal", suggestedDoseProductId: "p1" }, stock: { complete: true, supplies: [supply("s1", "p1")], lots: [lot("l1", "s1", 25)] } })).toMatchObject({ status: "stock_sufficient", estimatedQuantity: 20, compatibleStock: 25, deficit: 0 });
  });
  it("não inventa quantidade quando a dose não existe", () => {
    expect(buildSanitaryAgendaForecastV2({ fazendaId: "farm-1", asOf: "2026-01-01", item: { animalCount: 10, plannedProductId: "p1", suggestedDose: null, suggestedDoseUnit: null } }).status).toBe("insufficient_data");
  });
  it("sinaliza déficit sem bloquear o planejamento", () => {
    expect(buildSanitaryAgendaForecastV2({ fazendaId: "farm-1", asOf: "2026-01-01", item: { animalCount: 10, plannedProductId: "p1", suggestedDose: 2, suggestedDoseUnit: "ml", suggestedDoseBasis: "animal", suggestedDoseProductId: "p1" }, stock: { complete: true, supplies: [supply("s1", "p1")], lots: [lot("l1", "s1", 5)] } })).toMatchObject({ status: "stock_insufficient", deficit: 15 });
  });
  it("não interpreta ausência de baixa como consumo zero", () => {
    expect(buildSanitaryPlanRealizedIndicatorsV2({ fazendaId: "farm-1", eventIds: ["e1"], plannedAnimals: 1, executedAnimalIds: ["a1"], estimatedQuantity: 2, appliedQuantities: [{ quantity: 2, unit: "ml" }], movements: [], comparableUnit: "ml" })).toMatchObject({ consumedQuantity: null, lossQuantity: null, comparisonStatus: "incomplete_data" });
  });
  it("diferencia estoque desconhecido de estoque vazio e isola fazenda", () => {
    const item = { animalCount: 10, plannedProductId: "p1", suggestedDose: 2, suggestedDoseUnit: "ml", suggestedDoseBasis: "animal", suggestedDoseProductId: "p1" } as const;
    expect(buildSanitaryAgendaForecastV2({ fazendaId: "farm-1", asOf: "2026-01-01", item }).status).toBe("stock_unknown");
    expect(buildSanitaryAgendaForecastV2({ fazendaId: "farm-1", asOf: "2026-01-01", item, stock: { complete: true, supplies: [supply("s1", "p1")], lots: [] } })).toMatchObject({ status: "stock_insufficient", compatibleStock: 0, deficit: 20 });
    expect(buildSanitaryAgendaForecastV2({ fazendaId: "farm-1", asOf: "2026-01-01", item, stock: { complete: true, supplies: [{ ...supply("s1", "p1"), fazenda_id: "farm-2" }], lots: [lot("l1", "s1", 50)] } })).toMatchObject({ status: "stock_insufficient", compatibleStock: 0 });
  });
  it("separa cobertura e consumo baixado", () => {
    expect(buildSanitaryPlanRealizedIndicatorsV2({ fazendaId: "farm-1", eventIds: ["e1"], plannedAnimals: 4, executedAnimalIds: ["a1", "a2"], estimatedQuantity: 8, appliedQuantities: [{ quantity: 4, unit: "ml" }], movements: [{ id: "m1", fazenda_id: "farm-1", source_evento_id: "e1", quantidade_base: 5, unidade_base: "ml", tipo: "consumo_sanitario", deleted_at: null }], comparableUnit: "ml" })).toMatchObject({ executedAnimals: 2, remainingAnimals: 2, remainingEstimatedQuantity: 4, coverageRatio: 0.5, appliedQuantity: 4, consumedQuantity: 5, variance: null, comparable: false, comparisonStatus: "partial_execution" });
  });
  it("não interpreta ausência de baixa como consumo zero", () => {
    expect(buildSanitaryPlanRealizedIndicatorsV2({ fazendaId: "farm-1", eventIds: ["e1"], plannedAnimals: 1, executedAnimalIds: ["a1"], estimatedQuantity: 2, appliedQuantities: [{ quantity: 2, unit: "ml" }], movements: [], comparableUnit: "ml" })).toMatchObject({ consumedQuantity: null, lossQuantity: null, comparable: false, comparisonStatus: "incomplete_data" });
  });
});

describe("sanitary plan realized movement classification", () => {
  type Input = Parameters<typeof buildSanitaryPlanRealizedIndicatorsV2>[0];
  type Movement = Input["movements"][number];
  const consumption: Movement = { id: "consumption-1", fazenda_id: "farm-1", source_evento_id: "e1", quantidade_base: 10, unidade_base: "ml", tipo: "consumo_sanitario", deleted_at: null };
  const loss: Movement = { ...consumption, id: "loss-1", quantidade_base: 3, tipo: "perda" };
  const input = (movements: Movement[]): Input => ({
    fazendaId: "farm-1",
    eventIds: ["e1"],
    plannedAnimals: 1,
    executedAnimalIds: ["a1"],
    estimatedQuantity: 8,
    appliedQuantities: [{ quantity: 8, unit: "ml" }],
    movements,
    comparableUnit: "ml",
  });

  it("contabiliza perda do mesmo Evento sem somá-la à aplicação ou ao consumo", () => {
    const source = input([consumption, loss]);
    const original = structuredClone(source);

    expect(buildSanitaryPlanRealizedIndicatorsV2(source)).toMatchObject({
      appliedQuantity: 8,
      consumedQuantity: 10,
      lossQuantity: 3,
      variance: 2,
      comparable: true,
      comparisonStatus: "comparable",
    });
    expect(source).toEqual(original);
  });

  it.each([
    { name: "consumo sem perdas", movements: [consumption], consumed: 10, lost: null },
    { name: "perda sem consumo", movements: [loss], consumed: null, lost: 3 },
    { name: "consumo duplicado", movements: [consumption, { ...consumption }], consumed: 10, lost: null },
    { name: "perda duplicada", movements: [loss, { ...loss }], consumed: null, lost: 3 },
    { name: "duplicatas intercaladas", movements: [loss, consumption, { ...loss }, { ...consumption }], consumed: 10, lost: 3 },
  ])("preserva totais em $name", ({ movements, consumed, lost }) => {
    expect(buildSanitaryPlanRealizedIndicatorsV2(input(movements))).toMatchObject({
      consumedQuantity: consumed,
      lossQuantity: lost,
      appliedQuantity: 8,
    });
  });

  it.each([
    { name: "outra fazenda", patch: { fazenda_id: "farm-2" } },
    { name: "outro Evento", patch: { source_evento_id: "e2" } },
    { name: "sem vínculo factual", patch: { source_evento_id: null } },
    { name: "movimento excluído", patch: { deleted_at: "2026-01-02" } },
    { name: "unidade incompatível", patch: { unidade_base: "kg" as const } },
    { name: "quantidade negativa", patch: { quantidade_base: -3 } },
    { name: "quantidade não finita", patch: { quantidade_base: Number.NaN } },
  ])("exclui consumo e perda com $name", ({ patch }) => {
    const invalidConsumption = { ...consumption, ...patch };
    const invalidLoss = { ...loss, ...patch };
    expect(buildSanitaryPlanRealizedIndicatorsV2(input([invalidConsumption, invalidLoss]))).toMatchObject({
      consumedQuantity: null,
      lossQuantity: null,
    });
  });

  it("mantém perdas desconhecidas quando não há unidade comparável", () => {
    expect(buildSanitaryPlanRealizedIndicatorsV2({ ...input([consumption, loss]), comparableUnit: null })).toMatchObject({
      appliedQuantity: null,
      consumedQuantity: null,
      lossQuantity: null,
      comparable: false,
      comparisonStatus: "incomplete_data",
    });
  });
});
