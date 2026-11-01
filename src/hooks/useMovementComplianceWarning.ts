import { useMemo } from "react";
import { buildRegulatoryOperationalReadModel, type RegulatorySurfaceSource } from "@/lib/sanitario/compliance/regulatoryReadModel";

export function useMovementComplianceWarning(source: RegulatorySurfaceSource | undefined) {
  return useMemo(() => {
    const guards = buildRegulatoryOperationalReadModel(source).flows.movementInternal;
    const messages = [...guards.blockers, ...(guards.warnings ?? [])].map(guard => guard.message ?? guard.label);
    return [...new Set(messages)].join(" ") || null;
  }, [source]);
}
