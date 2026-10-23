import type {
  AgendaItem,
  Animal,
  DominioEnum,
  Evento,
  Lote,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";
import { describeSanitaryAgendaScheduleMeta } from "@/lib/sanitario/engine/calendar";
import {
  getSanitaryAttentionOperationalClassLabel,
  summarizeSanitaryAgendaAttention,
  type SanitaryAttentionRow,
} from "@/lib/sanitario/compliance/attention";
import { buildRegulatoryOperationalReadModel } from "@/lib/sanitario/compliance/regulatoryReadModel";
import { summarizeBiosecurityOccurrences } from "@/lib/sanitario/compliance/biosecurityReadModel";
import {
  buildSanitaryExceptionsReadModel,
  summarizeSanitaryExceptions,
} from "@/lib/sanitario/reconciliation/sanitaryExceptions";
import type {
  AgendaAttentionRow,
  OperationalSummaryInput,
  RecentEventRow,
  ReportRange,
} from "./operationalSummaryTypes";
import { getEventDateKey } from "./operationalSummaryCalendar";
import type { resolveMetricTimezone } from "./operationalSummaryCalendar";

const DOMAIN_LABEL: Record<DominioEnum, string> = {
  sanitario: "Sanitario",
  alerta_sanitario: "Alerta sanitario",
  conformidade: "Conformidade",
  comercial: "Comercial",
  pesagem: "Pesagem",
  nutricao: "Nutricao",
  movimentacao: "Movimentacao",
  reproducao: "Reproducao",
  financeiro: "Financeiro",
  obito: "Obito",
  ecc: "ECC",
  pastagem: "Pastagem",
};

const DOMAIN_ORDER: DominioEnum[] = [
  "sanitario",
  "alerta_sanitario",
  "conformidade",
  "comercial",
  "pesagem",
  "movimentacao",
  "nutricao",
  "reproducao",
  "financeiro",
  "obito",
  "ecc",
  "pastagem",
];

function resolveAgendaStatus(
  item: AgendaItem,
  todayKey: string,
): AgendaAttentionRow["status"] {
  if (item.data_prevista < todayKey) return "atrasado";
  if (item.data_prevista === todayKey) return "hoje";
  return "proximo";
}

export function buildOperationalReadModels({
  input,
  agendaAberta,
  animals,
  lotes,
  eventos,
  range,
  now,
}: {
  input: Pick<
    OperationalSummaryInput,
    | "protocolosSanitarios"
    | "protocoloItensSanitarios"
    | "fazendaSanidadeConfig"
    | "catalogoProtocolosOficiais"
    | "catalogoProtocolosOficiaisItens"
    | "eventosSanitario"
    | "insumoMovimentacoes"
    | "insumoLotes"
  >;
  agendaAberta: AgendaItem[];
  animals: Animal[];
  lotes: Lote[];
  eventos: readonly Evento[];
  range: Pick<ReportRange, "from" | "to">;
  now: Date;
}) {
  const sanitaryAttention = summarizeSanitaryAgendaAttention({
    agenda: agendaAberta,
    animals,
    lotes,
    protocols: (input.protocolosSanitarios ?? []).filter(
      (item) => !item.deleted_at,
    ),
    protocolItems: (input.protocoloItensSanitarios ?? []).filter(
      (item) => !item.deleted_at,
    ),
    limit: agendaAberta.length,
    today: now,
  });
  const regulatoryReadModel = buildRegulatoryOperationalReadModel({
    config: input.fazendaSanidadeConfig ?? null,
    templates: input.catalogoProtocolosOficiais ?? [],
    items: input.catalogoProtocolosOficiaisItens ?? [],
  });
  const biosecurityOccurrences = summarizeBiosecurityOccurrences({
    eventos,
    agenda: agendaAberta,
    from: range.from,
    to: range.to,
  });
  const sanitaryExceptions = buildSanitaryExceptionsReadModel({
    eventos,
    eventosSanitario: input.eventosSanitario ?? [],
    insumoMovimentacoes: input.insumoMovimentacoes ?? [],
    agendaItens: agendaAberta,
    estoqueLotes: input.insumoLotes ?? [],
    detectedAt: now.toISOString(),
  });
  const sanitaryExceptionSummary = summarizeSanitaryExceptions(
    sanitaryExceptions,
    eventos,
  );
  const sanitaryAttentionById = new Map(
    sanitaryAttention.topItems.map((item) => [item.id, item]),
  );
  const domainCounts = DOMAIN_ORDER.map((dominio) => ({
    label: DOMAIN_LABEL[dominio],
    value: eventos.filter((evento) => evento.dominio === dominio).length,
  }));

  return {
    sanitaryAttentionById,
    regulatoryReadModel,
    biosecurityOccurrences,
    sanitaryExceptions,
    sanitaryExceptionSummary,
    domainCounts,
  };
}

export function buildOperationalAttentionRows({
  agendaAberta,
  sanitaryAttentionById,
  sanitaryProtocolItemById,
  animalById,
  loteById,
  todayKey,
  eventos,
  metricTimezone,
}: {
  agendaAberta: readonly AgendaItem[];
  sanitaryAttentionById: ReadonlyMap<string, SanitaryAttentionRow>;
  sanitaryProtocolItemById: ReadonlyMap<string, ProtocoloSanitarioItem>;
  animalById: ReadonlyMap<string, string>;
  loteById: ReadonlyMap<string, string>;
  todayKey: string;
  eventos: readonly Evento[];
  metricTimezone: Pick<ReturnType<typeof resolveMetricTimezone>, "timezone">;
}) {
  const agendaAttention: AgendaAttentionRow[] = agendaAberta
    .slice()
    .sort((left, right) =>
      left.data_prevista.localeCompare(right.data_prevista),
    )
    .slice(0, 10)
    .map((item) => {
      const sanitaryItem = sanitaryAttentionById.get(item.id);
      const protocolItem = item.protocol_item_version_id
        ? (sanitaryProtocolItemById.get(item.protocol_item_version_id) ?? null)
        : null;
      const scheduleMeta =
        item.dominio === "sanitario"
          ? describeSanitaryAgendaScheduleMeta({
              intervalDays:
                item.interval_days_applied ??
                protocolItem?.intervalo_dias ??
                null,
              payloads: [
                protocolItem?.payload ?? null,
                item.payload,
                item.source_ref,
              ],
            })
          : null;

      return {
        id: item.id,
        data: item.data_prevista,
        titulo:
          sanitaryItem?.titulo ??
          `${DOMAIN_LABEL[item.dominio]}: ${item.tipo.replaceAll("_", " ")}`,
        contexto:
          sanitaryItem?.contexto ??
          animalById.get(item.animal_id ?? "") ??
          loteById.get(item.lote_id ?? "") ??
          "Sem animal ou lote vinculado",
        scheduleLabel: scheduleMeta?.label,
        scheduleModeLabel: scheduleMeta?.modeLabel,
        scheduleAnchorLabel: scheduleMeta?.anchorLabel ?? undefined,
        operationalClassLabel: sanitaryItem
          ? getSanitaryAttentionOperationalClassLabel(
              sanitaryItem.operationalClass,
            )
          : undefined,
        status: resolveAgendaStatus(item, todayKey),
        priorityLabel: sanitaryItem?.priorityLabel,
        priorityTone: sanitaryItem?.priorityTone,
        mandatory: sanitaryItem?.mandatory,
        requiresVet: sanitaryItem?.requiresVet,
      };
    });

  const recentEvents: RecentEventRow[] = eventos
    .slice()
    .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))
    .slice(0, 8)
    .map((evento) => ({
      id: evento.id,
      data: getEventDateKey(evento, metricTimezone.timezone),
      dominio: DOMAIN_LABEL[evento.dominio],
      contexto:
        animalById.get(evento.animal_id ?? "") ??
        loteById.get(evento.lote_id ?? "") ??
        evento.observacoes ??
        "Registro geral",
    }));

  return { agendaAttention, recentEvents };
}
