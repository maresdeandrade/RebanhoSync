import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

const PastoEditar = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Carregar pasto
  const pasto = useLiveQuery(
    () => (id ? db.state_pastos.get(id) : undefined),
    [id],
  );

  const [nome, setNome] = useState("");
  const [areaHa, setAreaHa] = useState("");
  const [capacidadeUa, setCapacidadeUa] = useState("");
  const [tipoPasto, setTipoPasto] = useState<TipoPastoEnum>("nativo");

  // State for infrastructure
  const [infra, setInfra] = useState<InfraestruturaPasto>({
    cochos: { quantidade: 0, tipo: "", estado: "bom" },
    bebedouros: { quantidade: 0, tipo: "", estado: "bom" },
    saleiros: { quantidade: 0, tipo: "", estado: "bom" },
    cerca: { tipo: "", estado: "bom", comprimento_metros: 0 },
    curral: {
      tipo: "",
      estado: "bom",
      area_metros: 0,
      possui_balanca: false,
      possui_brete: false,
    },
  });

  // Preencher formulário quando pasto carregar
  useEffect(() => {
    if (pasto) {
      setNome(pasto.nome ?? "");
      setAreaHa(pasto.area_ha?.toString() ?? "");
      setCapacidadeUa(pasto.capacidade_ua?.toString() ?? "");
      setTipoPasto(pasto.tipo_pasto ?? "nativo");
      if (pasto.infraestrutura) {
        setInfra(pasto.infraestrutura);
      }
    }
  }, [pasto]);

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

  const handleSave = async () => {
    if (!pasto || !id) {
      showError("Pasto não encontrado.");
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

    const now = new Date().toISOString();

    const op = {
      table: "pastos",
      action: "UPDATE" as const,
      record: {
        id: id,
        nome: nome.trim(),
        area_ha: parseFloat(areaHa),
        capacidade_ua: capacidadeUa ? parseFloat(capacidadeUa) : null,
        tipo_pasto: tipoPasto,
        infraestrutura: infra,
        updated_at: now,
      },
    };

    try {
      await createGesture(pasto.fazenda_id, [op]);
      showSuccess("Pasto atualizado localmente!");
      navigate(`/pastos/${id}`);
    } catch (e) {
      showError("Erro ao atualizar pasto.");
    }
  };

  if (!pasto) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/pastos")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Carregando...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/pastos/${id}`)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">Editar Pasto</h1>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="basic">Informações Básicas</TabsTrigger>
          <TabsTrigger value="infra">Infraestrutura</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle>Dados do Pasto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Pasto *</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Piquete 1, Pasto Norte..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="tipo">Tipo de Pastagem</Label>
                <Select
                  value={tipoPasto}
                  onValueChange={(v: TipoPastoEnum) => setTipoPasto(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nativo">Nativo</SelectItem>
                    <SelectItem value="cultivado">Cultivado</SelectItem>
                    <SelectItem value="integracao">ILPF/Integração</SelectItem>
                    <SelectItem value="degradado">Degradado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="infra">
          <Card>
            <CardHeader>
              <CardTitle>Infraestrutura e Benfeitorias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Cochos */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  🥣 Cochos
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      value={infra.cochos?.quantidade || 0}
                      onChange={(e) =>
                        handleInfraChange(
                          "cochos",
                          "quantidade",
                          parseInt(e.target.value)
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select
                      value={infra.cochos?.estado || "bom"}
                      onValueChange={(v) =>
                        handleInfraChange("cochos", "estado", v)
                      }
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
                  <div className="space-y-2">
                    <Label>Metragem total (m)</Label>
                    <Input
                      type="number"
                      value={infra.cochos?.capacidade || 0}
                      onChange={(e) =>
                        handleInfraChange(
                          "cochos",
                          "capacidade",
                          parseFloat(e.target.value)
                        )
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Bebedouros */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  💧 Bebedouros
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      value={infra.bebedouros?.quantidade || 0}
                      onChange={(e) =>
                        handleInfraChange(
                          "bebedouros",
                          "quantidade",
                          parseInt(e.target.value)
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Input
                      value={infra.bebedouros?.tipo || ""}
                      onChange={(e) =>
                        handleInfraChange("bebedouros", "tipo", e.target.value)
                      }
                      placeholder="Ex: Australiano, Concreto..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select
                      value={infra.bebedouros?.estado || "bom"}
                      onValueChange={(v) =>
                        handleInfraChange("bebedouros", "estado", v)
                      }
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
                </div>
              </div>

              {/* Cerca */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  🚧 Cerca
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Cerca</Label>
                    <Input
                      value={infra.cerca?.tipo || ""}
                      onChange={(e) =>
                        handleInfraChange("cerca", "tipo", e.target.value)
                      }
                      placeholder="Ex: Arame Liso 5 fios, Elétrica..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado Geral</Label>
                    <Select
                      value={infra.cerca?.estado || "bom"}
                      onValueChange={(v) =>
                        handleInfraChange("cerca", "estado", v)
                      }
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
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Button onClick={handleSave} className="w-full">
        <Save className="h-4 w-4 mr-2" />
        Salvar Alterações
      </Button>
    </div>
  );
};

export default PastoEditar;
