import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Save, Loader2 } from "lucide-react";

import { FormSection } from "@/components/ui/form-section";
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
import { Textarea } from "@/components/ui/textarea";
import { FieldCombobox } from "@/components/ui/field-combobox";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { createGesture } from "@/lib/offline/ops";
import { getActiveFarmId } from "@/lib/storage";
import {
  TipoPastoEnum,
  InfraestruturaPasto,
  PastoCoberturaSoloEnum,
} from "@/lib/offline/types";
import { showSuccess, showError } from "@/utils/toast";

const INFRA_STATUS = [
  { value: "otimo", label: "Otimo" },
  { value: "bom", label: "Bom" },
  { value: "regular", label: "Regular" },
  { value: "ruim", label: "Ruim" },
] as const;

const FORRAGEIRA_OPTIONS_BY_TIPO: Record<TipoPastoEnum, string[]> = {
  nativo: ["Campo nativo", "Capim nativo", "Outro"],
  cultivado: [
    "Braquiaria Marandu",
    "Braquiaria Decumbens",
    "Panicum Mombaca",
    "Panicum Tanzania",
    "Massai",
    "Tifton",
    "Andropogon",
    "Outro",
  ],
  integracao: [
    "Braquiaria Marandu",
    "Braquiaria Ruziziensis",
    "Panicum Mombaca",
    "Panicum Tanzania",
    "Outro",
  ],
  degradado: [
    "Braquiaria Marandu",
    "Braquiaria Decumbens",
    "Capim degradado",
    "Outro",
  ],
};

function getForrageiraOptions(tipo: TipoPastoEnum, current: string) {
  const options = FORRAGEIRA_OPTIONS_BY_TIPO[tipo];
  if (!current || options.includes(current)) return options;
  return [current, ...options];
}

function parseOptionalNumber(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return { value: null, valid: true };

  const parsed = Number(normalized);
  return {
    value: Number.isFinite(parsed) ? parsed : null,
    valid: Number.isFinite(parsed),
  };
}

