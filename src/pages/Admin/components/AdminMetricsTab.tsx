import React from "react";
import type { AdminApiError, PlatformMetrics } from "@/lib/admin/adminTypes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserPlus, Building2, Layers, MailCheck, AlertTriangle, RefreshCw, WifiOff } from "lucide-react";

interface AdminMetricsTabProps {
  metrics: PlatformMetrics | null;
  loading: boolean;
  error?: AdminApiError | null;
  onRetry?: () => void;
}

export const AdminMetricsTab: React.FC<AdminMetricsTabProps> = ({
  metrics,
  loading,
  error,
  onRetry,
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    if (error.code === "OFFLINE") {
      return (
        <Card className="p-8 text-center border-dashed">
          <WifiOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-60" />
          <h4 className="font-semibold text-sm">Dispositivo Offline</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Não é possível carregar as métricas sem conexão com a internet.
          </p>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Tentar Novamente
            </Button>
          )}
        </Card>
      );
    }

    return (
      <Card className="p-8 text-center border-destructive/40 bg-destructive/5">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
        <h4 className="font-semibold text-sm text-destructive">Erro ao carregar métricas</h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          {error.message}
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Tentar Novamente
          </Button>
        )}
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Nenhuma métrica disponível no momento.
      </Card>
    );
  }

  const items = [
    {
      title: "Total de usuários",
      value: metrics.totalUsers.toLocaleString("pt-BR"),
      icon: Users,
      description: "Contas registradas na plataforma",
    },
    {
      title: "Novos usuários — 30 dias",
      value: metrics.newUsers30d.toLocaleString("pt-BR"),
      icon: UserPlus,
      description: "Criados nos últimos 30 dias",
    },
    {
      title: "Total de fazendas",
      value: metrics.totalFarms.toLocaleString("pt-BR"),
      icon: Building2,
      description: "Propriedades cadastradas na plataforma",
    },
    {
      title: "Animais ativos",
      value: metrics.totalActiveAnimals.toLocaleString("pt-BR"),
      icon: Layers,
      description: "Animais com status ativo no rebanho",
    },
    {
      title: "Convites pendentes válidos",
      value: metrics.pendingValidInvites.toLocaleString("pt-BR"),
      icon: MailCheck,
      description: "Convites não expirados em aberto",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="admin-metrics-grid">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.title} className="relative overflow-hidden border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.title}
              </CardTitle>
              <Icon className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {item.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
