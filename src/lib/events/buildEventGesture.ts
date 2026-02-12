import type { OperationInput } from "@/lib/offline/types";
import type { EventGestureBuildResult, EventInput } from "./types";
import { assertValidEventInput } from "./validators";

const toIsoDate = (value: string): string => {
  return value.split("T")[0];
};

const buildBaseEventOp = (
  input: EventInput,
  eventId: string,
  occurredAt: string,
): OperationInput => {
  return {
    table: "eventos",
    action: "INSERT",
    record: {
      id: eventId,
      dominio: input.dominio,
      occurred_at: occurredAt,
      animal_id: input.animalId ?? null,
      lote_id: input.loteId ?? null,
      source_task_id: input.sourceTaskId ?? null,
      corrige_evento_id: input.corrigeEventoId ?? null,
      observacoes: input.observacoes ?? null,
      payload: input.payload ?? {},
    },
  };
};

export const buildEventGesture = (input: EventInput): EventGestureBuildResult => {
  assertValidEventInput(input);

  const eventId = crypto.randomUUID();
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const ops: OperationInput[] = [buildBaseEventOp(input, eventId, occurredAt)];

  if (input.dominio === "sanitario") {
    ops.push({
      table: "eventos_sanitario",
      action: "INSERT",
      record: {
        evento_id: eventId,
        tipo: input.tipo,
        produto: input.produto.trim(),
        payload: {},
      },
    });
  } else if (input.dominio === "pesagem") {
    ops.push({
      table: "eventos_pesagem",
      action: "INSERT",
      record: {
        evento_id: eventId,
        peso_kg: input.pesoKg,
        payload: {},
      },
    });
  } else if (input.dominio === "movimentacao") {
    ops.push({
      table: "eventos_movimentacao",
      action: "INSERT",
      record: {
        evento_id: eventId,
        from_lote_id: input.fromLoteId ?? null,
        to_lote_id: input.toLoteId ?? null,
        from_pasto_id: input.fromPastoId ?? null,
        to_pasto_id: input.toPastoId ?? null,
        payload: {},
      },
    });

    if (
      input.applyAnimalStateUpdate !== false &&
      input.animalId &&
      input.toLoteId !== undefined
    ) {
      ops.push({
        table: "animais",
        action: "UPDATE",
        record: {
          id: input.animalId,
          lote_id: input.toLoteId,
        },
      });
    }
  } else if (input.dominio === "nutricao") {
    ops.push({
      table: "eventos_nutricao",
      action: "INSERT",
      record: {
        evento_id: eventId,
        alimento_nome: input.alimentoNome.trim(),
        quantidade_kg: input.quantidadeKg,
        payload: {},
      },
    });
  } else if (input.dominio === "financeiro") {
    ops.push({
      table: "eventos_financeiro",
      action: "INSERT",
      record: {
        evento_id: eventId,
        tipo: input.tipo,
        valor_total: input.valorTotal,
        contraparte_id: input.contraparteId ?? null,
        payload: {},
      },
    });

    if (
      input.tipo === "venda" &&
      input.animalId &&
      input.applyAnimalStateUpdate !== false
    ) {
      ops.push({
        table: "animais",
        action: "UPDATE",
        record: {
          id: input.animalId,
          status: input.animalSaleStatus ?? "vendido",
          data_saida: toIsoDate(occurredAt),
          ...(input.clearAnimalLoteOnSale !== false ? { lote_id: null } : {}),
        },
      });
    }
  } else if (input.dominio === "reproducao") {
    ops.push({
      table: "eventos_reproducao",
      action: "INSERT",
      record: {
        evento_id: eventId,
        fazenda_id: input.fazendaId,
        tipo: input.tipo,
        macho_id: input.machoId ?? null,
        payload: input.payloadData ?? {},
      },
    });
  }

  return { eventId, ops };
};
