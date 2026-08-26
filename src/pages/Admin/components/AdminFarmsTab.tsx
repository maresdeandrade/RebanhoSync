import React, { useEffect, useState } from "react";
import type { AdminApiError, PlatformFarmListItem } from "@/lib/admin/adminTypes";
import { fetchPlatformFarms } from "@/lib/admin/adminApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  AlertTriangle,
  Building2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  WifiOff,
} from "lucide-react";

const PAGE_SIZE = 25;

interface AdminFarmsTabProps {
  onForbidden?: () => void;
}

export const AdminFarmsTab: React.FC<AdminFarmsTabProps> = ({ onForbidden }) => {
  const [farms, setFarms] = useState<PlatformFarmListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminApiError | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
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

  const loadFarms = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Solicita PAGE_SIZE+1 para detectar se há próxima página sem COUNT(*)
      const data = await fetchPlatformFarms({
        search: debouncedSearch,
        limit: PAGE_SIZE + 1,
        offset,
      });
      setFarms(data.slice(0, PAGE_SIZE));
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
  }, [debouncedSearch, offset, onForbidden]);

  useEffect(() => {
    loadFarms();
  }, [loadFarms]);

  const hasPrevPage = offset > 0;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, código, município ou proprietário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadFarms}
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
                Conecte-se à internet para carregar a listagem de fazendas.
              </p>
            </>
          ) : (
            <>
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <h4 className="font-semibold text-sm text-destructive">
                Erro ao carregar fazendas
              </h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {error.message}
              </p>
            </>
          )}
          <Button variant="outline" size="sm" onClick={loadFarms} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Tentar Novamente
          </Button>
        </Card>
      )}

      {/* Tabela de Fazendas */}
      {!error && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-medium border-b text-xs">
                <tr>
                  <th className="px-4 py-3">Fazenda</th>
                  <th className="px-4 py-3">Localização</th>
                  <th className="px-4 py-3 text-right">Área Total</th>
                  <th className="px-4 py-3">Proprietário</th>
                  <th className="px-4 py-3 text-center">Animais Ativos</th>
                  <th className="px-4 py-3 text-center">Membros</th>
                  <th className="px-4 py-3">Cadastro</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                      <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-8 mx-auto" /></td>
                      <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-8 mx-auto" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    </tr>
                  ))
                ) : farms.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Nenhuma fazenda encontrada com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  farms.map((f) => (
                    <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <div>{f.nome}</div>
                        {f.codigo && (
                          <div className="text-xs text-muted-foreground">
                            Código: {f.codigo}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {f.municipio || f.estado ? (
                          `${f.municipio ?? "—"} / ${f.estado ?? "—"}`
                        ) : (
                          <span className="italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {f.areaTotalHa !== null ? (
                          `${f.areaTotalHa.toLocaleString("pt-BR")} ha`
                        ) : (
                          <span className="text-muted-foreground italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-xs">
                          {f.ownerName || "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {f.ownerEmail || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className="font-semibold">
                          {f.activeAnimalsCount}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">
                        {f.membersCount}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {new Date(f.createdAt).toLocaleDateString("pt-BR")}
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
              Mostrando {farms.length} registros (página {Math.floor(offset / PAGE_SIZE) + 1})
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
