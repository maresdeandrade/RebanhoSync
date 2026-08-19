import type {
  InfraestruturaPasto,
  LoteStatusEnum,
  TipoPastoEnum,
} from "@/lib/offline/types";

export interface PastoRegistrationDraft {
  id?: string;
  nome: string;
  areaHa: number;
  capacidadeUa?: number | null;
  tipoPasto: TipoPastoEnum;
  tipoArea?: string | null;
  forrageiraNome?: string | null;
  forrageiraGenero?: string | null;
  forrageiraCultivar?: string | null;
  alturaEntrada?: number | null;
  alturaSaida?: number | null;
  capacidadeUaAlvo?: number | null;
  infraestrutura?: InfraestruturaPasto;
  observacoes?: string | null;
  payload?: Record<string, unknown>;
}

export function validatePastoRegistrationDraft(
  draft: PastoRegistrationDraft,
): string | null {
  if (!draft.nome.trim()) return "Nome do pasto é obrigatório.";
  if (!Number.isFinite(draft.areaHa) || draft.areaHa <= 0) {
    return "Área do pasto deve ser maior que zero.";
  }

  for (const [label, value] of [
    ["Capacidade UA", draft.capacidadeUa],
    ["Altura de entrada", draft.alturaEntrada],
    ["Altura de saída", draft.alturaSaida],
    ["Capacidade UA alvo", draft.capacidadeUaAlvo],
  ] as const) {
    if (value == null) continue;
    if (!Number.isFinite(value)) return `${label} deve ser numérica.`;
  }

  if (draft.capacidadeUa != null && draft.capacidadeUa < 0) {
    return "Capacidade UA deve ser maior ou igual a zero.";
  }
  if (draft.alturaEntrada != null && draft.alturaEntrada <= 0) {
    return "Altura de entrada deve ser maior que zero.";
  }
  if (draft.alturaSaida != null && draft.alturaSaida <= 0) {
    return "Altura de saída deve ser maior que zero.";
  }
  if (
    draft.alturaEntrada != null &&
    draft.alturaSaida != null &&
    draft.alturaSaida >= draft.alturaEntrada
  ) {
    return "Altura de saída deve ser menor que a altura de entrada.";
  }
  if (draft.capacidadeUaAlvo != null && draft.capacidadeUaAlvo < 0) {
    return "Capacidade UA alvo deve ser maior ou igual a zero.";
  }

  return null;
}

export function buildPastoRegistrationRecord(input: {
  fazendaId: string;
  draft: PastoRegistrationDraft;
  recordedAt?: string;
}) {
  const issue = validatePastoRegistrationDraft(input.draft);
  if (issue) throw new Error(issue);

  const draft = input.draft;
  const recordedAt = input.recordedAt ?? new Date().toISOString();
  return {
    id: draft.id ?? crypto.randomUUID(),
    fazenda_id: input.fazendaId,
    nome: draft.nome.trim(),
    area_ha: draft.areaHa,
    capacidade_ua: draft.capacidadeUa ?? null,
    tipo_pasto: draft.tipoPasto,
    tipo_area: draft.tipoArea ?? null,
    forrageira_nome: draft.forrageiraNome ?? null,
    forrageira_genero: draft.forrageiraGenero ?? null,
    forrageira_cultivar: draft.forrageiraCultivar ?? null,
    altura_entrada_alvo_cm: draft.alturaEntrada ?? null,
    altura_saida_alvo_cm: draft.alturaSaida ?? null,
    capacidade_ua_alvo: draft.capacidadeUaAlvo ?? null,
    infraestrutura: draft.infraestrutura ?? {},
    observacoes: draft.observacoes?.trim() || null,
    payload: draft.payload ?? {},
    created_at: recordedAt,
    updated_at: recordedAt,
    deleted_at: null,
  };
}

export interface LoteRegistrationDraft {
  id?: string;
  nome: string;
  status: LoteStatusEnum;
  pastoId?: string | null;
  touroId?: string | null;
  observacoes?: string | null;
  payload?: Record<string, unknown>;
}

export function validateLoteRegistrationDraft(
  draft: LoteRegistrationDraft,
): string | null {
  if (!draft.nome.trim()) return "Nome do lote é obrigatório.";
  return null;
}

export function buildLoteRegistrationRecord(input: {
  fazendaId: string;
  draft: LoteRegistrationDraft;
  recordedAt?: string;
}) {
  const issue = validateLoteRegistrationDraft(input.draft);
  if (issue) throw new Error(issue);

  const draft = input.draft;
  const recordedAt = input.recordedAt ?? new Date().toISOString();
  return {
    id: draft.id ?? crypto.randomUUID(),
    fazenda_id: input.fazendaId,
    nome: draft.nome.trim(),
    status: draft.status,
    pasto_id: draft.pastoId ?? null,
    touro_id: draft.touroId ?? null,
    observacoes: draft.observacoes?.trim() || null,
    payload: draft.payload ?? {},
    created_at: recordedAt,
    updated_at: recordedAt,
    deleted_at: null,
  };
}
