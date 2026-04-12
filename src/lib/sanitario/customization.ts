import type {
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
  SanitarioTipoEnum,
} from "@/lib/offline/types";
import {
  buildSanitaryBaseCalendarPayload,
  readSanitaryBaseCalendar,
  type SanitaryBaseCalendarAnchor,
  type SanitaryBaseCalendarMode,
} from "@/lib/sanitario/calendar";

export type SanitaryCalendarDraftMode = "" | SanitaryBaseCalendarMode;
export type SanitaryCalendarDraftAnchor = "" | SanitaryBaseCalendarAnchor;

export type SanitaryTargetSex = "" | "M" | "F" | "todos";

export interface SanitaryProtocolDraft {
  nome: string;
  descricao: string;
  ativo: boolean;
  sexoAlvo: SanitaryTargetSex;
  idadeMinDias: string;
  idadeMaxDias: string;
  obrigatorio: boolean;
  obrigatorioPorRisco: boolean;
  requiresVet: boolean;
  requiresComplianceDocument: boolean;
  validoDe: string;
  validoAte: string;
}

export interface SanitaryProtocolItemDraft {
  tipo: SanitarioTipoEnum;
  produto: string;
  intervaloDias: string;
  doseNum: string;
  geraAgenda: boolean;
  indicacao: string;
  observacoes: string;
  sexoAlvo: SanitaryTargetSex;
  idadeMinDias: string;
  idadeMaxDias: string;
  obrigatorio: boolean;
  obrigatorioPorRisco: boolean;
  requiresVet: boolean;
  requiresComplianceDocument: boolean;
  dedupTemplate: string;
  itemCode: string;
  dependsOnItemCode: string;
  calendarMode: SanitaryCalendarDraftMode;
  calendarAnchor: SanitaryCalendarDraftAnchor;
  calendarLabel: string;
  calendarMonths: string;
  calendarNotes: string;
}

export function createEmptyProtocolDraft(
  overrides?: Partial<SanitaryProtocolDraft>,
): SanitaryProtocolDraft {
  return {
    nome: "",
    descricao: "",
    ativo: true,
    sexoAlvo: "",
    idadeMinDias: "",
    idadeMaxDias: "",
    obrigatorio: false,
    obrigatorioPorRisco: false,
    requiresVet: false,
    requiresComplianceDocument: false,
    validoDe: "",
    validoAte: "",
    ...overrides,
  };
}

export function createEmptyProtocolItemDraft(
  overrides?: Partial<SanitaryProtocolItemDraft>,
): SanitaryProtocolItemDraft {
  return {
    tipo: "vacinacao",
    produto: "",
    intervaloDias: "1",
    doseNum: "1",
    geraAgenda: true,
    indicacao: "",
    observacoes: "",
    sexoAlvo: "",
    idadeMinDias: "",
    idadeMaxDias: "",
    obrigatorio: false,
    obrigatorioPorRisco: false,
    requiresVet: false,
    requiresComplianceDocument: false,
    dedupTemplate: "",
    itemCode: "",
    dependsOnItemCode: "",
    calendarMode: "",
    calendarAnchor: "",
    calendarLabel: "",
    calendarMonths: "",
    calendarNotes: "",
    ...overrides,
  };
}

const PROTOCOL_PAYLOAD_KEYS = [
  "sexo_alvo",
  "idade_min_dias",
  "idade_minima_dias",
  "idade_max_dias",
  "idade_maxima_dias",
  "obrigatorio",
  "obrigatorio_por_risco",
  "requires_vet",
  "requires_vet_supervision",
  "requires_compliance_document",
  "valido_de",
  "valido_ate",
];

const ITEM_PAYLOAD_KEYS = [
  "indicacao",
  "observacoes",
  "sexo_alvo",
  "idade_min_dias",
  "idade_minima_dias",
  "idade_max_dias",
  "idade_maxima_dias",
  "obrigatorio",
  "obrigatorio_por_risco",
  "requires_vet",
  "requires_vet_supervision",
  "requires_compliance_document",
  "item_code",
  "depends_on_item_code",
  "calendario_base",
];

function readString(
  record: Record<string, unknown> | null | undefined,
  key: string,
): string {
  const value = record?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function readNumberString(
  record: Record<string, unknown> | null | undefined,
  keys: string[],
): string {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(Math.trunc(value));
    }
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function readBoolean(
  record: Record<string, unknown> | null | undefined,
  keys: string[],
): boolean {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "boolean") {
      return value;
    }
  }
  return false;
}

function normalizeSexoAlvo(value: unknown): SanitaryTargetSex {
  return value === "M" || value === "F" || value === "todos" ? value : "";
}

function normalizeCalendarMode(value: unknown): SanitaryCalendarDraftMode {
  return value === "campaign" ||
    value === "age_window" ||
    value === "rolling_interval" ||
    value === "immediate" ||
    value === "clinical_protocol"
    ? value
    : "";
}

