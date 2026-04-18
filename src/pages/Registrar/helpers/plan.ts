import type { OperationInput } from "@/lib/offline/types";

export function resolveRegistrarTargetAnimalIds(input: {
  hasSelectedAnimals: boolean;
  selectedAnimais: string[];
}) {
  return input.hasSelectedAnimals ? input.selectedAnimais : [null];
}

export function resolveRegistrarDistinctAnimalIds(
  targetAnimalIds: Array<string | null>,
) {
  return Array.from(
    new Set(targetAnimalIds.filter((id): id is string => id !== null)),
  );
}

export function buildRegistrarAgendaCompletionOp(input: {
  sourceTaskId: string;
  linkedEventId: string;
}): OperationInput {
  return {
    table: "agenda_itens",
    action: "UPDATE",
    record: {
      id: input.sourceTaskId,
      status: "concluido",
      source_evento_id: input.linkedEventId,
    },
  };
}
