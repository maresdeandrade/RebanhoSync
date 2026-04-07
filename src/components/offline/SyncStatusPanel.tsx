import { AlertTriangle, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { FarmSyncSummary } from "@/lib/offline/syncPresentation";

interface SyncStatusPanelProps {
  summary: FarmSyncSummary;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getHeadline(summary: FarmSyncSummary) {
  if (summary.rejectionCount > 0) {
    return {
      tone: "danger" as const,
      label: "Revisao necessaria",
      description:
        "O servidor rejeitou parte da fila e o rollback local ja foi aplicado neste aparelho.",
    };
  }

  if (summary.syncingCount > 0) {
    return {
      tone: "info" as const,
      label: "Sincronizando",
      description:
        "Os registros ja estao salvos neste aparelho e aguardam confirmacao autoritativa.",
    };
  }

  if (summary.savedLocalCount > 0) {
    return {
      tone: "warning" as const,
      label: "Salvo localmente",
      description:
        "A rotina segue operando offline, mas ainda existe fila local para enviar.",
    };
  }

  if (summary.lastCompletedStage === "synced_altered") {
    return {
      tone: "warning" as const,
      label: "Confirmado com ajuste",
      description:
        "O servidor aceitou a operacao, mas consolidou o resultado sem duplicar o registro.",
    };
  }

  return {
    tone: "success" as const,
    label: "Sync em dia",
    description: "Neste momento nao ha fila local nem rejeicoes abertas para revisar.",
  };
}

export function SyncStatusPanel({ summary }: SyncStatusPanelProps) {
  const headline = getHeadline(summary);

  return (
    <Card className="border-border/80">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Estado de sync</CardTitle>
            <StatusBadge tone={headline.tone}>{headline.label}</StatusBadge>
          </div>
          <CardDescription>{headline.description}</CardDescription>
        </div>

        {summary.rejectionCount > 0 ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/reconciliacao">Abrir reconciliacao</Link>
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            Salvos no aparelho
          </div>
          <p className="mt-3 text-2xl font-semibold">{summary.savedLocalCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Registros ainda nao confirmados pelo servidor.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
            Sincronizando
          </div>
          <p className="mt-3 text-2xl font-semibold">{summary.syncingCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Gestos ja enviados e aguardando retorno.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Rejeicoes
          </div>
          <p className="mt-3 text-2xl font-semibold">{summary.rejectionCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Itens que pedem correcao operacional.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Ultima confirmacao
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">
            {summary.lastCompletedAt ? formatDateTime(summary.lastCompletedAt) : "Sem confirmacao"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {summary.lastCompletedStage === "synced_altered"
              ? "Servidor confirmou com ajuste."
              : summary.lastCompletedAt
                ? "Servidor confirmou a fila mais recente."
                : "Os proximos gestos confirmados aparecem aqui."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
