import type { Animal, OperationInput } from "@/lib/offline/types";
import type { FarmLifecycleConfig } from "@/lib/farms/lifecycleConfig";
import {
  buildAnimalRegistrationRecord,
  validateAnimalRegistrationDraft,
  type AnimalRegistrationDraft,
} from "@/lib/animals/registration";
import { calculateCommercialOperation } from "@/lib/comercial/commercialOperation";
import {
  calculateCommercialPricingLine,
  calculateEffectiveArrobaPrices,
  sumCommercialArrobas,
  sumCommercialPricingValues,
  sumCommercialWeights,
  type CommercialArrobaBasis,
  type CommercialPricingMode,
  type CommercialWeight,
  type CommercialWeightUnit,
} from "@/lib/comercial/commercialPricing";
import { buildEventGesture } from "@/lib/events/buildEventGesture";

export const COMMERCIAL_OPERATION_MAX_ANIMALS = 500;
export const COMMERCIAL_OPERATION_MAX_PAYLOAD_BYTES = 1024 * 1024;

export interface CommercialNewAnimalDraft extends AnimalRegistrationDraft {
  localId: string;
  commercialWeight?: number | null;
  valorIndividual?: number | null;
}

export interface CommercialOperationPricingInput {
  pricingMode: CommercialPricingMode;
  weightUnit: CommercialWeightUnit;
  pricePerArroba?: number | null;
  arrobaBasis?: CommercialArrobaBasis | null;
  carcassYieldPercent?: number | null;
  lines: Record<
    string,
    {
      pricePerHead?: number | null;
      commercialWeight: CommercialWeight<number | null>;
    }
  >;
}

export interface CommercialOperationCommandInput {
  fazendaId: string;
  operationType: "compra" | "venda";
  scope: "animal" | "lote";
  occurredAt: string;
  declaredQuantity: number;
  loteId: string | null;
  loteFarmId?: string | null;
  selectedAnimalIds: string[];
  animals: Animal[];
  currentLotAnimalIds?: string[];
  newAnimals: CommercialNewAnimalDraft[];
  existingIdentifications?: string[];
  pesoVivoTotal?: number | null;
  valorBruto?: number | null;
  frete?: number | null;
  comissao?: number | null;
  descontos?: number | null;
  taxasImpostos?: number | null;
  bonificacoes?: number | null;
  contraparteId?: string | null;
  contraparteNome?: string | null;
  financeTransactionId?: string | null;
  observacoes?: string | null;
  lifecycleConfig: FarmLifecycleConfig;
  operationId?: string;
  pricing?: CommercialOperationPricingInput | null;
}

export interface CommercialPricingSnapshotLine {
  pricing_mode: CommercialPricingMode;
  commercial_weight: number | null;
  commercial_weight_unit: CommercialWeightUnit;
  weight_source: "direct" | "calculated";
  weight_considered_kg: number | null;
  arrobas: number | null;
  arroba_basis: CommercialArrobaBasis | null;
  carcass_yield_percent: number | null;
}

export function validateCommercialPricingSnapshotLine(
  operationWeightUnit: CommercialWeightUnit,
  line: CommercialPricingSnapshotLine,
): string | null {
  if (line.commercial_weight_unit !== operationWeightUnit) {
    return "A unidade da linha diverge da unidade comercial da operação.";
  }
  if (line.commercial_weight_unit !== "arroba") return null;
  if (line.weight_source !== "direct") {
    return "Arroba informada diretamente deve registrar origem direct.";
  }
  if (line.weight_considered_kg !== null) {
    return "Arroba informada diretamente não pode registrar kg considerado.";
  }
  if (line.arroba_basis !== null || line.carcass_yield_percent !== null) {
    return "Arroba informada diretamente não pode fabricar base ou rendimento.";
  }
  if (
    line.pricing_mode !== "per_head" &&
    (line.commercial_weight === null ||
      line.arrobas === null ||
      Math.round(line.commercial_weight * 1_000_000) !==
        Math.round(line.arrobas * 1_000_000))
  ) {
    return "Peso comercial direto em arrobas deve ser igual às arrobas faturadas.";
  }
  return null;
}

