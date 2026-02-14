import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import { createGesture } from "@/lib/offline/ops";
import { showSuccess, showError } from "@/utils/toast";

// TYPE FIX: Define proper interface for queue_rejections table
interface QueueRejection {
  id?: number;
  client_tx_id: string;
  client_op_id: string;
  fazenda_id: string;
  table: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  reason_code?: string;
  reason_message?: string;
  created_at?: string;
  rejected_at?: string;
  // Generic by design - depends on table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record?: any;
}

const Reconciliacao = () => {
  const rejections = useLiveQuery(() => db.queue_rejections.toArray());

  // P1.7 FIX: Idempotency check before retry
  // TYPE FIX: Use proper QueueRejection type instead of any
  const handleRetry = async (rejection: QueueRejection) => {
    if (rejection.reason_code === "ANTI_TELEPORTE") {
      showError(
        "Este erro exige refazer a movimentacao pelo fluxo atual (Mover/Registrar).",
      );
      return;
    }

    // Check if operations already exist in queue (prevent duplicates)
    const existingGesture = await db.queue_gestures
      .where("fazenda_id")
      .equals(rejection.fazenda_id)
      .and((g) => g.status === "PENDING" || g.status === "SYNCING")
      .first();

    if (existingGesture) {
      // Check if any op from this rejection is already in a pending gesture
      const pendingOps = await db.queue_ops
        .where("client_tx_id")
        .equals(existingGesture.client_tx_id)
        .toArray();

      const hasDuplicate = pendingOps.some(
        (op) =>
          op.table === rejection.table &&
          op.action === rejection.action &&
          JSON.stringify(op.record) === JSON.stringify(rejection.record),
      );

      if (hasDuplicate) {
        console.warn(
          "[Reconciliacao] Operation already in sync queue, skipping retry",
        );
        showError("Esta operação já está na fila de sincronização");
        return;
      }
    }

    // Clone operations to new gesture
    const ops = await db.queue_ops
      .where("client_tx_id")
      .equals(rejection.client_tx_id)
      .toArray();
    await createGesture(
      rejection.fazenda_id,
      ops.map((o) => {
        // Hotfix de compatibilidade: schema exige intervalo_dias > 0.
        if (
          o.table === "protocolos_sanitarios_itens" &&
          (o.action === "INSERT" || o.action === "UPDATE")
        ) {
          const record = { ...(o.record ?? {}) };
          const intervalo = Number(record.intervalo_dias);
          if (!Number.isFinite(intervalo) || intervalo <= 0) {
            record.intervalo_dias = 1;
          }

          return {
            table: o.table,
            action: o.action,
            record,
          };
        }

        return {
          table: o.table,
          action: o.action,
          record: o.record,
        };
      }),
    );

    await db.queue_rejections.delete(rejection.id);
    showSuccess("Operação re-enfileirada para sincronização");
    console.log("[Reconciliacao] Gesture re-queued for sync");
  };

  const handleClear = async (id: number) => {
    await db.queue_rejections.delete(id);
    showSuccess("Rejeição removida");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reconciliação</h1>
        <span className="text-sm text-muted-foreground">
          {rejections?.length || 0} pendências
        </span>
      </div>

      {rejections?.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              Tudo limpo! Nenhuma rejeição encontrada.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rejections?.map((rej) => (
            <Card key={rej.id} className="border-destructive/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <div className="grid gap-2 text-sm">
                    <div>
                      <strong>Operação:</strong> {rej.table} • {rej.action}
                    </div>
                    <div>
                      <strong>Motivo:</strong>{" "}
                      {rej.reason_message || rej.reason_code}
                    </div>
                  </div>
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRetry(rej as QueueRejection)}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" /> Re-enfileirar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleClear(rej.id!)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs font-mono bg-muted p-2 rounded mb-2">
                  {rej.reason_code}
                </p>
                <p className="text-sm text-muted-foreground">
                  {rej.reason_message}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Reconciliacao;
