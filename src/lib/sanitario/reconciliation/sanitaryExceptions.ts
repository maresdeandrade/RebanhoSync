import { readBiosecurityOccurrencePayload } from "@/lib/sanitario/compliance/biosecurityOccurrence";
import {
  readSanitaryCorrectionPayload,
  type SanitaryCorrectionType,
} from "@/lib/sanitario/reconciliation/sanitaryCorrections";

export type SanitaryExceptionCode =
  | "evento_sanitario_sem_produto"
  | "evento_sanitario_sem_lote_estoque"
  | "evento_sanitario_sem_custo"
  | "evento_sanitario_sem_dose"
  | "evento_sanitario_sem_via"
  | "estoque_lote_vencido_na_data_evento"
  | "estoque_movimentacao_ausente"
  | "estoque_movimentacao_duplicada"
  | "custo_inconsistente"
  | "carencia_incompleta"
  | "ocorrencia_biosseguranca_aberta"
  | "ocorrencia_com_pendencia_aberta"
  | "suspeita_notificavel_aberta"
  | "pendencia_corretiva_vencida";

export type SanitaryExceptionSeverity = "info" | "warning" | "critical";
export type SanitaryExceptionStatus = "open" | "resolved" | "ignored";

export type SanitaryExceptionSource =
  | "eventos"
  | "eventos_sanitario"
  | "insumo_movimentacoes"
  | "agenda_itens"
  | "eventos.payload.biosseguranca_ocorrencia";

export type SanitaryExceptionEvent = {
  id: string;
  dominio: string;
  occurred_at: string;
  animal_id?: string | null;
  lote_id?: string | null;
  source_task_id?: string | null;
  corrige_evento_id?: string | null;
  payload?: Record<string, unknown> | null;
  deleted_at?: string | null;
};

export type SanitaryExceptionEventDetail = {
  evento_id: string;
  tipo?: string | null;
  produto?: string | null;
  produto_veterinario_id?: string | null;
  produto_nome_snapshot?: string | null;
  estoque_lote_id?: string | null;
  validade_produto?: string | null;
  dose_quantidade?: number | null;
  dose_unidade?: string | null;
  via_aplicacao?: string | null;
  carencia_carne_dias?: number | null;
  carencia_leite_dias?: number | null;
  carencia_carne_ate?: string | null;
  carencia_leite_ate?: string | null;
  custo_unitario_snapshot?: number | null;
  custo_total_snapshot?: number | null;
  payload?: Record<string, unknown> | null;
  deleted_at?: string | null;
};

export type SanitaryExceptionInventoryMovement = {
  id: string;
  insumo_lote_id?: string | null;
  tipo?: string | null;
  quantidade_base?: number | null;
  occurred_at?: string | null;
  source_evento_id?: string | null;
  source_evento_dominio?: string | null;
  animal_id?: string | null;
  rebanho_lote_id?: string | null;
  custo_unitario_snapshot?: number | null;
  custo_total_snapshot?: number | null;
  deleted_at?: string | null;
};

export type SanitaryExceptionAgendaItem = {
  id: string;
  dominio?: string | null;
  tipo?: string | null;
  status: string;
  data_prevista: string;
  animal_id?: string | null;
  lote_id?: string | null;
  source_ref?: Record<string, unknown> | null;
  source_evento_id?: string | null;
  payload?: Record<string, unknown> | null;
  deleted_at?: string | null;
};

export type SanitaryExceptionInventoryLot = {
  id: string;
  validade?: string | null;
  custo_unitario?: number | null;
  deleted_at?: string | null;
};

export type SanitaryException = {
  id: string;
  code: SanitaryExceptionCode;
  severity: SanitaryExceptionSeverity;
  status: SanitaryExceptionStatus;
  source: SanitaryExceptionSource;
  evento_id?: string;
  source_evento_id?: string;
  animal_id?: string;
  lote_id?: string;
  estoque_lote_id?: string;
  produto_veterinario_id?: string;
  title: string;
  description: string;
  recommended_action: string;
  limitations: string[];
  detected_at: string;
};

