import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showSuccess, showError } from "@/utils/toast";
import { ChevronLeft, Save } from "lucide-react";
import { TipoPastoEnum, InfraestruturaPasto } from "@/lib/offline/types";
import { getActiveFarmId } from "@/lib/storage";

const PastoNovo = () => {
  const navigate = useNavigate();

  // Basic Info
  const [nome, setNome] = useState("");
  const [areaHa, setAreaHa] = useState("");
  const [capacidadeUa, setCapacidadeUa] = useState("");
  const [tipoPasto, setTipoPasto] = useState<TipoPastoEnum>("nativo");
  const [observacoes, setObservacoes] = useState("");

  // Infraestrutura
  const [infra, setInfra] = useState<InfraestruturaPasto>({
    cochos: { quantidade: 0, tipo: "madeira", capacidade: 0 },
    bebedouros: { quantidade: 0, tipo: "natural", capacidade: 0 },
    saleiros: { quantidade: 0, tipo: "coberto", capacidade: 0 },
    cerca: { tipo: "arame_liso", comprimento_metros: 0, estado: "bom" },
    curral: { area_metros: 0, possui_balanca: false, possui_brete: false },
  });

  const handleInfraChange = (
    category: keyof InfraestruturaPasto,
    field: string,
    value: string | number | boolean
  ) => {
    setInfra((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value,
      },
    }));
  };

  const activeFazendaId = getActiveFarmId();

  const handleSave = async () => {
    if (!activeFazendaId) {
      showError("Fazenda não identificada.");
      return;
    }

    if (!nome.trim()) {
      showError("Nome do pasto é obrigatório.");
      return;
    }

    if (!areaHa || parseFloat(areaHa) <= 0) {
      showError("Área (ha) é obrigatória e deve ser maior que zero.");
      return;
    }

    const pasto_id = crypto.randomUUID();
    const now = new Date().toISOString();

    const op = {
      table: "pastos",
      action: "INSERT" as const,
      record: {
        id: pasto_id,
        fazenda_id: activeFazendaId,
        nome: nome.trim(),
        area_ha: parseFloat(areaHa),
        capacidade_ua: capacidadeUa ? parseFloat(capacidadeUa) : null,
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
    } catch (e) {
      console.error(e);
      showError("Erro ao cadastrar pasto. Tente novamente.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pastos")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Novo Pasto</h1>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
          <TabsTrigger value="infra">Infraestrutura</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Informações Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Pasto *</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Piquete 1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo de Pastagem</Label>
                  <Select
                    value={tipoPasto}
                    onValueChange={(v: TipoPastoEnum) => setTipoPasto(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nativo">Nativo</SelectItem>
                      <SelectItem value="cultivado">Cultivado</SelectItem>
                      <SelectItem value="integracao">ILPF / Integração</SelectItem>
                      <SelectItem value="degradado">Degradado / Em Recuperação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="area">Área (ha) *</Label>
                  <Input
                    id="area"
                    type="number"
                    step="0.01"
                    value={areaHa}
                    onChange={(e) => setAreaHa(e.target.value)}
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
                    onChange={(e) => setCapacidadeUa(e.target.value)}
                    placeholder="Ex: 25.0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="obs">Observações</Label>
                <Input
                  id="obs"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Detalhes adicionais..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="infra" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* COCHOS */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cochos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Qtd</Label>
                    <Input
                      type="number"
                      value={infra.cochos?.quantidade}
                      onChange={(e) =>
                        handleInfraChange("cochos", "quantidade", parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="flex-[2] space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select
                      value={infra.cochos?.tipo}
                      onValueChange={(v) => handleInfraChange("cochos", "tipo", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="madeira">Madeira coberto</SelectItem>
                        <SelectItem value="plastico">Plástico/Tambor</SelectItem>
                        <SelectItem value="concreto">Concreto</SelectItem>
                        <SelectItem value="bags">Bags/Móvel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Capacidade Total (m lineares)</Label>
                  <Input
                    type="number"
                    value={infra.cochos?.capacidade}
                    onChange={(e) =>
                      handleInfraChange("cochos", "capacidade", parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* BEBEDOUROS */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bebedouros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Qtd</Label>
                    <Input
                      type="number"
                      value={infra.bebedouros?.quantidade}
                      onChange={(e) =>
                        handleInfraChange("bebedouros", "quantidade", parseInt(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="flex-[2] space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select
                      value={infra.bebedouros?.tipo}
                      onValueChange={(v) => handleInfraChange("bebedouros", "tipo", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="natural">Natural (Açude/Rio)</SelectItem>
                        <SelectItem value="artificial">Artificial (Pileta)</SelectItem>
                        <SelectItem value="tanque">Tanque Rede</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Capacidade (Litros)</Label>
                  <Input
                    type="number"
                    value={infra.bebedouros?.capacidade}
                    onChange={(e) =>
                      handleInfraChange("bebedouros", "capacidade", parseFloat(e.target.value) || 0)
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* CERCAS */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cercas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo Predominante</Label>
                  <Select
                    value={infra.cerca?.tipo}
                    onValueChange={(v) => handleInfraChange("cerca", "tipo", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="arame_liso">Arame Liso</SelectItem>
                      <SelectItem value="arame_farpado">Arame Farpado</SelectItem>
                      <SelectItem value="eletrica">Elétrica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Estado</Label>
                    <Select
                      value={infra.cerca?.estado}
                      onValueChange={(v) => handleInfraChange("cerca", "estado", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="otimo">Ótimo</SelectItem>
                        <SelectItem value="bom">Bom</SelectItem>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="ruim">Ruim</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Metragem (m)</Label>
                    <Input
                      type="number"
                      value={infra.cerca?.comprimento_metros}
                      onChange={(e) =>
                        handleInfraChange("cerca", "comprimento_metros", parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
             {/* CURRAL / SALEIRO */}
             <Card>
              <CardHeader>
                <CardTitle className="text-base">Outros (Saleiro/Curral)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-4 items-end">
                   <div className="flex-1 space-y-1">
                    <Label className="text-xs">Saleiros (Qtd)</Label>
                    <Input
                      type="number"
                      value={infra.saleiros?.quantidade}
                      onChange={(e) =>
                        handleInfraChange("saleiros", "quantidade", parseInt(e.target.value) || 0)
                      }
                    />
                   </div>
                   <div className="flex-1 space-y-1">
                      <Label className="text-xs">Possui Curral/Brete?</Label>
                      <Select
                        value={infra.curral?.possui_brete ? "sim" : "nao"}
                        onValueChange={(v) => handleInfraChange("curral", "possui_brete", v === "sim")}
                      >
                         <SelectTrigger><SelectValue /></SelectTrigger>
                         <SelectContent>
                            <SelectItem value="sim">Sim</SelectItem>
                            <SelectItem value="nao">Não</SelectItem>
                         </SelectContent>
                      </Select>
                   </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="pt-4">
        <Button onClick={handleSave} className="w-full text-lg h-12">
          <Save className="h-5 w-5 mr-2" />
          Salvar Pasto
        </Button>
      </div>
    </div>
  );
};

export default PastoNovo;
