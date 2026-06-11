export const SPECIES_CODES = ["bovino", "bubalino"] as const;
export type SpeciesCode = (typeof SPECIES_CODES)[number];

export const PRODUCTIVE_APTITUDES = ["corte", "leite", "mista", "all"] as const;
export type ProductiveAptitude = (typeof PRODUCTIVE_APTITUDES)[number];

export const PROTOCOL_LEGAL_STATUSES = [
  "obrigatorio_norma",
  "recomendado_tecnico",
  "condicional",
  "estrategico",
  "experimental_alerta",
  "bloqueado"
] as const;
export type ProtocolLegalStatus = (typeof PROTOCOL_LEGAL_STATUSES)[number];