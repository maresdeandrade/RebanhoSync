import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type {
  DestinoProdutivoAnimalEnum,
  OperationInput,
  StatusReprodutivoMachoEnum,
} from "@/lib/offline/types";
import { ANIMAL_BREED_OPTIONS, parseAnimalBreed } from "@/lib/animals/catalogs";
import {
  buildAnimalClassificationPayload,
  getAnimalProductiveDestination,
  getLegacyMaleFields,
  getMaleReproductiveStatus,
  isMaleBreedingDestination,
} from "@/lib/animals/maleProfile";
import {
  buildAnimalLifecyclePayload,
  resolveAnimalLifecycleSnapshot,
} from "@/lib/animals/lifecycle";
import {
  buildAnimalTaxonomyFactsPayload,
  getAnimalTaxonomyFacts,
} from "@/lib/animals/taxonomy";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { EventValidationError } from "@/lib/events/validators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { showSuccess, showError } from "@/utils/toast";
import { ChevronLeft, Save, Loader2, Trash2 } from "lucide-react";
import { useLotes } from "@/hooks/useLotes";
import { useAuth } from "@/hooks/useAuth";

const AnimalEditar = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { farmLifecycleConfig, role } = useAuth();
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
  const [raca, setRaca] = useState("null");

  // Estados específicos para machos
  const [destinoProdutivo, setDestinoProdutivo] = useState<
    DestinoProdutivoAnimalEnum | "null"
  >("null");
  const [statusReprodutivoMacho, setStatusReprodutivoMacho] = useState<
    StatusReprodutivoMachoEnum | "null"
  >("null");
  const [castrado, setCastrado] = useState<"null" | "true" | "false">("null");
  const [puberdadeConfirmada, setPuberdadeConfirmada] = useState<
    "null" | "true" | "false"
  >("null");
  const [emLactacao, setEmLactacao] = useState<"null" | "true" | "false">(
    "null",
  );
  const [secagemRealizada, setSecagemRealizada] = useState<
    "null" | "true" | "false"
  >("null");
  const lotes = useLotes(animal?.fazenda_id);

  const temCriaRecente = useLiveQuery(async () => {
    if (!animal?.id) return false;
    const crias = await db.state_animais
      .where("mae_id")
      .equals(animal.id)
      .filter((a) => !a.deleted_at)
      .toArray();
      
    const umAnoAtras = Date.now() - 365 * 24 * 60 * 60 * 1000;
    return crias.some((c) => {
      if (!c.data_nascimento) return true; // se nao tem data, por precaucao consideramos vinculo valido
      return new Date(c.data_nascimento).getTime() > umAnoAtras;
    });
  }, [animal?.id]) ?? false;

  const dataUltimoParto = animal?.payload?.data_ultimo_parto;
  let tevePartoRecente = false;
  if (dataUltimoParto) {
    const umAnoAtras = Date.now() - 365 * 24 * 60 * 60 * 1000;
    tevePartoRecente = new Date(dataUltimoParto).getTime() > umAnoAtras;
  }
  
  const isLactationEligible = (tevePartoRecente || temCriaRecente || animal?.payload?.em_lactacao === true);


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
      setRaca(parseAnimalBreed(animal.raca) ?? (animal.raca ? "outra" : "null"));
      setDestinoProdutivo(getAnimalProductiveDestination(animal) ?? "null");
      setStatusReprodutivoMacho(getMaleReproductiveStatus(animal) ?? "null");
      const taxonomyFacts = getAnimalTaxonomyFacts(animal.payload);
      setCastrado(
        taxonomyFacts.castrado === null
          ? "null"
          : taxonomyFacts.castrado
            ? "true"
            : "false",
      );
      setPuberdadeConfirmada(
        taxonomyFacts.puberdade_confirmada === null
          ? "null"
          : taxonomyFacts.puberdade_confirmada
            ? "true"
            : "false",
      );
      setEmLactacao(
        taxonomyFacts.em_lactacao === null
          ? "null"
          : taxonomyFacts.em_lactacao
            ? "true"
            : "false",
      );
      setSecagemRealizada(
        taxonomyFacts.secagem_realizada === null
          ? "null"
          : taxonomyFacts.secagem_realizada
            ? "true"
            : "false",
      );
    }
  }, [animal]);

  const handleDestinoProdutivoChange = (
    value: DestinoProdutivoAnimalEnum | "null",
  ) => {
    setDestinoProdutivo(value);

    if (value === "null") {
      setStatusReprodutivoMacho("null");
      return;
    }

    if (isMaleBreedingDestination(value)) {
      setStatusReprodutivoMacho((current) =>
        current === "null" || current === "inativo" ? "candidato" : current,
      );
      return;
    }

    setStatusReprodutivoMacho("inativo");
  };

  const handleSecagemRealizadaChange = (value: "null" | "true" | "false") => {
    setSecagemRealizada(value);
    if (value === "true") {
      setEmLactacao("false");
    }
  };

  const idadeMeses = dataNascimento
    ? Math.floor(
        (Date.now() - new Date(dataNascimento).getTime()) /
          (1000 * 60 * 60 * 24 * 30),
      )
    : null;
  const maleBreedingSelected =
    destinoProdutivo !== "null" && isMaleBreedingDestination(destinoProdutivo);

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

    if (
      sexo === "M" &&
      castrado === "true" &&
      destinoProdutivo !== "null" &&
      isMaleBreedingDestination(destinoProdutivo)
    ) {
      showError("Macho castrado nao pode ficar com destino reprodutivo.");
      return;
    }

    const now = new Date().toISOString();

    // Lote alterado removido (read-only na UI)
    const novoLoteId = animal.lote_id ?? null;

    setIsSaving(true);

    const destinoProdutivoValue =
      sexo === "M" && destinoProdutivo !== "null" ? destinoProdutivo : null;
    const statusReprodutivoValue =
      sexo === "M" && statusReprodutivoMacho !== "null"
        ? statusReprodutivoMacho
        : null;
    let payload = buildAnimalClassificationPayload(animal.payload, {
      sexo,
      destinoProdutivo: destinoProdutivoValue,
      statusReprodutivoMacho: statusReprodutivoValue,
      modoTransicao: null,
    });
    const { papel_macho, habilitado_monta } = getLegacyMaleFields({
      sexo,
      destinoProdutivo: destinoProdutivoValue,
      statusReprodutivoMacho: statusReprodutivoValue,
    });
    payload = buildAnimalTaxonomyFactsPayload(payload, {
      castrado: sexo === "M" && castrado !== "null" ? castrado === "true" : null,
      puberdade_confirmada:
        puberdadeConfirmada !== "null"
          ? puberdadeConfirmada === "true"
          : null,
      em_lactacao:
        sexo === "F" && emLactacao !== "null" ? emLactacao === "true" : null,
      secagem_realizada:
        sexo === "F" && secagemRealizada !== "null"
          ? secagemRealizada === "true"
          : null,
    });
    const lifecycleSnapshot = resolveAnimalLifecycleSnapshot(
      {
        sexo,
        data_nascimento: dataNascimento || null,
        payload,
        papel_macho,
        habilitado_monta,
      },
      farmLifecycleConfig,
    );
    if (lifecycleSnapshot.currentStageSource === "inferred") {
      payload = buildAnimalLifecyclePayload(
        payload,
        lifecycleSnapshot.targetStage,
        "manual",
      );
    }

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
      raca: raca === "null" ? null : raca,

      // Campos específicos para machos
      papel_macho,
      habilitado_monta,
      payload,

      updated_at: now,
    };

    const ops: OperationInput[] = [];

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

  const handleDelete = async () => {
    if (!animal || !id) return;

    if (!window.confirm("ATENÇÃO: Você está prestes a excluir este animal de todos os registros da Gestão Agro. Esta ação o removerá dos relatórios passados e cancelará sua vida ativa na fazenda. Deseja mesmo excluir este animal?")) {
      return;
    }

    setIsSaving(true);
    try {
      await createGesture(animal.fazenda_id, [{
        table: "animais",
        action: "DELETE",
        record: { id: animal.id }
      }]);
      await db.state_animais.delete(animal.id);
      showSuccess("Animal excluído com sucesso.");
      navigate("/animais");
    } catch (e: unknown) {
      setIsSaving(false);
      showError("Erro ao excluir animal.");
      console.error(e);
    }
  };

  if (!animal) {
    return (
      <div className="space-y-6 pb-16">
        <PageIntro
          eyebrow="Cadastro animal"
          title="Editar animal"
          description="Carregando os dados do cadastro selecionado."
          actions={
            <Button variant="outline" onClick={() => navigate("/animais")}>
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
        eyebrow="Cadastro animal"
        title="Editar animal"
        description="Os blocos principais continuam os mesmos, agora com uma leitura mais previsivel para revisar o cadastro."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(`/animais/${id}`)}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSaving ? "Salvando..." : "Salvar alteracoes"}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Sexo"
          value={sexo === "M" ? "Macho" : "Femea"}
          hint={idadeMeses !== null ? `${idadeMeses} mes(es) estimados.` : "Sem idade calculada."}
        />
        <MetricCard
          label="Origem"
          value={origem === "null" ? "Nao informada" : origem}
          hint="Contexto atual do animal dentro do cadastro."
        />
        <MetricCard
          label="Lote atual"
          value={
            loteId === "null"
              ? "Sem lote"
              : lotes?.find((loteAtual) => loteAtual.id === loteId)?.nome ?? "Selecionado"
          }
          hint="Pode ser alterado sem expor acoes destrutivas."
        />
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
            <Label>Lote</Label>
            <Input 
              value={lotes?.find((l) => l.id === loteId)?.nome ?? "Sem lote"} 
              disabled 
            />
            <p className="text-xs text-muted-foreground mt-1">Para alterar o lote, utilize o recurso de Movimentação do Animal.</p>
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
            <Select value={raca} onValueChange={setRaca}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a raca" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Nao informada</SelectItem>
                {ANIMAL_BREED_OPTIONS.map((breed) => (
                  <SelectItem key={breed.value} value={breed.value}>
                    {breed.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fatos Taxonômicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(idadeMeses === null || (idadeMeses >= 7 && idadeMeses <= 12)) && (
          <div className="space-y-2">
            <Label>Puberdade confirmada</Label>
            <Select
              value={puberdadeConfirmada}
              onValueChange={(value: "null" | "true" | "false") =>
                setPuberdadeConfirmada(value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Nao informado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Nao informado</SelectItem>
                <SelectItem value="true">Sim</SelectItem>
                <SelectItem value="false">Nao</SelectItem>
              </SelectContent>
            </Select>
          </div>
          )}

          {sexo === "M" && (
            <div className="space-y-2">
              <Label>Castrado</Label>
              <Select
                value={castrado}
                onValueChange={(value: "null" | "true" | "false") =>
                  setCastrado(value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nao informado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Nao informado</SelectItem>
                  <SelectItem value="true">Sim</SelectItem>
                  <SelectItem value="false">Nao</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {sexo === "F" && isLactationEligible && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Em lactação</Label>
                <Select
                  value={emLactacao}
                  onValueChange={(value: "null" | "true" | "false") =>
                    setEmLactacao(value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nao informado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Nao informado</SelectItem>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Nao</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Secagem realizada</Label>
                <Select
                  value={secagemRealizada}
                  onValueChange={handleSecagemRealizadaChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nao informado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Nao informado</SelectItem>
                    <SelectItem value="true">Sim</SelectItem>
                    <SelectItem value="false">Nao</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
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

      {sexo === "M" && (
        <Card>
          <CardHeader>
            <CardTitle>Perfil do Macho</CardTitle>
            <p className="text-xs text-muted-foreground">
              Ajuste o destino do animal e a liberacao reprodutiva. O modo de
              transicao agora vem das configuracoes gerais da fazenda.
              {idadeMeses !== null ? ` Idade atual: ${idadeMeses} meses.` : ""}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Destino Produtivo</Label>
              <Select
                value={destinoProdutivo}
                onValueChange={(value: DestinoProdutivoAnimalEnum | "null") =>
                  handleDestinoProdutivoChange(value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Como este macho sera conduzido?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Nao definido</SelectItem>
                  <SelectItem value="reprodutor">Reprodutor</SelectItem>
                  <SelectItem value="rufiao">Rufiao</SelectItem>
                  <SelectItem value="engorda">Engorda</SelectItem>
                  <SelectItem value="abate">Abate</SelectItem>
                  <SelectItem value="venda">Venda</SelectItem>
                  <SelectItem value="descarte">Descarte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status Reprodutivo</Label>
              <Select
                value={statusReprodutivoMacho}
                onValueChange={(
                  value: StatusReprodutivoMachoEnum | "null",
                ) => setStatusReprodutivoMacho(value)}
                disabled={!maleBreedingSelected}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      destinoProdutivo === "null"
                        ? "Defina primeiro o destino"
                        : "Selecione o status"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Nao definido</SelectItem>
                  <SelectItem value="candidato">Candidato</SelectItem>
                  <SelectItem value="apto">Apto</SelectItem>
                  <SelectItem value="suspenso">Suspenso</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
              {!maleBreedingSelected && destinoProdutivo !== "null" && (
                  <p className="text-xs text-muted-foreground">
                    Destinos nao reprodutivos mantem o manejo reprodutivo como
                    inativo.
                  </p>
                )}
            </div>
          </CardContent>
        </Card>
      )}

      {role === "owner" && (
        <Card className="border-destructive/50 shadow-sm mb-6">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center">
              <Trash2 className="h-5 w-5 mr-2" />
              Zona de Perigo
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              A exclusão remove este animal dos relatórios, contadores do painel e registros visuais. Para preservar a consistência causal, esta ação aplica um silenciamento permanente (soft-delete).
            </p>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Excluir animal permanentemente
            </Button>
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
