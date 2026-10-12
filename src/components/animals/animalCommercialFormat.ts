export function formatCommercialDate(value: string | null | undefined) {
  if (!value) return "Não informada";
  // Datas civis não passam por UTC; timestamps mantêm a data local.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data indisponível"
    : date.toLocaleDateString("pt-BR");
}

export function formatCommercialMoney(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "Não registrado";
}

export function formatCommercialNumber(value: unknown, unit: string) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toLocaleString("pt-BR")} ${unit}`
    : "Não registrado";
}
