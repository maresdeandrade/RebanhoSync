import type { Animal, OperationInput } from "@/lib/offline/types";
import type { FarmLifecycleConfig } from "@/lib/farms/lifecycleConfig";
import {
  buildAnimalRegistrationRecord,
  validateAnimalRegistrationDraft,
  type AnimalRegistrationDraft,
} from "@/lib/animals/registration";
import { calculateCommercialOperation } from "@/lib/comercial/commercialOperation";
import { buildEventGesture } from "@/lib/events/buildEventGesture";

export const COMMERCIAL_OPERATION_MAX_ANIMALS = 500;
export const COMMERCIAL_OPERATION_MAX_PAYLOAD_BYTES = 1024 * 1024;

export interface CommercialNewAnimalDraft extends AnimalRegistrationDraft {
  localId: string;
  pesoKg?: number | null;
  valorIndividual?: number | null;
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
  contraparteId?: string | null;
  contraparteNome?: string | null;
  financeTransactionId?: string | null;
  observacoes?: string | null;
  lifecycleConfig: FarmLifecycleConfig;
  operationId?: string;
}

function canonicalIds(ids: readonly string[]) {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

function payloadBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
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
      if (draft.pesoKg != null && draft.pesoKg < 0)
        return "Peso individual não pode ser negativo.";
    }
  } else {
    if (input.newAnimals.length > 0) return "Venda não pode criar animais.";
    const ids = canonicalIds(input.selectedAnimalIds);
    if (ids.length !== input.selectedAnimalIds.length)
      return "Não repita animais na venda.";
    if (ids.length !== input.declaredQuantity)
      return "A quantidade declarada diverge do snapshot da venda.";
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
          }),
        )
      : [];
  const animalIds = canonicalIds(
    input.operationType === "compra"
      ? newAnimalRecords.map((animal) => animal.id)
      : input.selectedAnimalIds,
  );
  const valueByAnimal = Object.fromEntries(
    input.newAnimals
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
          peso_kg: input.newAnimals[index]?.pesoKg ?? null,
          valor_individual: input.newAnimals[index]?.valorIndividual ?? null,
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
    },
    calculationStatus: summary.calculationStatus,
    issues: summary.issues,
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
