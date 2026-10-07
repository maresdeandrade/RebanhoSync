import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getFarmSyncHealth,
  type FarmSyncSummary,
} from "@/lib/offline/syncPresentation";

interface SyncStatusPanelProps {
  summary?: FarmSyncSummary;
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

export function SyncStatusPanel({ summary }: SyncStatusPanelProps) {
  const headline = getFarmSyncHealth(summary);
  const details = summary ?? {
    savedLocalCount: 0,
    syncingCount: 0,
    rejectionCount: 0,
    errorCount: 0,
    reconcileCount: 0,
    lastCompletedAt: undefined,
  };

  return (
    <Card className="border-border/80">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Conexao</CardTitle>
            <StatusBadge tone={headline.tone}>{headline.label}</StatusBadge>
          </div>
        </div>

        {details.rejectionCount > 0 ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/reconciliacao">Abrir reconciliacao</Link>
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-wrap items-center gap-2">
        {details.savedLocalCount > 0 ? (
          <StatusBadge tone="warning">
            {details.savedLocalCount} no aparelho
          </StatusBadge>
        ) : null}
        {details.syncingCount > 0 ? (
          <StatusBadge tone="info">
            {details.syncingCount} enviando
          </StatusBadge>
        ) : null}
        {details.rejectionCount > 0 ? (
          <StatusBadge tone="danger">
            {details.rejectionCount} para revisar
          </StatusBadge>
        ) : null}
        {details.errorCount > 0 ? (
          <StatusBadge tone="danger">
            {details.errorCount} com erro
          </StatusBadge>
        ) : null}
        {details.reconcileCount > 0 ? (
          <StatusBadge tone="warning">
            {details.reconcileCount} aguardando reconciliação
          </StatusBadge>
        ) : null}
        <span className="text-sm text-muted-foreground">
          {details.lastCompletedAt
            ? `Ultima confirmacao: ${formatDateTime(details.lastCompletedAt)}`
            : "Sem confirmacao"}
        </span>
      </CardContent>
    </Card>
  );
}
