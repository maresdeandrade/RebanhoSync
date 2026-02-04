import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import { createGesture } from "@/lib/offline/ops";

const Reconciliacao = () => {
  const rejections = useLiveQuery(() => db.queue_rejections.toArray());

  const handleRetry = async (client_tx_id: string) => {
    const ops = await db.queue_ops.where('client_tx_id').equals(client_tx_id).toArray();
    const fazenda_id = ops[0].fazenda_id;
    
    // Clona operações com novos IDs
    await createGesture(fazenda_id, ops.map(o => ({
      table: o.table,
      action: o.action,
      record: o.record
    })));

    // Limpa rejeições antigas
    await db.queue_rejections.where('client_tx_id').equals(client_tx_id).delete();
  };

  const handleClear = async (id: string) => {
    await db.queue_rejections.delete(id);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reconciliação de Dados</h1>
      
      {!rejections || rejections.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhuma rejeição pendente. Tudo sincronizado!
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {rejections.map((rej) => (
            <Card key={rej.id} className="border-destructive/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  Erro em {rej.table} ({rej.action})
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleRetry(rej.client_tx_id)}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Reenviar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleClear(rej.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-bold text-destructive">{rej.reason_code}</p>
                <p className="text-sm text-muted-foreground">{rej.reason_message}</p>
                <p className="text-xs text-muted-foreground mt-2">TX: {rej.client_tx_id}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Reconciliacao;