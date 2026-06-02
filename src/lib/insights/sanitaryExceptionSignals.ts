import {
  createAnswerableInsight,
  createAnswerableSourceContract,
} from "@/lib/insights/sourceContract";
import type { OperationalInsight } from "@/lib/insights/types";
import {
  summarizeSanitaryExceptions,
  type SanitaryException,
  type SanitaryExceptionSummary,
} from "@/lib/sanitario/reconciliation/sanitaryExceptions";

export type SanitaryExceptionSignalSummary = SanitaryExceptionSummary & {
  source: SanitaryExceptionSummary["source"];
};

export function createSanitaryExceptionSignalsInsight(input: {
  question: string;
  generatedAt: string;
  exceptions: readonly SanitaryException[];
}): OperationalInsight<SanitaryExceptionSignalSummary> {
  const data = summarizeSanitaryExceptions(input.exceptions);

  return createAnswerableInsight({
    questionKind: "historical_kpi",
    question: input.question,
    generatedAt: input.generatedAt,
    filters: {},
    period: {
      start: input.generatedAt.slice(0, 10),
      end: input.generatedAt.slice(0, 10),
    },
    source: createAnswerableSourceContract({
      primarySource: "eventos_sanitario",
      auxiliarySources: [
        "eventos",
        "insumo_movimentacoes",
        "agenda_itens.source_evento_id",
        "eventos.payload.biosseguranca_ocorrencia",
      ],
      excludedSources: [
        "agenda geral",
        "protocolos_sanitarios",
        "checklist regulatorio contextual",
        "tags",
        "insights",
      ],
      limitations: [
        "Excecoes sao read model recalculavel; a correcao exige novo evento vinculado.",
        "Agenda entra somente como pendencia corretiva especifica vinculada por source_evento_id.",
      ],
    }),
    resultStatus: data.totalOpen > 0 ? "complete" : "empty",
    data,
  });
}
