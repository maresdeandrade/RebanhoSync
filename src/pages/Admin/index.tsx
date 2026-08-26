import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { AdminApiError, PlatformMetrics } from "@/lib/admin/adminTypes";
import { fetchPlatformMetrics } from "@/lib/admin/adminApi";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { PageIntro } from "@/components/ui/page-intro";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AdminMetricsTab } from "./components/AdminMetricsTab";
import { AdminUsersTab } from "./components/AdminUsersTab";
import { AdminFarmsTab } from "./components/AdminFarmsTab";
import { AdminInvitesTab } from "./components/AdminInvitesTab";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Mail,
  RefreshCw,
  ShieldCheck,
  Users,
  WifiOff,
} from "lucide-react";

export const AdminBackoffice: React.FC = () => {
  const navigate = useNavigate();
  const { refreshSettings } = useAuth();
  const { toast } = useToast();

  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [metricsError, setMetricsError] = useState<AdminApiError | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const handleForbiddenError = useCallback(() => {
    toast({
      title: "Acesso Administrativo Revogado",
      description: "Suas permissões de SuperAdmin foram revogadas ou sua sessão expirou.",
      variant: "destructive",
    });
    // Invalida privilégios no auth context
    void refreshSettings();
    // Redireciona com segurança para a página inicial
    navigate("/home", { replace: true });
  }, [navigate, refreshSettings, toast]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const loadMetrics = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setLoadingMetrics(false);
      return;
    }

    setLoadingMetrics(true);
    setMetricsError(null);

    try {
      const data = await fetchPlatformMetrics();
      setMetrics(data);
    } catch (err: unknown) {
      const adminErr = err as AdminApiError;
      setMetricsError(adminErr);
      if (adminErr.code === "FORBIDDEN") {
        handleForbiddenError();
      }
    } finally {
      setLoadingMetrics(false);
    }
  }, [handleForbiddenError]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  return (
    <div className="container max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Header / Intro */}
      <PageIntro
        eyebrow="Plataforma"
        title="Painel Administrativo"
        description="Governança global, telemetria de plataforma e gestão de acessos."
        meta={
          <div className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-0.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>SuperAdmin</span>
          </div>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/home")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao App
          </Button>
        }
      />

      {/* Banner de Offline State (Online-Only) */}
      {!isOnline && (
        <Card className="border-destructive/50 bg-destructive/10 text-destructive">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <WifiOff className="h-6 w-6 text-destructive shrink-0" />
              <div>
                <h4 className="font-semibold text-sm">Painel Indisponível Offline</h4>
                <p className="text-xs text-muted-foreground">
                  O Backoffice administrativo opera exclusivamente em modo online. Conecte-se à internet para carregar os dados.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsOnline(navigator.onLine);
                if (navigator.onLine) loadMetrics();
              }}
              className="shrink-0"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Abas Administrativas */}
      <Tabs defaultValue="metrics" className="space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto">
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span>Métricas</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>Usuários</span>
          </TabsTrigger>
          <TabsTrigger value="farms" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span>Fazendas</span>
          </TabsTrigger>
          <TabsTrigger value="invites" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span>Convites</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          <AdminMetricsTab
            metrics={metrics}
            loading={loadingMetrics}
            error={metricsError}
            onRetry={loadMetrics}
          />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <AdminUsersTab onForbidden={handleForbiddenError} />
        </TabsContent>

        <TabsContent value="farms" className="space-y-4">
          <AdminFarmsTab onForbidden={handleForbiddenError} />
        </TabsContent>

        <TabsContent value="invites" className="space-y-4">
          <AdminInvitesTab onForbidden={handleForbiddenError} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminBackoffice;