function canonicalIds(ids: readonly string[]) {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

function payloadBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function buildPricingCalculations(input: CommercialOperationCommandInput) {
  if (!input.pricing) return null;
  const lineRefs =
    input.operationType === "compra"
      ? input.newAnimals.map((item) => item.localId)
      : input.selectedAnimalIds;
  if (
    Object.keys(input.pricing.lines).length !== lineRefs.length ||
    lineRefs.some((lineRef) => !(lineRef in input.pricing!.lines))
  ) {
    throw new Error(
      "A precificação deve conter exatamente uma linha por animal.",
    );
  }
  if (
    input.pricing.pricingMode !== "per_arroba" &&
    input.pricing.pricePerArroba != null
  ) {
    throw new Error(
      "A precificação por cabeça contém preço residual por arroba.",
    );
  }
  if (
    input.pricing.weightUnit !== "arroba" &&
    input.pricing.arrobaBasis === "live_weight_yield" &&
    (input.pricing.carcassYieldPercent == null ||
      input.pricing.carcassYieldPercent <= 0 ||
      input.pricing.carcassYieldPercent > 100)
  ) {
    throw new Error(
      "Informe rendimento de carcaça entre 0 e 100% para converter arrobas.",
    );
  }
  if (
    input.pricing.pricingMode === "per_arroba" &&
    input.pricing.arrobaBasis === "carcass_weight" &&
    input.pricing.carcassYieldPercent != null
  ) {
    throw new Error(
      "Peso de carcaça conhecido não pode manter rendimento residual.",
    );
  }
  const calculations = lineRefs.map((lineRef) => {
    const line = input.pricing!.lines[lineRef]!;
    if (line.commercialWeight.unit !== input.pricing!.weightUnit) {
      throw new Error("A unidade do peso comercial diverge da operação.");
    }
    if (
      input.pricing!.pricingMode === "per_arroba" &&
      line.pricePerHead != null
    ) {
      throw new Error(
        "A precificação por arroba contém valor residual por cabeça.",
      );
    }
    const calculation = calculateCommercialPricingLine({
      pricingMode: input.pricing!.pricingMode,
      commercialWeight: line.commercialWeight,
      pricePerHead: line.pricePerHead,
      pricePerArroba: input.pricing!.pricePerArroba,
      arrobaBasis: input.pricing!.arrobaBasis,
      carcassYieldPercent: input.pricing!.carcassYieldPercent,
    });
    if (calculation.issue) throw new Error(calculation.issue);
    return { lineRef, line, calculation };
  });
  const gross = sumCommercialPricingValues(
    calculations.map((item) => item.calculation),
  );
  if (
    !gross ||
    input.valorBruto == null ||
    Math.round(input.valorBruto * 100) !== Math.round(gross.value * 100)
  ) {
    throw new Error(
      "O valor bruto deve corresponder à soma exata dos animais.",
    );
  }
  return calculations;
}

export function validateCommercialOperationCommand(
  input: CommercialOperationCommandInput,
): string | null {
  const occurredAt = new Date(input.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) return "Data da operação inválida.";
  if (input.declaredQuantity < 1 || !Number.isInteger(input.declaredQuantity)) {
    return "Quantidade de animais inválida.";
  }
  if (input.declaredQuantity > COMMERCIAL_OPERATION_MAX_ANIMALS) {
    return `O limite por operação comercial é ${COMMERCIAL_OPERATION_MAX_ANIMALS} animais.`;
  }
  if (
    input.loteId &&
    input.loteFarmId &&
    input.loteFarmId !== input.fazendaId
  ) {
    return "Lote de outra fazenda não pode ser usado.";
  }
  if (input.scope === "lote" && !input.loteId) return "Selecione um lote.";

  if (input.operationType === "compra") {
    if (input.selectedAnimalIds.length > 0) {
      return "Compra cria novos animais e não usa animais previamente cadastrados.";
    }
    if (input.scope === "animal" && input.newAnimals.length !== 1) {
      return "Compra individual exige exatamente um novo animal.";
    }
    if (input.scope === "lote" && input.newAnimals.length < 2) {
      return "Compra por lote exige ao menos dois novos animais.";
    }
    if (input.newAnimals.length !== input.declaredQuantity) {
      return "A quantidade declarada deve corresponder às linhas válidas da compra.";
    }
    const localIds = canonicalIds(input.newAnimals.map((item) => item.localId));
    if (localIds.length !== input.newAnimals.length)
      return "Há animais duplicados na grade.";
    const normalized = input.newAnimals.map((item) =>
      item.identificacao.trim().toLocaleLowerCase(),
    );
    if (
      normalized.some((item) => !item) ||
      new Set(normalized).size !== normalized.length
    ) {
      return "Informe identificações únicas para todos os novos animais.";
    }
    const existing = new Set(
      (input.existingIdentifications ?? []).map((item) =>
        item.trim().toLocaleLowerCase(),
      ),
    );
    if (normalized.some((item) => existing.has(item)))
      return "Já existe animal com uma das identificações informadas.";
    for (const draft of input.newAnimals) {
      const issue = validateAnimalRegistrationDraft(draft);
      if (issue) return issue;
      if (draft.valorIndividual != null && draft.valorIndividual < 0)
        return "Valor individual não pode ser negativo.";
      if (draft.commercialWeight != null && draft.commercialWeight < 0)
        return "Peso individual não pode ser negativo.";
    }
  } else {
    if (input.newAnimals.length > 0) return "Venda não pode criar animais.";
    const ids = canonicalIds(input.selectedAnimalIds);
    if (ids.length !== input.selectedAnimalIds.length)
      return "Não repita animais na venda.";
    if (ids.length !== input.declaredQuantity)
      return "A quantidade declarada diverge do snapshot da venda.";
    if (input.scope === "animal" && ids.length !== 1)
      return "Venda individual exige exatamente um animal.";
    const animals = new Map(input.animals.map((animal) => [animal.id, animal]));
    if (input.scope === "lote") {
      const frozen = canonicalIds(ids);
      const current = canonicalIds(input.currentLotAnimalIds ?? []);
      if (JSON.stringify(frozen) !== JSON.stringify(current)) {
        return "A composição do lote mudou. Atualize a seleção antes de confirmar.";
      }
    }
    for (const id of ids) {
      const animal = animals.get(id);
      if (!animal) return "Animal inexistente no snapshot da venda.";
      if (animal.fazenda_id !== input.fazendaId)
        return "Animal de outra fazenda não pode ser vendido.";
      if (animal.status !== "ativo" || animal.deleted_at)
        return `O animal ${animal.identificacao} não está ativo.`;
      if (input.scope === "lote" && animal.lote_id !== input.loteId)
        return "A composição do lote mudou. Atualize a seleção antes de confirmar.";
    }
  }
  try {
    buildPricingCalculations(input);
  } catch (error) {
    return error instanceof Error ? error.message : "Precificação inválida.";
  }
  return null;
}

export function buildCommercialOperationGesture(
  input: CommercialOperationCommandInput,
): {
  operationId: string;
  eventId: string;
  animalIds: string[];
  ops: OperationInput[];
} {
  const issue = validateCommercialOperationCommand(input);
  if (issue) throw new Error(issue);
  const operationId = input.operationId ?? crypto.randomUUID();
  const newAnimalRecords =
    input.operationType === "compra"
      ? input.newAnimals.map((draft) =>
          buildAnimalRegistrationRecord({
            fazendaId: input.fazendaId,
            draft: { ...draft, loteId: input.loteId ?? draft.loteId ?? null },
            origem: "compra",
            lifecycleConfig: input.lifecycleConfig,
            recordedAt: input.occurredAt,
          }),
        )
      : [];
  const animalIds = canonicalIds(
    input.operationType === "compra"
      ? newAnimalRecords.map((animal) => animal.id)
      : input.selectedAnimalIds,
  );
  const pricingCalculations = buildPricingCalculations(input);
  const resolvedAnimalIdByLineRef = new Map(
    input.operationType === "compra"
      ? input.newAnimals.map((item, index) => [
          item.localId,
          newAnimalRecords[index]!.id,
        ])
      : input.selectedAnimalIds.map((id) => [id, id]),
  );
  const pricingLines = pricingCalculations
    ?.map((item) => ({
      animal_id: resolvedAnimalIdByLineRef.get(item.lineRef)!,
      pricing_mode: input.pricing!.pricingMode,
      price_per_head:
        input.pricing!.pricingMode === "per_head"
          ? item.calculation.individualGrossValue
          : null,
      allocated_gross_value:
        input.pricing!.pricingMode === "total_value"
          ? item.calculation.individualGrossValue
          : null,
      price_per_arroba:
        input.pricing!.pricingMode === "per_arroba"
          ? (input.pricing!.pricePerArroba ?? null)
          : null,
      arroba_basis: input.pricing!.arrobaBasis ?? null,
      carcass_yield_percent: input.pricing!.carcassYieldPercent ?? null,
      commercial_weight: item.calculation.commercialWeight?.amount ?? null,
      commercial_weight_unit:
        item.calculation.commercialWeight?.unit ?? input.pricing!.weightUnit,
      weight_source: item.calculation.weightSource,
      weight_considered_kg: item.calculation.weightConsideredKg,
      arrobas: item.calculation.arrobas,
      individual_gross_value: item.calculation.individualGrossValue,
    }))
    .sort((a, b) => a.animal_id.localeCompare(b.animal_id));
  for (const line of pricingLines ?? []) {
    const snapshotIssue = validateCommercialPricingSnapshotLine(
      input.pricing!.weightUnit,
      line,
    );
    if (snapshotIssue) throw new Error(snapshotIssue);
  }
  const commercialWeightTotal = pricingCalculations
    ? sumCommercialWeights(
        pricingCalculations.map((item) => ({
          unit: input.pricing!.weightUnit!,
          amount: item.calculation.commercialWeight?.amount ?? null,
        })) as CommercialWeight<number | null>[],
      )
    : null;
  const valueByAnimal = Object.fromEntries(
    pricingLines
      ? pricingLines.map((line) => [
          line.animal_id,
          line.individual_gross_value,
        ])
      : input.newAnimals
          .filter((item) => item.valorIndividual != null)
          .map((item, index) => [
            newAnimalRecords[index]!.id,
            item.valorIndividual!,
          ]),
  );
  const animalSnapshot =
    input.operationType === "compra"
      ? newAnimalRecords.map((animal, index) => ({
          id: animal.id,
          identificacao: animal.identificacao,
          lote_id: animal.lote_id,
          // Peso comercial não é uma pesagem zootécnica do cadastro.
          peso_kg: null,
          weight_considered_kg:
            pricingCalculations?.[index]?.calculation.weightConsideredKg ??
            null,
          valor_individual:
            pricingCalculations?.[index]?.calculation.individualGrossValue ??
            input.newAnimals[index]?.valorIndividual ??
            null,
        }))
      : animalIds.map((id) => {
          const animal = input.animals.find((item) => item.id === id)!;
          return {
            id,
            identificacao: animal.identificacao,
            status: animal.status,
            lote_id: animal.lote_id,
          };
        });
  const summary = calculateCommercialOperation({
    operationType: input.operationType,
    scope: input.scope,
    occurredAt: input.occurredAt,
    quantidadeAnimais: animalIds.length,
    pesoVivoTotal: input.pesoVivoTotal ?? undefined,
    valorBruto: input.valorBruto ?? undefined,
    frete: input.frete ?? undefined,
    comissao: input.comissao ?? undefined,
    descontos: input.descontos ?? undefined,
    taxasImpostos: input.taxasImpostos ?? undefined,
    bonificacoes: input.bonificacoes ?? undefined,
    contraparteId: input.contraparteId ?? undefined,
    contraparteNome: input.contraparteNome ?? undefined,
    animalIds,
    loteId: input.loteId ?? undefined,
    financeTransactionId: input.financeTransactionId ?? undefined,
    observacoes: input.observacoes ?? undefined,
  });
  if (summary.calculationStatus === "blocked")
    throw new Error(
      summary.issues[0]?.message ?? "Operação comercial inválida.",
    );
  const totalArrobas = pricingCalculations
    ? sumCommercialArrobas(pricingCalculations.map((item) => item.calculation))
    : null;
  const effectiveArrobaPrices = totalArrobas
    ? calculateEffectiveArrobaPrices({
        totalArrobas: totalArrobas.value,
        grossValue: input.valorBruto,
        netValue: summary.valorLiquidoDerivado,
      })
    : null;
  const built = buildEventGesture({
    dominio: "comercial",
    fazendaId: input.fazendaId,
    eventId: operationId,
    occurredAt: input.occurredAt,
    animalId:
      input.scope === "animal" && animalIds.length === 1 ? animalIds[0] : null,
    loteId: input.loteId,
    operationType: input.operationType,
    scope: input.scope,
    quantidadeAnimais: animalIds.length,
    pesoVivoTotal: input.pesoVivoTotal,
    pesoMedioDerivado: summary.pesoMedioDerivado,
    valorBruto: input.valorBruto,
    frete: input.frete,
    comissao: input.comissao,
    descontos: input.descontos,
    taxasImpostos: input.taxasImpostos,
    valorLiquidoDerivado: summary.valorLiquidoDerivado,
    contraparteId: input.contraparteId,
    contraparteNome: input.contraparteNome,
    animalIds,
    financeTransactionId: input.financeTransactionId,
    snapshot: {
      ...summary.snapshot,
      contract_version: 2,
      domain_op_id: operationId,
      animals: animalSnapshot,
      lot_snapshot: input.loteId
        ? { id: input.loteId, animal_ids: animalIds }
        : null,
      valor_por_animal: valueByAnimal,
      pricing: input.pricing
        ? {
            contract_version: 2,
            pricing_mode: input.pricing.pricingMode,
            weight_unit: input.pricing.weightUnit ?? "kg",
            commercial_weight_total:
              commercialWeightTotal?.amount === ""
                ? null
                : Number(commercialWeightTotal?.amount),
            price_per_arroba:
              input.pricing.pricingMode === "per_arroba"
                ? (input.pricing.pricePerArroba ?? null)
                : null,
            arroba_basis: input.pricing.arrobaBasis ?? null,
            carcass_yield_percent: input.pricing.carcassYieldPercent ?? null,
            total_arrobas: totalArrobas?.value ?? null,
            effective_price_per_arroba_gross:
              effectiveArrobaPrices?.gross?.value ?? null,
            effective_price_per_arroba_net:
              effectiveArrobaPrices?.net?.value ?? null,
            lines: pricingLines,
          }
        : null,
    },
    calculationStatus: summary.calculationStatus,
    issues: summary.issues.map((issue) => ({ ...issue } as Record<string, unknown>)),
    limitations: summary.limitations,
    observacoes: input.observacoes,
    payload: { kind: "commercial_operation_v2", domain_op_id: operationId },
  });
  const eventOps = built.ops.filter((op) => op.table !== "animais");
  const stateOps: OperationInput[] =
    input.operationType === "compra"
      ? newAnimalRecords.map((record) => ({
          table: "animais",
          action: "INSERT",
          record,
        }))
      : animalIds.map((id) => ({
          table: "animais",
          action: "UPDATE",
          record: {
            id,
            status: "vendido",
            data_saida: input.occurredAt.slice(0, 10),
            lote_id: null,
          },
        }));
  const ops = [...stateOps, ...eventOps];
  if (
    payloadBytes({ operationId, animalIds, ops }) >
    COMMERCIAL_OPERATION_MAX_PAYLOAD_BYTES
  ) {
    throw new Error(
      "A operação comercial excede o limite de payload de 1 MiB.",
    );
  }
  return { operationId, eventId: built.eventId, animalIds, ops };
}
