import { AlertTriangle, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    };
  }

  if (summary.syncingCount > 0) {
    return {
      tone: "info" as const,
      label: "Sincronizando",
    };
  }

  if (summary.savedLocalCount > 0) {
    return {
      tone: "warning" as const,
      label: "Salvo localmente",
    };
  }

  if (summary.lastCompletedStage === "synced_altered") {
    return {
      tone: "warning" as const,
      label: "Confirmado com ajuste",
    };
  }

  return {
    tone: "success" as const,
    label: "Em dia",
  };
}

export function SyncStatusPanel({ summary }: SyncStatusPanelProps) {
  const headline = getHeadline(summary);

  return (
    <Card className="border-border/80">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Conexao</CardTitle>
            <StatusBadge tone={headline.tone}>{headline.label}</StatusBadge>
          </div>
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
          <p className="mt-3 text-2xl font-semibold">
            {summary.savedLocalCount}
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4" />
            Sincronizando
          </div>
          <p className="mt-3 text-2xl font-semibold">{summary.syncingCount}</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Rejeicoes
          </div>
          <p className="mt-3 text-2xl font-semibold">
            {summary.rejectionCount}
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            Ultima confirmacao
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">
            {summary.lastCompletedAt
              ? formatDateTime(summary.lastCompletedAt)
              : "Sem confirmacao"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