function normalizeCalendarAnchor(value: unknown): SanitaryCalendarDraftAnchor {
  return value === "calendar_month" ||
    value === "birth" ||
    value === "weaning" ||
    value === "pre_breeding_season" ||
    value === "clinical_need" ||
    value === "dry_off"
    ? value
    : "";
}

function readCalendarMonths(
  payload: Record<string, unknown> | null | undefined,
): string {
  const rule = readSanitaryBaseCalendar(payload);
  if (!rule?.months?.length) return "";
  return rule.months.join(", ");
}

function upsertString(
  payload: Record<string, unknown>,
  key: string,
  value: string,
) {
  if (value.trim().length === 0) {
    delete payload[key];
    return;
  }

  payload[key] = value.trim();
}

function upsertNumber(
  payload: Record<string, unknown>,
  key: string,
  rawValue: string,
) {
  const normalized = rawValue.trim();
  if (normalized.length === 0) {
    delete payload[key];
    return;
  }

  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    delete payload[key];
    return;
  }

  payload[key] = Math.max(0, Math.trunc(numeric));
}

function upsertBoolean(
  payload: Record<string, unknown>,
  key: string,
  value: boolean,
) {
  payload[key] = value;
}

function clearKeys(
  payload: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    delete payload[key];
  }
}

function normalizeInterval(intervaloDias: string): number {
  const parsed = Number(intervaloDias.trim());
  if (!Number.isFinite(parsed)) return 1;
  return parsed > 0 ? Math.trunc(parsed) : 1;
}

function parseCalendarMonths(value: string): number[] | undefined {
  const months = value
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry))
    .map((entry) => Math.trunc(entry))
    .filter((entry) => entry >= 1 && entry <= 12);

  return months.length > 0 ? Array.from(new Set(months)) : undefined;
}

function inferCalendarLabel(draft: SanitaryProtocolItemDraft): string {
  switch (draft.calendarMode) {
    case "campaign":
      return draft.calendarMonths.trim().length > 0
        ? `Campanha programada (${draft.calendarMonths.trim()})`
        : "Campanha programada";
    case "age_window":
      return draft.idadeMinDias || draft.idadeMaxDias
        ? `Janela etaria ${draft.idadeMinDias || "0"}-${draft.idadeMaxDias || "..."} dias`
        : "Janela etaria";
    case "rolling_interval":
      return `Revisao recorrente a cada ${normalizeInterval(draft.intervaloDias)} dias`;
    case "immediate":
      return "Procedimento imediato";
    case "clinical_protocol":
      return "Uso sob criterio clinico";
    default:
      return "";
  }
}

function buildCalendarPayload(
  draft: SanitaryProtocolItemDraft,
): Record<string, unknown> | null {
  if (!draft.calendarMode || !draft.calendarAnchor) {
    return null;
  }

  return buildSanitaryBaseCalendarPayload({
    mode: draft.calendarMode,
    anchor: draft.calendarAnchor,
    label: draft.calendarLabel.trim() || inferCalendarLabel(draft),
    months:
      draft.calendarMode === "campaign"
        ? parseCalendarMonths(draft.calendarMonths)
        : undefined,
    intervalDays:
      draft.calendarMode === "campaign" ||
      draft.calendarMode === "rolling_interval"
        ? normalizeInterval(draft.intervaloDias)
        : null,
    ageStartDays:
      draft.idadeMinDias.trim().length > 0 ? Number(draft.idadeMinDias) : null,
    ageEndDays:
      draft.idadeMaxDias.trim().length > 0 ? Number(draft.idadeMaxDias) : null,
    notes: draft.calendarNotes.trim() || undefined,
  });
}

export function readProtocolDraft(
  protocol: Pick<ProtocoloSanitario, "nome" | "descricao" | "ativo" | "payload">,
): SanitaryProtocolDraft {
  return {
    nome: protocol.nome,
    descricao: protocol.descricao ?? "",
    ativo: protocol.ativo,
    sexoAlvo: normalizeSexoAlvo(protocol.payload?.sexo_alvo),
    idadeMinDias: readNumberString(protocol.payload, [
      "idade_min_dias",
      "idade_minima_dias",
    ]),
    idadeMaxDias: readNumberString(protocol.payload, [
      "idade_max_dias",
      "idade_maxima_dias",
    ]),
    obrigatorio: readBoolean(protocol.payload, ["obrigatorio"]),
    obrigatorioPorRisco: readBoolean(protocol.payload, ["obrigatorio_por_risco"]),
    requiresVet: readBoolean(protocol.payload, [
      "requires_vet",
      "requires_vet_supervision",
    ]),
    requiresComplianceDocument: readBoolean(protocol.payload, [
      "requires_compliance_document",
    ]),
    validoDe: readString(protocol.payload, "valido_de"),
    validoAte: readString(protocol.payload, "valido_ate"),
  };
}

