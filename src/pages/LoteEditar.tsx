import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { showError, showSuccess } from "@/utils/toast";

const NULL_VALUE = "null";

const LoteEditar = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const lote = useLiveQuery(() => (id ? db.state_lotes.get(id) : undefined), [id]);
  const animaisNoLote = useLiveQuery(
    () => (id ? db.state_animais.where("lote_id").equals(id).count() : 0),
    [id],
  );
  const pastoAtual = useLiveQuery(
    () => (lote?.pasto_id ? db.state_pastos.get(lote.pasto_id) : null),
    [lote?.pasto_id],
  );
  const touroAtual = useLiveQuery(
    () => (lote?.touro_id ? db.state_animais.get(lote.touro_id) : null),
    [lote?.touro_id],
  );

  const [nome, setNome] = useState("");
  const [status, setStatus] = useState<"ativo" | "inativo">("ativo");
  const [pastoId, setPastoId] = useState<string>(NULL_VALUE);
  const [touroId, setTouroId] = useState<string>(NULL_VALUE);
  const [isLoaded, setIsLoaded] = useState(false);

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
              (animal) =>
                animal.sexo === "M" && (!animal.deleted_at || animal.deleted_at === null),
            )
            .toArray()
        : [],
    [lote?.fazenda_id],
  );

  useEffect(() => {
    if (lote && !isLoaded) {
      setNome(lote.nome ?? "");
      setStatus(lote.status ?? "ativo");
      setPastoId(lote.pasto_id ?? NULL_VALUE);
      setTouroId(lote.touro_id ?? NULL_VALUE);
      setIsLoaded(true);
    }
  }, [isLoaded, lote]);

  const handleSave = async () => {
    if (!lote || !id) {
      showError("Lote nao encontrado.");
      return;
    }

    if (!nome.trim()) {
      showError("Nome do lote e obrigatorio.");
      return;
    }

    const now = new Date().toISOString();
    const op = {
      table: "lotes",
      action: "UPDATE" as const,
      record: {
        id,
        nome: nome.trim(),
        status,
        pasto_id: pastoId === NULL_VALUE ? null : pastoId,
        touro_id: touroId === NULL_VALUE ? null : touroId,
        updated_at: now,
      },
    };

    try {
      await createGesture(lote.fazenda_id, [op]);
      showSuccess("Lote atualizado localmente!");
      navigate(`/lotes/${id}`);
    } catch {
      showError("Erro ao atualizar lote.");
    }
  };

  if (!lote || !isLoaded) {
    return (
      <div className="space-y-6 pb-16">
        <PageIntro
          eyebrow="Estrutura do rebanho"
          title="Editar lote"
          description="Carregando os dados operacionais do lote."
          actions={
            <Button variant="outline" onClick={() => navigate("/lotes")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <PageIntro
        eyebrow="Estrutura do rebanho"
        title={`Editar ${lote.nome}`}
        description="Ajuste nome, status e vinculos atuais sem alterar o fluxo operacional do lote."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(`/lotes/${id}`)}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Salvar alteracoes
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Animais no lote"
          value={animaisNoLote ?? 0}
          hint="Total atual usado na rotina de manejo."
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label="Pasto atual"
          value={pastoAtual?.nome ?? "Sem pasto"}
          hint="Vinculo visivel nas listagens e lotacao."
          icon={<Layers className="h-4 w-4" />}
        />
        <MetricCard
          label="Reprodutor"
          value={touroAtual?.identificacao ?? "Sem vinculo"}
          hint={status === "ativo" ? "Lote em operacao." : "Lote fora da rotina principal."}
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
          description="Esses campos controlam como o lote aparece para toda a fazenda."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nome">Nome do lote</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                placeholder="Ex: lote de recria, vacas em servico..."
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
          title="Vinculos operacionais"
          description="Pasto e reprodutor podem ser revistos aqui sem expor acoes extras na tela principal."
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

export default LoteEditar;
