import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { showError, showSuccess } from "@/utils/toast";
import { ChevronLeft, Save } from "lucide-react";
import { getActiveFarmId } from "@/lib/storage";

const LoteNovo = () => {
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo");
  const [pastoId, setPastoId] = useState<string>("null");
  const [touroId, setTouroId] = useState<string>("null");

  const activeFarmId = getActiveFarmId();

  const pastos = useLiveQuery(() => 
    (activeFarmId ? db.state_pastos.where('fazenda_id').equals(activeFarmId).toArray() : [])
  );
  const touros = useLiveQuery(() =>
    (activeFarmId
      ? db.state_animais
          .filter((a) => 
            a.sexo === 'M' && 
            a.fazenda_id === activeFarmId &&
            (!a.deleted_at || a.deleted_at === null)
          )
          .toArray()
      : [])
  );

  const handleSave = async () => {
    const fazenda_id = activeFarmId || "";

    if (!fazenda_id) {
      showError("Fazenda não identificada.");
      return;
    }

    if (!nome.trim()) {
      showError("Nome do lote é obrigatório.");
      return;
    }

    const lote_id = crypto.randomUUID();
    const now = new Date().toISOString();

    const op = {
      client_op_id: crypto.randomUUID(),
      client_tx_id: crypto.randomUUID(),
      table: "lotes",
      action: "INSERT" as const,
      record: {
        id: lote_id,
        fazenda_id: fazenda_id,
        nome: nome.trim(),
        status,
        pasto_id: pastoId === "null" ? null : pastoId,
        touro_id: touroId === "null" ? null : touroId,
        created_at: now,
        updated_at: now,
      },
    };

    try {
      await createGesture(fazenda_id, [op]);
      showSuccess("Lote cadastrado localmente!");
      navigate("/lotes");
    } catch (e) {
      showError("Erro ao cadastrar lote.");
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/lotes")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Novo Lote</h1>
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
        Salvar Lote
      </Button>
    </div>
  );
};

export default LoteNovo;