export function readProtocolItemDraft(
  item: Pick<
    ProtocoloSanitarioItem,
    | "tipo"
    | "produto"
    | "intervalo_dias"
    | "dose_num"
    | "gera_agenda"
    | "dedup_template"
    | "payload"
  >,
): SanitaryProtocolItemDraft {
  const calendarRule = readSanitaryBaseCalendar(item.payload);
  const idadeMinDias =
    readNumberString(item.payload, ["idade_min_dias", "idade_minima_dias"]) ||
    (typeof calendarRule?.ageStartDays === "number"
      ? String(Math.trunc(calendarRule.ageStartDays))
      : "");
  const idadeMaxDias =
    readNumberString(item.payload, ["idade_max_dias", "idade_maxima_dias"]) ||
    (typeof calendarRule?.ageEndDays === "number"
      ? String(Math.trunc(calendarRule.ageEndDays))
      : "");

  return {
    tipo: item.tipo,
    produto: item.produto,
    intervaloDias: String(item.intervalo_dias),
    doseNum:
      typeof item.dose_num === "number" && Number.isFinite(item.dose_num)
        ? String(item.dose_num)
        : "",
    geraAgenda: item.gera_agenda,
    indicacao: readString(item.payload, "indicacao"),
    observacoes: readString(item.payload, "observacoes"),
    sexoAlvo: normalizeSexoAlvo(item.payload?.sexo_alvo),
    idadeMinDias,
    idadeMaxDias,
    obrigatorio: readBoolean(item.payload, ["obrigatorio"]),
    obrigatorioPorRisco: readBoolean(item.payload, ["obrigatorio_por_risco"]),
    requiresVet: readBoolean(item.payload, [
      "requires_vet",
      "requires_vet_supervision",
    ]),
    requiresComplianceDocument: readBoolean(item.payload, [
      "requires_compliance_document",
    ]),
    dedupTemplate: item.dedup_template ?? "",
    itemCode: readString(item.payload, "item_code"),
    dependsOnItemCode: readString(item.payload, "depends_on_item_code"),
    calendarMode: normalizeCalendarMode(calendarRule?.mode),
    calendarAnchor: normalizeCalendarAnchor(calendarRule?.anchor),
    calendarLabel: calendarRule?.label ?? "",
    calendarMonths: readCalendarMonths(item.payload),
    calendarNotes: calendarRule?.notes ?? "",
  };
}

export function buildProtocolPayload(
  basePayload: Record<string, unknown> | null | undefined,
  draft: SanitaryProtocolDraft,
): Record<string, unknown> {
  const payload =
    basePayload && typeof basePayload === "object"
      ? { ...basePayload }
      : ({} as Record<string, unknown>);

  clearKeys(payload, PROTOCOL_PAYLOAD_KEYS);

  upsertString(payload, "sexo_alvo", draft.sexoAlvo);
  upsertNumber(payload, "idade_min_dias", draft.idadeMinDias);
  upsertNumber(payload, "idade_max_dias", draft.idadeMaxDias);
  upsertBoolean(payload, "obrigatorio", draft.obrigatorio);
  upsertBoolean(payload, "obrigatorio_por_risco", draft.obrigatorioPorRisco);
  upsertBoolean(payload, "requires_vet", draft.requiresVet);
  upsertBoolean(
    payload,
    "requires_compliance_document",
    draft.requiresComplianceDocument,
  );
  upsertString(payload, "valido_de", draft.validoDe);
  upsertString(payload, "valido_ate", draft.validoAte);

  return payload;
}

export function buildProtocolItemPayload(
  basePayload: Record<string, unknown> | null | undefined,
  draft: SanitaryProtocolItemDraft,
  extraPayload?: Record<string, unknown>,
): Record<string, unknown> {
  const payload =
    basePayload && typeof basePayload === "object"
      ? { ...basePayload }
      : ({} as Record<string, unknown>);

  clearKeys(payload, ITEM_PAYLOAD_KEYS);

  upsertString(payload, "indicacao", draft.indicacao);
  upsertString(payload, "observacoes", draft.observacoes);
  upsertString(payload, "sexo_alvo", draft.sexoAlvo);
  upsertNumber(payload, "idade_min_dias", draft.idadeMinDias);
  upsertNumber(payload, "idade_max_dias", draft.idadeMaxDias);
  upsertBoolean(payload, "obrigatorio", draft.obrigatorio);
  upsertBoolean(payload, "obrigatorio_por_risco", draft.obrigatorioPorRisco);
  upsertBoolean(payload, "requires_vet", draft.requiresVet);
  upsertBoolean(
    payload,
    "requires_compliance_document",
    draft.requiresComplianceDocument,
  );
  upsertString(payload, "item_code", draft.itemCode);
  upsertString(payload, "depends_on_item_code", draft.dependsOnItemCode);

  const calendarPayload = buildCalendarPayload(draft);
  if (calendarPayload) {
    Object.assign(payload, calendarPayload);
  }

  return extraPayload ? { ...payload, ...extraPayload } : payload;
}

