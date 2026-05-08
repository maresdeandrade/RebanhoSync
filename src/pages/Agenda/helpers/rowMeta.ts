import {
  getSyncStageLabel,
  getSyncStageTone,
} from "@/lib/offline/syncPresentation";
import {
  formatAgendaDate,
  getAgendaStatusTone,
  readNumber,
  readString,
} from "@/pages/Agenda/helpers/formatting";
import type { AgendaRow } from "@/pages/Agenda/types";

const DOMAIN_LABEL: Record<string, string> = {
  sanitario: "Sanitário",
  alerta_sanitario: "Alerta sanitário",
  conformidade: "Conformidade",
  pesagem: "Pesagem",
  movimentacao: "Movimentação",
  nutricao: "Nutrição",
  financeiro: "Financeiro",
  reproducao: "Reprodução",
};

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export function buildAgendaRowMeta(row: AgendaRow) {
  const doseNumber = readNumber(row.item.source_ref, "dose_num");
  const indicacao =
    readString(row.item.source_ref, "indicacao") ??
    (doseNumber ? `Dose ${doseNumber}` : "Aplicação conforme protocolo");

  return {
    dateLabel: formatAgendaDate(row.item.data_prevista),
    statusLabel: STATUS_LABEL[row.item.status] ?? row.item.status,
    statusTone: getAgendaStatusTone(row.item.status),
    syncLabel: getSyncStageLabel(row.syncStage),
    syncTone: getSyncStageTone(row.syncStage),
    indicacao,
    domainLabel: DOMAIN_LABEL[row.item.dominio] ?? row.item.dominio,
  };
}
