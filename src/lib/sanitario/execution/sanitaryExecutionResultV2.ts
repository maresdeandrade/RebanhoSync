import type {
  ExecuteSanitaryAgendaInputV2,
  SanitaryAgendaBatchResultV2,
} from "@/lib/sanitario/execution/sanitaryAgendaExecutionV2";

type ExecutionPayload = Omit<ExecuteSanitaryAgendaInputV2, "fazendaId">;

export function isCompleteSanitaryExecutionBatch(
  payloads: ExecutionPayload[],
  result: SanitaryAgendaBatchResultV2,
) {
  const expectedIds = new Set(payloads.map((payload) => payload.clientOpId));
  if (
    payloads.length === 0 ||
    expectedIds.size !== payloads.length ||
    result.items.length !== payloads.length
  ) {
    return false;
  }
  const outcomes = new Map(result.items.map((item) => [item.clientOpId, item]));
  return (
    result.executedCount === payloads.length &&
    result.failedCount === 0 &&
    result.notExecutedCount === 0 &&
    result.retryAvailableCount === 0 &&
    payloads.every((payload) => {
      const outcome = outcomes.get(payload.clientOpId);
      return (
        outcome?.agendaId === payload.agendaId &&
        outcome.status === "EXECUTADO" &&
        !outcome.retryAvailable
      );
    })
  );
}