export type SanitaryExceptionSummary = {
  source:
    "eventos+eventos_sanitario+insumo_movimentacoes+agenda_itens+eventos.payload.biosseguranca_ocorrencia";
  totalOpen: number;
  totalResolved: number;
  totalIgnored: number;
  byType: Array<{ key: SanitaryExceptionCode; count: number }>;
  bySeverity: Array<{ key: SanitaryExceptionSeverity; count: number }>;
  byAnimal: Array<{ key: string; count: number }>;
  byLote: Array<{ key: string; count: number }>;
  openOccurrenceCount: number;
  overdueCorrectivePendingCount: number;
  inconsistentStockCount: number;
  missingCostCount: number;
  resolvedWithStructuredDateCount: number;
  averageResolutionDays: number | null;
};

export type BuildSanitaryExceptionsInput = {
  eventos?: readonly SanitaryExceptionEvent[];
  eventosSanitario?: readonly SanitaryExceptionEventDetail[];
  insumoMovimentacoes?: readonly SanitaryExceptionInventoryMovement[];
  agendaItens?: readonly SanitaryExceptionAgendaItem[];
  estoqueLotes?: readonly SanitaryExceptionInventoryLot[];
  detectedAt: string;
  resolvedExceptionIds?: readonly string[];
  ignoredExceptionIds?: readonly string[];
};

const EPSILON = 0.01;
const CORRECTIVE_AGENDA_TYPES = new Set([
  "biosseguranca_acao_corretiva",
  "sanitario_notificacao_pendente",
]);

export function buildSanitaryExceptionsReadModel({
  eventos = [],
  eventosSanitario = [],
  insumoMovimentacoes = [],
  agendaItens = [],
  estoqueLotes = [],
  detectedAt,
  resolvedExceptionIds = [],
  ignoredExceptionIds = [],
}: BuildSanitaryExceptionsInput): SanitaryException[] {
  const activeEvents = eventos.filter((event) => !event.deleted_at);
  const eventsById = new Map(activeEvents.map((event) => [event.id, event]));
  const lotsById = new Map(
    estoqueLotes.filter((lot) => !lot.deleted_at).map((lot) => [lot.id, lot]),
  );
  const movementsByEvent = groupMovementsByEvent(insumoMovimentacoes);
  const correctiveAgendaByEvent = groupCorrectiveAgendaBySourceEvent(agendaItens);
  const correctionsByOriginEvent = groupCorrectionsByOriginEvent(activeEvents);
  const exceptions: SanitaryException[] = [];
  const statusResolver = createStatusResolver({
    resolvedExceptionIds,
    ignoredExceptionIds,
  });

  for (const detail of eventosSanitario) {
    if (detail.deleted_at) continue;
    const event = eventsById.get(detail.evento_id);
    if (!event || event.dominio !== "sanitario") {
      exceptions.push(
        createException({
          code: "evento_sanitario_sem_produto",
          severity: "warning",
          source: "eventos_sanitario",
          event,
          detail,
          detectedAt,
          statusResolver,
          description:
            "Detalhe sanitario existe sem evento sanitario base ativo carregado para confirmar o fato historico.",
          limitations: [
            "Sem o evento base carregado, a reconciliacao nao deve inferir animal, lote, data ou execucao.",
          ],
        }),
      );
      continue;
    }

    addTraceabilityExceptions({
      exceptions,
      event,
      detail,
      movements: movementsByEvent.get(detail.evento_id) ?? [],
      inventoryLot: detail.estoque_lote_id
        ? lotsById.get(detail.estoque_lote_id)
        : undefined,
      detectedAt,
      statusResolver,
    });
  }

  for (const event of activeEvents) {
    const occurrence = readBiosecurityOccurrencePayload(event.payload);
    if (!occurrence) continue;
    const effectiveOccurrenceStatus = resolveOccurrenceStatusFromCorrections(
      event.id,
      occurrence.status,
      correctionsByOriginEvent,
    );

    const agenda = correctiveAgendaByEvent.get(event.id) ?? [];
    const sourceFields = {
      animal_id: occurrence.animal_id ?? event.animal_id ?? undefined,
      lote_id: occurrence.lote_id ?? event.lote_id ?? undefined,
    };

    if (effectiveOccurrenceStatus === "aberta") {
      exceptions.push(
        createException({
          code:
            occurrence.categoria_ocorrencia === "suspeita_doenca_notificavel"
              ? "suspeita_notificavel_aberta"
              : "ocorrencia_biosseguranca_aberta",
          severity:
            occurrence.categoria_ocorrencia === "suspeita_doenca_notificavel"
              ? "critical"
              : occurrence.gravidade === "alta"
                ? "critical"
                : "warning",
          source: "eventos.payload.biosseguranca_ocorrencia",
          event,
          detectedAt,
          statusResolver,
          ...sourceFields,
        }),
      );
    }

    if (effectiveOccurrenceStatus === "aberta" && agenda.length > 0) {
      exceptions.push(
        createException({
          code: "ocorrencia_com_pendencia_aberta",
          severity: occurrence.gravidade === "alta" ? "critical" : "warning",
          source: "agenda_itens",
          event,
          source_evento_id: event.id,
          detectedAt,
          statusResolver,
          ...sourceFields,
        }),
      );
    }

    for (const agendaItem of agenda) {
      if (agendaItem.data_prevista < detectedAt.slice(0, 10)) {
        exceptions.push(
          createException({
            code: "pendencia_corretiva_vencida",
            severity: "critical",
            source: "agenda_itens",
            event,
            source_evento_id: event.id,
            detectedAt,
            statusResolver,
            animal_id: agendaItem.animal_id ?? sourceFields.animal_id,
            lote_id: agendaItem.lote_id ?? sourceFields.lote_id,
            limitations: [
              "Somente agenda corretiva especifica vinculada por source_evento_id foi considerada.",
            ],
          }),
        );
      }
    }
  }

  return applyCorrectionStatuses(dedupeExceptions(exceptions), correctionsByOriginEvent);
}

