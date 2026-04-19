import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

type AgendaLifecyclePanelItem = {
  animalId: string;
  identificacao: string;
  kindLabel: string;
  kindTone: "warning" | "info";
  autoApplyLabel: string;
  autoApplyTone: "info" | "warning";
  stageLabel: string;
  loteNome: string;
  reason: string;
};

type AgendaLifecycleSummaryPanelProps = {
  total: number;
  strategic: number;
  biological: number;
  items: AgendaLifecyclePanelItem[];
};

export function AgendaLifecycleSummaryPanel({
  total,
  strategic,
  biological,
  items,
}: AgendaLifecycleSummaryPanelProps) {
  return (
    <Card className="border-warning/20 bg-warning-muted/70 shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-warning" />
          Transicoes de estagio no radar
        </CardTitle>
        <CardDescription>
          {total} pendencia(s), com {strategic} estrategica(s) e {biological} biologica(s).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.animalId} className="rounded-2xl border border-border/70 bg-background/90 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.identificacao}</p>
                  <StatusBadge tone={item.kindTone}>{item.kindLabel}</StatusBadge>
                  <StatusBadge tone={item.autoApplyTone}>{item.autoApplyLabel}</StatusBadge>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {item.stageLabel} | {item.loteNome}
                </p>
                <p className="text-xs text-muted-foreground">{item.reason}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/animais/${item.animalId}`}>Abrir ficha</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/animais/transicoes">Tratar na fila</Link>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
