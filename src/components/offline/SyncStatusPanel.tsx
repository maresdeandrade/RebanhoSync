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

      <CardContent className="flex flex-wrap items-center gap-2">
        {summary.savedLocalCount > 0 ? (
          <StatusBadge tone="warning">
            {summary.savedLocalCount} no aparelho
          </StatusBadge>
        ) : null}
        {summary.syncingCount > 0 ? (
          <StatusBadge tone="info">{summary.syncingCount} enviando</StatusBadge>
        ) : null}
        {summary.rejectionCount > 0 ? (
          <StatusBadge tone="danger">
            {summary.rejectionCount} para revisar
          </StatusBadge>
        ) : null}
        <span className="text-sm text-muted-foreground">
          {summary.lastCompletedAt
            ? `Ultima confirmacao: ${formatDateTime(summary.lastCompletedAt)}`
            : "Sem confirmacao"}
        </span>
      </CardContent>
    </Card>
  );
}
