import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Activity } from "lucide-react";

interface HealthMetric {
  id: string;
  event_name: string;
  status: string;
  reason_code: string | null;
  created_at: string;
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

  if (!activeFarmId) return null;

  return (
    <Card className="shadow-none border-destructive/20 bg-destructive/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-destructive" />
          <CardTitle className="text-base text-destructive">Saúde do Sync (Operacional)</CardTitle>
        </div>
        <CardDescription>
          Últimos erros de sincronização e rejeições da fazenda detectados pela telemetria.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando métricas...</p>
        ) : metrics.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum erro de sync recente detectado.</p>
        ) : (
          <div className="space-y-3">
            {metrics.map((m) => (
              <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-background/60 border border-border/50 text-sm">
                <div className="flex items-center gap-3">
                  <StatusBadge tone={m.status === "error" ? "critical" : "warning"}>
                    {m.event_name}
                  </StatusBadge>
                  {m.reason_code && (
                    <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      {m.reason_code}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground mt-2 sm:mt-0">
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
