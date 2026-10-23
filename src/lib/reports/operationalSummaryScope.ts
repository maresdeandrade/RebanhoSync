import type {
  OperationalSummaryInput,
  ReportRange,
} from "./operationalSummaryTypes";
import {
  resolveMetricTimezone,
  getDateKeyInTimezone,
  getEventDateKey,
} from "./operationalSummaryCalendar";

function filterFarmRows<T extends { fazenda_id: string }>(
  rows: readonly T[] | undefined,
  fazendaId: string,
): T[] {
  return (rows ?? []).filter((row) => row.fazenda_id === fazendaId);
}

function scopeOperationalSummaryInput(
  input: OperationalSummaryInput,
): OperationalSummaryInput {
  const fazendaId = input.fazendaId.trim();
  if (!fazendaId)
    throw new Error("fazendaId is required for operational reports");

  return {
    ...input,
    fazendaId,
    animals: filterFarmRows(input.animals, fazendaId),
    lotes: filterFarmRows(input.lotes, fazendaId),
    pastos: filterFarmRows(input.pastos, fazendaId),
    agenda: filterFarmRows(input.agenda, fazendaId),
    eventos: filterFarmRows(input.eventos, fazendaId),
    eventosSanitario: input.eventosSanitario
      ? filterFarmRows(input.eventosSanitario, fazendaId)
      : undefined,
    eventosComercial: input.eventosComercial
      ? filterFarmRows(input.eventosComercial, fazendaId)
      : undefined,
    eventosReproducao: input.eventosReproducao
      ? filterFarmRows(input.eventosReproducao, fazendaId)
      : undefined,
    eventosPesagem: filterFarmRows(input.eventosPesagem, fazendaId),
    eventosFinanceiro: filterFarmRows(input.eventosFinanceiro, fazendaId),
    financeTransactions: input.financeTransactions
      ? filterFarmRows(input.financeTransactions, fazendaId)
      : undefined,
    financeCategories: input.financeCategories
      ? filterFarmRows(input.financeCategories, fazendaId)
      : undefined,
    sociedadesPecuarias: input.sociedadesPecuarias
      ? filterFarmRows(input.sociedadesPecuarias, fazendaId)
      : undefined,
    sociedadeAnimais: input.sociedadeAnimais
      ? filterFarmRows(input.sociedadeAnimais, fazendaId)
      : undefined,
    gestures: filterFarmRows(input.gestures, fazendaId),
    rejections: input.rejections.filter(
      (rejection) => rejection.fazenda_id === fazendaId,
    ),
    protocolosSanitarios: input.protocolosSanitarios
      ? filterFarmRows(input.protocolosSanitarios, fazendaId)
      : undefined,
    protocoloItensSanitarios: input.protocoloItensSanitarios
      ? filterFarmRows(input.protocoloItensSanitarios, fazendaId)
      : undefined,
    fazendaSanidadeConfig:
      input.fazendaSanidadeConfig?.fazenda_id === fazendaId
        ? input.fazendaSanidadeConfig
        : null,
    insumos: input.insumos
      ? filterFarmRows(input.insumos, fazendaId)
      : undefined,
    insumoApresentacoes: input.insumoApresentacoes
      ? filterFarmRows(input.insumoApresentacoes, fazendaId)
      : undefined,
    insumoLotes: input.insumoLotes
      ? filterFarmRows(input.insumoLotes, fazendaId)
      : undefined,
    insumoMovimentacoes: input.insumoMovimentacoes
      ? filterFarmRows(input.insumoMovimentacoes, fazendaId)
      : undefined,
  };
}

export function prepareOperationalSummary(
  rawInput: OperationalSummaryInput,
  range: ReportRange,
  now: Date,
) {
  const input = scopeOperationalSummaryInput(rawInput);
  const metricTimezone = resolveMetricTimezone(input.farmTimezone);
  const todayKey = getDateKeyInTimezone(now, metricTimezone.timezone);
  const animals = input.animals.filter(
    (animal) => !animal.deleted_at && animal.status === "ativo",
  );
  const lotes = input.lotes.filter((lote) => !lote.deleted_at);
  const pastos = input.pastos.filter((pasto) => !pasto.deleted_at);
  const agendaAberta = input.agenda.filter(
    (item) => !item.deleted_at && item.status === "agendado",
  );
  const eventos = input.eventos.filter(
    (evento) =>
      !evento.deleted_at &&
      getEventDateKey(evento, metricTimezone.timezone) >= range.from &&
      getEventDateKey(evento, metricTimezone.timezone) <= range.to,
  );

  const animalById = new Map(
    input.animals
      .filter((animal) => !animal.deleted_at)
      .map((animal) => [
        animal.id,
        animal.identificacao || animal.nome || "Animal sem identificacao",
      ]),
  );
  const loteById = new Map(lotes.map((lote) => [lote.id, lote.nome]));
  const financeByEventId = new Map(
    input.eventosFinanceiro
      .filter((item) => !item.deleted_at)
      .map((item) => [item.evento_id, item]),
  );
  const commercialByEventId = new Map(
    (input.eventosComercial ?? [])
      .filter((item) => !item.deleted_at)
      .map((item) => [item.evento_id, item]),
  );
  const weightByEventId = new Map(
    input.eventosPesagem
      .filter((item) => !item.deleted_at)
      .map((item) => [item.evento_id, item]),
  );
  const sanitaryDetailByEventId = new Map(
    (input.eventosSanitario ?? [])
      .filter((item) => !item.deleted_at)
      .map((item) => [item.evento_id, item]),
  );

  return {
    input,
    metricTimezone,
    todayKey,
    animals,
    lotes,
    pastos,
    agendaAberta,
    eventos,
    animalById,
    loteById,
    financeByEventId,
    commercialByEventId,
    weightByEventId,
    sanitaryDetailByEventId,
  };
}
