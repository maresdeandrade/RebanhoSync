import type { AgendaItem, ProtocoloSanitarioItem } from "@/lib/offline/types";
import {
  describeSanitaryAgendaScheduleMeta,
  type SanitaryAgendaScheduleMeta,
} from "@/lib/sanitario/calendar";

type AgendaScheduleItemInput = Pick<
  AgendaItem,
  "dominio" | "interval_days_applied" | "payload" | "source_ref"
>;

type AgendaScheduleProtocolItemInput = Pick<
  ProtocoloSanitarioItem,
  "intervalo_dias" | "payload"
>;

export function resolveSanitaryAgendaItemScheduleMeta(
  item: AgendaScheduleItemInput,
  protocolItem?: AgendaScheduleProtocolItemInput | null,
): SanitaryAgendaScheduleMeta | null {
  if (item.dominio !== "sanitario") return null;

  return describeSanitaryAgendaScheduleMeta({
    intervalDays: item.interval_days_applied ?? protocolItem?.intervalo_dias ?? null,
    payloads: [protocolItem?.payload ?? null, item.payload, item.source_ref],
  });
}
