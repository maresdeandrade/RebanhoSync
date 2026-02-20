import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { showSuccess, showError } from "@/utils/toast";
import { ChevronLeft, Save } from "lucide-react";

const LoteEditar = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Carregar lote
  const lote = useLiveQuery(
    () => (id ? db.state_lotes.get(id) : undefined),
    [id],
  );

  const [nome, setNome] = useState("");
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo");
  const [pastoId, setPastoId] = useState<string>("null");
  const [touroId, setTouroId] = useState<string>("null");
  const [isLoaded, setIsLoaded] = useState(false); // ✅ Flag para garantir carregamento

  const pastos = useLiveQuery(
    () =>
      lote?.fazenda_id
        ? db.state_pastos.where("fazenda_id").equals(lote.fazenda_id).toArray()
        : [],
    [lote?.fazenda_id],
  );
  const touros = useLiveQuery(
    () =>
      lote?.fazenda_id
        ? db.state_animais
            .where("fazenda_id")
            .equals(lote.fazenda_id)
            .filter(
              (a) => a.sexo === "M" && (!a.deleted_at || a.deleted_at === null),
            )
            .toArray()
        : [],
    [lote?.fazenda_id],
  );

  // Preencher formulário quando lote carregar
  useEffect(() => {
    if (lote && !isLoaded) {
      setNome(lote.nome ?? "");
      setStatus(lote.status ?? "ativo");
      setPastoId(lote.pasto_id ?? "null");
      setTouroId(lote.touro_id ?? "null");
      setIsLoaded(true); // ✅ Marca como carregado
    }
  }, [lote, isLoaded]);

  const handleSave = async () => {
    if (!lote || !id) {
      showError("Lote não encontrado.");
      return;
    }

    if (!nome.trim()) {
      showError("Nome do lote é obrigatório.");
      return;
    }

    const now = new Date().toISOString();

    const op = {
      table: "lotes",
      action: "UPDATE" as const,
      record: {
        id: id,
        nome: nome.trim(),
        status,
        pasto_id: pastoId === "null" ? null : pastoId,
        touro_id: touroId === "null" ? null : touroId,
        updated_at: now,
      },
    };

    try {
      await createGesture(lote.fazenda_id, [op]);
      showSuccess("Lote atualizado localmente!");
      navigate(`/lotes/${id}`);
    } catch (e) {
      showError("Erro ao atualizar lote.");
    }
  };

  if (!lote || !isLoaded) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/lotes")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Carregando...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/lotes/${id}`)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Editar Lote</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Lote</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Lote *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Lote A, Desmame 2024..."
            />
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v: "ativo" | "inativo") => setStatus(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Pasto (Opcional)</Label>
            <Select value={pastoId} onValueChange={setPastoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o pasto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Nenhum</SelectItem>
                {pastos?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Touro (Opcional)</Label>
            <Select value={touroId} onValueChange={setTouroId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o touro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Nenhum</SelectItem>
                {touros?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.identificacao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        Salvar Alterações
      </Button>
    </div>
  );
};

export default LoteEditar;
