import { ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { FarmProtocolManager } from "@/components/sanitario/FarmProtocolManager";
import { OfficialSanitaryPackManager } from "@/components/sanitario/OfficialSanitaryPackManager";
import { RegulatoryOverlayManager } from "@/components/sanitario/RegulatoryOverlayManager";
import { useAuth } from "@/hooks/useAuth";
import { useProtocolosData } from "@/pages/ProtocolosSanitarios/helpers/useProtocolosData";

const ProtocolosSanitarios = () => {
  const navigate = useNavigate();
  const { activeFarmId, farmExperienceMode, role } = useAuth();
  const canManageProtocols = role === "manager" || role === "owner";
  const {
    catalogProducts,
    protocolosExistentes,
    protocolosItensExistentes,
    isRefreshing,
    refreshError,
    isLoading,
  } = useProtocolosData({ activeFarmId });

  if (!activeFarmId) {
    return (
      <div className="container mx-auto space-y-6 pb-10">
        <EmptyState
          icon={ShieldCheck}
          title="Fazenda nao selecionada"
          description="Selecione uma fazenda para abrir os protocolos e o overlay sanitario."
          action={{
            label: "Selecionar fazenda",
            onClick: () => navigate("/select-fazenda"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 pb-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">
            Protocolos Sanitarios
          </h1>
        </div>
        <p className="max-w-3xl text-muted-foreground">
          Estrutura sanitaria animal-centric com tres camadas claras. Pack
          oficial = o que sua fazenda precisa cumprir. Template canonico =
          modelos padrao recomendados pelo sistema. Customizado = como sua
          fazenda escolhe operar sem recriar, em paralelo, o mesmo tronco
          obrigatorio ja coberto pelo pack oficial.
        </p>
        {!canManageProtocols ? (
          <p className="text-sm text-muted-foreground">
            Seu perfil esta em modo leitura para protocolos. Edicao estrutural e
            liberada para manager e owner.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/agenda")}>
            Abrir agenda
          </Button>
          <Button onClick={() => navigate("/registrar?dominio=sanitario")}>
            Abrir registro
          </Button>
        </div>
      </div>

      {isRefreshing ? (
        <div className="rounded-lg border border-info/20 bg-info/5 p-3 text-sm text-muted-foreground">
          Atualizando dados locais de protocolos...
        </div>
      ) : null}
      {refreshError ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {refreshError}
        </div>
      ) : null}
      {isLoading ? (
        <EmptyState
          icon={ShieldCheck}
          title="Carregando protocolos"
          description="Estamos preparando o catalogo e as configuracoes da fazenda."
        />
      ) : null}

      {!isLoading ? (
        <OfficialSanitaryPackManager
          activeFarmId={activeFarmId}
          canManage={canManageProtocols}
        />
      ) : null}

      {!isLoading ? (
        <RegulatoryOverlayManager
          activeFarmId={activeFarmId}
          canManage={canManageProtocols}
        />
      ) : null}

      {!isLoading ? (
        <FarmProtocolManager
          activeFarmId={activeFarmId}
          farmExperienceMode={farmExperienceMode}
          catalogProducts={catalogProducts}
          protocols={protocolosExistentes}
          protocolItems={protocolosItensExistentes}
          canManage={canManageProtocols}
        />
      ) : null}
    </div>
  );
};

export default ProtocolosSanitarios;
