import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type { OperationInput } from "@/lib/offline/types";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { EventValidationError } from "@/lib/events/validators";
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
import { Checkbox } from "@/components/ui/checkbox";
import { showSuccess, showError } from "@/utils/toast";
import { ChevronLeft, Save, Loader2 } from "lucide-react";

const AnimalEditar = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  // Carregar animal
  const animal = useLiveQuery(
    () => (id ? db.state_animais.get(id) : undefined),
    [id],
  );

  // Estados básicos
  const [identificacao, setIdentificacao] = useState("");
  const [sexo, setSexo] = useState<"M" | "F">("M");
  const [loteId, setLoteId] = useState<string>("null");

  // Estados de rastreabilidade
  const [dataNascimento, setDataNascimento] = useState("");
  const [dataEntrada, setDataEntrada] = useState("");

  // Estados de genealogia
  const [paiId, setPaiId] = useState<string>("null");
  const [maeId, setMaeId] = useState<string>("null");

  // Estados de identificação adicional
  const [nome, setNome] = useState("");
  const [rfid, setRfid] = useState("");

  // Estados da Fase 2: origem e raça
  const [origem, setOrigem] = useState<
    "nascimento" | "compra" | "doacao" | "arrendamento" | "sociedade" | "null"
  >("null");
  const [raca, setRaca] = useState("");

  // Estados específicos para machos
  const [papelMacho, setPapelMacho] = useState<
    "reprodutor" | "rufiao" | "null"
  >("null");
  const [habilitadoMonta, setHabilitadoMonta] = useState(false);

  const lotes = useLiveQuery(() => {
    if (!animal?.fazenda_id) return [];
    return db.state_lotes
      .where("fazenda_id")
      .equals(animal.fazenda_id)
      .filter((l) => !l.deleted_at)
      .toArray();
  }, [animal?.fazenda_id]);

  // Query para machos (potenciais pais) - excluir o próprio animal se for macho
  const machos = useLiveQuery(
    () => {
      if (!animal?.fazenda_id) return [];
      return db.state_animais
        .where("fazenda_id")
        .equals(animal.fazenda_id)
        .filter(
          (a) =>
            a.sexo === "M" &&
            (!a.deleted_at || a.deleted_at === null) &&
            a.id !== id,
        )
        .toArray();
    },
    [animal?.fazenda_id, id],
  );

  // Query para fêmeas (potenciais mães) - excluir o próprio animal se for fêmea
  const femeas = useLiveQuery(
    () => {
      if (!animal?.fazenda_id) return [];
      return db.state_animais
        .where("fazenda_id")
        .equals(animal.fazenda_id)
        .filter(
          (a) =>
            a.sexo === "F" &&
            (!a.deleted_at || a.deleted_at === null) &&
            a.id !== id,
        )
        .toArray();
    },
    [animal?.fazenda_id, id],
  );

  // Preencher formul ário quando animal carregar
  useEffect(() => {
    if (animal) {
      setIdentificacao(animal.identificacao ?? "");
      setSexo(animal.sexo);
      setLoteId(animal.lote_id ?? "null");
      setDataNascimento(animal.data_nascimento ?? "");
      setDataEntrada(animal.data_entrada ?? "");
      setPaiId(animal.pai_id ?? "null");
      setMaeId(animal.mae_id ?? "null");
      setNome(animal.nome ?? "");
      setRfid(animal.rfid ?? "");
      setOrigem((animal.origem as typeof origem) ?? "null");
      setRaca(animal.raca ?? "");
      setPapelMacho(
        (animal.papel_macho as "reprodutor" | "rufiao" | null) ?? "null",
      );
      setHabilitadoMonta(animal.habilitado_monta ?? false);
    }
  }, [animal]);

  const handleSave = async () => {
    if (!animal || !id) {
      showError("Animal não encontrado.");
      return;
    }

    if (!identificacao) {
      showError("Identificação é obrigatória.");
      return;
    }

    // Validação de datas
    const hoje = new Date();
    if (dataNascimento && new Date(dataNascimento) > hoje) {
      showError("Data de nascimento não pode ser no futuro.");
      return;
    }
    if (dataEntrada && new Date(dataEntrada) > hoje) {
      showError("Data de entrada não pode ser no futuro.");
      return;
    }

    const now = new Date().toISOString();

    const novoLoteId = loteId === "null" ? null : loteId;
    const loteAtualId = animal.lote_id ?? null;
    const loteChanged = novoLoteId !== loteAtualId;

    if (loteChanged && novoLoteId === null) {
      showError("Movimentacao exige lote de destino.");
      return;
    }

    setIsSaving(true);

    const animalUpdateRecord: Record<string, unknown> = {
      id: id,
      identificacao,
      sexo,
      status: animal.status, // CRÍTICO: Preservar status original

      // Campos de rastreabilidade
      data_nascimento: dataNascimento || null,
      data_entrada: dataEntrada || null,

      // Campos de genealogia
      pai_id: paiId === "null" || paiId === "externo" ? null : paiId,
      mae_id: maeId === "null" || maeId === "externo" ? null : maeId,

      // Campos de identificação adicional
      nome: nome || null,
      rfid: rfid || null,

      // Campos da Fase 2: origem e raça
      origem: origem === "null" ? null : origem,
      raca: raca || null,

      // Campos específicos para machos
      papel_macho: sexo === "M" && papelMacho !== "null" ? papelMacho : null,
      habilitado_monta: sexo === "M" ? habilitadoMonta : false,

      updated_at: now,
    };

    const ops: OperationInput[] = [];

    if (loteChanged) {
      const built = buildEventGesture({
        dominio: "movimentacao",
        fazendaId: animal.fazenda_id,
        occurredAt: now,
        animalId: id,
        loteId: loteAtualId,
        fromLoteId: loteAtualId,
        toLoteId: novoLoteId,
        applyAnimalStateUpdate: false,
        observacoes: "Movimentacao de lote via edicao de cadastro",
      });
      ops.push(...built.ops);
      animalUpdateRecord.lote_id = novoLoteId;
    }

    ops.push({
      table: "animais",
      action: "UPDATE",
      record: animalUpdateRecord,
    });

    try {
      await createGesture(animal.fazenda_id, ops);
      showSuccess("Animal atualizado localmente!");
      navigate(`/animais/${id}`);
    } catch (e: unknown) {
      setIsSaving(false);
      if (e instanceof EventValidationError) {
        showError(e.issues[0]?.message ?? "Dados invalidos para movimentacao.");
        return;
      }
      showError("Erro ao atualizar animal.");
    }
  };

  if (!animal) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/animais")}
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
          onClick={() => navigate(`/animais/${id}`)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Editar Animal</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados Básicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identificacao">Identificação *</Label>
            <Input
              id="identificacao"
              value={identificacao}
              onChange={(e) => setIdentificacao(e.target.value)}
              placeholder="Ex: 001, Brinco 123..."
            />
          </div>

          <div className="space-y-2">
            <Label>Sexo</Label>
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
                <SelectValue placeholder="Selecione um lote" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Nenhum</SelectItem>
                {lotes?.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rastreabilidade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dataNascimento">Data de Nascimento</Label>
              <Input
                id="dataNascimento"
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
              />
            </div>

            {/* Data de entrada apenas para origem externa (sociedade, doação, compra) */}
            {(origem === "sociedade" || origem === "doacao" || origem === "compra") && (
              <div className="space-y-2">
                <Label htmlFor="dataEntrada">Data de Entrada</Label>
                <Input
                  id="dataEntrada"
                  type="date"
                  value={dataEntrada}
                  onChange={(e) => setDataEntrada(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Origem</Label>
            <Select value={origem} onValueChange={(v: typeof origem) => setOrigem(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Como chegou à fazenda?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Não informado</SelectItem>
                <SelectItem value="nascimento">Nascimento</SelectItem>
                <SelectItem value="compra">Compra</SelectItem>
                <SelectItem value="doacao">Doação</SelectItem>
                <SelectItem value="arrendamento">Arrendamento</SelectItem>
                <SelectItem value="sociedade">Sociedade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Raça</Label>
            <Input
              value={raca}
              onChange={(e) => setRaca(e.target.value)}
              placeholder="Ex: Nelore, Angus, Mestiço..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Genealogia</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Pai (Opcional)</Label>
            <Select value={paiId} onValueChange={setPaiId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o pai" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Desconhecido</SelectItem>
                <SelectItem value="externo">Externo/IA</SelectItem>
                {machos?.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.identificacao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Mãe (Opcional)</Label>
            <Select value={maeId} onValueChange={setMaeId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a mãe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Desconhecido</SelectItem>
                <SelectItem value="externo">Externa</SelectItem>
                {femeas?.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.identificacao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações Adicionais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome popular do animal"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rfid">RFID</Label>
            <Input
              id="rfid"
              value={rfid}
              onChange={(e) => setRfid(e.target.value)}
              placeholder="Código RFID"
            />
          </div>
        </CardContent>
      </Card>

      {/* Card de Reprodutor: exibir somente para machos com data_nascimento E idade >= 15 meses */}
      {sexo === "M" &&
        dataNascimento &&
        (() => {
          // Calcular idade em meses
          const hoje = new Date();
          const nasc = new Date(dataNascimento);
          const diffDays = Math.floor(
            (hoje.getTime() - nasc.getTime()) / (1000 * 60 * 60 * 24),
          );
          const meses = Math.floor(diffDays / 30);
          return meses >= 15; // Idade mínima de 15 meses
        })() && (
          <Card>
            <CardHeader>
              <CardTitle>Informações de Reprodutor</CardTitle>
              {dataNascimento &&
                (() => {
                  const hoje = new Date();
                  const nasc = new Date(dataNascimento);
                  const diffDays = Math.floor(
                    (hoje.getTime() - nasc.getTime()) / (1000 * 60 * 60 * 24),
                  );
                  const meses = Math.floor(diffDays / 30);
                  return (
                    <p className="text-xs text-muted-foreground mt-1">
                      Idade mínima atingida ({meses} meses)
                    </p>
                  );
                })()}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Papel do Macho</Label>
                <Select
                  value={papelMacho}
                  onValueChange={(v: "reprodutor" | "rufiao" | "null") =>
                    setPapelMacho(v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Não definido</SelectItem>
                    <SelectItem value="reprodutor">Reprodutor</SelectItem>
                    <SelectItem value="rufiao">Rufião</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="habilitadoMonta"
                  checked={habilitadoMonta}
                  onCheckedChange={(checked) =>
                    setHabilitadoMonta(checked as boolean)
                  }
                />
                <Label htmlFor="habilitadoMonta" className="cursor-pointer">
                  Habilitado para Monta
                </Label>
              </div>
            </CardContent>
          </Card>
        )}

      <Button onClick={handleSave} className="w-full" disabled={isSaving}>
        {isSaving ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        {isSaving ? "Salvando..." : "Salvar Alterações"}
      </Button>
    </div>
  );
};

export default AnimalEditar;
