import React, { useEffect, useState } from "react";
import type { AdminApiError, PlatformUserListItem } from "@/lib/admin/adminTypes";
import { adminSetCanCreateFarm, fetchPlatformUsers } from "@/lib/admin/adminApi";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { AdminUserDetailModal } from "./AdminUserDetailModal";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  Unlock,
  Users,
  WifiOff,
} from "lucide-react";

const PAGE_SIZE = 25;

interface AdminUsersTabProps {
  onForbidden?: () => void;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({ onForbidden }) => {
  const { toast } = useToast();
  const [users, setUsers] = useState<PlatformUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AdminApiError | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Estado para diálogo de confirmação da mutação A4
  const [pendingUserMutation, setPendingUserMutation] = useState<{
    user: PlatformUserListItem;
    nextValue: boolean;
  } | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  // hasNextPage derivado do sentinela PAGE_SIZE+1 (não do length === PAGE_SIZE)
  const [hasNextPage, setHasNextPage] = useState(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setOffset(0);
    }, 400);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadUsers = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Solicita PAGE_SIZE+1 para detectar se há próxima página sem COUNT(*)
      const data = await fetchPlatformUsers({
        search: debouncedSearch,
        limit: PAGE_SIZE + 1,
        offset,
      });
      // Guarda apenas PAGE_SIZE itens; o item extra serve só como sentinela
      setUsers(data.slice(0, PAGE_SIZE));
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
    loadUsers();
  }, [loadUsers]);

  const handleConfirmMutation = async () => {
    if (!pendingUserMutation || isMutating) return;

    const { user, nextValue } = pendingUserMutation;
    setIsMutating(true);

    try {
      const result = await adminSetCanCreateFarm(user.id, nextValue);

      // Atualiza estado local da UI após confirmação do backend
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, canCreateFarm: result.canCreateFarm } : u,
        ),
      );

      toast({
        title: "Permissão atualizada",
        description: `Criação de fazenda ${
          result.canCreateFarm ? "permitida" : "bloqueada"
        } para ${user.email}.`,
      });

      setPendingUserMutation(null);
    } catch (err: unknown) {
      const adminErr = err as AdminApiError;
      if (adminErr.code === "FORBIDDEN" && onForbidden) {
        setPendingUserMutation(null);
        onForbidden();
        return;
      }

      toast({
        title: "Erro ao atualizar permissão",
        description: adminErr.message || "Não foi possível alterar a permissão.",
        variant: "destructive",
      });
    } finally {
      setIsMutating(false);
    }
  };

  const hasPrevPage = offset > 0;

  return (
    <div className="space-y-4">
      {/* Barra de Filtros e Ações */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadUsers}
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
                Conecte-se à internet para carregar a listagem de usuários.
              </p>
            </>
          ) : (
            <>
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <h4 className="font-semibold text-sm text-destructive">
                Erro ao carregar usuários
              </h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {error.message}
              </p>
            </>
          )}
          <Button variant="outline" size="sm" onClick={loadUsers} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Tentar Novamente
          </Button>
        </Card>
      )}

      {/* Tabela de Usuários */}
      {!error && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-medium border-b text-xs">
                <tr>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Criação</th>
                  <th className="px-4 py-3">Último Login</th>
                  <th className="px-4 py-3 text-center">Fazendas</th>
                  <th className="px-4 py-3 text-center">Criar Fazendas</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-8 mx-auto" /></td>
                      <td className="px-4 py-3 text-center"><Skeleton className="h-4 w-24 mx-auto" /></td>
                      <td className="px-4 py-3 text-right"><Skeleton className="h-8 w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Nenhum usuário encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {u.displayName || <span className="text-muted-foreground italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {u.email}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {u.lastSignInAt ? (
                          new Date(u.lastSignInAt).toLocaleDateString("pt-BR")
                        ) : (
                          <span className="text-muted-foreground italic">Nunca</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">
                        {u.farmsCount}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setPendingUserMutation({
                              user: u,
                              nextValue: !u.canCreateFarm,
                            })
                          }
                          className="h-7 px-2 text-xs flex items-center gap-1.5 mx-auto"
                          title={`Clique para ${u.canCreateFarm ? "bloquear" : "permitir"} criação de fazenda`}
                        >
                          {u.canCreateFarm ? (
                            <Badge
                              variant="outline"
                              className="text-xs bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1 cursor-pointer"
                            >
                              <Unlock className="h-3 w-3" />
                              Permitido
                            </Badge>
                          ) : (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-muted text-muted-foreground flex items-center gap-1 cursor-pointer"
                            >
                              <Lock className="h-3 w-3" />
                              Bloqueado
                            </Badge>
                          )}
                        </Button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedUserId(u.id)}
                          className="h-8 px-2 text-xs flex items-center gap-1 ml-auto"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Detalhes
                        </Button>
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
              Mostrando {users.length} registros (página {Math.floor(offset / PAGE_SIZE) + 1})
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

      {/* Modal de Detalhes sob Demanda */}
      {selectedUserId && (
        <AdminUserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onForbidden={onForbidden}
        />
      )}

      {/* Diálogo de Confirmação para Mutação A4 */}
      <AlertDialog
        open={pendingUserMutation !== null}
        onOpenChange={(open) => {
          if (!open && !isMutating) setPendingUserMutation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {pendingUserMutation?.nextValue ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <Lock className="h-5 w-5 text-amber-600" />
              )}
              {pendingUserMutation?.nextValue
                ? "Permitir Criação de Fazendas"
                : "Bloquear Criação de Fazendas"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingUserMutation?.nextValue ? (
                <>
                  Deseja conceder permissão para o usuário{" "}
                  <strong className="text-foreground">
                    {pendingUserMutation?.user.email}
                  </strong>{" "}
                  criar novas fazendas na plataforma?
                </>
              ) : (
                <>
                  Deseja revogar a permissão do usuário{" "}
                  <strong className="text-foreground">
                    {pendingUserMutation?.user.email}
                  </strong>{" "}
                  de criar novas fazendas? O usuário continuará acessando as
                  fazendas nas quais já é membro.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmMutation();
              }}
              disabled={isMutating}
              className={
                !pendingUserMutation?.nextValue
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {isMutating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                "Confirmar Alteração"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
