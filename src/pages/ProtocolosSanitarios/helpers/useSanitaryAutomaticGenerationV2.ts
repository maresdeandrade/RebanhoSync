import { useCallback, useEffect, useRef, useState } from "react";
import { generateSanitaryAutomaticAgendasV2 } from "@/lib/sanitario/agenda/sanitaryAutomaticGenerationV2";
import type { SanitaryProtocolWindowSourceV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";

export function sanitaryAutomationTodayV2() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

export function useSanitaryAutomaticGenerationV2(
  fazendaId: string,
  source: SanitaryProtocolWindowSourceV2 | undefined,
) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);
  const invalidate = useCallback(() => { ++latest.current; }, []);
  const reevaluate = useCallback(async () => {
    const request = ++latest.current;
    setBusy(true);
    try {
      const result = await generateSanitaryAutomaticAgendasV2({
        fazendaId,
        referenceDate: sanitaryAutomationTodayV2(),
      });
      if (request !== latest.current) return;
      setMessage(automaticResultMessage(result));
    } catch (error) {
      if (request === latest.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível reavaliar o plano. Tente novamente.",
        );
    } finally {
      if (request === latest.current) setBusy(false);
    }
  }, [fazendaId]);
  useEffect(() => {
    if (source?.fazendaId === fazendaId) void reevaluate();
    return invalidate;
  }, [source, fazendaId, reevaluate, invalidate]);
  useEffect(() => {
    window.addEventListener("online", reevaluate);
    return () => {
      invalidate();
      window.removeEventListener("online", reevaluate);
    };
  }, [reevaluate, invalidate]);
  return { reevaluate, message, busy };
}

function automaticResultMessage(result: {
  created: number;
  failures: string[];
  enabled: boolean;
}) {
  if (result.failures.length) return result.failures.join(" ");
  if (!result.enabled) return "Geração automática desativada.";
  return result.created > 0
    ? `${result.created} Agenda(s) gerada(s) automaticamente.`
    : "Plano reavaliado. Agendas existentes e cancelamentos preservados.";
}
