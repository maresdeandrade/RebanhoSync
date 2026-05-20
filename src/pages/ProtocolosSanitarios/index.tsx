import { ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
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
      <div className="container mx-auto space-y-5 pb-10">
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
    <div className="container mx-auto space-y-5 pb-10">
      <PageIntro
        eyebrow="Sanitário"
        title="Protocolos"
        meta={
          <>
            {!canManageProtocols ? (
              <StatusBadge tone="neutral">Somente leitura</StatusBadge>
            ) : null}
            {isRefreshing ? (
              <StatusBadge tone="info">Atualizando</StatusBadge>
            ) : null}
          </>
        }
        actions={
          <>
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
            Aplicar oficial
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate("/agenda?dominio=sanitario")}
          >
            Agenda
          </Button>
          </>
        }
      />

      {isRefreshing ? (
        null
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