export function summarizeSanitaryExceptions(
  exceptions: readonly SanitaryException[],
  correctionEvents: readonly SanitaryExceptionEvent[] = [],
): SanitaryExceptionSummary {
  const open = exceptions.filter((item) => item.status === "open");
  const resolvedCorrections = correctionEvents
    .map((event) => readSanitaryCorrectionPayload(event.payload))
    .filter((correction) => correction && correction.payload_correcao.resolvida_em);
  const resolutionDays = resolvedCorrections
    .map((correction) => {
      const resolvedAt = correction?.payload_correcao.resolvida_em;
      if (typeof resolvedAt !== "string") return null;
      const createdAt = correction.created_at;
      const diff = Date.parse(resolvedAt) - Date.parse(createdAt);
      return Number.isFinite(diff) && diff >= 0 ? diff / 86_400_000 : null;
    })
    .filter((value): value is number => value !== null);

  return {
    source:
      "eventos+eventos_sanitario+insumo_movimentacoes+agenda_itens+eventos.payload.biosseguranca_ocorrencia",
    totalOpen: open.length,
    totalResolved: exceptions.filter((item) => item.status === "resolved").length,
    totalIgnored: exceptions.filter((item) => item.status === "ignored").length,
    byType: countBy(open.map((item) => item.code)),
    bySeverity: countBy(open.map((item) => item.severity)),
    byAnimal: countBy(open.map((item) => item.animal_id ?? "sem_animal")),
    byLote: countBy(open.map((item) => item.lote_id ?? "sem_lote")),
    openOccurrenceCount: open.filter(
      (item) =>
        item.code === "ocorrencia_biosseguranca_aberta" ||
        item.code === "suspeita_notificavel_aberta",
    ).length,
    overdueCorrectivePendingCount: open.filter(
      (item) => item.code === "pendencia_corretiva_vencida",
    ).length,
    inconsistentStockCount: open.filter(
      (item) =>
        item.code === "estoque_movimentacao_ausente" ||
        item.code === "estoque_movimentacao_duplicada" ||
        item.code === "estoque_lote_vencido_na_data_evento" ||
        item.code === "custo_inconsistente",
    ).length,
    missingCostCount: open.filter((item) => item.code === "evento_sanitario_sem_custo")
      .length,
    resolvedWithStructuredDateCount: resolutionDays.length,
    averageResolutionDays:
      resolutionDays.length > 0
        ? Number(
            (
              resolutionDays.reduce((acc, value) => acc + value, 0) /
              resolutionDays.length
            ).toFixed(2),
          )
        : null,
  };
}

