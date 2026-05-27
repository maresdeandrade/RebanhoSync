import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type {
  DestinoProdutivoAnimalEnum,
  OperationInput,
  StatusReprodutivoMachoEnum,
} from "@/lib/offline/types";
import { ANIMAL_BREED_OPTIONS } from "@/lib/animals/catalogs";
import { ANIMAL_SPECIES_OPTIONS, formatAnimalSpecies } from "@/lib/animals/species";
import type { AnimalSpeciesEnum } from "@/lib/animals/species";
import {
  buildAnimalClassificationPayload,
  getLegacyMaleFields,
  isMaleBreedingDestination,
} from "@/lib/animals/maleProfile";
import {
  buildAnimalLifecyclePayload,
  resolveAnimalLifecycleSnapshot,
} from "@/lib/animals/lifecycle";
import { buildAnimalTaxonomyFactsPayload } from "@/lib/animals/taxonomy";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { EventValidationError } from "@/lib/events/validators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/ui/page-intro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldCombobox } from "@/components/ui/field-combobox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showSuccess, showError } from "@/utils/toast";
import { ChevronLeft, Save, Loader2, ScanLine } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLotes } from "@/hooks/useLotes";

const AnimalNovo = () => {
  const navigate = useNavigate();
  const { activeFarmId, farmLifecycleConfig } = useAuth();

  const [isSaving, setIsSaving] = useState(false);

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
  const [isSelectingOutraRaca, setIsSelectingOutraRaca] = useState(false);

  // Estados da Fase 2.2: Sociedade (quando origem='sociedade')
  const [sociedadeContraparteId, setSociedadeContraparteId] =
    useState<string>("null");
  const [percentualSociedade, setPercentualSociedade] = useState("");
  const [inicioSociedade, setInicioSociedade] = useState("");

  // Vinculo financeiro para origem='compra'
  const [compraValorTotal, setCompraValorTotal] = useState("");
  const [compraContraparteId, setCompraContraparteId] = useState<string>("null");
  const [compraObservacoes, setCompraObservacoes] = useState("");

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
  const lotes = useLotes();

  // Query para machos (potenciais pais)
  const machos = useLiveQuery(() => {
    if (!activeFarmId) return [];
    return db.state_animais
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((a) => a.sexo === "M" && (!a.deleted_at || a.deleted_at === null))
      .toArray();
  }, [activeFarmId]);

  // Query para fêmeas (potenciais mães)
  const femeas = useLiveQuery(() => {
    if (!activeFarmId) return [];
    return db.state_animais
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((a) => a.sexo === "F" && (!a.deleted_at || a.deleted_at === null))
      .toArray();
  }, [activeFarmId]);

  // Query para contrapartes (para sociedade)
  const contrapartes = useLiveQuery(() => {
    if (!activeFarmId) return [];
    return db.state_contrapartes
      .where("fazenda_id")
      .equals(activeFarmId)
      .filter((c) => !c.deleted_at)
      .toArray();
  }, [activeFarmId]);

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

    // Validação específica para origem='sociedade'
    if (origem === "sociedade") {
      if (!sociedadeContraparteId || sociedadeContraparteId === "null") {
        showError("Contraparte é obrigatória para animais em sociedade.");
        return;
      }
    }

    const parseNumeric = (value: string): number =>
      Number.parseFloat(value.replace(',', '.'));

    if (origem === 'compra') {
      const valor = parseNumeric(compraValorTotal);
      if (!Number.isFinite(valor) || valor <= 0) {
        showError('Informe um valor de compra maior que zero.');
        return;
      }
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

    const fazenda_id = activeFarmId;

    if (!fazenda_id) {
      showError("Fazenda não identificada.");
      return;
    }

    setIsSaving(true);

    const animal_id = crypto.randomUUID();
    const now = new Date().toISOString();
    const destinoProdutivoValue =
      sexo === "M" && destinoProdutivo !== "null" ? destinoProdutivo : null;
    const statusReprodutivoValue =
      sexo === "M" && statusReprodutivoMacho !== "null"
        ? statusReprodutivoMacho
        : null;
    let payload = buildAnimalClassificationPayload({}, {
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
    payload = buildAnimalLifecyclePayload(
      payload,
      lifecycleSnapshot.targetStage,
      "manual",
    );

    const ops: OperationInput[] = [];

    // 1. Gesture do animal
    const op = {
      table: "animais",
      action: "INSERT" as const,
      record: {
        id: animal_id,
        fazenda_id,
        identificacao,
        sexo,
        status: "ativo",
        lote_id: loteId === "null" ? null : loteId,
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

        created_at: now,
        updated_at: now,
      },
    };

    ops.push(op);

    // 2. Se origem='sociedade', criar registro em animais_sociedade
    if (origem === "sociedade") {
      const opSociedade = {
        table: "animais_sociedade",
        action: "INSERT" as const,
        record: {
          id: crypto.randomUUID(),
          fazenda_id,
          animal_id,
          contraparte_id: sociedadeContraparteId,
          percentual: percentualSociedade ? parseFloat(percentualSociedade) : null,
          inicio: inicioSociedade || dataEntrada || new Date().toISOString().split("T")[0],
          fim: null,
          payload: {},
          created_at: now,
          updated_at: now,
        },
      };
      ops.push(opSociedade);
    }

    // 3. Se origem='compra', registrar evento financeiro no mesmo gesto
    if (origem === "compra") {
      const valorCompra = parseNumeric(compraValorTotal);
      const occurredAt = dataEntrada
        ? `${dataEntrada}T12:00:00.000Z`
        : now;
      const built = buildEventGesture({
        dominio: "financeiro",
        fazendaId: fazenda_id,
        occurredAt,
        animalId: animal_id,
        loteId: loteId === "null" ? null : loteId,
        tipo: "compra",
        valorTotal: valorCompra,
        contraparteId:
          compraContraparteId !== "null" ? compraContraparteId : null,
        observacoes: compraObservacoes || "Compra vinculada ao cadastro do animal",
        payload: {
          kind: "compra_animal",
          animal_id,
          origem: "cadastro_animal",
        },
      });
      ops.push(...built.ops);
    }

    try {
      await createGesture(fazenda_id, ops);
      showSuccess(
        origem === "sociedade"
          ? "Animal e sociedade cadastrados localmente!"
          : origem === "compra"
            ? "Animal e compra financeira cadastrados localmente!"
            : "Animal cadastrado localmente!"
      );
      navigate("/animais");
    } catch (e: unknown) {
      setIsSaving(false);
      if (e instanceof EventValidationError) {
        showError(e.issues[0]?.message ?? "Dados invalidos para cadastro.");
        return;
      }
      showError("Erro ao cadastrar animal.");
    }
  };

  const especieOptions = [
    { value: "null", label: "Nao informada" },
    ...ANIMAL_SPECIES_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];

  const loteOptions = [
    { value: "null", label: "Sem lote" },
    ...(lotes ?? []).map((l) => ({ value: l.id, label: l.nome })),
  ];

  const contraparteOptions = [
    { value: "null", label: "Selecione..." },
    ...(contrapartes ?? []).map((c) => ({ value: c.id, label: c.nome })),
  ];

  const compraContraparteOptions = [
    { value: "null", label: "Sem contraparte" },
    ...(contrapartes ?? []).map((c) => ({ value: c.id, label: c.nome })),
  ];

  return (
    <div className="space-y-5 pb-8">
      <PageIntro
        variant="plain"
        eyebrow="Cadastro animal"
        title="Novo animal"
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/animais")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSaving ? "Salvando..." : "Salvar animal"}
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
              <CardTitle className="text-base">Dados basicos</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 pt-0 sm:p-5 sm:pt-0 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="identificacao" className="flex justify-between items-baseline">
                  <span>Identificação (Brinco/Nome) *</span>
                  <span className="text-caption text-muted-foreground">obrig.</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="identificacao"
                    value={identificacao}
                    onChange={(e) => setIdentificacao(e.target.value)}
                    placeholder="ex.: 0001 ou BR-1234"
                    className="h-12 text-body rounded-xl flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-xl shrink-0"
                    onClick={() => showSuccess("Leitor de brinco ativado!")}
                    aria-label="Escanear brinco"
                  >
                    <ScanLine className="size-5" />
                  </Button>
                </div>
                <p className="text-caption text-muted-foreground leading-normal">
                  Use o leitor do brinco ou digite manualmente.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Sexo *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={sexo === "M" ? "default" : "outline"}
                    className="h-12 text-base rounded-xl border-2"
                    onClick={() => setSexo("M")}
                  >
                    Macho
                  </Button>
                  <Button
                    type="button"
                    variant={sexo === "F" ? "default" : "outline"}
                    className="h-12 text-base rounded-xl border-2"
                    onClick={() => setSexo("F")}
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
                  onValueChange={(value) => setEspecie(value ? (value as AnimalSpeciesEnum | "null") : "null")}
                  placeholder="Nao informada"
                  searchPlaceholder="Buscar espécie..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lote">Lote (Opcional)</Label>
                <FieldCombobox
                  id="lote"
                  options={loteOptions}
                  value={loteId}
                  onValueChange={(value) => setLoteId(value || "null")}
                  placeholder="Sem lote"
                  searchPlaceholder="Buscar lote..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="px-4 py-3 sm:px-5">
              <CardTitle className="text-base">Genealogia</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 pt-0 sm:p-5 sm:pt-0 md:grid-cols-2">
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

          <Accordion type="single" collapsible>
            <AccordionItem value="advanced" className="rounded-xl border border-border/70 bg-card px-4 shadow-none">
              <AccordionTrigger>Informações Adicionais (Opcional)</AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Estrela"
                    className="h-12 text-body rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rfid">Código RFID</Label>
                  <Input
                    id="rfid"
                    value={rfid}
                    onChange={(e) => setRfid(e.target.value)}
                    placeholder="Ex: 982000123456789"
                    className="h-12 text-body rounded-xl"
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        <TabsContent value="trace" className="space-y-5">
          <Card className="shadow-none">
            <CardHeader className="px-4 py-3 sm:px-5">
              <CardTitle className="text-base">Rastreabilidade</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 pt-0 sm:p-5 sm:pt-0 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Origem</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={origem === "nascimento" ? "default" : "outline"}
                    className="h-12 text-sm rounded-xl border-2 px-1"
                    onClick={() => setOrigem("nascimento")}
                  >
                    Nascimento
                  </Button>
                  <Button
                    type="button"
                    variant={origem === "compra" ? "default" : "outline"}
                    className="h-12 text-sm rounded-xl border-2 px-1"
                    onClick={() => setOrigem("compra")}
                  >
                    Compra
                  </Button>
                  <Button
                    type="button"
                    variant={origem === "doacao" ? "default" : "outline"}
                    className="h-12 text-sm rounded-xl border-2 px-1"
                    onClick={() => setOrigem("doacao")}
                  >
                    Doação
                  </Button>
                  <Button
                    type="button"
                    variant={origem === "arrendamento" ? "default" : "outline"}
                    className="h-12 text-sm rounded-xl border-2 px-1"
                    onClick={() => setOrigem("arrendamento")}
                  >
                    Arrendamento
                  </Button>
                  <Button
                    type="button"
                    variant={origem === "sociedade" ? "default" : "outline"}
                    className="h-12 text-sm rounded-xl border-2 px-1"
                    onClick={() => setOrigem("sociedade")}
                  >
                    Sociedade
                  </Button>
                  <Button
                    type="button"
                    variant={origem === "null" ? "default" : "outline"}
                    className="h-12 text-sm rounded-xl border-2 px-1"
                    onClick={() => setOrigem("null")}
                  >
                    Não inf.
                  </Button>
                </div>
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

              <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                  <Input
                    id="data_nascimento"
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    className="h-12 text-body rounded-xl"
                  />
                </div>

                {/* Data de entrada apenas para origem externa (sociedade, doação, compra) */}
                {(origem === "sociedade" || origem === "doacao" || origem === "compra") && (
                  <div className="space-y-2">
                    <Label htmlFor="data_entrada">Data de Entrada</Label>
                    <Input
                      id="data_entrada"
                      type="date"
                      value={dataEntrada}
                      onChange={(e) => setDataEntrada(e.target.value)}
                      className="h-12 text-body rounded-xl"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card condicional: Detalhes da Sociedade */}
          {origem === "sociedade" && (
            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader className="px-4 py-3 sm:px-5">
                <CardTitle className="text-base">Sociedade</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-4 pt-0 sm:p-5 sm:pt-0 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="sociedade_contraparte">
                    Contraparte <span className="text-red-500">*</span>
                  </Label>
                  <FieldCombobox
                    id="sociedade_contraparte"
                    options={contraparteOptions}
                    value={sociedadeContraparteId}
                    onValueChange={(value) => setSociedadeContraparteId(value || "null")}
                    placeholder="Selecione..."
                    searchPlaceholder="Buscar contraparte..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="percentual_sociedade">Percentual da Fazenda (%)</Label>
                  <Input
                    id="percentual_sociedade"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={percentualSociedade}
                    onChange={(e) => setPercentualSociedade(e.target.value)}
                    placeholder="Ex: 50"
                    className="h-12 text-body rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inicio_sociedade">Data de Início da Sociedade</Label>
                  <Input
                    id="inicio_sociedade"
                    type="date"
                    value={inicioSociedade}
                    onChange={(e) => setInicioSociedade(e.target.value)}
                    className="h-12 text-body rounded-xl"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Card condicional: Detalhes da Compra */}
          {origem === "compra" && (
            <Card className="border-border/70 bg-card shadow-none">
              <CardHeader className="px-4 py-3 sm:px-5">
                <CardTitle className="text-base">Compra</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 p-4 pt-0 sm:p-5 sm:pt-0 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="compra_valor">
                    Valor Total (R$) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="compra_valor"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={compraValorTotal}
                    onChange={(e) => setCompraValorTotal(e.target.value)}
                    placeholder="Ex: 4500.00"
                    className="h-12 text-body rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="compra_contraparte">Contraparte (Opcional)</Label>
                  <FieldCombobox
                    id="compra_contraparte"
                    options={compraContraparteOptions}
                    value={compraContraparteId}
                    onValueChange={(value) => setCompraContraparteId(value || "null")}
                    placeholder="Sem contraparte"
                    searchPlaceholder="Buscar contraparte..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="compra_obs">Observacoes da Compra</Label>
                  <Input
                    id="compra_obs"
                    value={compraObservacoes}
                    onChange={(e) => setCompraObservacoes(e.target.value)}
                    placeholder="Ex: Compra em leilao regional"
                    className="h-12 text-body rounded-xl"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="field" className="space-y-5">
          <Card className="shadow-none">
            <CardHeader className="px-4 py-3 sm:px-5">
              <CardTitle className="text-base">Fatos taxonomicos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
              <div className="space-y-2">
                <Label>Puberdade confirmada</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={puberdadeConfirmada === "true" ? "default" : "outline"}
                    className="h-12 text-base rounded-xl border-2"
                    onClick={() => setPuberdadeConfirmada("true")}
                  >
                    Sim
                  </Button>
                  <Button
                    type="button"
                    variant={puberdadeConfirmada === "false" ? "default" : "outline"}
                    className="h-12 text-base rounded-xl border-2"
                    onClick={() => setPuberdadeConfirmada("false")}
                  >
                    Não
                  </Button>
                  <Button
                    type="button"
                    variant={puberdadeConfirmada === "null" ? "default" : "outline"}
                    className="h-12 text-base rounded-xl border-2"
                    onClick={() => setPuberdadeConfirmada("null")}
                  >
                    Não inf.
                  </Button>
                </div>
              </div>

              {sexo === "M" && (
                <div className="space-y-2">
                  <Label>Castrado</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={castrado === "true" ? "default" : "outline"}
                      className="h-12 text-base rounded-xl border-2"
                      onClick={() => setCastrado("true")}
                    >
                      Sim
                    </Button>
                    <Button
                      type="button"
                      variant={castrado === "false" ? "default" : "outline"}
                      className="h-12 text-base rounded-xl border-2"
                      onClick={() => setCastrado("false")}
                    >
                      Não
                    </Button>
                    <Button
                      type="button"
                      variant={castrado === "null" ? "default" : "outline"}
                      className="h-12 text-base rounded-xl border-2"
                      onClick={() => setCastrado("null")}
                    >
                      Não inf.
                    </Button>
                  </div>
                </div>
              )}

              {sexo === "F" && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Em lactação</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        variant={emLactacao === "true" ? "default" : "outline"}
                        className="h-12 text-base rounded-xl border-2"
                        onClick={() => setEmLactacao("true")}
                      >
                        Sim
                      </Button>
                      <Button
                        type="button"
                        variant={emLactacao === "false" ? "default" : "outline"}
                        className="h-12 text-base rounded-xl border-2"
                        onClick={() => setEmLactacao("false")}
                      >
                        Não
                      </Button>
                      <Button
                        type="button"
                        variant={emLactacao === "null" ? "default" : "outline"}
                        className="h-12 text-base rounded-xl border-2"
                        onClick={() => setEmLactacao("null")}
                      >
                        Não inf.
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Secagem realizada</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        variant={secagemRealizada === "true" ? "default" : "outline"}
                        className="h-12 text-base rounded-xl border-2"
                        onClick={() => handleSecagemRealizadaChange("true")}
                      >
                        Sim
                      </Button>
                      <Button
                        type="button"
                        variant={secagemRealizada === "false" ? "default" : "outline"}
                        className="h-12 text-base rounded-xl border-2"
                        onClick={() => handleSecagemRealizadaChange("false")}
                      >
                        Não
                      </Button>
                      <Button
                        type="button"
                        variant={secagemRealizada === "null" ? "default" : "outline"}
                        className="h-12 text-base rounded-xl border-2"
                        onClick={() => handleSecagemRealizadaChange("null")}
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
              </CardHeader>
              <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
                <div className="space-y-3">
                  <Label>Destino Produtivo</Label>
                  <ToggleGroup
                    type="single"
                    value={destinoProdutivo}
                    onValueChange={(value) => handleDestinoProdutivoChange((value || "null") as DestinoProdutivoAnimalEnum | "null")}
                    className="justify-start flex-wrap"
                  >
                    <ToggleGroupItem value="null">Não definido</ToggleGroupItem>
                    <ToggleGroupItem value="reprodutor">Reprodutor</ToggleGroupItem>
                    <ToggleGroupItem value="rufiao">Rufião</ToggleGroupItem>
                    <ToggleGroupItem value="engorda">Engorda</ToggleGroupItem>
                    <ToggleGroupItem value="abate">Abate</ToggleGroupItem>
                    <ToggleGroupItem value="venda">Venda</ToggleGroupItem>
                    <ToggleGroupItem value="descarte">Descarte</ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="space-y-3">
                  <Label>Status Reprodutivo</Label>
                  <ToggleGroup
                    type="single"
                    value={statusReprodutivoMacho}
                    onValueChange={(value) => setStatusReprodutivoMacho((value || "null") as StatusReprodutivoMachoEnum | "null")}
                    disabled={!maleBreedingSelected}
                    className="justify-start flex-wrap"
                  >
                    <ToggleGroupItem value="null">Não definido</ToggleGroupItem>
                    <ToggleGroupItem value="candidato">Candidato</ToggleGroupItem>
                    <ToggleGroupItem value="apto">Apto</ToggleGroupItem>
                    <ToggleGroupItem value="suspenso">Suspenso</ToggleGroupItem>
                    <ToggleGroupItem value="inativo">Inativo</ToggleGroupItem>
                  </ToggleGroup>
                  {!maleBreedingSelected && destinoProdutivo !== "null" && (
                    <p className="text-xs text-muted-foreground">
                      Status reprodutivo inativo.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Rodapé fixo para mobile (DS §7.3) */}
      <div className="sticky bottom-0 inset-x-0 -mx-4 -mb-8 mt-5 border-t-2 border-border bg-card p-4 flex items-center justify-between gap-4 md:hidden z-30 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
        <Button
          variant="outline"
          className="h-14 flex-1 text-base rounded-xl"
          onClick={() => navigate("/animais")}
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
          {isSaving ? "Salvando..." : "Salvar animal"}
        </Button>
      </div>

    </div>
  );
};

export default AnimalNovo;



