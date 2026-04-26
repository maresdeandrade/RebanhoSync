import { buildEventGesture } from "@/lib/events/buildEventGesture";
import type { OperationInput, OrigemEnum, SexoEnum } from "@/lib/offline/types";
import type { AnimalBreedEnum } from "@/lib/animals/catalogs";
import type { FarmLifecycleConfig } from "@/lib/farms/lifecycleConfig";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import {
  buildAnimalLifecyclePayload,
  resolveAnimalLifecycleSnapshot,
} from "@/lib/animals/lifecycle";

export type FinancialTransactionNature = "compra" | "venda";
export type FinancialPriceMode = "por_animal" | "por_lote";
export type FinancialWeightMode = "nenhum" | "lote" | "individual";

export interface FinancialDraftAnimalInput {
  localId: string;
  identificacao?: string;
  sexo: SexoEnum;
  dataNascimento?: string | null;
  pesoKg?: number | null;
  raca?: AnimalBreedEnum | null;
}

export interface FinancialExistingAnimalInput {
  id: string;
  identificacao: string;
  loteId: string | null;
}

export interface BuildFinancialTransactionInput {
  fazendaId: string;
  natureza: FinancialTransactionNature;
  occurredAt: string;
  loteId: string | null;
  contraparteId?: string | null;
  sourceTaskId?: string | null;
  selectedAnimals?: FinancialExistingAnimalInput[];
  purchaseAnimals?: FinancialDraftAnimalInput[];
  priceMode: FinancialPriceMode;
  totalAmount?: number | null;
  unitAmount?: number | null;
  weightMode: FinancialWeightMode;
  lotWeightKg?: number | null;
  payload?: Record<string, unknown>;
  animalOrigin?: OrigemEnum;
  lifecycleConfig?: FarmLifecycleConfig;
}

export interface BuildFinancialTransactionResult {
  financialEventId: string;
  ops: OperationInput[];
  createdAnimalIds: string[];
}

function toDateKey(value: string) {
  return value.slice(0, 10);
}

function buildAutoIdentifier(prefix: string, dateKey: string, index: number) {
  return `${prefix}-${dateKey.replaceAll("-", "").slice(2)}-${String(index + 1).padStart(2, "0")}`;
}

function resolvePayloadKind(
  natureza: FinancialTransactionNature,
  quantity: number,
) {
  if (natureza === "compra") {
    return quantity > 1 ? "compra_animais" : "compra_animal";
  }

  return quantity > 1 ? "venda_animais" : "venda_animal";
}

export function resolveFinancialTotalAmount(input: {
  quantity: number;
  priceMode: FinancialPriceMode;
  totalAmount?: number | null;
  unitAmount?: number | null;
}) {
  if (input.priceMode === "por_animal") {
    return (input.unitAmount ?? 0) * input.quantity;
  }

  return input.totalAmount ?? 0;
}

