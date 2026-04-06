import { useState, useCallback, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  Clock,
  Download,
  RefreshCw,
  Trash2,
  ChevronDown,
  Info,
  AlertTriangle,
} from "lucide-react";
import { createGesture } from "@/lib/offline/ops";
import { showSuccess, showError } from "@/utils/toast";
import { useAuth } from "@/hooks/useAuth";
import {
  listRejections,
  exportRejections,
  purgeRejections,
  getRejectionStats,
  triggerDownload,
  type RejectionStats,
} from "@/lib/offline/rejections";
import { resetOfflineFarmData } from "@/lib/offline/reset";
import type { Rejection } from "@/lib/offline/types";

const PAGE_SIZE = 20;

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
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
  if (days === 1) return "1 dia atrás";
  return `${days} dias atrás`;
}

const Reconciliacao = () => {
  const { activeFarmId } = useAuth();

  // Stats — reactive via Dexie live query for badge/count updates
  const rejectionCount = useLiveQuery(
    () => (activeFarmId ? db.queue_rejections.where("fazenda_id").equals(activeFarmId).count() : 0),
    [activeFarmId],
  ) || 0;

  // Paginated list state
  const [items, setItems] = useState<Rejection[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [stats, setStats] = useState<RejectionStats>({ count: 0 });
  const [isLoading, setIsLoading] = useState(false);

  // Detail dialog state
  const [selectedRejection, setSelectedRejection] = useState<Rejection | null>(null);

  // Purge dialog state
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purgeDryRunCount, setPurgeDryRunCount] = useState<number | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Load first page + stats
  const loadFirstPage = useCallback(async () => {
    if (!activeFarmId) return;
    setIsLoading(true);
    try {
      const [page, s] = await Promise.all([
        listRejections(activeFarmId, { limit: PAGE_SIZE }),
        getRejectionStats(activeFarmId),
      ]);
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setStats(s);
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.error("[Reconciliacao] Load failed:", error.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeFarmId]);

  // Reload on farm change or when rejectionCount changes (reactive)
  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage, rejectionCount]);

  // Load more (cursor pagination)
  const loadMore = async () => {
    if (!activeFarmId || !nextCursor) return;
    setIsLoading(true);
    try {
      const page = await listRejections(activeFarmId, {
        limit: PAGE_SIZE,
        cursorBefore: nextCursor,
      });
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      console.error("[Reconciliacao] Load more failed:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Export
  const handleExport = async () => {
    if (!activeFarmId) return;
    try {
      const { blob, filename } = await exportRejections(activeFarmId);
      triggerDownload(blob, filename);
      showSuccess(`Exportado: ${filename}`);
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      showError(`Erro ao exportar: ${error.message}`);
    }
  };

  // Purge — step 1: dryRun
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
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      showError(`Erro ao verificar: ${error.message}`);
    }
  };

  // Purge — step 2: confirm
  const handlePurgeConfirm = async () => {
    if (!activeFarmId) return;
    setIsPurging(true);
    try {
      const result = await purgeRejections({
        fazendaId: activeFarmId,
        olderThanDays: 7,
      });
      showSuccess(`${result.deletedCount} rejeição(ões) removida(s)`);
      setPurgeDialogOpen(false);
      setPurgeDryRunCount(null);
      await loadFirstPage();
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      showError(`Erro ao limpar: ${error.message}`);
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
      showSuccess("Estado offline da fazenda foi resetado");
      await loadFirstPage();
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      showError(`Erro ao resetar estado offline: ${error.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  // Retry (preserve existing logic from original Reconciliacao)
  const handleRetry = async (rejection: Rejection) => {
    if (rejection.reason_code === "ANTI_TELEPORTE") {
      showError(
        "Este erro exige refazer a movimentação pelo fluxo atual (Mover/Registrar).",
      );
      return;
    }

    // Idempotency: check for duplicate in queue
    const existingGesture = await db.queue_gestures
      .where("fazenda_id")
      .equals(rejection.fazenda_id)
      .and((g) => g.status === "PENDING" || g.status === "SYNCING")
      .first();

    if (existingGesture) {
      const pendingOps = await db.queue_ops
        .where("client_tx_id")
        .equals(existingGesture.client_tx_id)
        .toArray();

      const hasDuplicate = pendingOps.some(
        (op) =>
          op.table === rejection.table &&
          op.action === rejection.action,
      );

      if (hasDuplicate) {
        showError("Esta operação já está na fila de sincronização");
        return;
      }
    }

    const ops = await db.queue_ops
      .where("client_tx_id")
      .equals(rejection.client_tx_id)
      .toArray();

    await createGesture(
      rejection.fazenda_id,
      ops.map((o) => {
        if (
          o.table === "protocolos_sanitarios_itens" &&
          (o.action === "INSERT" || o.action === "UPDATE")
        ) {
          const record = { ...(o.record ?? {}) };
          const intervalo = Number(record.intervalo_dias);
          if (!Number.isFinite(intervalo) || intervalo <= 0) {
            record.intervalo_dias = 1;
          }
          return { table: o.table, action: o.action, record };
        }
        return { table: o.table, action: o.action, record: o.record };
      }),
    );

    if (rejection.id != null) {
      await db.queue_rejections.delete(rejection.id);
    }
    showSuccess("Operação re-enfileirada para sincronização");
    await loadFirstPage();
  };

  // Delete single
  const handleClear = async (rejection: Rejection) => {
    if (rejection.id == null) return;
    await db.queue_rejections.delete(rejection.id);
    showSuccess("Rejeição removida");
    await loadFirstPage();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Reconciliação</h1>
        <div className="flex items-center gap-2">
          {stats.count > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" /> Exportar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/50 hover:bg-destructive/10"
                onClick={handlePurgePreview}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Limpar antigas (&gt;7d)
              </Button>
            </>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setResetDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Resetar offline
          </Button>
        </div>
      </div>

      {/* TTL Warning */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Expurgo automático</AlertTitle>
        <AlertDescription>
          Rejeições são removidas automaticamente após <strong>7 dias</strong>.
          Exporte antes se precisar mantê-las para auditoria.
        </AlertDescription>
      </Alert>

      {/* Stats Banner */}
      {stats.count > 0 ? (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold">{stats.count}</p>
                <p className="text-xs text-muted-foreground">Rejeições</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">{formatDate(stats.oldestAt)}</p>
                <p className="text-xs text-muted-foreground">
                  Mais antiga ({daysAgo(stats.oldestAt)})
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2 md:col-span-1">
            <CardContent className="p-4 flex items-center gap-3">
              <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">{formatDate(stats.newestAt)}</p>
                <p className="text-xs text-muted-foreground">
                  Mais recente ({daysAgo(stats.newestAt)})
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* List */}
      {items.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              Tudo limpo! Nenhuma rejeição encontrada.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((rej) => (
            <Card
              key={rej.id}
              className="border-destructive/30 cursor-pointer hover:border-destructive/60 transition-colors"
              onClick={() => setSelectedRejection(rej)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="destructive" className="text-xs">
                    {rej.reason_code}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {rej.table} • {rej.action}
                  </span>
                </div>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleRetry(rej)}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => handleClear(rej)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pb-3 pt-0">
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {rej.reason_message}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {formatDate(rej.created_at)} · {daysAgo(rej.created_at)}
                </p>
              </CardContent>
            </Card>
          ))}

          {/* Load More */}
          {nextCursor && (
            <Button
              variant="outline"
              className="w-full"
              onClick={loadMore}
              disabled={isLoading}
            >
              <ChevronDown className="h-4 w-4 mr-2" />
              {isLoading ? "Carregando..." : "Carregar mais"}
            </Button>
          )}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog
        open={!!selectedRejection}
        onOpenChange={(open) => !open && setSelectedRejection(null)}
      >
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Detalhe da Rejeição
            </DialogTitle>
            <DialogDescription>
              Informações completas do registro rejeitado.
            </DialogDescription>
          </DialogHeader>

          {selectedRejection && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-2">
                <span className="font-medium text-muted-foreground">Código:</span>
                <Badge variant="destructive">{selectedRejection.reason_code}</Badge>

                <span className="font-medium text-muted-foreground">Mensagem:</span>
                <span>{selectedRejection.reason_message}</span>

                <span className="font-medium text-muted-foreground">Tabela:</span>
                <span className="font-mono text-xs">{selectedRejection.table}</span>

                <span className="font-medium text-muted-foreground">Ação:</span>
                <Badge variant="outline">{selectedRejection.action}</Badge>

                <span className="font-medium text-muted-foreground">Data:</span>
                <span>{formatDate(selectedRejection.created_at)}</span>

                <span className="font-medium text-muted-foreground">TX ID:</span>
                <span className="font-mono text-xs break-all">
                  {selectedRejection.client_tx_id}
                </span>

                <span className="font-medium text-muted-foreground">OP ID:</span>
                <span className="font-mono text-xs break-all">
                  {selectedRejection.client_op_id}
                </span>

                <span className="font-medium text-muted-foreground">Fazenda:</span>
                <span className="font-mono text-xs break-all">
                  {selectedRejection.fazenda_id}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (selectedRejection) handleRetry(selectedRejection);
                setSelectedRejection(null);
              }}
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Re-enfileirar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (selectedRejection) handleClear(selectedRejection);
                setSelectedRejection(null);
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purge Confirmation Dialog */}
      <Dialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Limpar rejeições antigas
            </DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Exporte os dados antes se necessário.
            </DialogDescription>
          </DialogHeader>

          <div className="text-center py-4">
            <p className="text-3xl font-bold text-destructive">{purgeDryRunCount}</p>
            <p className="text-sm text-muted-foreground mt-1">
              rejeição(ões) com mais de 7 dias serão removidas
            </p>
          </div>

          <DialogFooter className="gap-2">
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
              {isPurging ? "Removendo..." : "Confirmar exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resetar estado offline</DialogTitle>
            <DialogDescription>
              Isso remove dados locais, fila de sincronizacao e rejeicoes da fazenda ativa neste navegador.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-muted-foreground">
            Use apenas para ambiente de teste. O servidor nao e alterado; apenas o estado offline local sera limpo.
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetDialogOpen(false)}
              disabled={isResetting}
            >
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
};

export default Reconciliacao;
