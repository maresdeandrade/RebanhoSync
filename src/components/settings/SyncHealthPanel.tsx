import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

interface HealthMetric {
  id: string;
  event_name: string;
  status: string;
  reason_code: string | null;
  created_at: string;
}

function getMetricLabel(eventName: string) {
  if (eventName === "sync_error") return "Falha de envio";
  if (eventName === "sync_rejected") return "Registro rejeitado";
  if (eventName === "sync_backlog") return "Envio acumulado";
  return "Ocorrencia";
}

export function SyncHealthPanel() {
  const { activeFarmId } = useAuth();
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      if (!activeFarmId) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("metrics_events")
          .select("id, event_name, status, reason_code, created_at")
          .eq("fazenda_id", activeFarmId)
          .in("event_name", ["sync_error", "sync_rejected", "sync_backlog"])
          .order("created_at", { ascending: false })
          .limit(10);

        if (!error && data) {
          setMetrics(data);
        }
      } catch (err) {
        console.error("Erro ao carregar telemetria", err);
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
  }, [activeFarmId]);

  if (!activeFarmId || (!loading && metrics.length === 0)) return null;

  return (
    <Card className="border-destructive/20 bg-destructive/5 shadow-none">
      <CardHeader className="px-4 py-3">
        <CardTitle className="text-base text-destructive">
          Telemetria de sync para revisar
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pt-0">
        {loading ? (
          <p className="text-sm text-muted-foreground">Verificando...</p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Estes registros vêm da telemetria remota de sync. A fila local
              atual continua indicada no Dashboard como itens salvos neste
              aparelho.
            </p>
            {metrics.map((m) => (
              <div
                key={m.id}
                className="flex flex-col justify-between gap-2 rounded-lg border border-border/50 bg-background/70 p-3 text-sm sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge
                    tone={m.status === "error" ? "critical" : "warning"}
                  >
                    {getMetricLabel(m.event_name)}
                  </StatusBadge>
                  {m.reason_code && (
                    <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                      {m.reason_code}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
