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
  const [observacoes, setObservacoes] = useState("");
  const [infra, setInfra] = useState<InfraestruturaPasto>({
    cochos: { quantidade: 0, tipo: "", estado: "bom" },
    bebedouros: { quantidade: 0, tipo: "", estado: "bom" },
    saleiros: { quantidade: 0, tipo: "", estado: "bom" },
    cerca: { tipo: "", estado: "bom", comprimento_metros: 0 },
    curral: {
      area_metros: 0,
      possui_balanca: false,
      possui_brete: false,
      estado: "bom",
    },
  });

  useEffect(() => {
    if (!pasto) return;

    setNome(pasto.nome ?? "");
    setAreaHa(pasto.area_ha?.toString() ?? "");
    setCapacidadeUa(pasto.capacidade_ua?.toString() ?? "");
    setTipoPasto(pasto.tipo_pasto ?? "nativo");
    setObservacoes(pasto.observacoes ?? "");
    if (pasto.infraestrutura) {
      setInfra(pasto.infraestrutura);
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

  const handleSave = async () => {
    if (!pasto || !id) {
      showError("Pasto nao encontrado.");
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

    const now = new Date().toISOString();
    const op = {
      table: "pastos",
      action: "UPDATE" as const,
      record: {
        id,
        nome: nome.trim(),
        area_ha: Number.parseFloat(areaHa),
        capacidade_ua: capacidadeUa ? Number.parseFloat(capacidadeUa) : null,
        tipo_pasto: tipoPasto,
        infraestrutura: infra,
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
                onValueChange={(value: TipoPastoEnum) => setTipoPasto(value)}
              >
                <SelectTrigger>
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
                <p className="font-medium text-foreground">Saleiro e curral</p>
                <p className="text-sm text-muted-foreground">
                  Estruturas de apoio para suplementacao e manejo contido.
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

export default PastoEditar;
