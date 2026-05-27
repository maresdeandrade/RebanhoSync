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
  ANIMAL_SPECIES_OPTIONS,
  formatAnimalSpecies,
} from "@/lib/animals/species";
import type { AnimalSpeciesEnum } from "@/lib/animals/species";
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
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { FieldCombobox } from "@/components/ui/field-combobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showSuccess, showError } from "@/utils/toast";
import { ChevronLeft, Save, Loader2, Trash2, ScanLine } from "lucide-react";
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
  const [especie, setEspecie] = useState<AnimalSpeciesEnum | "null">("null");

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

  const temCriaRecente =
    useLiveQuery(async () => {
      if (!animal?.id || !animal.fazenda_id) return false;
      const crias = await db.state_animais
        .where("fazenda_id")
        .equals(animal.fazenda_id)
        .filter((a) => a.mae_id === animal.id && !a.deleted_at)
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

  const isLactationEligible =
    tevePartoRecente || temCriaRecente || animal?.payload?.em_lactacao === true;

  // Query para machos (potenciais pais) - excluir o próprio animal se for macho
  const machos = useLiveQuery(() => {
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
  }, [animal?.fazenda_id, id]);

  // Query para fêmeas (potenciais mães) - excluir o próprio animal se for fêmea
  const femeas = useLiveQuery(() => {
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
  }, [animal?.fazenda_id, id]);

  // Preencher formulário quando animal carregar
  useEffect(() => {
    if (animal) {
      setIdentificacao(animal.identificacao ?? "");
      setSexo(animal.sexo);
      setLoteId(animal.lote_id ?? "null");
      setEspecie(animal.especie ?? "null");
      setDataNascimento(animal.data_nascimento ?? "");
      setDataEntrada(animal.data_entrada ?? "");
      setPaiId(animal.pai_id ?? "null");
      setMaeId(animal.mae_id ?? "null");
      setNome(animal.nome ?? "");
      setRfid(animal.rfid ?? "");
      setOrigem((animal.origem as typeof origem) ?? "null");
      setRaca(
        parseAnimalBreed(animal.raca) ?? (animal.raca ? "outra" : "null"),
      );
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

  // Combobox Options Mapping
  const especieOptions = [
    { value: "null", label: "Nao informada" },
    ...ANIMAL_SPECIES_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))
  ];

  const origemOptions = [
    { value: "null", label: "Não informado" },
    { value: "nascimento", label: "Nascimento" },
    { value: "compra", label: "Compra" },
    { value: "doacao", label: "Doação" },
    { value: "arrendamento", label: "Arrendamento" },
    { value: "sociedade", label: "Sociedade" }
  ];

  const racaOptions = [
    { value: "null", label: "Nao informada" },
    ...ANIMAL_BREED_OPTIONS.map((breed) => ({ value: breed.value, label: breed.label }))
  ];

  const paiOptions = [
    { value: "null", label: "Desconhecido" },
    { value: "externo", label: "Externo/IA" },
    ...(machos?.map((m) => ({ value: m.id, label: m.identificacao })) ?? [])
  ];

  const maeOptions = [
    { value: "null", label: "Desconhecido" },
    { value: "externo", label: "Externa" },
    ...(femeas?.map((f) => ({ value: f.id, label: f.identificacao })) ?? [])
  ];

  const destinoProdutivoOptions = [
    { value: "null", label: "Nao definido" },
    { value: "reprodutor", label: "Reprodutor" },
    { value: "rufiao", label: "Rufiao" },
    { value: "engorda", label: "Engorda" },
    { value: "abate", label: "Abate" },
    { value: "venda", label: "Venda" },
    { value: "descarte", label: "Descarte" }
  ];

  const statusReprodutivoOptions = [
    { value: "null", label: "Nao definido" },
    { value: "candidato", label: "Candidato" },
    { value: "apto", label: "Apto" },
    { value: "suspenso", label: "Suspenso" },
    { value: "inativo", label: "Inativo" }
  ];

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
      castrado:
        sexo === "M" && castrado !== "null" ? castrado === "true" : null,
      puberdade_confirmada:
        puberdadeConfirmada !== "null" ? puberdadeConfirmada === "true" : null,
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
      especie: especie === "null" ? null : especie,

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
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!animal || !id) return;

    if (
      !window.confirm(
        "ATENÇÃO: Você está prestes a excluir este animal de todos os registros da Gestão Agro. Esta ação o removerá dos relatórios passados e cancelará sua vida ativa na fazenda. Deseja mesmo excluir este animal?",
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      await createGesture(animal.fazenda_id, [
        {
          table: "animais",
          action: "DELETE",
          record: { id: animal.id },
        },
      ]);
      await db.state_animais.delete(animal.id);
      showSuccess("Animal excluído com sucesso.");
      navigate("/animais");
    } catch (e: unknown) {
      setIsSaving(false);
      showError("Erro ao excluir animal.");
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (!animal) {
    return (
      <div className="space-y-5 pb-16">
        <PageIntro
          variant="plain"
          eyebrow="Cadastro animal"
          title="Editar animal"
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
    <div className="space-y-5 pb-16">
      <PageIntro
        variant="plain"
        eyebrow="Cadastro animal"
        title="Editar animal"
        meta={
          <>
            <StatusBadge tone="neutral">
              {sexo === "M" ? "Macho" : "Femea"}
            </StatusBadge>
            <StatusBadge tone="neutral">
              {origem === "null" ? "Origem nao informada" : origem}
            </StatusBadge>
            <StatusBadge tone="neutral">
              {loteId === "null"
                ? "Sem lote"
                : (lotes?.find((loteAtual) => loteAtual.id === loteId)?.nome ??
                  "Lote selecionado")}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => navigate(`/animais/${id}`)}
              disabled={isSaving}
            >
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

      <Tabs defaultValue="basic" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-12 rounded-xl mb-6 bg-muted/60 p-1">
          <TabsTrigger value="basic" className="rounded-lg py-2 text-sm font-semibold">Geral</TabsTrigger>
          <TabsTrigger value="trace" className="rounded-lg py-2 text-sm font-semibold">Origem</TabsTrigger>
          <TabsTrigger value="field" className="rounded-lg py-2 text-sm font-semibold">Campo</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-5">
          <Card className="shadow-none">
            <CardHeader className="px-4 py-3 sm:px-5">
              <CardTitle className="text-base">Dados básicos</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 pt-0 sm:p-5 sm:pt-0 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="identificacao">Identificação *</Label>
                <Input
                  id="identificacao"
                  value={identificacao}
                  onChange={(e) => setIdentificacao(e.target.value)}
                  placeholder="Ex: 001, Brinco 123..."
                  className="h-12 text-body rounded-xl"
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sexo">Sexo *</Label>
                <div className="grid grid-cols-2 gap-2" id="sexo">
                  <Button
                    type="button"
                    variant={sexo === "M" ? "default" : "outline"}
                    className="h-12 text-base rounded-xl border-2"
                    onClick={() => setSexo("M")}
                    disabled={isSaving}
                  >
                    Macho
                  </Button>
                  <Button
                    type="button"
                    variant={sexo === "F" ? "default" : "outline"}
                    className="h-12 text-base rounded-xl border-2"
                    onClick={() => setSexo("F")}
                    disabled={isSaving}
                  >
                    Fêmea
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="especie">Espécie</Label>
                <FieldCombobox
                  id="especie"
                  options={especieOptions}
                  value={especie}
                  onValueChange={(value) => setEspecie(value as AnimalSpeciesEnum || "null")}
                  placeholder="Nao informada"
                  searchPlaceholder="Buscar espécie..."
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lote">Lote</Label>
                <Input
                  id="lote"
                  value={lotes?.find((l) => l.id === loteId)?.nome ?? "Sem lote"}
                  disabled
                  className="h-12 text-body rounded-xl bg-muted/40"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Altere pelo manejo Movimentação.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="px-4 py-3 sm:px-5">
              <CardTitle className="text-base">Genealogia</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 pt-0 sm:p-5 sm:pt-0 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pai">Pai (Opcional)</Label>
                <FieldCombobox
                  id="pai"
                  options={paiOptions}
                  value={paiId}
                  onValueChange={(value) => setPaiId(value || "null")}
                  placeholder="Desconhecido"
                  searchPlaceholder="Buscar pai..."
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mae">Mãe (Opcional)</Label>
                <FieldCombobox
                  id="mae"
                  options={maeOptions}
                  value={maeId}
                  onValueChange={(value) => setMaeId(value || "null")}
                  placeholder="Desconhecido"
                  searchPlaceholder="Buscar mãe..."
                  disabled={isSaving}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="px-4 py-3 sm:px-5">
              <CardTitle className="text-base">Informações adicionais</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 pt-0 sm:p-5 sm:pt-0 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome_popular">Nome</Label>
                <Input
                  id="nome_popular"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome popular do animal"
                  className="h-12 text-body rounded-xl"
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rfid">RFID</Label>
                <div className="flex gap-2">
                  <Input
                    id="rfid"
                    value={rfid}
                    onChange={(e) => setRfid(e.target.value)}
                    placeholder="Código RFID"
                    className="h-12 text-body rounded-xl flex-1"
                    disabled={isSaving}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-12 rounded-xl p-0 flex items-center justify-center border-2 border-primary/20 hover:border-primary/50"
                    onClick={() => {
                      showSuccess("Scanner de campo ativado (Simulação).");
                    }}
                    disabled={isSaving}
                  >
                    <ScanLine className="h-5 w-5 text-primary" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trace" className="space-y-5">
          <Card className="shadow-none">
            <CardHeader className="px-4 py-3 sm:px-5">
              <CardTitle className="text-base">Rastreabilidade</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 pt-0 sm:p-5 sm:pt-0 md:grid-cols-2">
              <div className="space-y-2 col-span-1 md:col-span-2">
                <Label htmlFor="origem">Origem</Label>
                <div className="grid grid-cols-3 gap-2" id="origem">
                  <Button
                    type="button"
                    variant={origem === "nascimento" ? "default" : "outline"}
                    className="h-12 text-sm rounded-xl border-2 px-1"
                    onClick={() => setOrigem("nascimento")}
                    disabled={isSaving}
                  >
                    Nascimento
                  </Button>
                  <Button
                    type="button"
                    variant={origem === "compra" ? "default" : "outline"}
                    className="h-12 text-sm rounded-xl border-2 px-1"
                    onClick={() => setOrigem("compra")}
                    disabled={isSaving}
                  >
                    Compra
                  </Button>
                  <Button
                    type="button"
                    variant={origem === "doacao" ? "default" : "outline"}
                    className="h-12 text-sm rounded-xl border-2 px-1"
                    onClick={() => setOrigem("doacao")}
                    disabled={isSaving}
                  >
                    Doação
                  </Button>
                  <Button
                    type="button"
                    variant={origem === "arrendamento" ? "default" : "outline"}
                    className="h-12 text-sm rounded-xl border-2 px-1"
                    onClick={() => setOrigem("arrendamento")}
                    disabled={isSaving}
                  >
                    Arrendamento
                  </Button>
                  <Button
                    type="button"
                    variant={origem === "sociedade" ? "default" : "outline"}
                    className="h-12 text-sm rounded-xl border-2 px-1"
                    onClick={() => setOrigem("sociedade")}
                    disabled={isSaving}
                  >
                    Sociedade
                  </Button>
                  <Button
                    type="button"
                    variant={origem === "null" ? "default" : "outline"}
                    className="h-12 text-sm rounded-xl border-2 px-1"
                    onClick={() => setOrigem("null")}
                    disabled={isSaving}
                  >
                    Não inf.
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="raca">Raça</Label>
                <FieldCombobox
                  id="raca"
                  options={racaOptions}
                  value={raca}
                  onValueChange={(value) => setRaca(value || "null")}
                  placeholder="Selecione a raça"
                  searchPlaceholder="Buscar raça..."
                  disabled={isSaving}
                />
              </div>

              <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dataNascimento">Data de Nascimento</Label>
                  <Input
                    id="dataNascimento"
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    className="h-12 text-body rounded-xl"
                    disabled={isSaving}
                  />
                </div>

                {/* Data de entrada apenas para origem externa (sociedade, doação, compra) */}
                {(origem === "sociedade" ||
                  origem === "doacao" ||
                  origem === "compra") && (
                  <div className="space-y-2">
                    <Label htmlFor="dataEntrada">Data de Entrada</Label>
                    <Input
                      id="dataEntrada"
                      type="date"
                      value={dataEntrada}
                      onChange={(e) => setDataEntrada(e.target.value)}
                      className="h-12 text-body rounded-xl"
                      disabled={isSaving}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="field" className="space-y-5">
          <Card className="shadow-none">
            <CardHeader className="px-4 py-3 sm:px-5">
              <CardTitle className="text-base">Fatos taxonômicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
              {(idadeMeses === null || (idadeMeses >= 7 && idadeMeses <= 12)) && (
                <div className="space-y-2">
                  <Label htmlFor="puberdade">Puberdade confirmada</Label>
                  <div className="grid grid-cols-3 gap-2" id="puberdade">
                    <Button
                      type="button"
                      variant={puberdadeConfirmada === "true" ? "default" : "outline"}
                      className="h-12 text-base rounded-xl border-2"
                      onClick={() => setPuberdadeConfirmada("true")}
                      disabled={isSaving}
                    >
                      Sim
                    </Button>
                    <Button
                      type="button"
                      variant={puberdadeConfirmada === "false" ? "default" : "outline"}
                      className="h-12 text-base rounded-xl border-2"
                      onClick={() => setPuberdadeConfirmada("false")}
                      disabled={isSaving}
                    >
                      Não
                    </Button>
                    <Button
                      type="button"
                      variant={puberdadeConfirmada === "null" ? "default" : "outline"}
                      className="h-12 text-base rounded-xl border-2"
                      onClick={() => setPuberdadeConfirmada("null")}
                      disabled={isSaving}
                    >
                      Não inf.
                    </Button>
                  </div>
                </div>
              )}

              {sexo === "M" && (
                <div className="space-y-2">
                  <Label htmlFor="castrado">Castrado</Label>
                  <div className="grid grid-cols-3 gap-2" id="castrado">
                    <Button
                      type="button"
                      variant={castrado === "true" ? "default" : "outline"}
                      className="h-12 text-base rounded-xl border-2"
                      onClick={() => setCastrado("true")}
                      disabled={isSaving}
                    >
                      Sim
                    </Button>
                    <Button
                      type="button"
                      variant={castrado === "false" ? "default" : "outline"}
                      className="h-12 text-base rounded-xl border-2"
                      onClick={() => setCastrado("false")}
                      disabled={isSaving}
                    >
                      Não
                    </Button>
                    <Button
                      type="button"
                      variant={castrado === "null" ? "default" : "outline"}
                      className="h-12 text-base rounded-xl border-2"
                      onClick={() => setCastrado("null")}
                      disabled={isSaving}
                    >
                      Não inf.
                    </Button>
                  </div>
                </div>
              )}

              {sexo === "F" && isLactationEligible && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="lactacao">Em lactação</Label>
                    <div className="grid grid-cols-3 gap-2" id="lactacao">
                      <Button
                        type="button"
                        variant={emLactacao === "true" ? "default" : "outline"}
                        className="h-12 text-base rounded-xl border-2"
                        onClick={() => setEmLactacao("true")}
                        disabled={isSaving}
                      >
                        Sim
                      </Button>
                      <Button
                        type="button"
                        variant={emLactacao === "false" ? "default" : "outline"}
                        className="h-12 text-base rounded-xl border-2"
                        onClick={() => setEmLactacao("false")}
                        disabled={isSaving}
                      >
                        Não
                      </Button>
                      <Button
                        type="button"
                        variant={emLactacao === "null" ? "default" : "outline"}
                        className="h-12 text-base rounded-xl border-2"
                        onClick={() => setEmLactacao("null")}
                        disabled={isSaving}
                      >
                        Não inf.
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="secagem">Secagem realizada</Label>
                    <div className="grid grid-cols-3 gap-2" id="secagem">
                      <Button
                        type="button"
                        variant={secagemRealizada === "true" ? "default" : "outline"}
                        className="h-12 text-base rounded-xl border-2"
                        onClick={() => handleSecagemRealizadaChange("true")}
                        disabled={isSaving}
                      >
                        Sim
                      </Button>
                      <Button
                        type="button"
                        variant={secagemRealizada === "false" ? "default" : "outline"}
                        className="h-12 text-base rounded-xl border-2"
                        onClick={() => handleSecagemRealizadaChange("false")}
                        disabled={isSaving}
                      >
                        Não
                      </Button>
                      <Button
                        type="button"
                        variant={secagemRealizada === "null" ? "default" : "outline"}
                        className="h-12 text-base rounded-xl border-2"
                        onClick={() => handleSecagemRealizadaChange("null")}
                        disabled={isSaving}
                      >
                        Não inf.
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {sexo === "M" && (
            <Card className="shadow-none">
              <CardHeader className="px-4 py-3 sm:px-5">
                <CardTitle className="text-base">Perfil do macho</CardTitle>
                {idadeMeses !== null ? (
                  <p className="text-xs text-muted-foreground">
                    {idadeMeses} meses.
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
                <div className="space-y-2">
                  <Label htmlFor="destino_produtivo">Destino Produtivo</Label>
                  <FieldCombobox
                    id="destino_produtivo"
                    options={destinoProdutivoOptions}
                    value={destinoProdutivo}
                    onValueChange={(value) => handleDestinoProdutivoChange(value as DestinoProdutivoAnimalEnum || "null")}
                    placeholder="Como este macho sera conduzido?"
                    searchPlaceholder="Buscar destino..."
                    disabled={isSaving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status_reprodutivo">Status Reprodutivo</Label>
                  <FieldCombobox
                    id="status_reprodutivo"
                    options={statusReprodutivoOptions}
                    value={statusReprodutivoMacho}
                    onValueChange={(value) => setStatusReprodutivoMacho(value as StatusReprodutivoMachoEnum || "null")}
                    placeholder={
                      destinoProdutivo === "null"
                        ? "Defina primeiro o destino"
                        : "Selecione o status"
                    }
                    searchPlaceholder="Buscar status..."
                    disabled={isSaving || !maleBreedingSelected}
                  />
                  {!maleBreedingSelected && destinoProdutivo !== "null" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Destino nao reprodutivo.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {role === "owner" && (
            <Card className="mb-6 border-destructive/40 shadow-none">
              <CardHeader className="px-4 py-3 sm:px-5">
                <CardTitle className="text-base text-destructive flex items-center">
                  <Trash2 className="h-5 w-5 mr-2" />
                  Zona de Perigo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="w-full sm:w-auto h-12 rounded-xl"
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
        </TabsContent>
      </Tabs>

      {/* Rodapé fixo para mobile (DS §7.3) */}
      <div className="sticky bottom-0 inset-x-0 -mx-4 -mb-16 mt-5 border-t-2 border-border bg-card p-4 flex items-center justify-between gap-4 md:hidden z-30 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <Button
          variant="outline"
          className="h-14 flex-1 text-base rounded-xl"
          onClick={() => navigate(`/animais/${id}`)}
          disabled={isSaving}
        >
          Cancelar
        </Button>
        <Button
          className="h-14 flex-1 text-base rounded-xl"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <Save className="mr-2 h-5 w-5" />
          )}
          {isSaving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>

    </div>
  );
};

export default AnimalEditar;
