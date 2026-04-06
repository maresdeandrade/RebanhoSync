import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { createGesture } from "@/lib/offline/ops";
import { getActiveFarmId } from "@/lib/storage";
import { TipoPastoEnum, InfraestruturaPasto } from "@/lib/offline/types";
import { showSuccess, showError } from "@/utils/toast";

const INFRA_STATUS = [
  { value: "otimo", label: "Otimo" },
  { value: "bom", label: "Bom" },
  { value: "regular", label: "Regular" },
  { value: "ruim", label: "Ruim" },
] as const;

const PastoNovo = () => {
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [areaHa, setAreaHa] = useState("");
  const [capacidadeUa, setCapacidadeUa] = useState("");
  const [tipoPasto, setTipoPasto] = useState<TipoPastoEnum>("nativo");
  const [observacoes, setObservacoes] = useState("");
  const [infra, setInfra] = useState<InfraestruturaPasto>({
    cochos: { quantidade: 0, tipo: "madeira", capacidade: 0, estado: "bom" },
    bebedouros: { quantidade: 0, tipo: "natural", capacidade: 0, estado: "bom" },
    saleiros: { quantidade: 0, tipo: "coberto", capacidade: 0, estado: "bom" },
    cerca: { tipo: "arame_liso", comprimento_metros: 0, estado: "bom" },
    curral: {
      area_metros: 0,
      possui_balanca: false,
      possui_brete: false,
      estado: "bom",
    },
  });

  const activeFazendaId = getActiveFarmId();

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

  const handleSave = async () => {
    if (!activeFazendaId) {
      showError("Fazenda nao identificada.");
      return;
    }

    if (!nome.trim()) {
      showError("Nome do pasto e obrigatorio.");
      return;
    }

    if (!areaHa || Number.parseFloat(areaHa) <= 0) {
      showError("Area (ha) e obrigatoria e deve ser maior que zero.");
      return;
    }

    const pastoId = crypto.randomUUID();
    const now = new Date().toISOString();
    const op = {
      table: "pastos",
      action: "INSERT" as const,
      record: {
        id: pastoId,
        fazenda_id: activeFazendaId,
        nome: nome.trim(),
        area_ha: Number.parseFloat(areaHa),
        capacidade_ua: capacidadeUa ? Number.parseFloat(capacidadeUa) : null,
        tipo_pasto: tipoPasto,
        infraestrutura: infra,
        observacoes: observacoes || null,
        payload: {},
        created_at: now,
        updated_at: now,
      },
    };

    try {
      await createGesture(activeFazendaId, [op]);
      showSuccess("Pasto cadastrado com sucesso!");
      navigate("/pastos");
    } catch (error) {
      console.error(error);
      showError("Erro ao cadastrar pasto. Tente novamente.");
    }
  };

  return (
    <div className="space-y-6 pb-16">
      <PageIntro
        eyebrow="Estrutura do rebanho"
        title="Novo pasto"
        description="Cadastre area, capacidade e infraestrutura em blocos objetivos, sem transformar a tela em planilha."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/pastos")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Salvar pasto
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Tipo de pastagem"
          value={tipoPasto}
          hint="Usado para leitura operacional e comparacao entre areas."
          icon={<Trees className="h-4 w-4" />}
        />
        <MetricCard
          label="Area informada"
          value={areaHa || "0"}
          hint="Hectares cadastrados para este pasto."
          icon={<MapIcon className="h-4 w-4" />}
        />
        <MetricCard
          label="Capacidade declarada"
          value={capacidadeUa || "Nao informada"}
          hint="UA de referencia para lotacao."
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
          description="Campos principais para localizar o pasto, entender sua area e registrar a capacidade alvo."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nome">Nome do pasto</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                placeholder="Ex: piquete 1, reserva norte, descanso..."
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de pastagem</Label>
              <Select
                value={tipoPasto}
                onValueChange={(value: TipoPastoEnum) => setTipoPasto(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
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
                placeholder="Ex: 10.5"
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
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="observacoes">Observacoes</Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(event) => setObservacoes(event.target.value)}
                placeholder="Informacoes de manejo, limitacoes ou notas do campo."
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Infraestrutura"
          description="Agrupe benfeitorias por bloco para manter o cadastro legivel e facilitar revisoes futuras."
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
                  <Select
                    value={infra.cochos?.tipo || "madeira"}
                    onValueChange={(value) => handleInfraChange("cochos", "tipo", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="madeira">Madeira coberto</SelectItem>
                      <SelectItem value="plastico">Plastico / tambor</SelectItem>
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
                  Registre a estrutura que sustenta disponibilidade de agua.
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

            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="mb-4 space-y-1">
                <p className="font-medium text-foreground">Cercas</p>
                <p className="text-sm text-muted-foreground">
                  Tipo predominante, estado e metragem de referencia.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tipo predominante</Label>
                  <Select
                    value={infra.cerca?.tipo || "arame_liso"}
                    onValueChange={(value) => handleInfraChange("cerca", "tipo", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="arame_liso">Arame liso</SelectItem>
                      <SelectItem value="arame_farpado">Arame farpado</SelectItem>
                      <SelectItem value="eletrica">Eletrica</SelectItem>
                    </SelectContent>
                  </Select>
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
                <p className="font-medium text-foreground">Saleiro e curral</p>
                <p className="text-sm text-muted-foreground">
                  Itens de apoio ao manejo e infraestrutura de contenção.
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
                  <Label>Estado do curral</Label>
                  <Select
                    value={infra.curral?.estado || "bom"}
                    onValueChange={(value) => handleInfraChange("curral", "estado", value)}
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
                  <Label>Possui brete</Label>
                  <Select
                    value={infra.curral?.possui_brete ? "sim" : "nao"}
                    onValueChange={(value) =>
                      handleInfraChange("curral", "possui_brete", value === "sim")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Nao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Possui balanca</Label>
                  <Select
                    value={infra.curral?.possui_balanca ? "sim" : "nao"}
                    onValueChange={(value) =>
                      handleInfraChange("curral", "possui_balanca", value === "sim")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Nao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </FormSection>
      </form>
    </div>
  );
};

export default PastoNovo;
