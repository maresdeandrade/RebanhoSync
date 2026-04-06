import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, Layers, Save, Users } from "lucide-react";

import { FormSection } from "@/components/ui/form-section";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
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
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { getActiveFarmId } from "@/lib/storage";
import { showError, showSuccess } from "@/utils/toast";

const NULL_VALUE = "null";

const LoteNovo = () => {
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo");
  const [pastoId, setPastoId] = useState<string>(NULL_VALUE);
  const [touroId, setTouroId] = useState<string>(NULL_VALUE);

  const activeFarmId = getActiveFarmId();

  const pastos = useLiveQuery(
    () =>
      activeFarmId
        ? db.state_pastos.where("fazenda_id").equals(activeFarmId).toArray()
        : [],
    [activeFarmId],
  );
  const touros = useLiveQuery(
    () =>
      activeFarmId
        ? db.state_animais
            .filter(
              (animal) =>
                animal.sexo === "M" &&
                animal.fazenda_id === activeFarmId &&
                (!animal.deleted_at || animal.deleted_at === null),
            )
            .toArray()
        : [],
    [activeFarmId],
  );

  const handleSave = async () => {
    const fazendaId = activeFarmId || "";

    if (!fazendaId) {
      showError("Fazenda nao identificada.");
      return;
    }

    if (!nome.trim()) {
      showError("Nome do lote e obrigatorio.");
      return;
    }

    const loteId = crypto.randomUUID();
    const now = new Date().toISOString();

    const op = {
      client_op_id: crypto.randomUUID(),
      client_tx_id: crypto.randomUUID(),
      table: "lotes",
      action: "INSERT" as const,
      record: {
        id: loteId,
        fazenda_id: fazendaId,
        nome: nome.trim(),
        status,
        pasto_id: pastoId === NULL_VALUE ? null : pastoId,
        touro_id: touroId === NULL_VALUE ? null : touroId,
        created_at: now,
        updated_at: now,
      },
    };

    try {
      await createGesture(fazendaId, [op]);
      showSuccess("Lote cadastrado localmente!");
      navigate("/lotes");
    } catch {
      showError("Erro ao cadastrar lote.");
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <PageIntro
        eyebrow="Estrutura do rebanho"
        title="Novo lote"
        description="Crie o agrupamento operacional e defina apenas o basico para iniciar o manejo. Pasto e reprodutor seguem como contexto opcional."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/lotes")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Salvar lote
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Pastos ativos"
          value={pastos?.length ?? 0}
          hint="Locais disponiveis para alocacao inicial."
          icon={<Layers className="h-4 w-4" />}
        />
        <MetricCard
          label="Machos disponiveis"
          value={touros?.length ?? 0}
          hint="Reprodutores que podem ser vinculados ao lote."
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label="Status inicial"
          value={status === "ativo" ? "Ativo" : "Inativo"}
          hint="Pode ser ajustado depois sem alterar o historico do lote."
          tone={status === "ativo" ? "success" : "default"}
        />
      </div>

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
      >
        <FormSection
          title="Identidade do lote"
          description="Defina o nome e a situacao operacional usada nas listagens e rotinas diarias."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nome">Nome do lote</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                placeholder="Ex: lote A, desmame 2024, matriz norte..."
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value: "ativo" | "inativo") => setStatus(value)}
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
          </div>
        </FormSection>

        <FormSection
          title="Contexto inicial"
          description="Esses vinculos sao opcionais e servem para deixar a operacao pronta logo no cadastro."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Pasto</Label>
              <Select value={pastoId} onValueChange={setPastoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o pasto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NULL_VALUE}>Nenhum</SelectItem>
                  {pastos?.map((pasto) => (
                    <SelectItem key={pasto.id} value={pasto.id}>
                      {pasto.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reprodutor vinculado</Label>
              <Select value={touroId} onValueChange={setTouroId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o touro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NULL_VALUE}>Nenhum</SelectItem>
                  {touros?.map((touro) => (
                    <SelectItem key={touro.id} value={touro.id}>
                      {touro.identificacao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </FormSection>
      </form>
    </div>
  );
};

export default LoteNovo;
