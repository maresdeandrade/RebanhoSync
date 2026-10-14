export function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3,
  }).format(value);
}

export function formatDate(value: string | null) {
  if (!value) return "Sem validade";
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-BR");
}

export function formatEventDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR");
}
