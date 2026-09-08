import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AnimalOccupancyPeriod, DataStatus } from "./occupancyTypes";

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
  status: DataStatus["status"],
): "success" | "warning" | "info" | "danger" {
  switch (status) {
    case "complete":
      return "success";
    case "partial":
      return "warning";
    case "empty":
      return "info";
    case "bloqueado":
      return "danger";
  }
}

function getStatusLabel(status: DataStatus["status"]): string {
  switch (status) {
    case "complete":
      return "Completo";
    case "partial":
      return "Parcial";
    case "empty":
      return "Vazio";
    case "bloqueado":
      return "Bloqueado";
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
        <SectionHeader title={title} description={description} level={3} />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Animal</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Pasto</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Saída</TableHead>
              <TableHead>Dias</TableHead>
              <TableHead>Peso</TableHead>
              <TableHead>ECC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPeriods.map((period, idx) => (
              <TableRow
                key={`${period.animalId}-${period.entradaAt}-${idx}`}
              >
                <TableCell className="font-medium text-foreground">
                  {period.animalId}
                </TableCell>
                <TableCell className="text-foreground">{period.loteId}</TableCell>
                <TableCell className="text-foreground">
                  {period.pastoId}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(period.entradaAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(period.saidaAt)}
                </TableCell>
                <TableCell className="text-foreground">
                  {period.dias}
                </TableCell>
                <TableCell>
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
                </TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground font-semibold">Legenda:</strong> Ini = Valor na entrada, Fin = Valor na
            saída. Dados em branco indicam registros não disponíveis para o
            período.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
