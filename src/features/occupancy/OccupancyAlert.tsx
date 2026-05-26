import { differenceInDays, parseISO } from "date-fns";
import { AlertTriangle, AlertCircle, CheckCircle2 } from "lucide-react";

interface OccupancyAlertProps {
  dataEntrada: string;
  diasEsperados?: number;
  tipo?: "lote" | "pasto";
}

export function OccupancyAlert({
  dataEntrada,
  diasEsperados = 30,
  tipo = "lote",
}: OccupancyAlertProps) {
  const diasOcupacao = differenceInDays(new Date(), parseISO(dataEntrada));
  const percentualExcesso = ((diasOcupacao - diasEsperados) / diasEsperados) * 100;

  if (diasOcupacao <= diasEsperados) {
    return null;
  }

  const isAlerta = percentualExcesso <= 20; // 20% de excesso
  const isCritico = percentualExcesso > 20; // Mais de 20% de excesso

  if (isAlerta) {
    return (
      <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">
            Ocupação próxima do limite
          </p>
          <p className="text-xs text-amber-800">
            Este {tipo} está ocupado há {diasOcupacao} dias (esperado: {diasEsperados}d). 
            Considere planejamento de rotação.
          </p>
        </div>
      </div>
    );
  }

  if (isCritico) {
    return (
      <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50/60 p-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-900">
            Ocupação crítica
          </p>
          <p className="text-xs text-red-800">
            Este {tipo} está ocupado há {diasOcupacao} dias, excedendo {diasEsperados}d em {Math.round(percentualExcesso)}%. 
            Ação imediata recomendada.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
