import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Building2,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  Save,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { showError, showSuccess } from "@/utils/toast";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/EmptyState";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";

type ContraparteTipo = "pessoa" | "empresa";

interface ContraparteForm {
  tipo: ContraparteTipo;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
}

const EMPTY_FORM: ContraparteForm = {
  tipo: "pessoa",
  nome: "",
  documento: "",
  telefone: "",
  email: "",
  endereco: "",
};

export default function Contrapartes() {
  const { activeFarmId, role } = useAuth();
  const canManage = role === "owner" || role === "manager";

  const [search, setSearch] = useState("");
  const [isSavingCreate, setIsSavingCreate] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<{
    id: string;
    nome: string;
  } | null>(null);
  const [form, setForm] = useState<ContraparteForm>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<ContraparteForm>(EMPTY_FORM);

  const contrapartesQuery = useLiveQuery(async () => {
    if (!activeFarmId) return [];
    return db.state_contrapartes
      .where("fazenda_id")
      .equals(activeFarmId)
      .and((item) => !item.deleted_at)
      .toArray();
  }, [activeFarmId]);

  const contrapartes = useMemo(
    () => contrapartesQuery ?? [],
    [contrapartesQuery],
  );

  const filtered = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    return contrapartes
      .filter((item) => {
        if (!searchLower) return true;
        const index = [
          item.nome,
          item.documento ?? "",
          item.telefone ?? "",
          item.email ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return index.includes(searchLower);
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [contrapartes, search]);

  const counts = useMemo(
    () => ({
      total: contrapartes.length,
      pessoas: contrapartes.filter((item) => item.tipo === "pessoa").length,
      empresas: contrapartes.filter((item) => item.tipo === "empresa").length,
    }),
    [contrapartes],
  );

  const handleCreate = async () => {
    if (!activeFarmId) {
      showError("Selecione uma fazenda ativa.");
      return;
    }
    if (!canManage) {
      showError("Apenas owner/manager pode cadastrar contraparte.");
      return;
    }
    if (!form.nome.trim()) {
      showError("Nome da contraparte e obrigatorio.");
      return;
    }

    setIsSavingCreate(true);
    try {
      const contraparteId = crypto.randomUUID();
      const txId = await createGesture(activeFarmId, [
        {
          table: "contrapartes",
          action: "INSERT",
          record: {
            id: contraparteId,
            tipo: form.tipo,
            nome: form.nome.trim(),
            documento: form.documento.trim() || null,
            telefone: form.telefone.trim() || null,
            email: form.email.trim() || null,
            endereco: form.endereco.trim() || null,
            payload: { origem: "cadastro_manual_contraparte" },
          },
        },
      ]);

      setForm(EMPTY_FORM);
      showSuccess(`Contraparte criada. TX: ${txId.slice(0, 8)}`);
    } catch {
      showError("Falha ao criar contraparte.");
    } finally {
      setIsSavingCreate(false);
    }
  };

  const startEdit = (item: (typeof contrapartes)[number]) => {
    setEditingId(item.id);
    setEditForm({
      tipo: item.tipo,
      nome: item.nome,
      documento: item.documento ?? "",
      telefone: item.telefone ?? "",
      email: item.email ?? "",
      endereco: item.endereco ?? "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  };

  const handleUpdate = async (id: string) => {
    if (!activeFarmId) {
      showError("Selecione uma fazenda ativa.");
      return;
    }
    if (!canManage) {
      showError("Apenas owner/manager pode editar contraparte.");
      return;
    }
    if (!editForm.nome.trim()) {
      showError("Nome da contraparte e obrigatorio.");
      return;
    }

    setUpdatingId(id);
    try {
      const txId = await createGesture(activeFarmId, [
        {
          table: "contrapartes",
          action: "UPDATE",
          record: {
            id,
            tipo: editForm.tipo,
            nome: editForm.nome.trim(),
            documento: editForm.documento.trim() || null,
            telefone: editForm.telefone.trim() || null,
            email: editForm.email.trim() || null,
            endereco: editForm.endereco.trim() || null,
          },
        },
      ]);

      cancelEdit();
      showSuccess(`Contraparte atualizada. TX: ${txId.slice(0, 8)}`);
    } catch {
      showError("Falha ao atualizar contraparte.");
    } finally {
      setUpdatingId(null);
    }
  };

  const requestDelete = async (id: string, nome: string) => {
    if (!activeFarmId) {
      showError("Selecione uma fazenda ativa.");
      return;
    }
    if (!canManage) {
      showError("Apenas owner/manager pode remover contraparte.");
      return;
    }

    const [financeiroCount, sociedadeCount] = await Promise.all([
      db.event_eventos_financeiro
        .where("fazenda_id")
        .equals(activeFarmId)
        .and(
          (item) =>
            item.contraparte_id === id &&
            (item.deleted_at === null || !item.deleted_at),
        )
        .count(),
      db.state_animais_sociedade
        .where("fazenda_id")
        .equals(activeFarmId)
        .and(
          (item) =>
            item.contraparte_id === id &&
            (item.deleted_at === null || !item.deleted_at),
        )
        .count(),
    ]);

    if (financeiroCount > 0 || sociedadeCount > 0) {
      showError(
        "Nao e possivel remover: contraparte vinculada a eventos financeiros ou sociedades.",
      );
      return;
    }

    setDeleteCandidate({ id, nome });
  };

  const handleDelete = async () => {
    if (!activeFarmId || !deleteCandidate) return;

    setDeletingId(deleteCandidate.id);
    try {
      const txId = await createGesture(activeFarmId, [
        {
          table: "contrapartes",
          action: "DELETE",
          record: { id: deleteCandidate.id },
        },
      ]);

      if (editingId === deleteCandidate.id) {
        cancelEdit();
      }

      showSuccess(`Contraparte removida. TX: ${txId.slice(0, 8)}`);
      setDeleteCandidate(null);
    } catch {
      showError("Falha ao remover contraparte.");
    } finally {
      setDeletingId(null);
    }
  };

  function setFormField<K extends keyof ContraparteForm>(
    setter: typeof setForm | typeof setEditForm,
    field: K,
    value: ContraparteForm[K],
  ) {
    setter((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Financeiro"
        title="Parceiros e contrapartes"
        description="Cadastro limpo para compra, venda e sociedade, com exclusao protegida e edicao separada do fluxo principal."
        meta={
          <>
            <StatusBadge tone="neutral">{counts.total} cadastro(s)</StatusBadge>
            <StatusBadge tone="info">{counts.empresas} empresa(s)</StatusBadge>
            <StatusBadge tone="neutral">{counts.pessoas} pessoa(s)</StatusBadge>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Total"
          value={counts.total}
          hint="Base unica de parceiros disponiveis para eventos financeiros."
          icon={<Building2 className="h-5 w-5" />}
        />
        <MetricCard
          label="Pessoas"
          value={counts.pessoas}
          hint="Cadastros individuais para compra, venda ou sociedade."
          icon={<UserRound className="h-5 w-5" />}
        />
        <MetricCard
          label="Empresas"
          value={counts.empresas}
          hint="Parceiros juridicos e fornecedores recorrentes."
          tone="info"
          icon={<Building2 className="h-5 w-5" />}
        />
      </div>

      <FormSection
        title="Nova contraparte"
        description="Cadastre apenas os campos necessarios para a rotina. O restante pode ser complementado depois."
        actions={
          <StatusBadge tone={canManage ? "info" : "warning"}>
            {canManage ? "Edicao liberada" : "Somente leitura"}
          </StatusBadge>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={form.tipo}
              onValueChange={(value) =>
                setFormField(setForm, "tipo", value as ContraparteTipo)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pessoa">Pessoa</SelectItem>
                <SelectItem value="empresa">Empresa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={form.nome}
              onChange={(event) => setFormField(setForm, "nome", event.target.value)}
              placeholder="Nome da contraparte"
            />
          </div>

          <div className="space-y-2">
            <Label>Documento</Label>
            <Input
              value={form.documento}
              onChange={(event) =>
                setFormField(setForm, "documento", event.target.value)
              }
              placeholder="CPF/CNPJ"
            />
          </div>

          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={form.telefone}
              onChange={(event) =>
                setFormField(setForm, "telefone", event.target.value)
              }
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={form.email}
              onChange={(event) => setFormField(setForm, "email", event.target.value)}
              placeholder="contato@dominio.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Endereco</Label>
            <Input
              value={form.endereco}
              onChange={(event) =>
                setFormField(setForm, "endereco", event.target.value)
              }
              placeholder="Cidade/UF"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {!canManage ? (
            <p className="text-sm text-muted-foreground">
              Apenas owner/manager pode criar contrapartes.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Priorize nome, contato e documento para manter a operacao leve.
            </p>
          )}
          <Button onClick={handleCreate} disabled={!canManage || isSavingCreate}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {isSavingCreate ? "Salvando..." : "Salvar contraparte"}
          </Button>
        </div>
      </FormSection>

      {editingId ? (
        <FormSection
          title="Edicao em andamento"
          description="Revise os dados da contraparte selecionada e confirme para aplicar o ajuste."
          actions={<StatusBadge tone="warning">Edicao ativa</StatusBadge>}
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={editForm.tipo}
                onValueChange={(value) =>
                  setFormField(setEditForm, "tipo", value as ContraparteTipo)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pessoa">Pessoa</SelectItem>
                  <SelectItem value="empresa">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editForm.nome}
                onChange={(event) =>
                  setFormField(setEditForm, "nome", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Documento</Label>
              <Input
                value={editForm.documento}
                onChange={(event) =>
                  setFormField(setEditForm, "documento", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={editForm.telefone}
                onChange={(event) =>
                  setFormField(setEditForm, "telefone", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={editForm.email}
                onChange={(event) =>
                  setFormField(setEditForm, "email", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Endereco</Label>
              <Input
                value={editForm.endereco}
                onChange={(event) =>
                  setFormField(setEditForm, "endereco", event.target.value)
                }
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              onClick={() => handleUpdate(editingId)}
              disabled={updatingId === editingId || !canManage}
            >
              <Save className="mr-2 h-4 w-4" />
              {updatingId === editingId ? "Salvando..." : "Salvar alteracoes"}
            </Button>
            <Button variant="outline" onClick={cancelEdit} disabled={updatingId === editingId}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          </div>
        </FormSection>
      ) : null}

      <Toolbar>
        <ToolbarGroup className="flex-1 gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, documento, telefone ou email"
            />
          </div>
        </ToolbarGroup>
        <ToolbarGroup className="gap-2">
          <StatusBadge tone="info">{filtered.length} no recorte</StatusBadge>
        </ToolbarGroup>
      </Toolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhuma contraparte encontrada"
          description={
            search
              ? "Ajuste a busca para localizar parceiros ja cadastrados."
              : "Cadastre a primeira contraparte para destravar compra, venda e sociedade."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <Card key={item.id} className="shadow-none">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{item.nome}</p>
                    <StatusBadge tone="neutral">
                      {item.tipo === "empresa" ? "Empresa" : "Pessoa"}
                    </StatusBadge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[item.documento, item.telefone, item.email]
                      .filter(Boolean)
                      .join(" · ") || "Sem contato informado"}
                  </p>
                  {item.endereco ? (
                    <p className="text-sm text-muted-foreground">{item.endereco}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {item.tipo === "empresa" ? (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                  )}

                  {canManage ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" aria-label="Acoes da contraparte">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => startEdit(item)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => requestDelete(item.id, item.nome)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remover
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={!!deleteCandidate}
        onOpenChange={(open) => !open && setDeleteCandidate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover contraparte?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate
                ? `A contraparte "${deleteCandidate.nome}" sera removida da fazenda ativa.`
                : "A contraparte sera removida da fazenda ativa."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!!deletingId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? "Removendo..." : "Confirmar remocao"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
