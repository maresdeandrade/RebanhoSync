import type { SchedulerNowContext } from "@/lib/sanitario/models/domain";

export function buildSchedulerNowContext(
  dateOrIso: string,
  timezone = "America/Sao_Paulo",
): SchedulerNowContext {
  const nowIso = dateOrIso.includes("T") ? dateOrIso : `${dateOrIso}T00:00:00Z`;
  return { nowIso, timezone };
}
