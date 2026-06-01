import type {
  Insumo,
  InsumoUnidadeBaseEnum,
  SanitarioTipoEnum,
} from "@/lib/offline/types";

const ROUTE_ALIASES: Record<string, string> = {
  sc: "subcutanea",
  subcutanea: "subcutanea",
  subcutaneo: "subcutanea",
  im: "intramuscular",
  intramuscular: "intramuscular",
  oral: "oral",
  vo: "oral",
  topica: "topica",
  topico: "topica",
  intramamaria: "intramamaria",
  intramamario: "intramamaria",
  outra: "outra",
};

const DEFAULT_ROUTE_BY_SANITARY_TYPE: Record<SanitarioTipoEnum, string> = {
  vacinacao: "subcutanea",
  vermifugacao: "oral",
  medicamento: "intramuscular",
};

function readString(
  record: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function normalizeSanitaryApplicationRoute(
  value: string | null | undefined,
) {
  if (!value) return null;
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return ROUTE_ALIASES[normalized] ?? null;
}

export function resolveSanitaryDefaultApplicationRoute(input: {
  sanitarioTipo: SanitarioTipoEnum;
  insumo?: Pick<Insumo, "payload"> | null;
}) {
  const payloadRoute =
    readString(input.insumo?.payload, "via_aplicacao_padrao") ??
    readString(input.insumo?.payload, "viaAplicacaoPadrao") ??
    readString(input.insumo?.payload, "via_aplicacao") ??
    readString(input.insumo?.payload, "viaAplicacao") ??
    readString(input.insumo?.payload, "via_padrao") ??
    readString(input.insumo?.payload, "via");

  return (
    normalizeSanitaryApplicationRoute(payloadRoute) ??
    DEFAULT_ROUTE_BY_SANITARY_TYPE[input.sanitarioTipo]
  );
}

export function resolveSanitaryDefaultDoseUnit(input: {
  loteUnit?: InsumoUnidadeBaseEnum | null;
  insumo?: Pick<Insumo, "unidade_base"> | null;
}) {
  return input.loteUnit ?? input.insumo?.unidade_base ?? "dose";
}

export function resolveSanitaryDefaultDose() {
  return "1";
}
