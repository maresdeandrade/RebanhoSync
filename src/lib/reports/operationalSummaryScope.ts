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

function filterOptionalFarmRows<T extends { fazenda_id: string }>(
  rows: readonly T[] | undefined,
  fazendaId: string,
): T[] | undefined {
  return rows ? filterFarmRows(rows, fazendaId) : undefined;
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
    eventosSanitario: filterOptionalFarmRows(input.eventosSanitario, fazendaId),
    eventosComercial: filterOptionalFarmRows(input.eventosComercial, fazendaId),
    eventosReproducao: filterOptionalFarmRows(
      input.eventosReproducao,
      fazendaId,
    ),
    eventosPesagem: filterFarmRows(input.eventosPesagem, fazendaId),
    eventosFinanceiro: filterFarmRows(input.eventosFinanceiro, fazendaId),
    financeTransactions: filterOptionalFarmRows(
      input.financeTransactions,
      fazendaId,
    ),
    financeCategories: filterOptionalFarmRows(
      input.financeCategories,
      fazendaId,
    ),
    sociedadesPecuarias: filterOptionalFarmRows(
      input.sociedadesPecuarias,
      fazendaId,
    ),
    sociedadeAnimais: filterOptionalFarmRows(input.sociedadeAnimais, fazendaId),
    gestures: filterFarmRows(input.gestures, fazendaId),
    rejections: input.rejections.filter(
      (rejection) => rejection.fazenda_id === fazendaId,
    ),
    protocolosSanitarios: filterOptionalFarmRows(
      input.protocolosSanitarios,
      fazendaId,
    ),
    protocoloItensSanitarios: filterOptionalFarmRows(
      input.protocoloItensSanitarios,
      fazendaId,
    ),
    fazendaSanidadeConfig:
      input.fazendaSanidadeConfig?.fazenda_id === fazendaId
        ? input.fazendaSanidadeConfig
        : null,
    insumos: filterOptionalFarmRows(input.insumos, fazendaId),
    insumoApresentacoes: filterOptionalFarmRows(
      input.insumoApresentacoes,
      fazendaId,
    ),
    insumoLotes: filterOptionalFarmRows(input.insumoLotes, fazendaId),
    insumoMovimentacoes: filterOptionalFarmRows(
      input.insumoMovimentacoes,
      fazendaId,
    ),
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
