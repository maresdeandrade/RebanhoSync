import { differenceInDays, parseISO } from "date-fns";

interface OccupancyEntryInfoProps {
  dataEntrada: string;
  label?: string;
  showDays?: boolean;
  showBadge?: boolean;
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(dateString));
}

/**
 * Exibe data de entrada e, opcionalmente, quantidade de dias de ocupação.
 * Usado em listas de animais (LoteDetalhe) e lotes (PastoDetalhe).
 */
export function OccupancyEntryInfo({
  dataEntrada,
  label = "Entrada",
  showDays = true,
  showBadge = false,
}: OccupancyEntryInfoProps) {
  const dias = differenceInDays(new Date(), parseISO(dataEntrada));
  const isRecente = dias <= 7;

  return (
    <p className="text-xs text-muted-foreground">
      {label}: {formatDate(dataEntrada)}
      {showDays && ` (${dias} dia${dias !== 1 ? "s" : ""})`}
      {showBadge && isRecente && (
        <span className="ml-1 inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
          Novo
        </span>
      )}
    </p>
  );
}
