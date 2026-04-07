import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
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
import type { Operation, Rejection } from "@/lib/offline/types";
import { showError, showSuccess } from "@/utils/toast";

const PAGE_SIZE = 20;
const NON_RETRYABLE_REASON_CODES = new Set([
  "ANTI_TELEPORTE",
  "PERMISSION_DENIED",
  "INVALID_EPISODE_REFERENCE",
  "TAXONOMY_FACTS_SCHEMA_VERSION_REQUIRED",
  "INVALID_TAXONOMY_FACTS_PAYLOAD",
  "VALIDATION_ERROR",
]);

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

function shortId(value?: string | null) {
  return value ? value.slice(0, 8) : "-";
}

function readStringValue(record: unknown, key: string): string | null {
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  const value = (record as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNullableId(record: unknown, key: string): string | null | undefined {
  if (!record || typeof record !== "object" || Array.isArray(record)) return undefined;
  const value = (record as Record<string, unknown>)[key];
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function describeRollback(action: string) {
  if (action === "INSERT") {
    return "Rollback local aplicado: o registro otimista foi removido deste aparelho.";
  }
  if (action === "DELETE") {
    return "Rollback local aplicado: o registro voltou ao estado visivel neste aparelho.";
  }
  return "Rollback local aplicado: o estado anterior foi restaurado neste aparelho.";
}

function describeNextStep(rejection: Rejection) {
  switch (rejection.reason_code) {
    case "ANTI_TELEPORTE":
      return "Refaca a movimentacao pelo fluxo atual, com origem e destino diferentes.";
    case "PERMISSION_DENIED":
      return "Use um perfil com permissao para esta acao ou encaminhe para owner/manager.";
    case "INVALID_EPISODE_REFERENCE":
      return "Reabra o fluxo reprodutivo e vincule o episodio correto antes de tentar novamente.";
    case "TAXONOMY_FACTS_SCHEMA_VERSION_REQUIRED":
    case "INVALID_TAXONOMY_FACTS_PAYLOAD":
      return "Ajuste o registro pelo fluxo suportado da UI; nao reenfileire payload manual invalido.";
    case "VALIDATION_ERROR":
      if (rejection.reason_message.toLowerCase().includes("peso")) {
        return "Corrija o peso para ser maior que zero antes de registrar novamente.";
      }
      return "Revise campos obrigatorios e faixas validas antes de reenfileirar.";
    default:
      return "Corrija os dados de origem e so reenfileire quando a regra estiver resolvida.";
  }
}

function getCorrectionAction(rejection: Rejection) {
  switch (rejection.reason_code) {
    case "ANTI_TELEPORTE":
      return {
        href: "/registrar?quick=movimentacao",
        label: "Abrir movimentacao",
      };
    case "VALIDATION_ERROR":
      if (rejection.reason_message.toLowerCase().includes("peso")) {
        return {
          href: "/registrar?quick=pesagem",
          label: "Corrigir pesagem",
        };
      }
      return {
        href: "/registrar",
        label: "Reabrir registro",
      };
    case "INVALID_EPISODE_REFERENCE":
    case "TAXONOMY_FACTS_SCHEMA_VERSION_REQUIRED":
    case "INVALID_TAXONOMY_FACTS_PAYLOAD":
      return {
        href: "/registrar",
        label: "Abrir registro",
      };
    default:
      return null;
  }
}

function describeOperation(
  rejection: Rejection,
  op: Operation | null | undefined,
  lotesById: Map<string, string>,
) {
  if (!op) {
    return {
      title: `${rejection.table} ${rejection.action.toLowerCase()}`,
      context: "Operacao original nao encontrada na fila local.",
    };
  }

  if (op.table === "animais") {
    const identificacao =
      readStringValue(op.record, "identificacao") ??
      readStringValue(op.before_snapshot, "identificacao") ??
      `Animal ${shortId(readStringValue(op.record, "id") ?? readStringValue(op.before_snapshot, "id"))}`;
    const beforeLoteId = readNullableId(op.before_snapshot, "lote_id");
    const afterLoteId = readNullableId(op.record, "lote_id");

    if (beforeLoteId !== undefined || afterLoteId !== undefined) {
      const beforeLabel =
        beforeLoteId === null
          ? "Sem lote"
          : lotesById.get(beforeLoteId ?? "") ?? `Lote ${shortId(beforeLoteId)}`;
      const afterLabel =
        afterLoteId === null
          ? "Sem lote"
          : lotesById.get(afterLoteId ?? "") ?? `Lote ${shortId(afterLoteId)}`;

      return {
        title: identificacao,
        context: `${beforeLabel} -> ${afterLabel}`,
      };
    }

    return {
      title: identificacao,
      context: `Tabela ${op.table} | ${op.action}`,
    };
  }

  if (op.table === "agenda_itens") {
    const tipo =
      readStringValue(op.record, "tipo") ??
      readStringValue(op.before_snapshot, "tipo") ??
      "item de agenda";
    const dominio =
      readStringValue(op.record, "dominio") ??
      readStringValue(op.before_snapshot, "dominio") ??
      "agenda";

    return {
      title: `Agenda ${tipo.replaceAll("_", " ")}`,
      context: dominio,
    };
  }

  if (op.table === "contrapartes") {
    const nome =
      readStringValue(op.record, "nome") ??
      readStringValue(op.before_snapshot, "nome") ??
      `Contraparte ${shortId(readStringValue(op.record, "id"))}`;

    return {
      title: nome,
      context: "Cadastro de parceiro/contraparte",
    };
  }

  if (op.table.startsWith("eventos")) {
    const dominio =
      readStringValue(op.record, "dominio") ??
      readStringValue(op.before_snapshot, "dominio") ??
      op.table.replace("eventos_", "");

    return {
      title: `Evento ${dominio}`,
      context: `Tabela ${op.table} | ${op.action}`,
    };
  }

  return {
    title:
      readStringValue(op.record, "nome") ??
      readStringValue(op.record, "identificacao") ??
      `${op.table} ${op.action.toLowerCase()}`,
    context: `Tabela ${op.table} | ${op.action}`,
  };
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
  const lotes = useLiveQuery(
    () =>
      activeFarmId
        ? db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray()
        : [],
    [activeFarmId],
  );

  const [items, setItems] = useState<Rejection[]>([]);
  const [operationsById, setOperationsById] = useState<Map<string, Operation>>(
    () => new Map(),
  );
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [stats, setStats] = useState<RejectionStats>({ count: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRejection, setSelectedRejection] = useState<Rejection | null>(null);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purgeDryRunCount, setPurgeDryRunCount] = useState<number | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const hydrateOperations = useCallback(
    async (rejections: Rejection[], replace = false) => {
      const txIds = Array.from(new Set(rejections.map((item) => item.client_tx_id)));
      if (txIds.length === 0) {
        if (replace) setOperationsById(new Map());
        return;
      }

      const ops = await db.queue_ops.where("client_tx_id").anyOf(txIds).toArray();
      setOperationsById((current) => {
        const next = replace ? new Map<string, Operation>() : new Map(current);
        for (const op of ops) {
          next.set(op.client_op_id, op);
        }
        return next;
      });
    },
    [],
  );

  const loadFirstPage = useCallback(async () => {
    if (!activeFarmId) return;
    setIsLoading(true);
    try {
      const [page, summary] = await Promise.all([
        listRejections(activeFarmId, { limit: PAGE_SIZE }),
        getRejectionStats(activeFarmId),
      ]);
      await hydrateOperations(page.items, true);
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setStats(summary);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha ao carregar rejeicoes.";
      showError(message);
    } finally {
      setIsLoading(false);
    }
  }, [activeFarmId, hydrateOperations]);

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
      await hydrateOperations(page.items);
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha ao carregar mais itens.";
      showError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const lotesById = useMemo(
    () => new Map((lotes ?? []).map((lote) => [lote.id, lote.nome])),
    [lotes],
  );
  const canRetryRejection = useCallback(
    (rejection: Rejection) => !NON_RETRYABLE_REASON_CODES.has(rejection.reason_code),
    [],
  );
  const retryableCount = useMemo(
    () => items.filter((item) => canRetryRejection(item)).length,
    [items, canRetryRejection],
  );
  const correctionRequiredCount = items.length - retryableCount;
  const selectedOperation = selectedRejection
    ? operationsById.get(selectedRejection.client_op_id) ?? null
    : null;
  const selectedPresentation = selectedRejection
    ? describeOperation(selectedRejection, selectedOperation, lotesById)
    : null;
  const selectedRollbackDescription = selectedRejection
    ? describeRollback(selectedRejection.action)
    : null;
  const selectedNextStep = selectedRejection
    ? describeNextStep(selectedRejection)
    : null;
  const selectedCanRetry = selectedRejection
    ? canRetryRejection(selectedRejection)
    : false;
  const selectedCorrectionAction = selectedRejection
    ? getCorrectionAction(selectedRejection)
    : null;

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
    if (!canRetryRejection(rejection)) {
      showError(describeNextStep(rejection));
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

    if (ops.length === 0) {
      showError("A operacao original nao esta mais disponivel na fila local.");
      return;
    }

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
    showSuccess("Operacao reenfileirada neste aparelho. Sincronizacao pendente.");
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
        description="Cada rejeicao mostra o que o servidor recusou, o rollback local ja aplicado e o proximo passo seguro para corrigir o fluxo."
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
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Rejeicoes"
          value={stats.count}
          hint="Volume atual de itens que exigem atencao."
          tone={stats.count > 0 ? "danger" : "default"}
          icon={<AlertCircle className="h-5 w-5" />}
        />
        <MetricCard
          label="Corrigir no fluxo"
          value={correctionRequiredCount}
          hint="Erros previsiveis que nao devem ser reenfileirados sem ajuste."
          tone={correctionRequiredCount > 0 ? "warning" : "default"}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <MetricCard
          label="Prontas para retry"
          value={retryableCount}
          hint="Itens que podem voltar para a fila local sem violacao previsivel."
          tone={retryableCount > 0 ? "info" : "default"}
          icon={<RefreshCw className="h-5 w-5" />}
        />
        <MetricCard
          label="Mais antiga"
          value={stats.oldestAt ? formatDate(stats.oldestAt) : "-"}
          hint={stats.oldestAt ? daysAgo(stats.oldestAt) : "Sem itens pendentes."}
          tone="warning"
          icon={<Clock className="h-5 w-5" />}
        />
      </div>

      <Toolbar>
        <ToolbarGroup className="flex-1 gap-2">
          <div className="rounded-2xl border border-warning/30 bg-warning-muted/80 px-4 py-3 text-sm text-muted-foreground">
            O servidor rejeitou estas operacoes e o rollback local ja foi aplicado.
            Reenfileire apenas quando a causa estiver resolvida. Rejeicoes sao
            removidas automaticamente apos 7 dias.
          </div>
        </ToolbarGroup>
        <ToolbarGroup className="gap-2">
          <StatusBadge tone="info">{items.length} item(ns) carregado(s)</StatusBadge>
          {correctionRequiredCount > 0 ? (
            <StatusBadge tone="warning">
              {correctionRequiredCount} exigem correcao manual
            </StatusBadge>
          ) : null}
          {retryableCount > 0 ? (
            <StatusBadge tone="info">
              {retryableCount} podem voltar para a fila
            </StatusBadge>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Acoes avancadas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setResetDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Resetar offline
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          {items.map((rejection) => {
            const operation = operationsById.get(rejection.client_op_id) ?? null;
            const presentation = describeOperation(rejection, operation, lotesById);
            const rollbackDescription = describeRollback(rejection.action);
            const nextStep = describeNextStep(rejection);
            const canRetry = canRetryRejection(rejection);
            const correctionAction = getCorrectionAction(rejection);

            return (
              <Card key={rejection.id} className="shadow-none">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <button
                    type="button"
                    className="min-w-0 flex-1 space-y-3 text-left"
                    onClick={() => setSelectedRejection(rejection)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone="danger">{rejection.reason_code}</StatusBadge>
                      <StatusBadge tone="warning">Rollback aplicado</StatusBadge>
                      <StatusBadge tone={canRetry ? "info" : "warning"}>
                        {canRetry ? "Pode reenfileirar" : "Corrigir no fluxo"}
                      </StatusBadge>
                      <StatusBadge tone="neutral">{rejection.action}</StatusBadge>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{presentation.title}</p>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {presentation.context}
                      </p>
                    </div>
                  <p className="hidden text-xs text-muted-foreground">
                    {formatDate(rejection.created_at)} · {daysAgo(rejection.created_at)}
                  </p>
                </button>

                  <div className="flex shrink-0 items-center gap-2 lg:flex-col lg:items-end">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(rejection.created_at)}
                    </p>
                    <StatusBadge tone="neutral">{daysAgo(rejection.created_at)}</StatusBadge>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      Servidor rejeitou
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground">
                      {rejection.reason_message}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-info/20 bg-info-muted/60 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      Proximo passo seguro
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground">{nextStep}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-border/70 pt-4 lg:flex-row lg:items-center lg:justify-between">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {rollbackDescription}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRejection(rejection)}
                    >
                      <Info className="mr-2 h-4 w-4" />
                      Ver detalhes
                    </Button>

                    {canRetry ? (
                      <Button size="sm" onClick={() => handleRetry(rejection)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Re-enfileirar
                      </Button>
                    ) : correctionAction ? (
                      <Button asChild size="sm">
                        <Link to={correctionAction.href}>{correctionAction.label}</Link>
                      </Button>
                    ) : (
                      <Button size="sm" disabled>
                        Corrigir fora desta tela
                      </Button>
                    )}

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
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}

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

          {selectedRejection && selectedPresentation ? (
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
                    Registro afetado
                  </p>
                  <p className="text-foreground">{selectedPresentation.title}</p>
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
                  Contexto
                </p>
                <p className="leading-6 text-muted-foreground">
                  {selectedPresentation.context}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Mensagem do servidor
                </p>
                <p className="leading-6 text-muted-foreground">
                  {selectedRejection.reason_message}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Rollback local
                </p>
                <p className="leading-6 text-muted-foreground">
                  {selectedRollbackDescription}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Proximo passo seguro
                </p>
                <p className="leading-6 text-muted-foreground">{selectedNextStep}</p>
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
            {selectedCanRetry ? (
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
            ) : selectedCorrectionAction ? (
              <Button asChild variant="outline">
                <Link to={selectedCorrectionAction.href} onClick={() => setSelectedRejection(null)}>
                  {selectedCorrectionAction.label}
                </Link>
              </Button>
            ) : (
              <Button variant="outline" disabled>
                Corrigir fora desta tela
              </Button>
            )}
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
