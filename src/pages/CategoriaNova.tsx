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
import { showSuccess, showError } from "@/utils/toast";
import { ChevronLeft, Save } from "lucide-react";
import { SexoEnum } from "@/lib/offline/types";
import { getActiveFarmId } from "@/lib/storage";

const CategoriaNova = () => {
  const navigate = useNavigate();
  const activeFazendaId = getActiveFarmId();

  const [nome, setNome] = useState("");
  const [sexo, setSexo] = useState<SexoEnum | "ambos">("ambos");
  const [idadeMin, setIdadeMin] = useState("");
  const [idadeMax, setIdadeMax] = useState("");

  const handleSave = async () => {
    if (!activeFazendaId) {
      showError("Fazenda não identificada.");
      return;
    }

    if (!nome.trim()) {
      showError("Nome da categoria é obrigatório.");
      return;
    }

    const cat_id = crypto.randomUUID();
    const now = new Date().toISOString();

    const op = {
      table: "categorias_zootecnicas",
      action: "INSERT" as const,
      record: {
        id: cat_id,
        fazenda_id: activeFazendaId,
        nome: nome.trim(),
        sexo: sexo === "ambos" ? null : sexo,
        aplica_ambos: sexo === "ambos",
        idade_min_dias: idadeMin ? parseInt(idadeMin) : null,
        idade_max_dias: idadeMax ? parseInt(idadeMax) : null,
        ativa: true,
        payload: {},
        created_at: now,
        updated_at: now,
      },
    };

    try {
      await createGesture(activeFazendaId, [op]);
      showSuccess("Categoria criada com sucesso!");
      navigate("/categorias");
    } catch (e) {
      console.error(e);
      showError("Erro ao criar categoria.");
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/categorias")}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Nova Categoria</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Definição da Categoria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Bezerro, Novilha..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sexo">Sexo Aplicável</Label>
            <Select
              value={sexo}
              onValueChange={(v: SexoEnum | "ambos") => setSexo(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ambos">Ambos (Macho e Fêmea)</SelectItem>
                <SelectItem value="M">Apenas Machos</SelectItem>
                <SelectItem value="F">Apenas Fêmeas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min">Idade Mínima (dias)</Label>
              <Input
                id="min"
                type="number"
                value={idadeMin}
                onChange={(e) => setIdadeMin(e.target.value)}
                placeholder="Ex: 0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max">Idade Máxima (dias)</Label>
              <Input
                id="max"
                type="number"
                value={idadeMax}
                onChange={(e) => setIdadeMax(e.target.value)}
                placeholder="Ex: 365"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Deixe Idade Máxima em branco para "sem limite".
          </p>
        </CardContent>
      </Card>

      <Button onClick={handleSave} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        Salvar Categoria
      </Button>
    </div>
  );
};

export default CategoriaNova;
