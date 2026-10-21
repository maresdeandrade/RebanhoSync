import { resolveShortPhaseLabel } from "@/lib/agenda/grouping";
import {
  formatAgendaManejoLabel,
  readNumber,
  readString,
} from "@/pages/Agenda/helpers/formatting";
import { buildAgendaRowMeta } from "@/pages/Agenda/helpers/rowMeta";
import type { AgendaRow } from "@/pages/Agenda/types";

function uniqueLabels(values: (string | null | undefined)[]) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter(Boolean)),
  ) as string[];
}

function comparableLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("_", " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function rowPhaseLabel(row: AgendaRow) {
  const doseNum =
    readNumber(row.item.source_ref, "dose_num") ??
    row.protocolItem?.dose_num ??
    null;
  return (
    resolveShortPhaseLabel({
      tipo: row.item.tipo,
      itemCode: row.item.protocol_item_code,
      milestoneKey: readString(row.item.source_ref, "milestone_key"),
      doseNum,
    }) ?? (doseNum && doseNum > 0 ? `Dose ${doseNum}` : null)
  );
}

function rowContext(row: AgendaRow) {
  const protocolName =
    row.protocol?.nome?.trim() ||
    readString(row.item.source_ref, "protocolo") ||
    readString(row.item.payload, "protocolLabel");
  return [
    protocolName === "Protocolo sanitário" ? null : protocolName,
    readString(row.item.payload, "itemLabel"),
    readString(row.item.source_ref, "agenda_v2_id")
      ? null
      : (readString(row.item.source_ref, "indicacao") ??
        readString(row.item.payload, "indicacao")),
    rowPhaseLabel(row),
  ];
}

/** Presentation only: all rows participate, including those hidden by quick filters. */
export function buildAgendaGroupPresentation(rows: AgendaRow[]) {
  const title =
    uniqueLabels(
      rows.map((row) => formatAgendaManejoLabel(row.item.tipo)),
    ).join(" · ") || "Tipo não informado";
  const alreadyInTitle = (label: string) =>
    ` ${comparableLabel(title)} `.includes(` ${comparableLabel(label)} `);
  const rowMetas = rows.map(buildAgendaRowMeta);
  const statuses = Array.from(
    new Map(
      rowMetas.map((meta) => [
        meta.statusLabel,
        { label: meta.statusLabel, tone: meta.statusTone },
      ]),
    ).values(),
  );
  return {
    title,
    subtitle: uniqueLabels(rows.flatMap(rowContext))
      .filter((label) => !alreadyInTitle(label))
      .join(" · "),
    products: uniqueLabels(rows.map((row) => row.produtoLabel)).filter(
      (label) => !alreadyInTitle(label),
    ),
    dates: uniqueLabels(rowMetas.map((meta) => meta.dateLabel)),
    statuses,
    targets: uniqueLabels(
      rows.flatMap((row) => [
        !row.item.animal_id
          ? readString(row.item.source_ref, "target_label")
          : null,
        row.loteNome !== "Sem lote" ? `Lote: ${row.loteNome}` : null,
      ]),
    ),
    intervals: uniqueLabels(
      rows.map((row) =>
        row.item.interval_days_applied && row.item.interval_days_applied > 0
          ? `Intervalo: ${row.item.interval_days_applied} dias`
          : null,
      ),
    ),
  };
}
