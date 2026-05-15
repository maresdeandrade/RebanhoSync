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
  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  };
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
          Regras sanitarias, protocolos e verificacoes da fazenda.
        </p>
        {!canManageProtocols ? (
          <p className="text-sm text-muted-foreground">Somente leitura.</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => scrollToSection("protocolos-gerenciar")}
            disabled={!canManageProtocols}
          >
            Gerenciar protocolos
          </Button>
          <Button
            variant="outline"
            onClick={() => scrollToSection("protocolos-gerenciar")}
            disabled={!canManageProtocols}
          >
            Criar protocolo
          </Button>
          <Button onClick={() => scrollToSection("protocolos-aplicar")}>
            Aplicar protocolo
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate("/agenda?dominio=sanitario")}
          >
            Voltar para agenda
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
        <EmptyState icon={ShieldCheck} title="Carregando protocolos" />
      ) : null}

      {!isLoading ? (
        <div id="protocolos-aplicar">
          <OfficialSanitaryPackManager
            activeFarmId={activeFarmId}
            canManage={canManageProtocols}
          />
        </div>
      ) : null}

      {!isLoading ? (
        <RegulatoryOverlayManager
          activeFarmId={activeFarmId}
          canManage={canManageProtocols}
        />
      ) : null}

      {!isLoading ? (
        <div id="protocolos-gerenciar">
          <FarmProtocolManager
            activeFarmId={activeFarmId}
            farmExperienceMode={farmExperienceMode}
            catalogProducts={catalogProducts}
            protocols={protocolosExistentes}
            protocolItems={protocolosItensExistentes}
            canManage={canManageProtocols}
          />
        </div>
      ) : null}
    </div>
  );
};

export default ProtocolosSanitarios;