export function buildFinancialTransaction(input: BuildFinancialTransactionInput): BuildFinancialTransactionResult {
  const selectedAnimals = input.selectedAnimals ?? [];
  const purchaseAnimals = input.purchaseAnimals ?? [];
  const generatedPurchaseAnimalIds =
    input.natureza === "compra"
      ? purchaseAnimals.map(() => crypto.randomUUID())
      : [];
  const quantity = selectedAnimals.length > 0 ? selectedAnimals.length : purchaseAnimals.length;
  const totalAmount = resolveFinancialTotalAmount({
    quantity,
    priceMode: input.priceMode,
    totalAmount: input.totalAmount,
    unitAmount: input.unitAmount,
  });
  const financialTargetAnimalId =
    input.natureza === "venda"
      ? quantity === 1
        ? selectedAnimals[0]?.id ?? null
        : null
      : quantity === 1 && selectedAnimals.length === 1
        ? selectedAnimals[0]?.id
        : null;

  const payload = {
    kind: resolvePayloadKind(input.natureza, quantity),
    origem: "registrar_manejo",
    quantidade_animais: quantity,
    modo_preco: input.priceMode,
    valor_unitario: input.priceMode === "por_animal" ? input.unitAmount ?? null : null,
    peso_modo: input.weightMode,
    peso_lote_kg: input.weightMode === "lote" ? input.lotWeightKg ?? null : null,
    animal_ids:
      input.natureza === "compra"
        ? generatedPurchaseAnimalIds
        : selectedAnimals.map((animal) => animal.id),
    animais_identificacao:
      input.natureza === "compra"
        ? purchaseAnimals.map((animal) => animal.identificacao?.trim()).filter(Boolean)
        : selectedAnimals.map((animal) => animal.identificacao),
    ...(input.payload ?? {}),
  };

  const financialEvent = buildEventGesture({
    dominio: "financeiro",
    fazendaId: input.fazendaId,
    occurredAt: input.occurredAt,
    sourceTaskId: input.sourceTaskId ?? null,
    animalId: financialTargetAnimalId,
    loteId: input.loteId,
    tipo: input.natureza,
    valorTotal: totalAmount,
    contraparteId: input.contraparteId ?? null,
    applyAnimalStateUpdate: false,
    payload,
  });

  const ops: OperationInput[] = [...financialEvent.ops];
  const createdAnimalIds: string[] = [];
  const dateKey = toDateKey(input.occurredAt);
  const lifecycleConfig =
    input.lifecycleConfig ?? DEFAULT_FARM_LIFECYCLE_CONFIG;

  if (input.natureza === "compra") {
    purchaseAnimals.forEach((draft, index) => {
      const animalId = generatedPurchaseAnimalIds[index] ?? crypto.randomUUID();
      createdAnimalIds.push(animalId);
      const basePayload = {
        source: "registrar_manejo_compra",
        purchase_event_id: financialEvent.eventId,
      };
      const lifecycleSnapshot = resolveAnimalLifecycleSnapshot(
        {
          sexo: draft.sexo,
          data_nascimento: draft.dataNascimento || null,
          payload: basePayload,
          papel_macho: null,
          habilitado_monta: false,
        },
        lifecycleConfig,
      );
      const payload = buildAnimalLifecyclePayload(
        basePayload,
        lifecycleSnapshot.targetStage,
        "manual",
        input.occurredAt,
      );
      ops.push({
        table: "animais",
        action: "INSERT",
        record: {
          id: animalId,
          identificacao:
            draft.identificacao?.trim() ||
            buildAutoIdentifier("CPR", dateKey, index),
          sexo: draft.sexo,
          status: "ativo",
          lote_id: input.loteId,
          data_nascimento: draft.dataNascimento || null,
          data_entrada: dateKey,
          data_saida: null,
          pai_id: null,
          mae_id: null,
          nome: null,
          rfid: null,
          origem: input.animalOrigin ?? "compra",
          raca: draft.raca ?? null,
          papel_macho: null,
          habilitado_monta: false,
          observacoes: null,
          payload,
          created_at: input.occurredAt,
          updated_at: input.occurredAt,
        },
      });

      const shouldCreateWeightEvent =
        (input.weightMode === "individual" && draft.pesoKg != null) ||
        (input.weightMode === "lote" &&
          purchaseAnimals.length === 1 &&
          input.lotWeightKg != null);

      if (!shouldCreateWeightEvent) {
        return;
      }

      const weightKg =
        input.weightMode === "individual"
          ? draft.pesoKg ?? null
          : input.lotWeightKg ?? null;

      if (weightKg == null) {
        return;
      }

      const weightEvent = buildEventGesture({
        dominio: "pesagem",
        fazendaId: input.fazendaId,
        occurredAt: input.occurredAt,
        animalId,
        loteId: input.loteId,
        pesoKg: weightKg,
        payload: {
          kind: "peso_entrada_compra",
          source_evento_id: financialEvent.eventId,
        },
      });
      ops.push(...weightEvent.ops);
    });
  }

  if (input.natureza === "venda") {
    selectedAnimals.forEach((animal) => {
      ops.push({
        table: "animais",
        action: "UPDATE",
        record: {
          id: animal.id,
          status: "vendido",
          data_saida: dateKey,
          lote_id: null,
        },
      });
    });
  }

  if (input.weightMode === "individual" && input.natureza === "venda") {
    selectedAnimals.forEach((animal, index) => {
      const draft = purchaseAnimals[index];
      if (!draft?.pesoKg) return;

      const weightEvent = buildEventGesture({
        dominio: "pesagem",
        fazendaId: input.fazendaId,
        occurredAt: input.occurredAt,
        animalId: animal.id,
        loteId: animal.loteId,
        pesoKg: draft.pesoKg,
        payload: {
          kind: "peso_saida_venda",
          source_evento_id: financialEvent.eventId,
        },
      });
      ops.push(...weightEvent.ops);
    });
  }

  return {
    financialEventId: financialEvent.eventId,
    ops,
    createdAnimalIds,
  };
}
