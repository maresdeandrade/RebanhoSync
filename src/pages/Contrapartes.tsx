import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Building2,
  Pencil,
  PlusCircle,
  Save,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { useAuth } from "@/hooks/useAuth";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const Contrapartes = () => {
  const { activeFarmId, role } = useAuth();
  const canManage = role === "owner" || role === "manager";

  const [search, setSearch] = useState("");
  const [isSavingCreate, setIsSavingCreate] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
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
            payload: {
              origem: "cadastro_manual_contraparte",
            },
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

  const handleDelete = async (id: string, nome: string) => {
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
            item.contraparte_id === id && (item.deleted_at === null || !item.deleted_at),
        )
        .count(),
      db.state_animais_sociedade
        .where("fazenda_id")
        .equals(activeFarmId)
        .and(
          (item) =>
            item.contraparte_id === id && (item.deleted_at === null || !item.deleted_at),
        )
        .count(),
    ]);

    if (financeiroCount > 0 || sociedadeCount > 0) {
      showError(
        "Nao e possivel remover: contraparte vinculada a eventos financeiros ou sociedades.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Remover contraparte "${nome}"? Esta acao pode impactar registros financeiros futuros.`,
    );
    if (!confirmed) return;

    setDeletingId(id);
    try {
      const txId = await createGesture(activeFarmId, [
        {
          table: "contrapartes",
          action: "DELETE",
          record: { id },
        },
      ]);

      if (editingId === id) {
        cancelEdit();
      }
      showSuccess(`Contraparte removida. TX: ${txId.slice(0, 8)}`);
    } catch {
      showError("Falha ao remover contraparte.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Parceiros</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro de parceiros para eventos de compra, venda e sociedade.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo Cadastro</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={form.tipo}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, tipo: value as ContraparteTipo }))
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
              onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
              placeholder="Nome da contraparte"
            />
          </div>

          <div className="space-y-2">
            <Label>Documento</Label>
            <Input
              value={form.documento}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, documento: e.target.value }))
              }
              placeholder="CPF/CNPJ"
            />
          </div>

          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={form.telefone}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, telefone: e.target.value }))
              }
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="contato@dominio.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Endereco</Label>
            <Input
              value={form.endereco}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, endereco: e.target.value }))
              }
              placeholder="Cidade/UF"
            />
          </div>

          <div className="md:col-span-2">
            {!canManage && (
              <p className="mb-2 text-xs text-muted-foreground">
                Apenas owner/manager pode criar contrapartes.
              </p>
            )}
            <Button
              onClick={handleCreate}
              disabled={!canManage || isSavingCreate}
              className="w-full md:w-auto"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              {isSavingCreate ? "Salvando..." : "Salvar contraparte"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Lista de Parceiros</CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, documento, telefone..."
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma contraparte cadastrada.</p>
          ) : (
            filtered.map((item) => (
              <div key={item.id} className="rounded-md border p-3">
                {editingId === item.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select
                          value={editForm.tipo}
                          onValueChange={(value) =>
                            setEditForm((prev) => ({
                              ...prev,
                              tipo: value as ContraparteTipo,
                            }))
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
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, nome: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Documento</Label>
                        <Input
                          value={editForm.documento}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, documento: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input
                          value={editForm.telefone}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, telefone: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input
                          value={editForm.email}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, email: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Endereco</Label>
                        <Input
                          value={editForm.endereco}
                          onChange={(e) =>
                            setEditForm((prev) => ({ ...prev, endereco: e.target.value }))
                          }
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleUpdate(item.id)}
                        disabled={updatingId === item.id || !canManage}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {updatingId === item.id ? "Salvando..." : "Salvar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEdit}
                        disabled={updatingId === item.id}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{item.nome}</span>
                        <Badge variant="outline">
                          {item.tipo === "empresa" ? "Empresa" : "Pessoa"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {[item.documento, item.telefone, item.email]
                          .filter(Boolean)
                          .join(" - ") || "Sem contato informado"}
                      </p>
                      {item.endereco && (
                        <p className="text-xs text-muted-foreground">{item.endereco}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {item.tipo === "empresa" ? (
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <UserRound className="h-4 w-4 text-muted-foreground" />
                      )}

                      {canManage && (
                        <>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => startEdit(item)}
                            title="Editar contraparte"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => handleDelete(item.id, item.nome)}
                            disabled={deletingId === item.id}
                            title="Remover contraparte"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Contrapartes;
