import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  Clock,
  Download,
  Info,
  MoreHorizontal,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { useAuth } from "@/hooks/useAuth";
import { createGesture } from "@/lib/offline/ops";
import { resetOfflineFarmData } from "@/lib/offline/reset";
import {
  exportRejections,
  getRejectionStats,
  listRejections,
  purgeRejections,
  triggerDownload,
  type RejectionStats,
} from "@/lib/offline/rejections";
import { db } from "@/lib/offline/db";
import type { Rejection } from "@/lib/offline/types";
import { showError, showSuccess } from "@/utils/toast";

const PAGE_SIZE = 20;

function formatDate(iso: string | undefined): string {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function daysAgo(iso: string | undefined): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days === 0) return "hoje";
  if (days === 1) return "1 dia atras";
  return `${days} dias atras`;
}

export default function Reconciliacao() {
  const { activeFarmId } = useAuth();
  const rejectionCount =
    useLiveQuery(
      () =>
        activeFarmId
          ? db.queue_rejections.where("fazenda_id").equals(activeFarmId).count()
          : 0,
      [activeFarmId],
    ) || 0;

  const [items, setItems] = useState<Rejection[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [stats, setStats] = useState<RejectionStats>({ count: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRejection, setSelectedRejection] = useState<Rejection | null>(null);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purgeDryRunCount, setPurgeDryRunCount] = useState<number | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const loadFirstPage = useCallback(async () => {
    if (!activeFarmId) return;
    setIsLoading(true);
    try {
      const [page, summary] = await Promise.all([
        listRejections(activeFarmId, { limit: PAGE_SIZE }),
        getRejectionStats(activeFarmId),
      ]);
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setStats(summary);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha ao carregar rejeicoes.";
      showError(message);
    } finally {
      setIsLoading(false);
    }
  }, [activeFarmId]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage, rejectionCount]);

  const loadMore = async () => {
    if (!activeFarmId || !nextCursor) return;
    setIsLoading(true);
    try {
      const page = await listRejections(activeFarmId, {
        limit: PAGE_SIZE,
        cursorBefore: nextCursor,
      });
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha ao carregar mais itens.";
      showError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!activeFarmId) return;
    try {
      const { blob, filename } = await exportRejections(activeFarmId);
      triggerDownload(blob, filename);
      showSuccess(`Exportado: ${filename}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha ao exportar.";
      showError(`Erro ao exportar: ${message}`);
    }
  };

  const handlePurgePreview = async () => {
    if (!activeFarmId) return;
    try {
      const result = await purgeRejections({
        fazendaId: activeFarmId,
        olderThanDays: 7,
        dryRun: true,
      });
      setPurgeDryRunCount(result.deletedCount);
      setPurgeDialogOpen(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha ao verificar rejeicoes.";
      showError(`Erro ao verificar: ${message}`);
    }
  };

  const handlePurgeConfirm = async () => {
    if (!activeFarmId) return;
    setIsPurging(true);
    try {
      const result = await purgeRejections({
        fazendaId: activeFarmId,
        olderThanDays: 7,
      });
      showSuccess(`${result.deletedCount} rejeicao(oes) removida(s)`);
      setPurgeDialogOpen(false);
      setPurgeDryRunCount(null);
      await loadFirstPage();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha ao limpar rejeicoes.";
      showError(`Erro ao limpar: ${message}`);
    } finally {
      setIsPurging(false);
    }
  };

  const handleResetOfflineFarm = async () => {
    if (!activeFarmId) return;
    setIsResetting(true);
    try {
      await resetOfflineFarmData(activeFarmId);
      setResetDialogOpen(false);
      setSelectedRejection(null);
      showSuccess("Estado offline da fazenda foi resetado.");
      await loadFirstPage();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Falha ao resetar estado offline.";
      showError(`Erro ao resetar estado offline: ${message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const handleRetry = async (rejection: Rejection) => {
    if (rejection.reason_code === "ANTI_TELEPORTE") {
      showError(
        "Este erro exige refazer a movimentacao pelo fluxo atual (Mover/Registrar).",
      );
      return;
    }

    const existingGesture = await db.queue_gestures
      .where("fazenda_id")
      .equals(rejection.fazenda_id)
      .and((gesture) => gesture.status === "PENDING" || gesture.status === "SYNCING")
      .first();

    if (existingGesture) {
      const pendingOps = await db.queue_ops
        .where("client_tx_id")
        .equals(existingGesture.client_tx_id)
        .toArray();

      const hasDuplicate = pendingOps.some(
        (op) => op.table === rejection.table && op.action === rejection.action,
      );

      if (hasDuplicate) {
        showError("Esta operacao ja esta na fila de sincronizacao.");
        return;
      }
    }

    const ops = await db.queue_ops
      .where("client_tx_id")
      .equals(rejection.client_tx_id)
      .toArray();

    await createGesture(
      rejection.fazenda_id,
      ops.map((op) => {
        if (
          op.table === "protocolos_sanitarios_itens" &&
          (op.action === "INSERT" || op.action === "UPDATE")
        ) {
          const record = { ...(op.record ?? {}) };
          const intervalo = Number(record.intervalo_dias);
          if (!Number.isFinite(intervalo) || intervalo <= 0) {
            record.intervalo_dias = 1;
          }
          return { table: op.table, action: op.action, record };
        }
        return { table: op.table, action: op.action, record: op.record };
      }),
    );

    if (rejection.id != null) {
      await db.queue_rejections.delete(rejection.id);
    }
    showSuccess("Operacao re-enfileirada para sincronizacao.");
    await loadFirstPage();
  };

  const handleClear = async (rejection: Rejection) => {
    if (rejection.id == null) return;
    await db.queue_rejections.delete(rejection.id);
    showSuccess("Rejeicao removida.");
    await loadFirstPage();
  };

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Suporte operacional"
        title="Reconciliacao offline"
        description="Fila de rejeicoes com leitura compacta, exportacao segura e acoes destrutivas protegidas para nao competir com a rotina diaria."
        meta={
          <>
            <StatusBadge tone={stats.count > 0 ? "danger" : "success"}>
              {stats.count} rejeicao(oes)
            </StatusBadge>
            {stats.oldestAt ? (
              <StatusBadge tone="warning">Mais antiga {daysAgo(stats.oldestAt)}</StatusBadge>
            ) : null}
          </>
        }
        actions={
          <>
            {stats.count > 0 ? (
              <Button variant="outline" onClick={handleExport}>
                <Download className="mr-2 h-4 w-4" />
                Exportar
              </Button>
            ) : null}
            {stats.count > 0 ? (
              <Button variant="outline" onClick={handlePurgePreview}>
                <Trash2 className="mr-2 h-4 w-4" />
                Limpar antigas
              </Button>
            ) : null}
            <Button variant="destructive" onClick={() => setResetDialogOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Resetar offline
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Rejeicoes"
          value={stats.count}
          hint="Volume atual de itens que exigem atencao."
          tone={stats.count > 0 ? "danger" : "default"}
          icon={<AlertCircle className="h-5 w-5" />}
        />
        <MetricCard
          label="Mais antiga"
          value={stats.oldestAt ? formatDate(stats.oldestAt) : "-"}
          hint={stats.oldestAt ? daysAgo(stats.oldestAt) : "Sem itens pendentes."}
          tone="warning"
          icon={<Clock className="h-5 w-5" />}
        />
        <MetricCard
          label="Mais recente"
          value={stats.newestAt ? formatDate(stats.newestAt) : "-"}
          hint={stats.newestAt ? daysAgo(stats.newestAt) : "Nenhuma rejeicao recente."}
          icon={<Info className="h-5 w-5" />}
        />
      </div>

      <Toolbar>
        <ToolbarGroup className="flex-1 gap-2">
          <div className="rounded-2xl border border-warning/30 bg-warning-muted/80 px-4 py-3 text-sm text-muted-foreground">
            Rejeicoes sao removidas automaticamente apos 7 dias. Exporte antes se
            precisar guardar evidencia para auditoria.
          </div>
        </ToolbarGroup>
        <ToolbarGroup className="gap-2">
          <StatusBadge tone="info">{items.length} item(ns) carregado(s)</StatusBadge>
        </ToolbarGroup>
      </Toolbar>

      {items.length === 0 && !isLoading ? (
        <EmptyState
          icon={AlertCircle}
          title="Fila limpa"
          description="Nenhuma rejeicao foi encontrada para a fazenda ativa."
        />
      ) : (
        <div className="space-y-3">
          {items.map((rejection) => (
            <Card key={rejection.id} className="shadow-none">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                <button
                  type="button"
                  className="min-w-0 flex-1 space-y-2 text-left"
                  onClick={() => setSelectedRejection(rejection)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone="danger">{rejection.reason_code}</StatusBadge>
                    <StatusBadge tone="neutral">{rejection.table}</StatusBadge>
                    <StatusBadge tone="neutral">{rejection.action}</StatusBadge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {rejection.reason_message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(rejection.created_at)} · {daysAgo(rejection.created_at)}
                  </p>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Acoes da rejeicao">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSelectedRejection(rejection)}>
                      <Info className="mr-2 h-4 w-4" />
                      Ver detalhes
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleRetry(rejection)}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Re-enfileirar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleClear(rejection)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}

          {nextCursor ? (
            <Button variant="outline" className="w-full" onClick={loadMore} disabled={isLoading}>
              <ChevronDown className="mr-2 h-4 w-4" />
              {isLoading ? "Carregando..." : "Carregar mais"}
            </Button>
          ) : null}
        </div>
      )}

      <Dialog
        open={!!selectedRejection}
        onOpenChange={(open) => !open && setSelectedRejection(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Detalhe da rejeicao</DialogTitle>
            <DialogDescription>
              Informacoes completas do registro rejeitado para orientar a correcao.
            </DialogDescription>
          </DialogHeader>

          {selectedRejection ? (
            <div className="space-y-4 rounded-2xl border border-border/70 bg-background/80 p-4 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Codigo
                  </p>
                  <StatusBadge tone="danger">{selectedRejection.reason_code}</StatusBadge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Data
                  </p>
                  <p className="text-foreground">{formatDate(selectedRejection.created_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Tabela
                  </p>
                  <p className="font-mono text-xs text-foreground">
                    {selectedRejection.table}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Acao
                  </p>
                  <StatusBadge tone="neutral">{selectedRejection.action}</StatusBadge>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Mensagem
                </p>
                <p className="leading-6 text-muted-foreground">
                  {selectedRejection.reason_message}
                </p>
              </div>

              <div className="grid gap-3">
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    TX ID
                  </p>
                  <p className="break-all font-mono text-xs text-foreground">
                    {selectedRejection.client_tx_id}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    OP ID
                  </p>
                  <p className="break-all font-mono text-xs text-foreground">
                    {selectedRejection.client_op_id}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedRejection) {
                  void handleRetry(selectedRejection);
                }
                setSelectedRejection(null);
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Re-enfileirar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedRejection) {
                  void handleClear(selectedRejection);
                }
                setSelectedRejection(null);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Limpar rejeicoes antigas</DialogTitle>
            <DialogDescription>
              Essa acao remove registros locais com mais de 7 dias. Exporte antes
              se precisar manter o historico.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-center">
            <p className="text-3xl font-semibold text-foreground">
              {purgeDryRunCount ?? 0}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              rejeicao(oes) serao removida(s)
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPurgeDialogOpen(false);
                setPurgeDryRunCount(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handlePurgeConfirm}
              disabled={isPurging || purgeDryRunCount === 0}
            >
              {isPurging ? "Removendo..." : "Confirmar limpeza"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resetar estado offline</DialogTitle>
            <DialogDescription>
              Isso remove dados locais, fila de sincronizacao e rejeicoes da
              fazenda ativa neste navegador.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-muted-foreground">
            Use apenas em ambiente de suporte ou teste. O servidor nao e alterado;
            apenas o estado offline local sera limpo.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetOfflineFarm}
              disabled={isResetting}
            >
              {isResetting ? "Resetando..." : "Confirmar reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
