import { differenceInDays, parseISO } from "date-fns";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface OccupancyTimelineProps {
  dataEntrada: string;
  diasEsperados?: number;
  label?: string;
}

export function OccupancyTimeline({
  dataEntrada,
  diasEsperados = 30,
  label = "Ocupação",
}: OccupancyTimelineProps) {
  const diasOcupacao = differenceInDays(new Date(), parseISO(dataEntrada));
  const percentualOcupacao = Math.min((diasOcupacao / diasEsperados) * 100, 100);
  const isExcedido = diasOcupacao > diasEsperados;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <div className="flex items-center gap-1">
          {isExcedido ? (
            <AlertCircle className="h-4 w-4 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          )}
          <span className="text-xs font-semibold text-foreground">
            {diasOcupacao}d / {diasEsperados}d
          </span>
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-all ${
            isExcedido
              ? "bg-gradient-to-r from-amber-500 to-amber-600"
              : "bg-gradient-to-r from-green-500 to-emerald-600"
          }`}
          style={{ width: `${percentualOcupacao}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {isExcedido
          ? `Excedido por ${diasOcupacao - diasEsperados} dias`
          : `${diasEsperados - diasOcupacao} dias restantes`}
      </p>
    </div>
  );
}
