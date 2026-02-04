import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import { createGesture } from "@/lib/offline/ops";

const Reconciliacao = () => {
  const rejections = useLiveQuery(() => db.queue_rejections.toArray());

  const handleRetry = async (rejection: any) => {
    const ops = await db.queue_ops.where('client_tx_id').equals(rejection.client_tx_id).toArray();
    // Clona as operações para um novo gesto
    await createGesture(rejection.fazenda_id, ops.map(o => ({
      table: o.table,
      action: o.action,
      record: o.record,
      fazenda_id: o.fazenda_id
    })));
    await db.queue_rejections.delete(rejection.id);
  };

  const handleClear = async (id: number) => {
    await db.queue_rejections.delete(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reconciliação</h1>
        <span className="text-sm text-muted-foreground">{rejections?.length || 0} pendências</span>
      </div>

      {rejections?.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">Tudo limpo! Nenhuma rejeição encontrada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rejections?.map((rej) => (
            <Card key={rej.id} className="border-destructive/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  Erro em {rej.table} ({rej.action})
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleRetry(rej)}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Re-enfileirar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleClear(rej.id!)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs font-mono bg-muted p-2 rounded mb-2">{rej.reason_code}</p>
                <p className="text-sm text-muted-foreground">{rej.reason_message}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Reconciliacao;