export function validateProtocolDraft(draft: SanitaryProtocolDraft): string | null {
  if (draft.nome.trim().length === 0) {
    return "Nome do protocolo e obrigatorio.";
  }

  const min = draft.idadeMinDias.trim();
  const max = draft.idadeMaxDias.trim();
  if (min && max && Number(min) > Number(max)) {
    return "Faixa etaria invalida no protocolo.";
  }

  if (
    draft.validoDe &&
    draft.validoAte &&
    draft.validoDe > draft.validoAte
  ) {
    return "Janela de vigencia invalida no protocolo.";
  }

  return null;
}

export function validateProtocolItemDraft(
  draft: SanitaryProtocolItemDraft,
): string | null {
  if (draft.produto.trim().length === 0) {
    return "Produto da etapa e obrigatorio.";
  }

  const min = draft.idadeMinDias.trim();
  const max = draft.idadeMaxDias.trim();
  if (min && max && Number(min) > Number(max)) {
    return "Faixa etaria invalida na etapa.";
  }

  if (
    draft.dependsOnItemCode.trim().length > 0 &&
    draft.itemCode.trim().length === 0
  ) {
    return "Defina um codigo da etapa antes de configurar dependencia.";
  }

  if (
    (draft.calendarMode && !draft.calendarAnchor) ||
    (!draft.calendarMode && draft.calendarAnchor)
  ) {
    return "Calendario-base exige modo e ancora juntos.";
  }

  if (
    draft.calendarMode === "campaign" &&
    draft.calendarMonths.trim().length > 0 &&
    !parseCalendarMonths(draft.calendarMonths)
  ) {
    return "Meses do calendario-base invalidos.";
  }

  return null;
}

export function buildProtocolUpdateRecord(
  protocol: Pick<ProtocoloSanitario, "id" | "payload">,
  draft: SanitaryProtocolDraft,
) {
  return {
    id: protocol.id,
    nome: draft.nome.trim(),
    descricao: draft.descricao.trim() || null,
    ativo: draft.ativo,
    payload: buildProtocolPayload(protocol.payload, draft),
  };
}

export function buildProtocolInsertRecord(
  protocolId: string,
  draft: SanitaryProtocolDraft,
) {
  return {
    id: protocolId,
    nome: draft.nome.trim(),
    descricao: draft.descricao.trim() || null,
    ativo: draft.ativo,
    payload: buildProtocolPayload(null, draft),
  };
}

export function buildProtocolItemUpdateRecord(
  item: Pick<ProtocoloSanitarioItem, "id" | "payload">,
  draft: SanitaryProtocolItemDraft,
  extraPayload?: Record<string, unknown>,
) {
  const normalizedDose = draft.doseNum.trim();
  const parsedDose = Number(normalizedDose);

  return {
    id: item.id,
    tipo: draft.tipo,
    produto: draft.produto.trim(),
    intervalo_dias: normalizeInterval(draft.intervaloDias),
    dose_num:
      normalizedDose.length === 0 || !Number.isFinite(parsedDose)
        ? null
        : Math.max(1, Math.trunc(parsedDose)),
    gera_agenda: draft.geraAgenda,
    dedup_template: draft.dedupTemplate.trim() || null,
    payload: buildProtocolItemPayload(item.payload, draft, extraPayload),
  };
}

export function buildProtocolItemInsertRecord(input: {
  itemId: string;
  protocoloId: string;
  protocolItemId: string;
  version?: number;
  draft: SanitaryProtocolItemDraft;
  extraPayload?: Record<string, unknown>;
}) {
  const normalizedDose = input.draft.doseNum.trim();
  const parsedDose = Number(normalizedDose);

  return {
    id: input.itemId,
    protocolo_id: input.protocoloId,
    protocol_item_id: input.protocolItemId,
    version: input.version ?? 1,
    tipo: input.draft.tipo,
    produto: input.draft.produto.trim(),
    intervalo_dias: normalizeInterval(input.draft.intervaloDias),
    dose_num:
      normalizedDose.length === 0 || !Number.isFinite(parsedDose)
        ? null
        : Math.max(1, Math.trunc(parsedDose)),
    gera_agenda: input.draft.geraAgenda,
    dedup_template: input.draft.dedupTemplate.trim() || null,
    payload: buildProtocolItemPayload(
      null,
      input.draft,
      input.extraPayload,
    ),
  };
}
