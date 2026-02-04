import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { showSuccess, showError } from "@/utils/toast";
import { ChevronLeft, Save } from "lucide-react";

const AnimalNovo = () => {
  const navigate = useNavigate();
  const [identificacao, setIdentificacao] = useState("");
  const [sexo, setSexo] = useState<"M" | "F">("M");
  const [loteId, setLoteId] = useState<string>("null");

  const lotes = useLiveQuery(() => db.state_lotes.toArray());

  const handleSave = async () => {
    if (!identificacao) {
      showError("Identificação é obrigatória.");
      return;
    }

    const fazenda_id = lotes?.[0]?.fazenda_id || "farm-123"; // Mock fallback
    const animal_id = crypto.randomUUID();
    const now = new Date().toISOString();

    const op = {
      table: 'animais',
      action: 'INSERT' as const,
      record: {
        id: animal_id,
        fazenda_id,
        identificacao,
        sexo,
        status: 'ativo',
        lote_id: loteId === "null" ? null : loteId,
        created_at: now,
        updated_at: now
      }
    };

    try {
      await createGesture(fazenda_id, [op]);
      showSuccess("Animal cadastrado localmente!");
      navigate("/animais");
    } catch (e) {
      showError("Erro ao cadastrar animal.");
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/animais")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Novo Animal</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados Básicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identificacao">Identificação (Brinco/Nome) *</Label>
            <Input 
              id="identificacao" 
              value={identificacao} 
              onChange={(e) => setIdentificacao(e.target.value)} 
              placeholder="Ex: BR-001"
            />
          </div>

          <div className="space-y-2">
            <Label>Sexo *</Label>
            <Select value={sexo} onValueChange={(v: "M" | "F") => setSexo(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="M">Macho</SelectItem>
                <SelectItem value="F">Fêmea</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Lote (Opcional)</Label>
            <Select value={loteId} onValueChange={setLoteId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Sem lote</SelectItem>
                {lotes?.map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" /> Salvar Animal
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnimalNovo;