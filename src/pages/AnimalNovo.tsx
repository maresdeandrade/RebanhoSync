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
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { showSuccess, showError } from "@/utils/toast";
import { ChevronLeft, Save, Loader2 } from "lucide-react";
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

  return (
    <div className="space-y-6 pb-16">
      <PageIntro
        eyebrow="Cadastro animal"
        title="Novo animal"
        description="O formulario foi reorganizado em blocos operacionais mais claros, preservando o comportamento atual do cadastro."
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

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Sexo"
          value={sexo === "M" ? "Macho" : "Femea"}
          hint={idadeMeses !== null ? `${idadeMeses} mes(es) estimados.` : "Sem idade calculada."}
        />
        <MetricCard
          label="Origem"
          value={origem === "null" ? "Nao informada" : origem}
          hint="A origem organiza o restante do fluxo de entrada."
        />
        <MetricCard
          label="Lote inicial"
          value={
            loteId === "null"
              ? "Sem lote"
              : lotes?.find((lote) => lote.id === loteId)?.nome ?? "Selecionado"
          }
          hint="Pode ser ajustado sem reabrir o cadastro."
        />
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
                {lotes?.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_nascimento">Data de Nascimento</Label>
              <Input
                id="data_nascimento"
                type="date"
                value={dataNascimento}
                onChange={(e) => setDataNascimento(e.target.value)}
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
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rastreabilidade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Origem</Label>
            <Select value={origem} onValueChange={(v: typeof origem) => setOrigem(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Como chegou à fazenda?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Não informado</SelectItem>
                <SelectItem value="nascimento">Nasc imento</SelectItem>
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

      {/* Card condicional: Detalhes da Sociedade */}
      {origem === "sociedade" && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-blue-900">Detalhes da Sociedade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>
                Contraparte <span className="text-red-500">*</span>
              </Label>
              <Select
                value={sociedadeContraparteId}
                onValueChange={setSociedadeContraparteId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a contraparte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Selecione...</SelectItem>
                  {contrapartes?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Dono/parceiro do animal em sociedade
              </p>
            </div>

            <div className="space-y-2">
              <Label>Percentual da Fazenda (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={percentualSociedade}
                onChange={(e) => setPercentualSociedade(e.target.value)}
                placeholder="Ex: 50"
              />
              <p className="text-xs text-muted-foreground">
                Participação da fazenda na sociedade (opcional)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Data de Início da Sociedade</Label>
              <Input
                type="date"
                value={inicioSociedade}
                onChange={(e) => setInicioSociedade(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Se não informado, usa a data de entrada ou data atual
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card condicional: Detalhes da Compra */}
      {origem === "compra" && (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardHeader>
            <CardTitle className="text-emerald-900">Detalhes da Compra</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>
                Valor Total (R$) <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={compraValorTotal}
                onChange={(e) => setCompraValorTotal(e.target.value)}
                placeholder="Ex: 4500.00"
              />
            </div>

            <div className="space-y-2">
              <Label>Contraparte (Opcional)</Label>
              <Select
                value={compraContraparteId}
                onValueChange={setCompraContraparteId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a contraparte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Sem contraparte</SelectItem>
                  {contrapartes?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observacoes da Compra</Label>
              <Input
                value={compraObservacoes}
                onChange={(e) => setCompraObservacoes(e.target.value)}
                placeholder="Ex: Compra em leilao regional"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Fatos Taxonômicos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {sexo === "F" && (
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

      {sexo === "M" && (
        <Card>
          <CardHeader>
            <CardTitle>Perfil do Macho</CardTitle>
            <p className="text-xs text-muted-foreground">
              Defina o destino do animal e, quando for o caso, o status
              reprodutivo. O modo de transicao fica nas configuracoes gerais
              da fazenda.
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

      <Accordion type="single" collapsible>
        <AccordionItem value="advanced">
          <AccordionTrigger>Informações Adicionais (Opcional)</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Estrela"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rfid">Código RFID</Label>
              <Input
                id="rfid"
                value={rfid}
                onChange={(e) => setRfid(e.target.value)}
                placeholder="Ex: 982000123456789"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Button className="w-full" onClick={handleSave} disabled={isSaving}>
        {isSaving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        {isSaving ? "Salvando..." : "Salvar Animal"}
      </Button>
    </div>
  );
};

export default AnimalNovo;
