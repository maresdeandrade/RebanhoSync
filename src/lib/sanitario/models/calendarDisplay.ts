import { describeSanitaryCalendarSchedule } from "@/lib/sanitario/engine/calendar";

type RegistrarCalendarScheduleDisplayInput = {
  intervalDays?: number | null;
  geraAgenda: boolean;
  payload?: unknown;
};

function toRecordPayload(payload: unknown): Record<string, unknown> | null {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : null;
}

export function describeRegistrarSanitaryCalendarSchedule(
  input: RegistrarCalendarScheduleDisplayInput,
) {
  return describeSanitaryCalendarSchedule({
    intervalDays: input.intervalDays ?? 0,
    geraAgenda: input.geraAgenda,
    payload: toRecordPayload(input.payload),
  });
}