const PastoNovo = () => {
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [areaHa, setAreaHa] = useState("");
  const [capacidadeUa, setCapacidadeUa] = useState("");
  const [tipoPasto, setTipoPasto] = useState<TipoPastoEnum>("nativo");
  const [forrageiraCultivar, setForrageiraCultivar] = useState("");
  const [coberturaSolo, setCoberturaSolo] = useState<
    PastoCoberturaSoloEnum | ""
  >("");
  const [alturaEntrada, setAlturaEntrada] = useState("");
  const [alturaSaida, setAlturaSaida] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [infra, setInfra] = useState<InfraestruturaPasto>({
    cochos: { quantidade: 0, tipo: "madeira", capacidade: 0, estado: "bom" },
    bebedouros: {
      quantidade: 0,
      tipo: "natural",
      capacidade: 0,
      estado: "bom",
    },
    saleiros: { quantidade: 0, tipo: "coberto", capacidade: 0, estado: "bom" },
    cerca: { tipo: "arame_liso", comprimento_metros: 0, estado: "bom" },
  });

  const activeFazendaId = getActiveFarmId();

  const tipoPastoOptions = [
    { value: "nativo", label: "Nativo" },
    { value: "cultivado", label: "Cultivado" },
    { value: "integracao", label: "ILPF / Integracao" },
    { value: "degradado", label: "Degradado / Recuperacao" },
  ];

  const coberturaSoloOptions = [
    { value: "nao_informado", label: "Nao informado" },
    { value: "excelente", label: "Excelente (sem solo exposto)" },
    { value: "media", label: "Media (falhas leves)" },
    { value: "ruim", label: "Ruim (solo exposto e plantas daninhas)" },
  ];

  const forrageiraOptions = [
    { value: "none", label: "Nao informado" },
    ...getForrageiraOptions(tipoPasto, forrageiraCultivar).map((opt) => ({
      value: opt,
      label: opt,
    })),
  ];

  const handleInfraChange = (
    category: keyof InfraestruturaPasto,
    field: string,
    value: string | number | boolean,
  ) => {
    setInfra((previous) => ({
      ...previous,
      [category]: {
        ...previous[category],
        [field]: value,
      },
    }));
  };

  const handleTipoPastoChange = (value: TipoPastoEnum) => {
    setTipoPasto(value);
    setForrageiraCultivar((current) =>
      current && !FORRAGEIRA_OPTIONS_BY_TIPO[value].includes(current)
        ? ""
        : current,
    );
  };

  const handleSave = async () => {
    if (!activeFazendaId) {
      showError("Fazenda nao identificada.");
      return;
    }

    if (!nome.trim()) {
      showError("Nome do pasto e obrigatorio.");
      return;
    }

    const area = Number(areaHa.trim().replace(",", "."));
    if (!Number.isFinite(area) || area <= 0) {
      showError("Area (ha) e obrigatoria e deve ser maior que zero.");
      return;
    }

    const entradaParsed = parseOptionalNumber(alturaEntrada);
    const saidaParsed = parseOptionalNumber(alturaSaida);
    const capacidadeParsed = parseOptionalNumber(capacidadeUa);

    if (!capacidadeParsed.valid) {
      showError("Capacidade UA deve ser um numero valido.");
      return;
    }
    if (!entradaParsed.valid) {
      showError("Altura de entrada deve ser um numero valido.");
      return;
    }
    if (!saidaParsed.valid) {
      showError("Altura de saida deve ser um numero valido.");
      return;
    }

    const entrada = entradaParsed.value;
    const saida = saidaParsed.value;
    const capacidade = capacidadeParsed.value;

    if (capacidade !== null && capacidade < 0) {
      showError("Capacidade UA deve ser maior ou igual a zero.");
      return;
    }
    if (entrada !== null && entrada <= 0) {
      showError("Altura de entrada deve ser maior que zero.");
      return;
    }
    if (saida !== null && saida <= 0) {
      showError("Altura de saida deve ser maior que zero.");
      return;
    }
    if (entrada !== null && saida !== null && saida >= entrada) {
      showError("Altura de saida deve ser menor que a altura de entrada.");
      return;
    }

    setIsSaving(true);
    const pastoId = crypto.randomUUID();
    const now = new Date().toISOString();
    const op = {
      table: "pastos",
      action: "INSERT" as const,
      record: {
        id: pastoId,
        fazenda_id: activeFazendaId,
        nome: nome.trim(),
        area_ha: area,
        capacidade_ua: capacidade,
        tipo_pasto: tipoPasto, // legado
        tipo_area: tipoPasto,
        forrageira_nome: null,
        forrageira_genero: null,
        forrageira_cultivar: forrageiraCultivar.trim() || null,
        altura_entrada_alvo_cm: entrada,
        altura_saida_alvo_cm: saida,
        capacidade_ua_alvo: capacidade,
        infraestrutura: infra,
        observacoes: observacoes || null,
        payload: {},
        created_at: now,
        updated_at: now,
      },
    };
    const ops = [op];

    if (coberturaSolo) {
      ops.push(
        ...buildEventGesture({
          dominio: "pastagem",
          fazendaId: activeFazendaId,
          pastoId,
          loteId: null,
          ocupacaoId: null,
          momento: "ronda",
          coberturaSolo,
          observacoes: "Condicao inicial registrada no cadastro do pasto.",
          payload: { origem: "cadastro_pasto" },
        }).ops,
      );
    }

    try {
      await createGesture(activeFazendaId, ops);
      showSuccess("Pasto cadastrado com sucesso!");
      navigate("/pastos");
    } catch (error) {
      console.error(error);
      showError("Erro ao cadastrar pasto. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-16">
      <PageIntro
        variant="plain"
        eyebrow="Estrutura do rebanho"
        title="Novo pasto"
        meta={
          <>
            <span className="inline-flex items-center rounded-full border border-border/80 bg-background/75 px-2.5 py-1 text-[11px] font-medium leading-none text-muted-foreground">
              {tipoPasto}
            </span>
            {areaHa ? (
              <span className="inline-flex items-center rounded-full border border-border/80 bg-background/75 px-2.5 py-1 text-[11px] font-medium leading-none text-muted-foreground">
                {areaHa} ha
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/pastos")} disabled={isSaving}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isSaving ? "Salvando..." : "Salvar pasto"}
            </Button>
          </>
        }
      />

      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
      >
        <FormSection title="Identidade e capacidade">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nome">Nome do pasto</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                placeholder="Ex: piquete 1, reserva norte, descanso..."
                className="h-12 text-body rounded-xl"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipoPasto">Tipo de pastagem</Label>
              <FieldCombobox
                id="tipoPasto"
                options={tipoPastoOptions}
                value={tipoPasto}
                onValueChange={(value) => handleTipoPastoChange(value as TipoPastoEnum)}
                placeholder="Selecione..."
                searchPlaceholder="Buscar tipo..."
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="area">Area (ha)</Label>
              <Input
                id="area"
                type="number"
                step="0.01"
                value={areaHa}
                onChange={(event) => setAreaHa(event.target.value)}
                placeholder="Ex: 10.5"
                className="h-12 text-body rounded-xl"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacidade">Capacidade (UA)</Label>
              <Input
                id="capacidade"
                type="number"
                step="0.1"
                value={capacidadeUa}
                onChange={(event) => setCapacidadeUa(event.target.value)}
                placeholder="Ex: 25"
                className="h-12 text-body rounded-xl"
                disabled={isSaving}
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Manejo da pastagem">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cultivar">Forrageira / cultivar</Label>
              <FieldCombobox
                id="cultivar"
                options={forrageiraOptions}
                value={forrageiraCultivar || "none"}
                onValueChange={(value) => setForrageiraCultivar(value === "none" ? "" : value)}
                placeholder="Selecione..."
                searchPlaceholder="Buscar forrageira..."
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coberturaSolo">Taxa de cobertura do solo / Aspecto visual</Label>
              <FieldCombobox
                id="coberturaSolo"
                options={coberturaSoloOptions}
                value={coberturaSolo || "nao_informado"}
                onValueChange={(value) => setCoberturaSolo(value === "nao_informado" ? "" : (value as PastoCoberturaSoloEnum))}
                placeholder="Selecione..."
                searchPlaceholder="Buscar aspecto..."
                disabled={isSaving}
              />
            </div>

            <div className="grid gap-4 grid-cols-2 md:col-span-2">
              <div className="space-y-2">
                <Label htmlFor="alt_entrada">Alt. entrada (cm)</Label>
                <Input
                  id="alt_entrada"
                  type="number"
                  step="0.1"
                  value={alturaEntrada}
                  onChange={(event) => setAlturaEntrada(event.target.value)}
                  placeholder="Ex: 30"
                  className="h-12 text-body rounded-xl"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alt_saida">Alt. saída (cm)</Label>
                <Input
                  id="alt_saida"
                  type="number"
                  step="0.1"
                  value={alturaSaida}
                  onChange={(event) => setAlturaSaida(event.target.value)}
                  placeholder="Ex: 15"
                  className="h-12 text-body rounded-xl"
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="observacoes">Observacoes</Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                placeholder="Informacoes de manejo, limitacoes ou notas do campo."
                className="min-h-24 rounded-xl text-body"
                disabled={isSaving}
              />
            </div>
          </div>
        </FormSection>

        <FormSection title="Infraestrutura">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-4 space-y-1">
                <p className="font-medium text-foreground">Cochos</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    value={infra.cochos?.quantidade || 0}
                    onChange={(event) =>
                      handleInfraChange(
                        "cochos",
                        "quantidade",
                        Number.parseInt(event.target.value, 10) || 0,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={infra.cochos?.tipo || "madeira"}
                    onValueChange={(value) =>
                      handleInfraChange("cochos", "tipo", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="madeira">Madeira coberto</SelectItem>
                      <SelectItem value="plastico">
                        Plastico / tambor
                      </SelectItem>
                      <SelectItem value="concreto">Concreto</SelectItem>
                      <SelectItem value="bags">Bags / movel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Capacidade total (m)</Label>
                  <Input
                    type="number"
                    value={infra.cochos?.capacidade || 0}
                    onChange={(event) =>
                      handleInfraChange(
                        "cochos",
                        "capacidade",
                        Number.parseFloat(event.target.value) || 0,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={infra.cochos?.estado || "bom"}
                    onValueChange={(value) =>
                      handleInfraChange("cochos", "estado", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INFRA_STATUS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-4 space-y-1">
                <p className="font-medium text-foreground">Bebedouros</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    value={infra.bebedouros?.quantidade || 0}
                    onChange={(event) =>
                      handleInfraChange(
                        "bebedouros",
                        "quantidade",
                        Number.parseInt(event.target.value, 10) || 0,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={infra.bebedouros?.tipo || "natural"}
                    onValueChange={(value) =>
                      handleInfraChange("bebedouros", "tipo", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="natural">Natural</SelectItem>
                      <SelectItem value="artificial">Artificial</SelectItem>
                      <SelectItem value="tanque">Tanque rede</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Capacidade (L)</Label>
                  <Input
                    type="number"
                    value={infra.bebedouros?.capacidade || 0}
                    onChange={(event) =>
                      handleInfraChange(
                        "bebedouros",
                        "capacidade",
                        Number.parseFloat(event.target.value) || 0,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={infra.bebedouros?.estado || "bom"}
                    onValueChange={(value) =>
                      handleInfraChange("bebedouros", "estado", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INFRA_STATUS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-4 space-y-1">
                <p className="font-medium text-foreground">Cercas</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo predominante</Label>
                  <Select
                    value={infra.cerca?.tipo || "arame_liso"}
                    onValueChange={(value) =>
                      handleInfraChange("cerca", "tipo", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="arame_liso">Arame liso</SelectItem>
                      <SelectItem value="arame_farpado">
                        Arame farpado
                      </SelectItem>
                      <SelectItem value="eletrica">Eletrica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={infra.cerca?.estado || "bom"}
                    onValueChange={(value) =>
                      handleInfraChange("cerca", "estado", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INFRA_STATUS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Metragem total (m)</Label>
                  <Input
                    type="number"
                    value={infra.cerca?.comprimento_metros || 0}
                    onChange={(event) =>
                      handleInfraChange(
                        "cerca",
                        "comprimento_metros",
                        Number.parseFloat(event.target.value) || 0,
                      )
                    }
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-4 space-y-1">
                <p className="font-medium text-foreground">Saleiros</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Saleiros (qtd)</Label>
                  <Input
                    type="number"
                    value={infra.saleiros?.quantidade || 0}
                    onChange={(event) =>
                      handleInfraChange(
                        "saleiros",
                        "quantidade",
                        Number.parseInt(event.target.value, 10) || 0,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={infra.saleiros?.estado || "bom"}
                    onValueChange={(value) =>
                      handleInfraChange("saleiros", "estado", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INFRA_STATUS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Input
                    value={infra.saleiros?.tipo || ""}
                    onChange={(event) =>
                      handleInfraChange("saleiros", "tipo", event.target.value)
                    }
                    placeholder="Ex: coberto, movel"
                  />
                </div>
              </div>
            </div>
          </div>
        </FormSection>

        {/* Rodapé fixo para mobile (DS §7.3) */}
        <div className="sticky bottom-0 inset-x-0 -mx-4 -mb-16 mt-5 border-t-2 border-border bg-card p-4 flex items-center justify-between gap-4 md:hidden z-30 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
          <Button
            type="button"
            variant="outline"
            className="h-14 flex-1 text-base rounded-xl"
            onClick={() => navigate("/pastos")}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-14 flex-1 text-base rounded-xl"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Save className="mr-2 h-5 w-5" />
            )}
            {isSaving ? "Salvando..." : "Salvar pasto"}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PastoNovo;

