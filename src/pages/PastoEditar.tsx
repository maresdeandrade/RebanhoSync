import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronLeft, Map as MapIcon, Save, Trees } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { TipoPastoEnum, InfraestruturaPasto } from "@/lib/offline/types";
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

const PastoEditar = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const pasto = useLiveQuery(() => (id ? db.state_pastos.get(id) : undefined), [id]);
  const lotesNoPasto = useLiveQuery(
    () => (id ? db.state_lotes.where("pasto_id").equals(id).count() : 0),
    [id],
  );

  const [nome, setNome] = useState("");
  const [areaHa, setAreaHa] = useState("");
  const [capacidadeUa, setCapacidadeUa] = useState("");
  const [tipoPasto, setTipoPasto] = useState<TipoPastoEnum>("nativo");
  const [forrageiraCultivar, setForrageiraCultivar] = useState("");
  const [alturaEntrada, setAlturaEntrada] = useState("");
  const [alturaSaida, setAlturaSaida] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [infra, setInfra] = useState<InfraestruturaPasto>({
    cochos: { quantidade: 0, tipo: "", estado: "bom" },
    bebedouros: { quantidade: 0, tipo: "", estado: "bom" },
    saleiros: { quantidade: 0, tipo: "", estado: "bom" },
    cerca: { tipo: "", estado: "bom", comprimento_metros: 0 },
  });

  useEffect(() => {
    if (!pasto) return;

    setNome(pasto.nome ?? "");
    setAreaHa(pasto.area_ha?.toString() ?? "");
    setCapacidadeUa(
      (pasto.capacidade_ua_alvo ?? pasto.capacidade_ua)?.toString() ?? "",
    );
    setTipoPasto(pasto.tipo_pasto ?? "nativo");
    setForrageiraCultivar(
      pasto.forrageira_cultivar ??
        pasto.forrageira_nome ??
        pasto.forrageira_genero ??
        "",
    );
    setAlturaEntrada(pasto.altura_entrada_alvo_cm?.toString() ?? "");
    setAlturaSaida(pasto.altura_saida_alvo_cm?.toString() ?? "");
    setObservacoes(pasto.observacoes ?? "");
    if (pasto.infraestrutura) {
      const { curral: _legacyCurral, ...infraLocalPasto } = pasto.infraestrutura;
      setInfra(infraLocalPasto);
    }
  }, [pasto]);

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
      current && !FORRAGEIRA_OPTIONS_BY_TIPO[value].includes(current) ? "" : current,
    );
  };

  const handleSave = async () => {
    if (!pasto || !id) {
      showError("Pasto nao encontrado.");
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

    const now = new Date().toISOString();
    const { curral: _legacyCurral, ...infraLocalPasto } = infra;
    const op = {
      table: "pastos",
      action: "UPDATE" as const,
      record: {
        id,
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
        infraestrutura: infraLocalPasto,
        observacoes: observacoes || null,
        updated_at: now,
      },
    };

    try {
      await createGesture(pasto.fazenda_id, [op]);
      showSuccess("Pasto atualizado localmente!");
      navigate(`/pastos/${id}`);
    } catch {
      showError("Erro ao atualizar pasto.");
    }
  };

  if (!pasto) {
    return (
      <div className="space-y-6 pb-16">
        <PageIntro
          eyebrow="Estrutura do rebanho"
          title="Editar pasto"
          description="Carregando dados do pasto selecionado."
          actions={
            <Button variant="outline" onClick={() => navigate("/pastos")}>
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
        title={`Editar ${pasto.nome}`}
        description="Revise area, capacidade e infraestrutura mantendo a mesma leitura operacional usada na listagem."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(`/pastos/${id}`)}>
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
          label="Tipo de pastagem"
          value={tipoPasto}
          hint="Mantem a leitura comparativa entre areas."
          icon={<Trees className="h-4 w-4" />}
        />
        <MetricCard
          label="Area informada"
          value={areaHa || "0"}
          hint="Hectares declarados no cadastro."
          icon={<MapIcon className="h-4 w-4" />}
        />
        <MetricCard
          label="Lotes vinculados"
          value={lotesNoPasto ?? 0}
          hint="Quantidade atual de grupos alocados ao pasto."
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
          title="Identidade e capacidade"
          description="Atualize os dados principais do pasto sem sobrecarregar a superficie com elementos secundarios."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nome">Nome do pasto</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                placeholder="Ex: piquete 1, descanso, reserva..."
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de pastagem</Label>
              <Select
                value={tipoPasto}
                onValueChange={(value: TipoPastoEnum) => handleTipoPastoChange(value)}
              >
                <SelectTrigger aria-label="Tipo de pastagem">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nativo">Nativo</SelectItem>
                  <SelectItem value="cultivado">Cultivado</SelectItem>
                  <SelectItem value="integracao">ILPF / Integracao</SelectItem>
                  <SelectItem value="degradado">Degradado / Recuperacao</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="area">Area (ha)</Label>
              <Input
                id="area"
                type="number"
                step="0.01"
                value={areaHa}
                onChange={(event) => setAreaHa(event.target.value)}
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
              />
            </div>

          </div>
        </FormSection>

        <FormSection
          title="Manejo da pastagem"
          description="Escolha uma forrageira coerente com o tipo de pastagem e registre metas de campo."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cultivar">Forrageira / cultivar</Label>
              <Select
                value={forrageiraCultivar || "none"}
                onValueChange={(value) =>
                  setForrageiraCultivar(value === "none" ? "" : value)
                }
              >
                <SelectTrigger id="cultivar" aria-label="Forrageira / cultivar">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nao informado</SelectItem>
                  {getForrageiraOptions(tipoPasto, forrageiraCultivar).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="observacoes">Observacoes</Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                placeholder="Notas operacionais, limites ou contexto de uso."
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Infraestrutura"
          description="Reorganize os recursos por grupo funcional para facilitar auditoria e revisoes futuras."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-4 space-y-1">
                <p className="font-medium text-foreground">Cochos</p>
                <p className="text-sm text-muted-foreground">
                  Quantidade, tipo predominante e metragem linear.
                </p>
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
                  <Input
                    value={infra.cochos?.tipo || ""}
                    onChange={(event) =>
                      handleInfraChange("cochos", "tipo", event.target.value)
                    }
                    placeholder="Ex: madeira coberto"
                  />
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
                    onValueChange={(value) => handleInfraChange("cochos", "estado", value)}
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

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-4 space-y-1">
                <p className="font-medium text-foreground">Bebedouros</p>
                <p className="text-sm text-muted-foreground">
                  Volume de agua e condicao da estrutura disponivel.
                </p>
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
                  <Input
                    value={infra.bebedouros?.tipo || ""}
                    onChange={(event) =>
                      handleInfraChange("bebedouros", "tipo", event.target.value)
                    }
                    placeholder="Ex: australiano, concreto"
                  />
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

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-4 space-y-1">
                <p className="font-medium text-foreground">Cercas</p>
                <p className="text-sm text-muted-foreground">
                  Tipo predominante, metragem e estado da divisao do campo.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Input
                    value={infra.cerca?.tipo || ""}
                    onChange={(event) =>
                      handleInfraChange("cerca", "tipo", event.target.value)
                    }
                    placeholder="Ex: arame liso 5 fios"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={infra.cerca?.estado || "bom"}
                    onValueChange={(value) => handleInfraChange("cerca", "estado", value)}
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

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-4 space-y-1">
                <p className="font-medium text-foreground">Saleiros</p>
                <p className="text-sm text-muted-foreground">
                  Itens locais de apoio a suplementacao no piquete.
                </p>
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
                    onValueChange={(value) => handleInfraChange("saleiros", "estado", value)}
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
      </form>
    </div>
  );
};

export default PastoEditar;
