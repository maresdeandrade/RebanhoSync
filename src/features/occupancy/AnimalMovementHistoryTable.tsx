import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AnimalOccupancyPeriod } from "./occupancyTypes";

interface AnimalMovementHistoryTableProps {
  periods: AnimalOccupancyPeriod[];
  title?: string;
  description?: string;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "Atual";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(dateString));
}

function getStatusTone(
  status: "complete" | "partial" | "empty"
): "success" | "warning" | "info" {
  switch (status) {
    case "complete":
      return "success";
    case "partial":
      return "warning";
    case "empty":
      return "info";
  }
}

function getStatusLabel(status: "complete" | "partial" | "empty"): string {
  switch (status) {
    case "complete":
      return "Completo";
    case "partial":
      return "Parcial";
    case "empty":
      return "Vazio";
  }
}

export function AnimalMovementHistoryTable({
  periods,
  title = "Histórico de Movimentação",
  description = "Trajetória dos animais entre lotes e pastos",
}: AnimalMovementHistoryTableProps) {
  const sortedPeriods = useMemo(() => {
    return [...periods].sort((a, b) => {
      const aDate = new Date(a.entradaAt);
      const bDate = new Date(b.entradaAt);
      return bDate.getTime() - aDate.getTime();
    });
  }, [periods]);

  if (sortedPeriods.length === 0) {
    return (
      <Card className="shadow-none">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">
            Sem histórico de movimentação disponível.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Animal
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Lote
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Pasto
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Entrada
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Saída
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Dias
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Peso
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  ECC
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPeriods.map((period, idx) => (
                <tr
                  key={`${period.animalId}-${period.entradaAt}-${idx}`}
                  className="border-b border-border/30 hover:bg-muted/50"
                >
                  <td className="px-3 py-2 text-foreground">
                    {period.animalId}
                  </td>
                  <td className="px-3 py-2 text-foreground">{period.loteId}</td>
                  <td className="px-3 py-2 text-foreground">
                    {period.pastoId}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatDate(period.entradaAt)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatDate(period.saidaAt)}
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {period.dias}
                  </td>
                  <td className="px-3 py-2">
                    {period.pesoInicial || period.pesoFinal ? (
                      <div className="space-y-1">
                        {period.pesoInicial && (
                          <div className="text-xs text-muted-foreground">
                            Ini: {period.pesoInicial.toFixed(1)} kg
                          </div>
                        )}
                        {period.pesoFinal && (
                          <div className="text-xs text-muted-foreground">
                            Fin: {period.pesoFinal.toFixed(1)} kg
                          </div>
                        )}
                        {period.ganho !== undefined && (
                          <StatusBadge tone="info" className="text-xs">
                            +{period.ganho.toFixed(1)} kg
                          </StatusBadge>
                        )}
                      </div>
                    ) : (
                      <StatusBadge
                        tone={getStatusTone(period.weightStatus.status)}
                      >
                        {getStatusLabel(period.weightStatus.status)}
                      </StatusBadge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {period.eccInicial || period.eccFinal ? (
                      <div className="space-y-1">
                        {period.eccInicial && (
                          <div className="text-xs text-muted-foreground">
                            Ini: {period.eccInicial.toFixed(1)}
                          </div>
                        )}
                        {period.eccFinal && (
                          <div className="text-xs text-muted-foreground">
                            Fin: {period.eccFinal.toFixed(1)}
                          </div>
                        )}
                        {period.variacaoEcc !== undefined && (
                          <StatusBadge
                            tone={
                              period.variacaoEcc > 0 ? "success" : "warning"
                            }
                            className="text-xs"
                          >
                            {period.variacaoEcc > 0 ? "+" : ""}
                            {period.variacaoEcc.toFixed(1)}
                          </StatusBadge>
                        )}
                      </div>
                    ) : (
                      <StatusBadge
                        tone={getStatusTone(period.eccStatus.status)}
                      >
                        {getStatusLabel(period.eccStatus.status)}
                      </StatusBadge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
          <p className="text-sm text-blue-800">
            <strong>Legenda:</strong> Ini = Valor na entrada, Fin = Valor na
            saída. Dados em branco indicam registros não disponíveis para o
            período.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