function addTraceabilityExceptions({
  exceptions,
  event,
  detail,
  movements,
  inventoryLot,
  detectedAt,
  statusResolver,
}: {
  exceptions: SanitaryException[];
  event: SanitaryExceptionEvent;
  detail: SanitaryExceptionEventDetail;
  movements: SanitaryExceptionInventoryMovement[];
  inventoryLot?: SanitaryExceptionInventoryLot;
  detectedAt: string;
  statusResolver: (id: string) => SanitaryExceptionStatus;
}) {
  const common = { event, detail, detectedAt, statusResolver };

  if (!hasStructuredProduct(detail)) {
    exceptions.push(
      createException({
        ...common,
        code: "evento_sanitario_sem_produto",
        severity: "critical",
        source: "eventos_sanitario",
      }),
    );
  }

  if (!detail.estoque_lote_id) {
    exceptions.push(
      createException({
        ...common,
        code: "evento_sanitario_sem_lote_estoque",
        severity: "warning",
        source: "eventos_sanitario",
      }),
    );
  }

  if (!hasNumber(detail.custo_total_snapshot) && !hasNumber(detail.custo_unitario_snapshot)) {
    exceptions.push(
      createException({
        ...common,
        code: "evento_sanitario_sem_custo",
        severity: "warning",
        source: "eventos_sanitario",
      }),
    );
  }

  if (!hasPositiveNumber(detail.dose_quantidade) || !hasText(detail.dose_unidade)) {
    exceptions.push(
      createException({
        ...common,
        code: "evento_sanitario_sem_dose",
        severity: "warning",
        source: "eventos_sanitario",
      }),
    );
  }

  if (!hasText(detail.via_aplicacao)) {
    exceptions.push(
      createException({
        ...common,
        code: "evento_sanitario_sem_via",
        severity: "warning",
        source: "eventos_sanitario",
      }),
    );
  }

  const lotValidity = inventoryLot?.validade ?? detail.validade_produto ?? null;
  if (detail.estoque_lote_id && lotValidity && lotValidity < event.occurred_at.slice(0, 10)) {
    exceptions.push(
      createException({
        ...common,
        code: "estoque_lote_vencido_na_data_evento",
        severity: "critical",
        source: "eventos_sanitario",
      }),
    );
  }

  if (detail.estoque_lote_id && movements.length === 0) {
    exceptions.push(
      createException({
        ...common,
        code: "estoque_movimentacao_ausente",
        severity: "critical",
        source: "insumo_movimentacoes",
      }),
    );
  }

  if (movements.length > 1) {
    exceptions.push(
      createException({
        ...common,
        code: "estoque_movimentacao_duplicada",
        severity: "critical",
        source: "insumo_movimentacoes",
      }),
    );
  }

  if (hasCostInconsistency(detail, movements)) {
    exceptions.push(
      createException({
        ...common,
        code: "custo_inconsistente",
        severity: "warning",
        source: "insumo_movimentacoes",
      }),
    );
  }

  if (hasIncompleteWithdrawal(detail)) {
    exceptions.push(
      createException({
        ...common,
        code: "carencia_incompleta",
        severity: "warning",
        source: "eventos_sanitario",
      }),
    );
  }
}

