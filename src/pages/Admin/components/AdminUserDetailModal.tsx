import React, { useEffect, useState } from "react";
import type { AdminApiError, PlatformUserDetail } from "@/lib/admin/adminTypes";
import { fetchPlatformUserDetail } from "@/lib/admin/adminApi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Calendar, Mail, Phone, ShieldCheck, User, WifiOff, AlertTriangle } from "lucide-react";

interface AdminUserDetailModalProps {
  userId: string | null;
  onClose: () => void;
  onForbidden?: () => void;
}

export const AdminUserDetailModal: React.FC<AdminUserDetailModalProps> = ({
  userId,
  onClose,
  onForbidden,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AdminApiError | null>(null);
  const [detail, setDetail] = useState<PlatformUserDetail | null>(null);

  useEffect(() => {
    if (!userId) {
      setDetail(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchPlatformUserDetail(userId)
      .then((data) => {
        if (isMounted) {
          setDetail(data);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          const adminErr = err as AdminApiError;
          setError(adminErr);
          if (adminErr.code === "FORBIDDEN" && onForbidden) {
            onClose();
            onForbidden();
          }
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [userId, onForbidden, onClose]);

  return (
    <Dialog open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Detalhes do Usuário
          </DialogTitle>
          <DialogDescription>
            Identificação e vínculos de fazenda registrados na plataforma.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div className="py-6 text-center text-sm">
            {error.code === "OFFLINE" ? (
              <div className="text-muted-foreground">
                <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-60" />
                <p className="font-medium">Indisponível Offline</p>
                <p className="text-xs mt-1">Conecte-se para ver os detalhes deste usuário.</p>
              </div>
            ) : (
              <div className="text-destructive">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                <p className="font-medium">Erro ao carregar detalhes</p>
                <p className="text-xs text-muted-foreground mt-1">{error.message}</p>
              </div>
            )}
          </div>
        ) : detail ? (
          <div className="space-y-6 py-2">
            {/* Identificação Base */}
            <div className="space-y-2 border-b pb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">
                  {detail.displayName || "Sem nome cadastrado"}
                </h3>
                {detail.isSuperAdmin && (
                  <Badge variant="default" className="flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    SuperAdmin
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>{detail.email}</span>
              </div>
              {detail.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span>{detail.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <Calendar className="h-3.5 w-3.5" />
                <span>
                  Criado em: {new Date(detail.createdAt).toLocaleDateString("pt-BR")}
                </span>
                {detail.lastSignInAt && (
                  <span className="ml-2">
                    • Último login: {new Date(detail.lastSignInAt).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
              <div className="pt-2">
                <span className="text-xs text-muted-foreground mr-2">
                  Permissão para criar fazendas:
                </span>
                <Badge variant={detail.canCreateFarm ? "outline" : "secondary"}>
                  {detail.canCreateFarm ? "Habilitado" : "Desabilitado"}
                </Badge>
              </div>
            </div>

            {/* Fazendas Vinculadas */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Fazendas Vinculadas ({detail.farms.length})
              </h4>
              {detail.farms.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  Nenhuma fazenda vinculada a este usuário.
                </p>
              ) : (
                <div className="space-y-2">
                  {detail.farms.map((farm) => (
                    <div
                      key={farm.fazenda_id}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <div>
                        <div className="font-medium">{farm.fazenda_nome}</div>
                        <div className="text-xs text-muted-foreground">
                          ID: {farm.fazenda_id.slice(0, 8)}...
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {farm.is_primary && (
                          <Badge variant="outline" className="text-xs">
                            Principal
                          </Badge>
                        )}
                        <Badge
                          variant={
                            farm.role === "owner"
                              ? "default"
                              : farm.role === "manager"
                              ? "secondary"
                              : "outline"
                          }
                          className="capitalize"
                        >
                          {farm.role}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Não foi possível carregar os detalhes do usuário.
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
