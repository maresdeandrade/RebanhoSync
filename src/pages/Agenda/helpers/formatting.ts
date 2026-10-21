import type { SanitarioTipoEnum } from "@/lib/offline/types";

export function getAgendaStatusTone(
  status: string,
): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "cancelado") return "danger";
  if (status === "concluido") return "success";
  return "warning";
}

export function readString(
  record: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function readNumber(
  record: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function asSanitarioTipo(
  value: string | null,
): SanitarioTipoEnum | null {
  if (
    value === "vacinacao" ||
    value === "vermifugacao" ||
    value === "medicamento"
  ) {
    return value;
  }
  return null;
}

export function formatAnimalAge(dataNascimento: string | null) {
  if (!dataNascimento) return "idade n/d";

  const birth = new Date(`${dataNascimento}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return "idade n/d";

  const diffMs = Date.now() - birth.getTime();
  if (diffMs < 0) return "idade n/d";

  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (totalDays < 30) return `${totalDays}d`;

  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);

  if (years > 0) return months > 0 ? `${years}a ${months}m` : `${years}a`;
  return `${Math.floor(totalDays / 30)}m`;
}

export function formatAgendaDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

export function formatAgendaTypeLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

const MANEJO_LABELS = new Map([
  ["vacinacao", "Vacinação"],
  ["vermifugacao", "Vermifugação"],
  ["medicamento", "Medicamento"],
  ["pesagem", "Pesagem"],
  ["reproducao", "Reprodução"],
  ["movimentacao", "Movimentação"],
  ["nutricao", "Nutrição"],
  ["financeiro", "Financeiro"],
]);

export function formatAgendaManejoLabel(tipo: string) {
  const persistedType = tipo?.trim() ?? "";
  return (
    MANEJO_LABELS.get(persistedType) ??
    (formatAgendaTypeLabel(persistedType) || "Tipo não informado")
  );
}

export function getGroupVisibilityLabel(
  visibleCount: number,
  totalCount: number,
) {
  if (visibleCount === totalCount) {
    return `${totalCount} item(ns) no recorte`;
  }

  return `${visibleCount} de ${totalCount} item(ns) visíveis`;
}