function createException({
  code,
  severity,
  source,
  event,
  detail,
  detectedAt,
  statusResolver,
  description,
  limitations,
  evento_id,
  source_evento_id,
  animal_id,
  lote_id,
}: {
  code: SanitaryExceptionCode;
  severity: SanitaryExceptionSeverity;
  source: SanitaryExceptionSource;
  event?: SanitaryExceptionEvent;
  detail?: SanitaryExceptionEventDetail;
  detectedAt: string;
  statusResolver: (id: string) => SanitaryExceptionStatus;
  description?: string;
  limitations?: string[];
  evento_id?: string;
  source_evento_id?: string;
  animal_id?: string | null;
  lote_id?: string | null;
}): SanitaryException {
  const resolvedEventoId = evento_id ?? event?.id ?? detail?.evento_id;
  const resolvedSourceEventoId = source_evento_id ?? resolvedEventoId;
  const id = buildExceptionId(code, source, {
    eventoId: resolvedEventoId,
    sourceEventoId: resolvedSourceEventoId,
    estoqueLoteId: detail?.estoque_lote_id,
    produtoVeterinarioId: detail?.produto_veterinario_id,
  });

  return {
    id,
    code,
    severity,
    status: statusResolver(id),
    source,
    ...(resolvedEventoId ? { evento_id: resolvedEventoId } : {}),
    ...(resolvedSourceEventoId ? { source_evento_id: resolvedSourceEventoId } : {}),
    ...readOptionalField("animal_id", animal_id ?? event?.animal_id),
    ...readOptionalField("lote_id", lote_id ?? event?.lote_id),
    ...readOptionalField("estoque_lote_id", detail?.estoque_lote_id),
    ...readOptionalField("produto_veterinario_id", detail?.produto_veterinario_id),
    title: EXCEPTION_COPY[code].title,
    description: description ?? EXCEPTION_COPY[code].description,
    recommended_action: EXCEPTION_COPY[code].recommendedAction,
    limitations: limitations ?? EXCEPTION_COPY[code].limitations,
    detected_at: detectedAt,
  };
}

function groupMovementsByEvent(
  movements: readonly SanitaryExceptionInventoryMovement[],
): Map<string, SanitaryExceptionInventoryMovement[]> {
  const grouped = new Map<string, SanitaryExceptionInventoryMovement[]>();

  for (const movement of movements) {
    if (movement.deleted_at) continue;
    if (movement.tipo !== "consumo_sanitario") continue;
    if (movement.source_evento_dominio && movement.source_evento_dominio !== "sanitario") {
      continue;
    }
    if (!movement.source_evento_id) continue;

    const nextMovements = grouped.get(movement.source_evento_id) ?? [];
    nextMovements.push(movement);
    grouped.set(movement.source_evento_id, nextMovements);
  }

  return grouped;
}

function groupCorrectiveAgendaBySourceEvent(
  agenda: readonly SanitaryExceptionAgendaItem[],
): Map<string, SanitaryExceptionAgendaItem[]> {
  const grouped = new Map<string, SanitaryExceptionAgendaItem[]>();

  for (const item of agenda) {
    if (item.deleted_at) continue;
    if (item.status !== "agendado") continue;
    if (!CORRECTIVE_AGENDA_TYPES.has(item.tipo ?? "")) continue;
    const sourceEventId = item.source_evento_id;
    if (!sourceEventId) continue;

    const nextItems = grouped.get(sourceEventId) ?? [];
    nextItems.push(item);
    grouped.set(sourceEventId, nextItems);
  }

  return grouped;
}

function hasStructuredProduct(detail: SanitaryExceptionEventDetail): boolean {
  return hasText(detail.produto_veterinario_id);
}

function hasCostInconsistency(
  detail: SanitaryExceptionEventDetail,
  movements: readonly SanitaryExceptionInventoryMovement[],
): boolean {
  if (movements.length === 0) return false;
  const movement = movements[0];

  if (detail.estoque_lote_id && movement.insumo_lote_id !== detail.estoque_lote_id) {
    return true;
  }

  if (
    hasNumber(detail.custo_total_snapshot) &&
    hasNumber(movement.custo_total_snapshot) &&
    Math.abs(detail.custo_total_snapshot - movement.custo_total_snapshot) > EPSILON
  ) {
    return true;
  }

  return (
    hasNumber(detail.custo_unitario_snapshot) &&
    hasNumber(movement.custo_unitario_snapshot) &&
    Math.abs(detail.custo_unitario_snapshot - movement.custo_unitario_snapshot) > EPSILON
  );
}

