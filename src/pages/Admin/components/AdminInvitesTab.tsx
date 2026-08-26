import React, { useEffect, useState } from "react";
import type { AdminApiError, InviteStatusFilter, PlatformInviteListItem } from "@/lib/admin/adminTypes";
import { fetchPlatformInvites } from "@/lib/admin/adminApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Mail,
  RefreshCw,
  Search,
  WifiOff,
} from "lucide-react";

const PAGE_SIZE = 25;

interface AdminInvitesTabProps {
  onForbidden?: () => void;
}

export const AdminInvitesTab: React.FC<AdminInvitesTabProps> = ({ onForbidden }) => {
  const [invites, setInvites] = useState<PlatformInviteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminApiError | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InviteStatusFilter>("all");
  const [offset, setOffset] = useState(0);
  // hasNextPage derivado do sentinela PAGE_SIZE+1 (não do length === PAGE_SIZE)
  const [hasNextPage, setHasNextPage] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setOffset(0);
    }, 400);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadInvites = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Solicita PAGE_SIZE+1 para detectar se há próxima página sem COUNT(*)
      const data = await fetchPlatformInvites({
        statusFilter,
        search: debouncedSearch,
        limit: PAGE_SIZE + 1,
        offset,
      });
      setInvites(data.slice(0, PAGE_SIZE));
      setHasNextPage(data.length > PAGE_SIZE);
    } catch (err: unknown) {
      const adminErr = err as AdminApiError;
      setError(adminErr);
      if (adminErr.code === "FORBIDDEN" && onForbidden) {
        onForbidden();
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch, offset, onForbidden]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const hasPrevPage = offset > 0;

  const renderStatusBadge = (invite: PlatformInviteListItem) => {
    if (invite.status === "accepted") {
      return <Badge variant="default" className="bg-emerald-600 text-white hover:bg-emerald-700">Aceito</Badge>;
    }
    if (invite.status === "rejected") {
      return <Badge variant="destructive">Rejeitado</Badge>;
    }
    if (invite.status === "cancelled") {
      return <Badge variant="secondary">Cancelado</Badge>;
    }
    if (invite.isExpired || invite.status === "pending" && new Date(invite.expiresAt) < new Date()) {
      return <Badge variant="destructive" className="bg-amber-600 text-white hover:bg-amber-700">Expirado</Badge>;
    }
    return <Badge variant="outline" className="text-primary border-primary">Pendente</Badge>;
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-3 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por e-mail, telefone ou fazenda..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={statusFilter}
              onValueChange={(val: InviteStatusFilter) => {
                setStatusFilter(val);
                setOffset(0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="pending">Pendentes (válidos)</SelectItem>
                <SelectItem value="expired">Expirados</SelectItem>
                <SelectItem value="accepted">Aceitos</SelectItem>
                <SelectItem value="rejected">Rejeitados</SelectItem>
                <SelectItem value="cancelled">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadInvites}
          disabled={loading}
          className="flex items-center gap-2 self-end sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Estado de Erro / Offline */}
      {error && !loading && (
        <Card
          className={`p-6 text-center ${
            error.code === "OFFLINE"
              ? "border-dashed"
              : "border-destructive/40 bg-destructive/5"
          }`}
        >
          {error.code === "OFFLINE" ? (
            <>
              <WifiOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-60" />
              <h4 className="font-semibold text-sm">Dispositivo Offline</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Conecte-se à internet para carregar a listagem de convites.
              </p>
            </>
          ) : (
            <>
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <h4 className="font-semibold text-sm text-destructive">
                Erro ao carregar convites
              </h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {error.message}
              </p>
            </>
          )}
          <Button variant="outline" size="sm" onClick={loadInvites} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Tentar Novamente
          </Button>
        </Card>
      )}

      {/* Tabela de Convites */}
      {!error && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-medium border-b text-xs">
                <tr>
                  <th className="px-4 py-3">Fazenda</th>
                  <th className="px-4 py-3">Destinatário</th>
                  <th className="px-4 py-3">Papel</th>
                  <th className="px-4 py-3">Emissor</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Envio</th>
                  <th className="px-4 py-3">Expiração</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-16 mx-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    </tr>
                  ))
                ) : invites.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Nenhum convite encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  invites.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {inv.fazendaNome}
                      </td>
                      <td className="px-4 py-3">
                        <div>{inv.email || "—"}</div>
                        {inv.phone && (
                          <div className="text-xs text-muted-foreground">
                            {inv.phone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="capitalize text-xs">
                          {inv.role}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium">
                          {inv.inviterName || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {inv.inviterEmail || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {renderStatusBadge(inv)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {new Date(inv.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {new Date(inv.expiresAt).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
            <div>
              Mostrando {invites.length} registros (página {Math.floor(offset / PAGE_SIZE) + 1})
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset((prev) => Math.max(prev - PAGE_SIZE, 0))}
                disabled={!hasPrevPage || loading}
                className="h-8 px-2"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                disabled={!hasNextPage || loading}
                className="h-8 px-2"
              >
                Próxima
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