function hasIncompleteWithdrawal(detail: SanitaryExceptionEventDetail): boolean {
  return (
    hasIncompleteWithdrawalPair(detail.carencia_carne_dias, detail.carencia_carne_ate) ||
    hasIncompleteWithdrawalPair(detail.carencia_leite_dias, detail.carencia_leite_ate)
  );
}

function hasIncompleteWithdrawalPair(days?: number | null, endDate?: string | null): boolean {
  if (hasPositiveNumber(days) && !hasText(endDate)) return true;
  if (!hasNumber(days) && hasText(endDate)) return true;
  return false;
}

function createStatusResolver({
  resolvedExceptionIds,
  ignoredExceptionIds,
}: {
  resolvedExceptionIds: readonly string[];
  ignoredExceptionIds: readonly string[];
}) {
  const resolved = new Set(resolvedExceptionIds);
  const ignored = new Set(ignoredExceptionIds);

  return (id: string): SanitaryExceptionStatus => {
    if (ignored.has(id)) return "ignored";
    if (resolved.has(id)) return "resolved";
    return "open";
  };
}

function groupCorrectionsByOriginEvent(
  eventos: readonly SanitaryExceptionEvent[],
): Map<string, SanitaryCorrectionType[]> {
  const grouped = new Map<string, SanitaryCorrectionType[]>();

  for (const event of eventos) {
    const correction = readSanitaryCorrectionPayload(event.payload);
    const originId = correction?.evento_origem_id ?? event.corrige_evento_id ?? null;
    if (!correction || !originId) continue;

    const next = grouped.get(originId) ?? [];
    next.push(correction.tipo_correcao);
    grouped.set(originId, next);
  }

  return grouped;
}

function resolveOccurrenceStatusFromCorrections(
  eventId: string,
  originalStatus: "aberta" | "resolvida" | "cancelada",
  correctionsByOriginEvent: Map<string, SanitaryCorrectionType[]>,
): "aberta" | "resolvida" | "cancelada" {
  const corrections = correctionsByOriginEvent.get(eventId) ?? [];
  if (corrections.includes("cancelamento_ocorrencia_biosseguranca")) {
    return "cancelada";
  }
  if (corrections.includes("resolucao_ocorrencia_biosseguranca")) {
    return "resolvida";
  }
  return originalStatus;
}

function applyCorrectionStatuses(
  exceptions: SanitaryException[],
  correctionsByOriginEvent: Map<string, SanitaryCorrectionType[]>,
): SanitaryException[] {
  return exceptions.map((exception) => {
    if (exception.status !== "open") return exception;
    const corrections = correctionsByOriginEvent.get(exception.source_evento_id ?? "") ?? [];
    if (!isExceptionResolvedByCorrection(exception.code, corrections)) {
      return exception;
    }
    return { ...exception, status: "resolved" };
  });
}

function isExceptionResolvedByCorrection(
  code: SanitaryExceptionCode,
  corrections: readonly SanitaryCorrectionType[],
): boolean {
  if (corrections.length === 0) return false;

  if (
    code === "evento_sanitario_sem_produto" ||
    code === "evento_sanitario_sem_dose" ||
    code === "evento_sanitario_sem_via" ||
    code === "carencia_incompleta"
  ) {
    return corrections.includes("complemento_rastreabilidade");
  }

  if (code === "evento_sanitario_sem_custo" || code === "custo_inconsistente") {
    return corrections.includes("correcao_custo");
  }

  if (
    code === "evento_sanitario_sem_lote_estoque" ||
    code === "estoque_lote_vencido_na_data_evento"
  ) {
    return corrections.includes("correcao_lote_estoque");
  }

  if (
    code === "estoque_movimentacao_ausente" ||
    code === "estoque_movimentacao_duplicada"
  ) {
    return (
      corrections.includes("estorno_baixa_estoque") ||
      corrections.includes("contra_lancamento_estoque")
    );
  }

  if (
    code === "ocorrencia_biosseguranca_aberta" ||
    code === "suspeita_notificavel_aberta"
  ) {
    return (
      corrections.includes("resolucao_ocorrencia_biosseguranca") ||
      corrections.includes("cancelamento_ocorrencia_biosseguranca")
    );
  }

  if (
    code === "ocorrencia_com_pendencia_aberta" ||
    code === "pendencia_corretiva_vencida"
  ) {
    return (
      corrections.includes("encerramento_pendencia_corretiva") ||
      corrections.includes("resolucao_ocorrencia_biosseguranca") ||
      corrections.includes("cancelamento_ocorrencia_biosseguranca")
    );
  }

  return false;
}

function countBy<T extends string>(values: readonly T[]): Array<{ key: T; count: number }> {
  const map = new Map<T, number>();
  for (const value of values) {
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function buildExceptionId(
  code: SanitaryExceptionCode,
  source: SanitaryExceptionSource,
  {
    eventoId,
    sourceEventoId,
    estoqueLoteId,
    produtoVeterinarioId,
  }: {
    eventoId?: string;
    sourceEventoId?: string;
    estoqueLoteId?: string | null;
    produtoVeterinarioId?: string | null;
  },
): string {
  return [
    "sanitary_exception",
    code,
    source,
    eventoId ?? "sem_evento",
    sourceEventoId ?? "sem_source_evento",
    estoqueLoteId ?? "sem_estoque_lote",
    produtoVeterinarioId ?? "sem_produto",
  ]
    .map((part) => part.replace(/[^a-zA-Z0-9_.:-]/g, "_"))
    .join(":");
}

function dedupeExceptions(exceptions: readonly SanitaryException[]): SanitaryException[] {
  return Array.from(new Map(exceptions.map((exception) => [exception.id, exception])).values());
}

function readOptionalField<T extends string>(
  field: T,
  value: string | null | undefined,
): { [key in T]?: string } {
  return hasText(value) ? ({ [field]: value } as { [key in T]?: string }) : {};
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function hasPositiveNumber(value: unknown): value is number {
  return hasNumber(value) && value > 0;
}

const EXCEPTION_COPY: Record<
  SanitaryExceptionCode,
  {
    title: string;
    description: string;
    recommendedAction: string;
    limitations: string[];
  }
> = {
  evento_sanitario_sem_produto: {
    title: "Evento sanitario sem produto estruturado",
    description:
      "O evento sanitario nao possui produto_veterinario_id estruturado para rastreabilidade.",
    recommendedAction:
      "Registrar complemento de rastreabilidade vinculado ao evento original quando a fonte tecnica estiver disponivel.",
    limitations: [
      "Texto livre, protocolo ou agenda nao comprovam produto aplicado de forma estruturada.",
    ],
  },
  evento_sanitario_sem_lote_estoque: {
    title: "Evento sanitario sem lote de estoque",
    description:
      "O evento sanitario nao possui estoque_lote_id estruturado para rastrear o lote consumido.",
    recommendedAction:
      "Registrar correcao vinculada com o lote de estoque correto, sem editar o evento original.",
    limitations: ["Nao foi inferido lote por produto, protocolo ou agenda."],
  },
  evento_sanitario_sem_custo: {
    title: "Evento sanitario sem custo",
    description:
      "O evento sanitario nao possui snapshot de custo unitario ou total suficiente.",
    recommendedAction:
      "Registrar correcao de custo vinculada ao evento original quando houver fonte economica explicita.",
    limitations: ["Nao foi calculado custo por tabela externa nao carregada."],
  },
  evento_sanitario_sem_dose: {
    title: "Evento sanitario sem dose",
    description:
      "O evento sanitario nao possui quantidade e unidade de dose estruturadas.",
    recommendedAction:
      "Registrar complemento de dose vinculado ao evento original com fonte operacional explicita.",
    limitations: ["Nao foi inferida dose por protocolo, agenda ou produto."],
  },
  evento_sanitario_sem_via: {
    title: "Evento sanitario sem via de aplicacao",
    description: "O evento sanitario nao possui via_aplicacao estruturada.",
    recommendedAction:
      "Registrar complemento de via vinculado ao evento original com fonte operacional explicita.",
    limitations: ["Nao foi inferida via por protocolo, agenda ou produto."],
  },
  estoque_lote_vencido_na_data_evento: {
    title: "Lote de estoque vencido na data do evento",
    description:
      "A validade do lote carregado ou do snapshot do evento e anterior a data do evento.",
    recommendedAction:
      "Reconciliar o lote de estoque por novo evento de correcao ou registrar justificativa tecnica vinculada.",
    limitations: ["Comparacao limitada a validade carregada por parametro ou snapshot do evento."],
  },
  estoque_movimentacao_ausente: {
    title: "Baixa de estoque ausente",
    description:
      "O evento sanitario possui lote de estoque, mas nao ha movimentacao de consumo sanitario vinculada.",
    recommendedAction:
      "Criar baixa ou contra-lancamento por fluxo corretivo idempotente, vinculado ao evento original.",
    limitations: ["Este read model nao cria movimentacao automaticamente."],
  },
  estoque_movimentacao_duplicada: {
    title: "Baixa de estoque duplicada",
    description:
      "Ha mais de uma movimentacao de consumo sanitario vinculada ao mesmo evento.",
    recommendedAction:
      "Registrar estorno ou contra-lancamento vinculado para preservar auditoria.",
    limitations: ["Este read model nao remove nem consolida movimentacoes."],
  },
  custo_inconsistente: {
    title: "Custo inconsistente",
    description:
      "Snapshots de custo ou lote divergem entre o evento sanitario e a movimentacao de estoque.",
    recommendedAction:
      "Registrar correcao de custo ou de lote vinculada ao evento original.",
    limitations: ["Comparacao feita apenas entre dados carregados por parametro."],
  },
  carencia_incompleta: {
    title: "Carencia incompleta",
    description:
      "A carencia possui dias ou data final parcial, sem par estruturado suficiente.",
    recommendedAction:
      "Registrar complemento tecnico de carencia vinculado ao evento original quando houver fonte explicita.",
    limitations: ["Nao foi inferida carencia por protocolo, catalogo, produto ou agenda."],
  },
  ocorrencia_biosseguranca_aberta: {
    title: "Ocorrencia de biosseguranca aberta",
    description:
      "Existe ocorrencia real aberta em eventos.payload.biosseguranca_ocorrencia.",
    recommendedAction:
      "Registrar resolucao ou cancelamento por novo evento vinculado quando a ocorrencia for tratada.",
    limitations: ["Sem ocorrencia real em payload, nada e inferido."],
  },
  ocorrencia_com_pendencia_aberta: {
    title: "Ocorrencia com pendencia aberta",
    description:
      "Existe pendencia corretiva especifica aberta e vinculada a ocorrencia real por source_evento_id.",
    recommendedAction:
      "Executar e encerrar a pendencia por fluxo corretivo vinculado ao evento de origem.",
    limitations: ["Agenda geral ou checklist contextual sem source_evento_id nao foram considerados."],
  },
  suspeita_notificavel_aberta: {
    title: "Suspeita notificavel aberta",
    description:
      "Existe suspeita de doenca notificavel aberta vinculada a animal, lote ou evento.",
    recommendedAction:
      "Registrar acompanhamento, notificacao ou encerramento por evento vinculado conforme fonte tecnica.",
    limitations: ["Nao foi criada tarefa geral para confirmar ausencia de doenca."],
  },
  pendencia_corretiva_vencida: {
    title: "Pendencia corretiva vencida",
    description:
      "A agenda corretiva especifica vinculada a uma ocorrencia real esta vencida.",
    recommendedAction:
      "Tratar a pendencia e registrar encerramento vinculado ao evento de origem.",
    limitations: ["Somente pendencias corretivas especificas vinculadas foram avaliadas."],
  },
};
